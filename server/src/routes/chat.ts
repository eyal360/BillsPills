import { Router, Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { logger } from '../lib/logger';
import { getPromptTemplate } from '../lib/prompts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';

// File Upload Configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 } // 5MB limit, max 3 files per request
});

// Protect against DDoS & abuse
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // Max 10 uploads per user IP per minute
  message: { error: 'Too many files uploaded, please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const chatRouter = Router();

// Helper to securely validate file types natively via Magic Bytes
function isAllowedFile(buffer: Buffer, mimetype: string): boolean {
  const hex = buffer.toString('hex', 0, 4).toUpperCase();
  if (mimetype === 'application/pdf' && hex.startsWith('25504446')) return true;
  if ((mimetype === 'image/jpeg' || mimetype === 'image/jpg') && hex.startsWith('FFD8FF')) return true;
  if (mimetype === 'image/png' && hex.startsWith('89504E47')) return true;
  if (mimetype === 'text/plain' || mimetype === 'text/csv') return true; 
  return false;
}

chatRouter.post('/upload', requireAuth, uploadRateLimiter, upload.array('files', 3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  const flashModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2-preview';
  const rawEmbeddingModel = embeddingModel.replace(/^models\//, '');
  
  if (!apiKey) {
    res.status(500).json({ error: 'AI not configured' });
    return;
  }

  try {
    const results = await Promise.all(files.map(async (file) => {
      if (!isAllowedFile(file.buffer, file.mimetype)) {
        throw new Error(`סוג הקובץ אינו נתמך או לא חוקי: ${file.originalname}`);
      }

      // 1. Extract content/metadata using Gemini Flash
      const parts: any[] = [{ text: "Extract any relevant text, details, or data from this document so it can be used for searching. Be concise." }];
      
      if (file.mimetype === 'text/plain' || file.mimetype === 'text/csv') {
        parts.push({ text: `\n\n[File Content: ${file.originalname}]\n${file.buffer.toString('utf8')}` });
      } else {
        parts.push({ 
          inline_data: { mime_type: file.mimetype, data: file.buffer.toString('base64') }
        });
      }

      const summarizeRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${flashModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts }] })
      });

      if (!summarizeRes.ok) {
        throw new Error(`Failed to extract data from ${file.originalname}`);
      }
      
      const data: any = await summarizeRes.json();
      const extractedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!extractedText.trim()) {
         return { filename: file.originalname, status: 'skipped (no text)' };
      }

      // 2. Embed using configured Embedding Model
      const isPreview = rawEmbeddingModel.includes('preview');
      const textToEmbed = isPreview ? `title: none | text: ${extractedText}` : extractedText;

      const embedPayload: any = { content: { parts: [{ text: textToEmbed }] } };

      if (isPreview) {
        embedPayload.outputDimensionality = 768; // Crucial match for DB vector
      } else {
        embedPayload.taskType = 'RETRIEVAL_DOCUMENT';
      }

      const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/${rawEmbeddingModel}:embedContent?key=${apiKey}`;
      const embedRes = await fetch(embedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embedPayload)
      });

      if (!embedRes.ok) {
        throw new Error(`Embedding failed for ${file.originalname}`);
      }

      const embedData: any = await embedRes.json();
      const embedding = embedData.embedding.values;

      // 3. Save directly to dynamic chat knowledgebase
      const { error: dbErr } = await supabase.from('chat_documents').insert({
        user_id: req.user!.id,
        filename: file.originalname,
        content: extractedText,
        embedding
      });

      if (dbErr) throw dbErr;
      return { filename: file.originalname, status: 'success' };
    }));

    res.json({ success: true, processed: results });
  } catch (err: any) {
    logger.error('Chat file upload failed:', err);
    res.status(500).json({ error: err.message || 'Upload processing failed' });
  }
});

chatRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { message, history } = req.body;
  const isAdmin = req.user!.role === 'admin';
  const apiKey = process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    res.status(500).json({ error: 'AI not configured' });
    return;
  }

  try {
    // Gather context data
    let contextData = '';

    if (isAdmin) {
      // Admins can see all data
      const { data: allBills } = await supabase
        .from('bills')
        .select('*, properties(name, user_id, profiles(full_name, email))')
        .order('created_at', { ascending: false })
        .limit(100);

      contextData = `נתוני מערכת כלל (מנהל): ${JSON.stringify(allBills)}`;
    } else {
      // Users see only their data (owned and shared)
      const userEmail = req.user!.email?.toLowerCase();
      
      const [ownedRes, sharesRes] = await Promise.all([
        supabase.from('properties').select('*, bills(*)').eq('user_id', req.user!.id),
        supabase.from('property_shares').select('property_id').eq('email', userEmail)
      ]);

      const sharedPropertyIds = sharesRes.data?.map((s: any) => s.property_id) || [];
      let allAccessibleProperties = ownedRes.data || [];

      if (sharedPropertyIds.length > 0) {
        const { data: sharedProps } = await supabase
          .from('properties')
          .select('*, bills(*)')
          .in('id', sharedPropertyIds);
        
        if (sharedProps) {
          const ownedIds = new Set(allAccessibleProperties.map((p: any) => p.id));
          const filteredShared = sharedProps.filter((p: any) => !ownedIds.has(p.id));
          allAccessibleProperties = [...allAccessibleProperties, ...filteredShared];
        }
      }

      contextData = `נתוני הנכסים שלי (כולל משותפים): ${JSON.stringify(allAccessibleProperties)}`;
      
      // Store accessible IDs for RAG filter
      (req as any).accessiblePropertyIds = allAccessibleProperties.map((p: any) => p.id);
    }

    // --- RAG (Retrieval-Augmented Generation) ---
    let ragContext = '';
    try {
      if (!isAdmin) {
        const rawEmbeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'models/gemini-embedding-2-preview';
        // Strip 'models/' prefix if present
        const embeddingModelName = rawEmbeddingModel.replace(/^models\//, '');
        
        const isPreview = embeddingModelName.includes('preview');
        const textToEmbed = isPreview ? `task: question answering | query: ${message}` : message;

        const payload: any = {
          content: { parts: [{ text: textToEmbed }] }
        };

        if (isPreview) {
          payload.outputDimensionality = 768; // Crucial: match DB vector(768) size
        } else {
          payload.taskType = 'RETRIEVAL_QUERY';
        }

        const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModelName}:embedContent?key=${apiKey}`;
        const embedRes = await fetch(embedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!embedRes.ok) {
          throw new Error(`Embedding failed: ${embedRes.statusText}`);
        }

        const embedData: any = await embedRes.json();
        const queryEmbedding = embedData.embedding.values;

        // Perform similarity search using v2 (by property_ids)
        const accessiblePropertyIds = (req as any).accessiblePropertyIds || [];
        
        if (accessiblePropertyIds.length === 0) {
          throw new Error('No accessible properties found for RAG');
        }

        const [billsRes, chatDocsRes] = await Promise.all([
          supabase.rpc('match_bill_documents_v2', {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: 5,
            p_property_ids: accessiblePropertyIds
          }),
          supabase.rpc('match_chat_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: 3,
            p_user_id: req.user!.id
          })
        ]);

        const matchedBills = billsRes.data;
        const matchedChatDocs = chatDocsRes.data;

        if ((matchedBills && matchedBills.length > 0) || (matchedChatDocs && matchedChatDocs.length > 0)) {
          ragContext = `\n\nמסמכי מקור (RAG) רלוונטיים (מתוך נתוני המשתמש ומסמכים שהועלו):\n`;
          if (matchedBills && matchedBills.length > 0) {
            ragContext += matchedBills.map((b: any) => `- מזהה חשבון ${b.bill_id}: ${b.content}`).join('\n') + '\n';
          }
          if (matchedChatDocs && matchedChatDocs.length > 0) {
            ragContext += '\n*מסמכים מצורפים לשיחה:*\n' + 
              matchedChatDocs.map((c: any) => `- מסמך [${c.filename}]: ${c.content}`).join('\n');
          }
        }
      }
    } catch (ragErr) {
      logger.warn('RAG processing failed, continuing without vector context', ragErr);
    }

    const templateName = isAdmin ? 'admin_query' : 'assistant_system';
    const systemPrompt = await getPromptTemplate(templateName, {
      context_data: contextData + ragContext
    });

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    // --- Chat History Memory ---
    const { data: dbHistory } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .limit(10);
      
    let chatHistory: any[] = [];
    if (dbHistory && dbHistory.length > 0) {
      chatHistory = dbHistory.reverse().map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
    } else {
      chatHistory = (history || []).map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
    }

    // Gemini requirements
    while (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory.shift();
    }
    if (chatHistory.length > 10) {
      chatHistory.splice(0, chatHistory.length - 10);
    }
    if (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory.shift();
    }

    const strictInstructions = `\n\nCRITICAL INSTRUCTIONS:
1. FOCUS MAINLY ON THE USER'S NEWEST MESSAGE. Address previous topics or uploaded RAG documents ONLY if the current question explicitly asks for it or strictly requires it to be answered properly. Keep unrelated older context completely out of the new reply.
2. If the user writes a finishing sentence or greeting like "תודה", "להתראות", "ביי", respond politely and uniquely. Assure them you are always here if they need anything else, doing so in a natural, friendly, non-robotic Hebrew tone.
3. YOU ARE A STRICTLY READ-ONLY ASSISTANT WITHOUT ANY ACTION TOOLS. You CANNOT create bills, properties, or mutate data. NEVER output tool activation codes, JSON, or any commands meant to trigger an agent (e.g. \`tool_code: {}\`). If a user asks you to add a bill or perform an action, politely inform them that you can only answer questions and they must use the app's interface to add/edit data.`;

    // Direct REST call for chat
    const chatUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const chatResponse = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          ...chatHistory,
          { role: 'user', parts: [{ text: message }] }
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt + strictInstructions }]
        }
      })
    });

    if (!chatResponse.ok) {
      const errorData = await chatResponse.json();
      throw new Error(`Chat request failed: ${chatResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const chatData: any = await chatResponse.json();
    const reply = chatData?.candidates?.[0]?.content?.parts?.[0]?.text || 'מצטער, לא הצלחתי לעבד את הבקשה.';

    // Save strictly valid pairs asynchronously
    Promise.all([
      supabase.from('chat_history').insert({ user_id: req.user!.id, role: 'user', content: message }),
      supabase.from('chat_history').insert({ user_id: req.user!.id, role: 'assistant', content: reply })
    ]).catch(dbErr => logger.error('Failed to save chat history', dbErr));

    res.json({ reply });
  } catch (err: any) {
    logger.error('Chat error:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Chat failed — ' + (err.message || '') });
  }
});

chatRouter.get('/wait-message', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) { res.json({ reply: 'מעבד את הקבצים שהעלית, רגע קט...' }); return; }

    const chatRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Generate a short wait message saying you are processing the attached files.' }] }],
        systemInstruction: {
          parts: [{ text: 'You are a virtual assistant inside a bills tracking app. Formulate a very short, friendly and unique single sentence in Hebrew telling the user to bear with you while you upload and process their files. It must be unique every time to avoid sounding robotic. DO NOT use markdown.' }]
        }
      })
    });

    const data: any = await chatRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'בסדר גמור, אני מסדר את המסמכים שלך, שנייה...';
    res.json({ reply: reply.trim() });
  } catch (e) {
    res.json({ reply: 'מעלה קבצים, אנא המתן...' });
  }
});

chatRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { data: dbHistory } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: true });

    if (dbHistory && dbHistory.length > 0) {
      res.json({ messages: dbHistory });
      return;
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const apiKey = process.env.GEMINI_API_KEY || '';

    const chatRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Generate welcome message' }] }],
        systemInstruction: {
          parts: [{ text: 'You are a robotic financial assistant inside a bills tracking app. Write a very short, welcoming, and unique opening sentence in Hebrew asking the user how you can help them right now. Do not use any markdown.' }]
        }
      })
    });

    const chatData: any = await chatRes.json();
    const reply = chatData?.candidates?.[0]?.content?.parts?.[0]?.text || 'שלום! איך אוכל לעזור לך היום?';

    res.json({ messages: [{ role: 'assistant', content: reply }] });
  } catch (err) {
    logger.error('Failed fetching chat history:', err);
    res.json({ messages: [{ role: 'assistant', content: 'שלום! אני עוזר חכם לניהול חשבונות. במה אוכל לעזור?' }] });
  }
});

chatRouter.delete('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await supabase.from('chat_history').delete().eq('user_id', req.user!.id);
    
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const apiKey = process.env.GEMINI_API_KEY || '';

    const chatRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Generate reset welcome message' }] }],
        systemInstruction: {
          parts: [{ text: 'You are a robotic financial assistant inside a bills tracking app. Write a very short, positive, and unique opening sentence in Hebrew asking the user how you can help them right now, acknowledging the chat was reset. Do not use any markdown.' }]
        }
      })
    });

    const chatData: any = await chatRes.json();
    const reply = chatData?.candidates?.[0]?.content?.parts?.[0]?.text || 'היסטוריית הצ\'אט נמחקה קליל. איך אוכל לעזור לך עכשיו?';

    res.json({ message: 'reset', reply });
  } catch (err) {
    logger.error('Failed to reset chat:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

import { Router, Response } from 'express';
import { logger } from '../lib/logger';
import { getPromptTemplate } from '../lib/prompts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';

export const chatRouter = Router();

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
        const embeddingModelName = process.env.GEMINI_EMBEDDING_MODEL || 'models/gemini-embedding-2-preview';
        
        const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModelName}:embedContent?key=${apiKey}`;
        const embedRes = await fetch(embedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { parts: [{ text: message }] },
            taskType: 'RETRIEVAL_QUERY'
          })
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

        const { data: matchedBills } = await supabase.rpc('match_bill_documents_v2', {
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_count: 5,
          p_property_ids: accessiblePropertyIds
        });

        if (matchedBills && matchedBills.length > 0) {
          ragContext = `\n\nמסמכי מקור (RAG) רלוונטיים (מתוך חשבונות המשתמש):\n` + 
            matchedBills.map((b: any) => `- מזהה חשבון ${b.bill_id}: ${b.content}`).join('\n');
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
          parts: [{ text: systemPrompt }]
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

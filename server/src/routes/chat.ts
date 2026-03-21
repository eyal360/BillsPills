import { Router, Response } from 'express';
import { logger } from '../lib/logger';
import { getPromptTemplate } from '../lib/prompts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const chatRouter = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

chatRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { message, history } = req.body;
  const isAdmin = req.user!.role === 'admin';

  if (!process.env.GEMINI_API_KEY) {
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
      // Users see only their data
      const { data: properties } = await supabase
        .from('properties')
        .select('*, bills(*)')
        .eq('user_id', req.user!.id);

      contextData = `נתוני הנכסים שלי: ${JSON.stringify(properties)}`;
    }

    // --- RAG (Retrieval-Augmented Generation) ---
    // Generate an embedding for the user's current incoming message to find relevant bills
    let ragContext = '';
    try {
      if (!isAdmin) {
        // Fallback to embedding-001 which is globally available if text-embedding-004 404s
        const embeddingModelName = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
        const embeddingModel = genAI.getGenerativeModel({ model: embeddingModelName });
        const embedResult = await embeddingModel.embedContent(message);
        const queryEmbedding = embedResult.embedding.values;

        // Perform similarity search
        const { data: matchedBills } = await supabase.rpc('match_bill_documents', {
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_count: 5,
          p_user_id: req.user!.id
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
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: systemPrompt
    });

    // --- Chat History Memory ---
    // Fetch user's persistent chat history from DB instead of strictly relying on frontend
    const { data: dbHistory } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .limit(10);
      
    // Reconstruct history array properly mapping 'assistant' role for Gemini as 'model'
    let chatHistory: any[] = [];
    if (dbHistory && dbHistory.length > 0) {
      chatHistory = dbHistory.reverse().map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
    } else {
      // Fallback to client history if DB is totally empty (e.g. they just pressed the greeting bubble)
      chatHistory = (history || []).map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
    }

    // Gemini requires the history to strictly begin with the 'user' role
    while (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory.shift();
    }
    // Keep the last 10 messages max
    if (chatHistory.length > 10) {
      chatHistory.splice(0, chatHistory.length - 10);
    }
    if (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory.shift();
    }

    const chatSession = model.startChat({
      history: chatHistory,
    });

    const result = await chatSession.sendMessage(message);
    const reply = result.response.text() || 'מצטער, לא הצלחתי לעבד את הבקשה.';

    // Save strictly valid pairs asynchronously so we don't block
    Promise.all([
      supabase.from('chat_history').insert({ user_id: req.user!.id, role: 'user', content: message }),
      supabase.from('chat_history').insert({ user_id: req.user!.id, role: 'assistant', content: reply })
    ]).catch(dbErr => logger.error('Failed to save chat history', dbErr));

    res.json({ reply });
  } catch (err) {
    logger.error('Chat error:', err);
    res.status(500).json({ error: 'Chat failed' });
  }
});

chatRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { data: dbHistory } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: true }); // keep ascending for client view

    if (dbHistory && dbHistory.length > 0) {
      res.json({ messages: dbHistory });
      return;
    }

    // Generate unique short welcome message if no history
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: 'You are a robotic financial assistant inside a bills tracking app. Write a very short, welcoming, and unique opening sentence in Hebrew asking the user how you can help them right now. Do not use any markdown.'
    });

    const result = await model.generateContent('Generate welcome message');
    const reply = result.response.text() || 'שלום! איך אוכל לעזור לך היום?';

    res.json({ messages: [{ role: 'assistant', content: reply }] });
  } catch (err) {
    logger.error('Failed fetching chat history:', err);
    res.json({ messages: [{ role: 'assistant', content: 'שלום! אני עוזר חכם לניהול חשבונות. במה אוכל לעזור?' }] });
  }
});

chatRouter.delete('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await supabase.from('chat_history').delete().eq('user_id', req.user!.id);
    
    // Generate new welcome
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: 'You are a robotic financial assistant inside a bills tracking app. Write a very short, positive, and unique opening sentence in Hebrew asking the user how you can help them right now, acknowledging the chat was reset. Do not use any markdown.'
    });

    const result = await model.generateContent('Generate reset welcome message');
    const reply = result.response.text() || 'היסטוריית הצ\'אט נמחקה קליל. איך אוכל לעזור לך עכשיו?';

    res.json({ message: 'reset', reply });
  } catch (err) {
    logger.error('Failed to reset chat:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

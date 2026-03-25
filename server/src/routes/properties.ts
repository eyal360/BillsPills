import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const propertiesRouter = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// GET all properties for current user
propertiesRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

// GET single property
propertiesRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }
  res.json(data);
});

// POST create property
propertiesRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, address, description, icon } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Property name is required' });
    return;
  }

  const { data, error } = await supabase
    .from('properties')
    .insert({ name, address, description, icon, user_id: req.user!.id })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create property:', error);
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

// PUT update property
propertiesRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, address, description, icon, is_archived } = req.body;

  const { data, error } = await supabase
    .from('properties')
    .update({ 
      name, 
      address, 
      description, 
      icon, 
      is_archived,
      updated_at: new Date().toISOString() 
    })
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Property not found or unauthorized' });
    return;
  }
  res.json(data);
});

// DELETE property
propertiesRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ message: 'Property deleted' });
});

// GET bills for a property
propertiesRouter.get('/:id/bills', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // First verify property belongs to user
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single();

  if (!property) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('property_id', req.params.id)
    .order('bill_date', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

// POST add bill to property
propertiesRouter.post('/:id/bills', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single();

  if (!property) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  const { 
    bill_type, 
    amount, 
    paid_amount, 
    status, 
    image_url, 
    extracted_data, 
    billing_period_start, 
    billing_period_end,
    processing_duration_ms
  } = req.body;
  logger.info('Creating bill for property:', { id: req.params.id, body: req.body });

  const { data, error } = await supabase
    .from('bills')
    .insert({
      user_id: req.user!.id,
      property_id: req.params.id,
      bill_type,
      amount,
      paid_amount,
      status: status || 'waiting',
      image_url,
      extracted_data: extracted_data || {},
      notes: req.body.notes,
      billing_period_start,
      billing_period_end,
      processing_duration_ms
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create bill:', error);
    res.status(500).json({ error: error.message });
    return;
  }

  // Create the initial "bill created" event
  await supabase.from('bill_events').insert({
    bill_id: data.id,
    user_id: req.user!.id,
    title: 'התשלום נוצר',
    note: `סוג: ${bill_type}${amount ? ` | סכום: ₪${amount}` : ''}${paid_amount ? ` | שולם: ₪${paid_amount}` : ''}`,
  });

  // --- RAG: Generate and store embedding ---
  try {
    const embeddingModelName = process.env.GEMINI_EMBEDDING_MODEL || 'models/gemini-embedding-2-preview';
    const embeddingModel = genAI.getGenerativeModel({ model: embeddingModelName });
    
    // Create a searchable text representation of the bill
    const contentToEmbed = `סוג חשבון: ${bill_type}\nסכום: ${amount}\nנתונים שחולצו: ${JSON.stringify(extracted_data)}`;
    
    logger.info(`Generating embedding for bill ${data.id} using ${embeddingModelName}...`);
    
    const embedResult = await embeddingModel.embedContent({
      content: { role: 'user', parts: [{ text: contentToEmbed }] },
      taskType: 'RETRIEVAL_DOCUMENT' as any,
    });
    
    const embedding = embedResult.embedding.values;

    if (!embedding || embedding.length === 0) {
      throw new Error('Generated embedding is empty');
    }

    const { error: insertError } = await supabase.from('bill_documents').insert({
      bill_id: data.id,
      user_id: req.user!.id,
      content: contentToEmbed,
      embedding: embedding
    });

    if (insertError) {
      logger.error('Supabase RAG insertion error:', insertError);
    } else {
      logger.info('Successfully stored bill embedding in bill_documents table.');
    }
  } catch (ragErr: any) {
    logger.error('RAG System Failure:', {
      message: ragErr.message,
      stack: ragErr.stack,
      model: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004'
    });
  }

  res.status(201).json(data);
});

// GET events for a specific bill
propertiesRouter.get('/:propertyId/bills/:billId/events', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Verify property belongs to user
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', req.params.propertyId)
    .eq('user_id', req.user!.id)
    .single();

  if (!property) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  const { data, error } = await supabase
    .from('bill_events')
    .select('*')
    .eq('bill_id', req.params.billId)
    .order('created_at', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

// POST add a manual event to a bill
propertiesRouter.post('/:propertyId/bills/:billId/events', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', req.params.propertyId)
    .eq('user_id', req.user!.id)
    .single();

  if (!property) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  const { title, note } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Event title is required' });
    return;
  }

  const { data, error } = await supabase
    .from('bill_events')
    .insert({ bill_id: req.params.billId, user_id: req.user!.id, title, note })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

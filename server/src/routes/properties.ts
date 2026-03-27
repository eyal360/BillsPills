import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const propertiesRouter = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// GET all properties for current user (owned and shared)
propertiesRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userEmail = req.user!.email?.toLowerCase();
  
  // Fetch properties owned by user OR shared with user
  // We use a complex query or two queries if needed. Supabase JS doesn't support OR across different tables easily without RPC.
  // Using two queries for simplicity and reliability.
  
  const [ownedRes, sharesRes] = await Promise.all([
    supabase.from('properties').select('*').eq('user_id', req.user!.id),
    supabase.from('property_shares').select('property_id').eq('email', userEmail)
  ]);

  if (ownedRes.error) {
    res.status(500).json({ error: ownedRes.error.message });
    return;
  }

  const sharedPropertyIds = sharesRes.data?.map((s: any) => s.property_id) || [];
  
  let allProperties = ownedRes.data || [];
  
  if (sharedPropertyIds.length > 0) {
    const { data: sharedProps, error: sharedError } = await supabase
      .from('properties')
      .select('*')
      .in('id', sharedPropertyIds);
      
    if (!sharedError && sharedProps) {
      // Merge and avoid duplicates (though theoretically impossible with unique constraint)
      const ownedIds = new Set(allProperties.map((p: any) => p.id));
      const filteredShared = sharedProps.filter((p: any) => !ownedIds.has(p.id));
      allProperties = [...allProperties, ...filteredShared];
    }
  }

  res.json(allProperties.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
});

// GET single property
propertiesRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userEmail = req.user!.email?.toLowerCase();
  
  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  // Check access
  if (property.user_id !== req.user!.id) {
    const { data: share } = await supabase
      .from('property_shares')
      .select('id')
      .eq('property_id', req.params.id)
      .eq('email', userEmail)
      .single();
      
    if (!share) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
  }

  res.json(property);
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
  const userEmail = req.user!.email?.toLowerCase();

  // Verify access first
  const { data: property } = await supabase
    .from('properties')
    .select('user_id')
    .eq('id', req.params.id)
    .single();

  if (!property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  if (property.user_id !== req.user!.id) {
    const { data: share } = await supabase
      .from('property_shares')
      .select('id')
      .eq('property_id', req.params.id)
      .eq('email', userEmail)
      .single();

    if (!share) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
  }

  const { data: updated, error: updateError } = await supabase
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
    .select()
    .single();

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }
  res.json(updated);
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
  const userEmail = req.user!.email?.toLowerCase();
  
  // Verify access
  const { data: property } = await supabase
    .from('properties')
    .select('user_id')
    .eq('id', req.params.id)
    .single();

  if (!property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  if (property.user_id !== req.user!.id) {
    const { data: share } = await supabase
      .from('property_shares')
      .select('id')
      .eq('property_id', req.params.id)
      .eq('email', userEmail)
      .single();

    if (!share) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
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
  const userEmail = req.user!.email?.toLowerCase();

  // Verify access
  const { data: property } = await supabase
    .from('properties')
    .select('user_id')
    .eq('id', req.params.id)
    .single();

  if (!property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  if (property.user_id !== req.user!.id) {
    const { data: share } = await supabase
      .from('property_shares')
      .select('id')
      .eq('property_id', req.params.id)
      .eq('email', userEmail)
      .single();

    if (!share) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
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
      property_id: req.params.id,
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

// GET events for a specific bill in a property
propertiesRouter.get('/:id/bills/:billId/events', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userEmail = req.user!.email?.toLowerCase();
  const { id: propertyId, billId } = req.params;

  // Verify property access
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('user_id')
    .eq('id', propertyId)
    .single();

  if (propError || !property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  // Check shared access
  if (property.user_id !== req.user!.id) {
    const { data: share } = await supabase
      .from('property_shares')
      .select('id')
      .eq('property_id', propertyId)
      .eq('email', userEmail)
      .single();

    if (!share) {
      res.status(403).json({ error: 'Unauthorized property access' });
      return;
    }
  }

  // Verify bill belongs to this property
  const { data: bill, error: billError } = await supabase
    .from('bills')
    .select('id')
    .eq('id', billId)
    .eq('property_id', propertyId)
    .single();

  if (billError || !bill) {
    res.status(404).json({ error: 'Bill not found in this property' });
    return;
  }

  // Fetch events
  const { data: events, error: eventsError } = await supabase
    .from('bill_events')
    .select('*')
    .eq('bill_id', billId)
    .order('created_at', { ascending: true });

  if (eventsError) {
    res.status(500).json({ error: eventsError.message });
    return;
  }

  res.json(events);
});

// GET shares for a property
propertiesRouter.get('/:id/shares', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userEmail = req.user!.email?.toLowerCase();

  // Any authorized user (owner or shared) can see who else has access
  // Actually usually only owner manages shares, but user said "any user can share"
  // So I'll allow viewing shares for anyone with access.
  
  const { data: property } = await supabase
    .from('properties')
    .select('user_id')
    .eq('id', req.params.id)
    .single();

  if (!property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  // Check access
  if (property.user_id !== req.user!.id) {
    const { data: share } = await supabase
      .from('property_shares')
      .select('id')
      .eq('property_id', req.params.id)
      .eq('email', userEmail)
      .single();

    if (!share) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
  }

  const { data, error } = await supabase
    .from('property_shares')
    .select('*')
    .eq('property_id', req.params.id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  
  res.json(data);
});

// POST update shares for a property
propertiesRouter.post('/:id/shares', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { emails } = req.body; // Array of emails
  const userEmail = req.user!.email?.toLowerCase();

  if (!Array.isArray(emails)) {
    res.status(400).json({ error: 'Emails array is required' });
    return;
  }

  // Verify access
  const { data: property } = await supabase
    .from('properties')
    .select('user_id')
    .eq('id', req.params.id)
    .single();

  if (!property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  // ONLY the property creator can manage shares
  if (property.user_id !== req.user!.id) {
    res.status(403).json({ error: 'Only the property owner can manage shares' });
    return;
  }

  // Normalize emails
  const normalizedEmails = emails.map(e => e.trim().toLowerCase()).filter(e => e.length > 0);

  // 1. Get current shares
  const { data: currentShares } = await supabase
    .from('property_shares')
    .select('email')
    .eq('property_id', req.params.id);

  const currentEmails = currentShares?.map((s: any) => s.email) || [];

  // 2. Identify new shares and removed shares
  const emailsToAdd = normalizedEmails.filter((e: string) => !currentEmails.includes(e));
  const emailsToRemove = currentEmails.filter((e: string) => !normalizedEmails.includes(e));

  // 3. Apply changes
  const actions = [];
  
  if (emailsToAdd.length > 0) {
    actions.push(supabase.from('property_shares').insert(
      emailsToAdd.map((email: string) => ({
        property_id: req.params.id,
        email,
        shared_by: req.user!.id
      }))
    ));
  }

  if (emailsToRemove.length > 0) {
    actions.push(supabase.from('property_shares').delete().eq('property_id', req.params.id).in('email', emailsToRemove));
  }

  const results = await Promise.all(actions);
  
  for (const result of results) {
    if (result.error) {
      logger.error('Database error in sharing update:', result.error);
      res.status(500).json({ error: result.error.message });
      return;
    }
  }

  res.json({ message: 'Shares updated successfully' });
});

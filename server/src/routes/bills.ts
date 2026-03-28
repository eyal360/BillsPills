import { Router, Response } from 'express';
import multer from 'multer';
import { logger } from '../lib/logger';
import { getPromptTemplate } from '../lib/prompts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const billsRouter = Router();

// 1. Static/Search routes (MUST come before /:id)
const EXTRACTION_FIELDS = [
  'bill_number',
  'supplier_name',
  'billing_period_start',
  'billing_period_end',
  'total_amount',
  'tax_amount',
  'consumption_amount',
  'meter_reading',
  'account_number',
  'payment_due_date',
  'payment_method',
  'address',
  'notes',
];

// Moving routes up to prevent shadowing by /:id
billsRouter.get('/fields', requireAuth, (_req: AuthenticatedRequest, res: Response): void => {
  res.json({ fields: EXTRACTION_FIELDS });
});

billsRouter.get('/unique-types', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userEmail = req.user!.email?.toLowerCase();
    const { data: owned } = await supabase.from('properties').select('id').eq('user_id', req.user!.id);
    const { data: shared } = await supabase.from('property_shares').select('property_id').eq('email', userEmail);
    const propIds = [...(owned?.map((p: { id: string }) => p.id) || []), ...(shared?.map((s: { property_id: string }) => s.property_id) || [])];
    if (propIds.length === 0) { res.json({ types: [] }); return; }
    const { data, error } = await supabase.from('bills').select('bill_type').in('property_id', propIds);
    if (error) throw error;
    const uniqueTypes = Array.from(new Set(data.map((b: any) => b.bill_type))).filter(Boolean);
    res.json({ types: uniqueTypes });
  } catch (err: any) {
    logger.error('Failed to fetch unique bill types:', err.message);
    res.status(500).json({ error: err.message });
  }
});

billsRouter.get('/average-duration', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userEmail = req.user!.email?.toLowerCase();
    const { data: owned } = await supabase.from('properties').select('id').eq('user_id', req.user!.id);
    const { data: shared } = await supabase.from('property_shares').select('property_id').eq('email', userEmail);
    const propIds = [...(owned?.map((p: { id: string }) => p.id) || []), ...(shared?.map((s: { property_id: string }) => s.property_id) || [])];
    if (propIds.length === 0) { res.json({ average: 20000 }); return; }
    const { data, error } = await supabase.from('bills').select('processing_duration_ms').in('property_id', propIds).not('processing_duration_ms', 'is', null).order('created_at', { ascending: false }).limit(5);
    if (error || !data || data.length === 0) { res.json({ average: 20000 }); return; }
    const sum = data.reduce((acc: number, bill: any) => acc + (bill.processing_duration_ms || 0), 0);
    res.json({ average: Math.round(sum / data.length) || 20000 });
  } catch (err) { res.json({ average: 20000 }); }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');



// GET single bill
billsRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userEmail = req.user!.email?.toLowerCase();
  
  const { data: bill, error: billError } = await supabase
    .from('bills')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (billError || !bill) {
    res.status(404).json({ error: 'Bill not found' });
    return;
  }

  // Verify access through property ownership or share
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('user_id')
    .eq('id', bill.property_id)
    .single();

  if (propError || !property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  if (property.user_id !== req.user!.id) {
    const { data: share } = await supabase
      .from('property_shares')
      .select('id')
      .eq('property_id', bill.property_id)
      .eq('email', userEmail)
      .single();

    if (!share) {
      res.status(403).json({ error: 'Unauthorized property access' });
      return;
    }
  }

  res.json(bill);
});

// GET /api/bills/:id/events (Redundant with properties route but good for direct bill access)
billsRouter.get('/:id/events', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userEmail = req.user!.email?.toLowerCase();
  
  const { data: bill, error: billError } = await supabase
    .from('bills')
    .select('property_id')
    .eq('id', req.params.id)
    .single();

  if (billError || !bill) {
    res.status(404).json({ error: 'Bill not found' });
    return;
  }

  // Verify property access
  const { data: property } = await supabase
    .from('properties')
    .select('user_id')
    .eq('id', bill.property_id)
    .single();

  if (!property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  if (property.user_id !== req.user!.id) {
    const { data: share } = await supabase
      .from('property_shares')
      .select('id')
      .eq('property_id', bill.property_id)
      .eq('email', userEmail)
      .single();

    if (!share) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
  }

  const { data: events, error } = await supabase
    .from('bill_events')
    .select('*')
    .eq('bill_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(events);
});

billsRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { bill_type, amount, paid_amount, status, extracted_data, billing_period_start, billing_period_end, notes } = req.body;
  const userEmail = req.user!.email?.toLowerCase();
  logger.info('Updating bill:', { id: req.params.id, body: req.body });

  // 1. Fetch current bill (including paid_amount for delta calculation)
  const { data: oldBill } = await supabase
    .from('bills')
    .select('property_id, status, amount, bill_type, paid_amount')
    .eq('id', req.params.id)
    .single();

  if (!oldBill) {
    res.status(404).json({ error: 'Bill not found' });
    return;
  }

  // 2. Verify access (owner OR share)
  const { data: property } = await supabase
    .from('properties')
    .select('user_id')
    .eq('id', oldBill.property_id)
    .single();

  if (!property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  if (property.user_id !== req.user!.id) {
    const { data: share } = await supabase
      .from('property_shares')
      .select('id')
      .eq('property_id', oldBill.property_id)
      .eq('email', userEmail)
      .single();

    if (!share) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
  }

  // 3. Update the bill
  const { data: updatedBill, error: updateError } = await supabase
    .from('bills')
    .update({ 
      bill_type, 
      amount, 
      paid_amount,
      status, 
      extracted_data, 
      notes,
      billing_period_start,
      billing_period_end,
      updated_at: new Date().toISOString() 
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  // 4. Create a descriptive event for the update
  let eventTitle = 'פרטי התשלום עודכנו';
  let eventNote = '';

  const newStatus = status || updatedBill.status;
  const newAmount = amount !== undefined ? amount : updatedBill.amount;
  const newPaidAmount = paid_amount !== undefined ? paid_amount : updatedBill.paid_amount;
  const oldPaidAmount = oldBill.paid_amount || 0;

  if (newStatus !== oldBill.status) {
    if (newStatus === 'paid') {
      eventTitle = 'שולם במלואו';
      eventNote = `סה"כ שולם: ₪${newAmount}`;
    } else if (newStatus === 'partial') {
      const addedNow = (newPaidAmount - oldPaidAmount).toFixed(1);
      const remaining = (newAmount - newPaidAmount).toFixed(1);
      eventTitle = 'שולם חלקית';
      eventNote = `שולם עכשיו: ₪${addedNow} | סה"כ שולם: ₪${newPaidAmount} | נשאר: ₪${remaining}`;
    } else {
      eventTitle = `סטטוס התשלום שונה: ${newStatus}`;
    }
  } else if (newPaidAmount !== oldPaidAmount) {
    // Paid amount changed but status stayed same (likely another partial payment)
    const addedNow = (newPaidAmount - oldPaidAmount).toFixed(1);
    const remaining = (newAmount - newPaidAmount).toFixed(1);
    eventTitle = 'שולם חלקית';
    eventNote = `שולם עכשיו: ₪${addedNow} | סה"כ שולם: ₪${newPaidAmount} | נשאר: ₪${remaining}`;
  } else if (newAmount !== oldBill.amount) {
    eventTitle = `סכום התשלום עודכן: ₪${newAmount}`;
  } else if (bill_type && bill_type !== oldBill.bill_type) {
    eventTitle = `סוג התשלום שונה: ${bill_type}`;
  }

  // Note: We deliberately exclude the general bill 'notes' from the timeline record 
  // to avoid duplication, as requested.
  await supabase.from('bill_events').insert({
    bill_id: req.params.id,
    user_id: req.user!.id,
    title: eventTitle,
    note: eventNote, // Only payment-specific data here
  });

  res.json(updatedBill);
});

// DELETE bill
billsRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userEmail = req.user!.email?.toLowerCase();

  const { data: bill } = await supabase
    .from('bills')
    .select('property_id')
    .eq('id', req.params.id)
    .single();

  if (!bill) {
    res.status(404).json({ error: 'Bill not found' });
    return;
  }

  // Verify access (owner OR share)
  const { data: property } = await supabase
    .from('properties')
    .select('user_id')
    .eq('id', bill.property_id)
    .single();

  if (!property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  if (property.user_id !== req.user!.id) {
    const { data: share } = await supabase
      .from('property_shares')
      .select('id')
      .eq('property_id', bill.property_id)
      .eq('email', userEmail)
      .single();

    if (!share) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
  }

  const { error } = await supabase.from('bills').delete().eq('id', req.params.id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ message: 'Bill deleted' });
});

// DELETE /api/bills/:id/events/last - Revert last payment action
billsRouter.delete('/:id/events/last', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id: billId } = req.params;
  const userEmail = req.user!.email?.toLowerCase();

  try {
    // 1. Fetch current bill and verify access
    const { data: bill } = await supabase
      .from('bills')
      .select('property_id, amount, status, paid_amount')
      .eq('id', billId)
      .single();

    if (!bill) {
      res.status(404).json({ error: 'Bill not found' });
      return;
    }

    // Verify access
    const { data: property } = await supabase
      .from('properties')
      .select('user_id')
      .eq('id', bill.property_id)
      .single();

    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    if (property.user_id !== req.user!.id) {
      const { data: share } = await supabase
        .from('property_shares')
        .select('id')
        .eq('property_id', bill.property_id)
        .eq('email', userEmail)
        .single();

      if (!share) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }
    }

    // 2. Fetch all events for this bill to find last and previous
    const { data: events, error: fetchError } = await supabase
      .from('bill_events')
      .select('*')
      .eq('bill_id', billId)
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;
    if (!events || events.length <= 1) {
      res.status(400).json({ error: 'Cannot revert the initial creation event' });
      return;
    }

    const lastEvent = events[events.length - 1];
    
    // 3. Delete the last event
    const { error: deleteError } = await supabase
      .from('bill_events')
      .delete()
      .eq('id', lastEvent.id);

    if (deleteError) throw deleteError;

    // 4. Reconstruct bill state by looking backwards from the new last event
    let newStatus = 'waiting';
    let newPaidAmount = 0;
    
    // Iterate backwards starting from the second-to-last event (which is now the last)
    for (let i = events.length - 2; i >= 0; i--) {
      const ev = events[i];
      if (ev.title === 'שולם במלואו') {
        newStatus = 'paid';
        newPaidAmount = bill.amount;
        break;
      } else if (ev.title === 'שולם חלקית') {
        newStatus = 'partial';
        const match = ev.note.match(/סה"כ שולם: ₪([0-9.]+)/);
        if (match) {
          newPaidAmount = parseFloat(match[1]);
        }
        break;
      } else if (ev.title === 'התשלום נוצר') {
        newStatus = 'waiting';
        newPaidAmount = 0;
        break;
      }
      // If title is "סכום התשלום עודכן" or similar, we continue looking backwards 
      // because those events don't change the payment status/amount being reverted.
    }

    // 5. Update the bill with reconstructed state
    const { data: updatedBill, error: updateError } = await supabase
      .from('bills')
      .update({
        status: newStatus,
        paid_amount: newPaidAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', billId)
      .select()
      .single();

    if (updateError) throw updateError;
    
    logger.info(`Reverted event for bill ${billId}. New status: ${newStatus}, Amount: ${newPaidAmount}`);
    res.json(updatedBill);
  } catch (err: any) {
    logger.error('Revert event error:', err);
    res.status(500).json({ error: err.message });
  }
});

billsRouter.post('/ocr', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const fileSizeMB = req.file ? (req.file.size / (1024 * 1024)).toFixed(2) : '0';
  logger.info(`OCR Handler entered - File: ${req.file?.originalname}, Size: ${fileSizeMB} MB, Mimetype: ${req.file?.mimetype}`);
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    logger.error('Gemini API key missing in environment variables');
    res.status(500).json({ error: 'Gemini API key not configured' });
    return;
  }

  const BILL_TYPES = ['חשמל', 'מים', 'גז', 'ארנונה', 'ועד בית', 'אינטרנט', 'טלוויזיה', 'ביטוח', 'אחר'];
  const mimeType = req.file.mimetype;
  const properties = req.body.properties ? JSON.parse(req.body.properties) : [];

  // Validate file type
  if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
    res.status(400).json({ error: 'סוג קובץ לא נתמך — אנא העלה תמונה או PDF' });
    return;
  }

  try {
    const startTimeOCR = Date.now();
    const base64Image = req.file.buffer.toString('base64');

    const propertiesContext = properties.length > 0 
      ? `### Available Properties List:\n${properties.map((p: any) => `- ID: ${p.id}, NAME: ${p.name}, ADDRESS: ${p.address}`).join('\n')}\n`
      : "";

    const prompt = await getPromptTemplate('ocr_extraction', {
      bill_types: BILL_TYPES.join(', '),
      fields_list: EXTRACTION_FIELDS.map(f => `- ${f}`).join('\n'),
      properties_context: propertiesContext
    });

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });
    
    logger.info(`Starting OCR extraction with ${modelName}...`);
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
    ]);

    const content = result.response.text() || '{}';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in AI response');
    }

    const extracted = JSON.parse(jsonMatch[0]);
    
    // Validate bill_type against known list
    let billType = extracted.bill_type || 'אחר';
    if (!BILL_TYPES.includes(billType)) {
      logger.warn(`AI returned unknown bill type: ${billType}. Reverting to 'אחר'.`);
      billType = 'אחר';
    }

    const amount = (extracted.amount || extracted.extracted_data?.amount || extracted.extracted_data?.total_amount) ? 
      parseFloat(String(extracted.amount || extracted.extracted_data?.amount || extracted.extracted_data?.total_amount)) : 
      null;
    
    const billingPeriodStart = extracted.billing_period_start || extracted.extracted_data?.billing_period_start || null;
    const billingPeriodEnd = extracted.billing_period_end || extracted.extracted_data?.billing_period_end || null;
    const propertyId = extracted.matched_property_id || extracted.extracted_data?.matched_property_id || null;
    const recognizedPropertyName = extracted.recognized_property_name || extracted.extracted_data?.recognized_property_name || extracted.extracted_data?.property_name || extracted.extracted_data?.address || null;

    logger.info(`OCR Success: Type=${billType}, Amount=${amount}, Period=${billingPeriodStart} to ${billingPeriodEnd}, PropMatch=${propertyId}`);

    // Generate embedding in-memory (consolidated pipeline)
    let embedding: number[] | null = null;
    try {
      const embeddingModelName = process.env.GEMINI_EMBEDDING_MODEL || 'models/gemini-embedding-2-preview';
      const embeddingModel = genAI.getGenerativeModel({ model: embeddingModelName });
      
      const contentToEmbed = `סוג חשבון: ${billType}\nסכום: ${amount}\nנתונים שחולצו: ${JSON.stringify(extracted.extracted_data || extracted)}`;
      
      
      const embedResult = await embeddingModel.embedContent({
        content: { role: 'user', parts: [{ text: contentToEmbed }] },
        taskType: 'RETRIEVAL_DOCUMENT' as any,
      });
      
      embedding = embedResult.embedding.values;
    } catch (embedErr: any) {
      logger.error('Embedding generation failure during OCR:', embedErr.message);
      // We don't fail the whole OCR if embedding fails, but we log it
    }

    res.json({
      bill_type: billType,
      amount: amount,
      billing_period_start: billingPeriodStart,
      billing_period_end: billingPeriodEnd,
      matched_property_id: propertyId,
      recognized_property_name: recognizedPropertyName,
      extracted_data: extracted.extracted_data || extracted,
      fields: EXTRACTION_FIELDS,
      embedding: embedding, // Return to client memory
      processing_duration_ms: Date.now() - startTimeOCR
    });
  } catch (err: any) {
    // User facing error (Return actual error message in debug/dev)
    const errorMsg = err.message || 'שגיאה בעיבוד התמונה — ניתן להזין נתונים ידנית';
    res.status(500).json({ 
      error: errorMsg
    });
  }
});

// (End of file - unique-types/fields already moved up)

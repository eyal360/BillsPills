import { Router, Response } from 'express';
import multer from 'multer';
import { logger } from '../lib/logger';
import { getPromptTemplate } from '../lib/prompts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const billsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Fields to extract from bills (extensible list)
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

// PUT update bill
billsRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { bill_type, amount, paid_amount, status, extracted_data, billing_period_start, billing_period_end } = req.body;
  logger.info('Updating bill:', { id: req.params.id, body: req.body });

  // Verify ownership through property
  const { data: bill } = await supabase
    .from('bills')
    .select('property_id')
    .eq('id', req.params.id)
    .single();

  if (!bill) {
    res.status(404).json({ error: 'Bill not found' });
    return;
  }

  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', bill.property_id)
    .eq('user_id', req.user!.id)
    .single();

  if (!property) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  const { data, error } = await supabase
    .from('bills')
    .update({ 
      bill_type, 
      amount, 
      paid_amount,
      status, 
      extracted_data, 
      billing_period_start,
      billing_period_end,
      updated_at: new Date().toISOString() 
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

// DELETE bill
billsRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { data: bill } = await supabase
    .from('bills')
    .select('property_id')
    .eq('id', req.params.id)
    .single();

  if (!bill) {
    res.status(404).json({ error: 'Bill not found' });
    return;
  }

  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', bill.property_id)
    .eq('user_id', req.user!.id)
    .single();

  if (!property) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  const { error } = await supabase.from('bills').delete().eq('id', req.params.id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ message: 'Bill deleted' });
});

// POST OCR — upload image and extract bill data
billsRouter.post('/ocr', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    const base64Image = req.file.buffer.toString('base64');

    const propertiesContext = properties.length > 0 
      ? `### Available Properties List:\n${properties.map((p: any) => `- ID: ${p.id}, NAME: ${p.name}, ADDRESS: ${p.address}`).join('\n')}\n`
      : "";

    const prompt = await getPromptTemplate('ocr_extraction', {
      bill_types: BILL_TYPES.join(', '),
      fields_list: EXTRACTION_FIELDS.map(f => `- ${f}`).join('\n'),
      properties_context: propertiesContext
    });

    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
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
    logger.debug(`Gemini Raw Response: ${content}`);
    
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

    res.json({
      bill_type: billType,
      amount: amount,
      billing_period_start: billingPeriodStart,
      billing_period_end: billingPeriodEnd,
      matched_property_id: propertyId,
      recognized_property_name: recognizedPropertyName,
      extracted_data: extracted.extracted_data || extracted,
      fields: EXTRACTION_FIELDS,
    });
  } catch (err: any) {
    logger.error('Internal OCR processing failure:', {
      message: err.message,
      stack: err.stack,
      response: err.response?.data
    });
    
    // User facing error
    res.status(500).json({ error: 'שגיאה בעיבוד התמונה — ניתן להזין נתונים ידנית' });
  }
});

// GET extraction fields
billsRouter.get('/fields', requireAuth, (_req: AuthenticatedRequest, res: Response): void => {
  res.json({ fields: EXTRACTION_FIELDS });
});

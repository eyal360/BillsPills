const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentBills() {
  console.log('Checking recent bills...');
  const { data: bills, error: billsError } = await supabase
    .from('bills')
    .select('*, properties(*)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (billsError) console.error('Bills Error:', billsError);
  else {
    console.log('Recent Bills:', JSON.stringify(bills.map(b => ({
      id: b.id,
      created_at: b.created_at,
      duration: b.processing_duration_ms,
      prop: b.properties?.name
    })), null, 2));
  }

  console.log('Checking bill_documents...');
  const { data: docs, error: docsError, count } = await supabase
    .from('bill_documents')
    .select('*', { count: 'exact' });

  if (docsError) console.error('Docs Error:', docsError);
  else {
    console.log('Total documents in bill_documents:', count || 0);
  }
}

checkRecentBills();

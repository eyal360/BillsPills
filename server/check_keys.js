const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: bills } = await supabase.from('bills').select('*').order('created_at', { ascending: false }).limit(1);
  if (bills && bills.length > 0) console.log('Last Bill:', bills[0].id, 'Created At:', bills[0].created_at);
  else console.log('No bills found');
}

check();

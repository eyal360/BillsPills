import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

async function checkShares() {
  const { data: shares, error } = await supabase.from('property_shares').select('*').limit(5);
  if (error) {
    console.error('Error fetching shares:', error);
    process.exit(1);
  }
  console.log(JSON.stringify(shares, null, 2));
}

checkShares();

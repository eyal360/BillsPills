import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './logger';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  logger.error('⚠️ CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// Service role client — bypasses RLS for server-side operations
// Use a proxy or dummy client if keys are missing to avoid startup crash
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null as any; // We check for null in the routes

// Create a user-scoped client for RLS-protected queries
export const createUserClient = (accessToken: string) => {
  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL.replace('/rest/v1/', '');
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('get_tables');
  if (error) {
    // try querying postgres using pg or just try to guess
    console.error('RPC failed, you need a custom function. Trying other tables...');
  }
}
run();

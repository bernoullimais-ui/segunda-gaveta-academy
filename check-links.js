import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL.replace('/rest/v1/', '');
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('links').select('*').limit(1);
  console.log('links table:', data ? 'exists' : 'does not exist or error', error);
  
  const { data: q } = await supabase.rpc('get_tables');
}
run();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL.replace('/rest/v1/', '');
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: lp } = await supabase.from('landing_pages').select('*').limit(1);
  console.log('landing_pages:', lp);
}
run();

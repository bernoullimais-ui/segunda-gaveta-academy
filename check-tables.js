import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL.replace('/rest/v1/', '');
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tables = ['campanhas_marketing', 'marketing_campaigns', 'lps', 'paginas_venda', 'paginas', 'funis_venda'];

async function run() {
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) console.log(`Table exists: ${t}`);
  }
}
run();

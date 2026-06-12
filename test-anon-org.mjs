import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let url = process.env.VITE_SUPABASE_URL;
url = url.trim().replace(/\/$/, '');
if (url.endsWith('/rest/v1')) {
  url = url.replace(/\/rest\/v1$/, '');
}

const supabase = createClient(url, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('organizacoes')
    .select('*')
    .limit(1);
  console.log("Anon Org Data:", data);
  console.log("Anon Org Error:", error);
}
test();

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
    .from('usuarios')
    .select('*')
    .eq('codigo_convite', '2R6T4M')
    .is('auth_id', null)
    .single();
  console.log("Anon Data (no join):", data);
  console.log("Anon Error (no join):", error);
}
test();

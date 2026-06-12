import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let url = process.env.VITE_SUPABASE_URL;
url = url.trim().replace(/\/$/, '');
if (url.endsWith('/rest/v1')) {
  url = url.replace(/\/rest\/v1$/, '');
}

const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('codigo_convite', '2R6T4M')
    .single();
  console.log("Data Service:", data);
  console.log("Error Service:", error);
}
test();

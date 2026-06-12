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
    .insert([{
      nome: 'Breno Anon',
      email: 'anonbreno@gmail.com',
      role: 'membro',
      codigo_convite: 'ANON12'
    }]);
  console.log("Insert Anon Data:", data);
  console.log("Insert Anon Error:", error);
}
test();

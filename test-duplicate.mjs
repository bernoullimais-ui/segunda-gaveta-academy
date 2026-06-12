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
    .insert([{
      nome: 'Duplicate Test',
      email: 'maiabruno@msn.com',
      role: 'membro'
    }]);
  console.log("Duplicate Data:", data);
  console.log("Duplicate Error:", error);
}
test();

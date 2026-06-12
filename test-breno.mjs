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
    .select('id, nome, email, codigo_convite')
    .ilike('email', '%breno%');
  console.log("Breno Users:", data);
  console.log("Error:", error);
}
test();

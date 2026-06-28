import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL.replace('/rest/v1/', '');
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const email = 'contato.matheusbarreto@gmail.com';
  console.log('Gerando link para:', email);
  
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: email,
    options: { redirectTo: 'https://segunda-gaveta-academy.vercel.app/reset-password' }
  });
  
  if (error) console.error('Erro:', error);
  else console.log('Link Gerado:', data?.properties?.action_link);
}
run();

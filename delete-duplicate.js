import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL.replace('/rest/v1/', ''), process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: compras } = await supabase.from('compras').select('id').eq('usuario_id', 'dfa87f75-a908-42d1-8969-e6662ed6ff85').order('criado_em', { ascending: false }).limit(1);
  if (compras && compras.length > 0) {
     const { error } = await supabase.from('compras').delete().eq('id', compras[0].id);
     console.log('Deleted duplicate:', error || 'Success');
  }
}
run();

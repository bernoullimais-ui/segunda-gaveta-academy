import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL.replace('/rest/v1/', ''), process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: cursos } = await supabase.from('cursos').select('id, nome, configuracao_json').ilike('nome', '%Processos Comerciais%');
  console.log(JSON.stringify(cursos, null, 2));
}
run();

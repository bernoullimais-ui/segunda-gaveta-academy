import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: user, error: uErr } = await supabase.from('usuarios').select('*').eq('email', 'judobrunomaia@gmail.com').single();
  if (uErr) { console.error('User error:', uErr); return; }
  console.log('User:', user);
  
  const { data: parts, error: pErr } = await supabase.from('curso_participantes').select('cursos(id, nome, organizacao_id)').eq('usuario_id', user.id);
  console.log('Participacoes:', JSON.stringify(parts, null, 2));

  const { data: orgs } = await supabase.from('organizacoes').select('id, nome, slug');
  console.log('Todas Orgs:', orgs);
}
check();

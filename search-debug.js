import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL.replace('/rest/v1/', '');
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Searching in cursos...');
  const { data: cursos } = await supabase.from('cursos').select('*').ilike('titulo', '%DEBUG%');
  console.log('Cursos:', cursos?.map(c => c.titulo));

  console.log('Searching in trilhas...');
  const { data: trilhas } = await supabase.from('trilhas').select('*').ilike('nome', '%DEBUG%');
  console.log('Trilhas:', trilhas?.map(t => t.nome));
}
run();

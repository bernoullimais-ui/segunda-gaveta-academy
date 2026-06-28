import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL.replace('/rest/v1/', '');
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: c1 } = await supabase.from('cursos').select('*').ilike('slug', '%debug%');
  console.log('cursos com debug:', c1?.map(c => c.slug));

  const { data: c2 } = await supabase.from('cursos').select('*').ilike('titulo', '%DEBUG%');
  console.log('cursos titulo debug:', c2?.map(c => c.titulo));

  const { data: links } = await supabase.from('links_divulgacao').select('*').ilike('slug', '%debug%');
  console.log('links com debug:', links);
}
run();

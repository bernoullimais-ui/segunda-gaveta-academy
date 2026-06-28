import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL.replace('/rest/v1/', '');
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('landing_pages').select('*').limit(1);
  if (!error) console.log('landing_pages exists');
  
  const { data: d2, error: e2 } = await supabase.from('campanhas').select('*').limit(1);
  if (!e2) console.log('campanhas exists');
  
  const { data: d3, error: e3 } = await supabase.from('cursos').select('*').limit(1);
  if (!e3) console.log('cursos exists');
}
run();

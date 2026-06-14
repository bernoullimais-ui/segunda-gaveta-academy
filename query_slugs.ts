import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const url = process.env.VITE_SUPABASE_URL!.replace(/\/rest\/v1\/?$/, '');
const supabase = createClient(url, process.env.VITE_SUPABASE_ANON_KEY!);
async function run() {
  const { data, error } = await supabase.from('cursos').select('id, nome, slug');
  console.log('Error:', error);
  console.log('Data:', data);
}
run();

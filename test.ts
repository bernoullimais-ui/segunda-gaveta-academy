import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
let supabaseUrl = process.env.VITE_SUPABASE_URL!;
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseService = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabaseService.rpc('exec_sql', { query: "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'cursos'" });
  console.log(data || error);
}
run();

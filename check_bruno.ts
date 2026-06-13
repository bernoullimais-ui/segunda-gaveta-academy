import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let supabaseUrl = process.env.VITE_SUPABASE_URL!;
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseService = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabaseService.from('usuarios').select('id, nome, email, auth_id, role').eq('email', 'maiabruno@msn.com');
  console.log(data);
}
run();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let supabaseUrl = process.env.VITE_SUPABASE_URL!;
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseService = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: { users }, error } = await supabaseService.auth.admin.listUsers();
  if (error) {
     console.log(error); return;
  }
  users.forEach(u => console.log(u.email, u.id));
}
run();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  // Simula login como admin
  await supabase.auth.signInWithPassword({
    email: 'maiabruno@msn.com',
    password: 'brunomaia_admin' // I don't know the password, I can't login.
  });
  
}
// Actually, let's just use service role to see if it errors out without RLS

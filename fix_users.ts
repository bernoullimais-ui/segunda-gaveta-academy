import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let supabaseUrl = process.env.VITE_SUPABASE_URL!;
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error(error);
    return;
  }
  
  for (const email of ['judobrunomaia@gmail.com', 'eubrenomaia@gmail.com']) {
    const authUser = users.find(u => u.email === email);
    if (!authUser) {
       console.log(`No auth user found for ${email}`);
       continue;
    }
    console.log(`Auth user for ${email} has id: ${authUser.id}`);
    
    // update usuarios table
    const { error: updateErr } = await supabase.from('usuarios').update({ auth_id: authUser.id }).eq('email', email);
    if (updateErr) {
       console.log(`Error updating ${email}:`, updateErr);
    } else {
       console.log(`Successfully fixed ${email}`);
    }
  }
}
run();

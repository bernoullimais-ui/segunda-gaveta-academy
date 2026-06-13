import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let supabaseUrl = process.env.VITE_SUPABASE_URL!;
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseService = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: org } = await supabaseService.from('organizacoes').select('id').limit(1).single();
  if (!org) {
     console.log("No org"); return;
  }
  
  console.log("Trying insert with postgres simulated RLS...");
  // Bruno Maia's auth.uid is 3e0e989a-58ab-4143-8446-2814e2aa81a3
  const { data, error } = await supabaseService.rpc('test_insert_curso', { 
     uid: '3e0e989a-58ab-4143-8446-2814e2aa81a3',
     org_id: org.id 
  });
  
  if (error) {
     console.error("RPC Failed!", error);
  } else {
     console.log("RPC Succeeded!", data);
  }
}
run();

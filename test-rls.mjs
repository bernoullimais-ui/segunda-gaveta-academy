import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let url = process.env.VITE_SUPABASE_URL;
url = url.trim().replace(/\/$/, '');
if (url.endsWith('/rest/v1')) {
  url = url.replace(/\/rest\/v1$/, '');
}

const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.rpc('get_policies_usuarios');
  // Since we don't have an RPC, let's query the table via REST is not possible for pg_policies.
  // Instead, let's just insert a test user using the ANON key. If it succeeds, it's not RLS. If it fails, it is.
}
test();

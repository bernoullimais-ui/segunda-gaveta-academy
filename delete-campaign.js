import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL.replace('/rest/v1/', '');
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Searching for campaign...');
  // It could be in 'campanhas' or 'links_campanha' or similar
  const { data, error } = await supabase.from('campanhas').select('*').ilike('nome', '%DEBUG%');
  if (error) {
    console.error('Error fetching campanhas:', error);
  } else {
    console.log('Found:', data);
    if (data.length > 0) {
      console.log('Deleting...');
      const { error: delErr } = await supabase.from('campanhas').delete().eq('id', data[0].id);
      if (delErr) console.error('Delete error:', delErr);
      else console.log('Deleted successfully!');
    }
  }
}
run();

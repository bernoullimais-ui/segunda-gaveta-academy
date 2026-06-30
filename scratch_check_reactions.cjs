const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReactions() {
  const { data, error } = await supabase
    .from('wa_mensagens')
    .select('*')
    .eq('tipo_mensagem', 'reacao')
    .order('criado_em', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching reactions:', error);
    return;
  }

  console.log('Recent reactions:');
  console.dir(data, { depth: null });
}

checkReactions();

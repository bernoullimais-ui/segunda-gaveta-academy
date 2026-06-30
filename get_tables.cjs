const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bjihfkhkfjiraopieuev.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqaWhma2hrZmppcmFvcGlldWV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU3NzUyNiwiZXhwIjoyMDk0MTUzNTI2fQ.D9pD2yzWFR7zbMenJj00nYrvtdlbQ4w7V6__8CXof-Y');

async function run() {
  const { data: user } = await supabase.from('usuarios').select('*').eq('email', 'barbara_estefanne@hotmail.com');
  console.log('--- USUARIO ---');
  console.log(JSON.stringify(user, null, 2));

  const { data: pedidos } = await supabase.from('pedidos').select('*').eq('cliente_id', user[0]?.id);
  console.log('\n--- PEDIDOS ---');
  console.log(JSON.stringify(pedidos, null, 2));

  const { data: logs } = await supabase.from('log_acessos').select('*').eq('usuario_id', user[0]?.id);
  console.log('\n--- LOG ACESSOS ---');
  console.log(JSON.stringify(logs, null, 2));
}
run();

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bjihfkhkfjiraopieuev.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqaWhma2hrZmppcmFvcGlldWV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU3NzUyNiwiZXhwIjoyMDk0MTUzNTI2fQ.D9pD2yzWFR7zbMenJj00nYrvtdlbQ4w7V6__8CXof-Y');

async function run() {
  const email = 'barbara_estefanne@hotmail.com';
  
  // Get user from auth.users (requires service role key)
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
     console.error('Error fetching auth users:', userError);
  } else {
     const user = users.users.find(u => u.email === email);
     console.log('--- AUTH USER ---');
     console.log(user ? JSON.stringify(user, null, 2) : 'User not found in auth.users');
     
     if (user) {
        // Get perfis
        const { data: perfil, error: perfilError } = await supabase.from('perfis').select('*').eq('id', user.id);
        console.log('\n--- PERFIL ---');
        console.log(perfilError ? perfilError : JSON.stringify(perfil, null, 2));
        
        // Pagamentos ou Assinaturas
        const { data: pagamentos, error: pagError } = await supabase.from('pagamentos').select('*').eq('user_id', user.id);
        if (!pagError && pagamentos) {
           console.log('\n--- PAGAMENTOS ---');
           console.log(JSON.stringify(pagamentos, null, 2));
        }
        
        // logs de acesso
        const { data: logs, error: logsError } = await supabase.from('log_acessos').select('*').eq('user_id', user.id);
        if (!logsError && logs) {
           console.log('\n--- LOGS ACESSO ---');
           console.log(JSON.stringify(logs, null, 2));
        }
     }
  }
}
run();

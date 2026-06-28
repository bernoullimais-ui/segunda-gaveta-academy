import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL.replace('/rest/v1/', ''),
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Testando inserção manual na tabela wa_conversas');
  
  const foneNorm = '5511999999999';
  const { data: novaConversa, error: insertErr } = await supabase
    .from('wa_conversas')
    .insert([{
      contato_telefone: foneNorm,
      contato_nome: 'Teste de Inserção',
      is_aluno: false,
      status: 'ia_ativa',
    }])
    .select()
    .single();

  if (insertErr) {
    console.error('❌ Erro na inserção:', insertErr);
  } else {
    console.log('✅ Conversa inserida:', novaConversa);
    await supabase.from('wa_conversas').delete().eq('id', novaConversa.id);
  }
}
run();

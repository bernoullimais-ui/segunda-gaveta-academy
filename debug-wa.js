import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL.replace('/rest/v1/', ''),
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const foneNorm = '5511987654321';
  
  // Tenta criar a conversa diretamente para ver o erro
  const { data, error } = await supabase
    .from('wa_conversas')
    .insert([{
      contato_telefone: foneNorm,
      contato_nome: 'Teste Debug',
      is_aluno: false,
      status: 'ia_ativa',
    }])
    .select()
    .single();

  if (error) {
    console.log('❌ Erro ao inserir conversa:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ Conversa criada com sucesso!');
    console.log('   ID:', data.id);
    console.log('   Status:', data.status);
    
    // Limpa o teste
    await supabase.from('wa_conversas').delete().eq('id', data.id);
    console.log('   (conversa de teste deletada)');
  }
}
run();

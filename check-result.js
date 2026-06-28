import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL.replace('/rest/v1/', ''),
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: conversas } = await supabase
    .from('wa_conversas')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(1);

  if (!conversas?.length) {
    console.log('❌ Nenhuma conversa criada.');
    return;
  }

  console.log(`✅ Conversa criada!`);
  const c = conversas[0];
  console.log(`📱 ${c.contato_nome || c.contato_telefone} | Status: ${c.status}`);
  
  const { data: msgs } = await supabase
    .from('wa_mensagens')
    .select('*')
    .eq('conversa_id', c.id)
    .order('criado_em', { ascending: true });

  msgs?.forEach(m => {
    const emoji = m.enviado_por === 'contato' ? '👤' : m.enviado_por === 'ia' ? '🤖' : '👨‍💼';
    console.log(`   ${emoji} [${m.direcao}] ${m.conteudo.slice(0, 100)}`);
  });
}
run();

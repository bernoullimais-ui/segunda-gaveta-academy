import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = 'https://bjihfkhkfjiraopieuev.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: msgs, error } = await supabase
    .from('wa_mensagens')
    .select('id, midia_url, utalk_message_id')
    .not('midia_url', 'is', null)
    .order('criado_em', { ascending: false })
    .limit(50);
  
  if (msgs) {
    for (const msg of msgs) {
      if (msg.midia_url && msg.midia_url.includes('utalk-wamedia.s3.amazonaws.com') && msg.utalk_message_id) {
        // Parse the URL
        const parts = msg.midia_url.split('/');
        // https://utalk-wamedia.s3.amazonaws.com/orgId/msgId/fileName
        if (parts.length >= 6) {
          const currentUrlMsgId = parts[4];
          if (currentUrlMsgId !== msg.utalk_message_id) {
            console.log(`Fixing ${msg.id}: replacing ${currentUrlMsgId} with ${msg.utalk_message_id}`);
            parts[4] = msg.utalk_message_id;
            const newUrl = parts.join('/');
            await supabase.from('wa_mensagens').update({ midia_url: newUrl }).eq('id', msg.id);
          }
        }
      }
    }
  }
}
run();

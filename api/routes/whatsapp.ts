/**
 * api/routes/whatsapp.ts — Módulo de Atendimento IA via WhatsApp
 *
 * Endpoints:
 *   POST /api/whatsapp/webhook          — Recebe mensagens do Umbler uTalk
 *   POST /api/whatsapp/send             — Atendente envia mensagem pelo painel
 *   PATCH /api/whatsapp/conversas/:id/takeover  — Atendente assume conversa
 *   PATCH /api/whatsapp/conversas/:id/release   — Devolve conversa para IA
 *   PATCH /api/whatsapp/conversas/:id/close     — Encerra conversa
 *   GET  /api/whatsapp/conversas               — Lista conversas (filtrado por role)
 *   GET  /api/whatsapp/metrics                 — Métricas de atendimento
 *   GET  /api/whatsapp/config/:orgId           — Busca config do canal
 *   POST /api/whatsapp/config/:orgId           — Salva config do canal
 */
import { Router, Request, Response } from 'express';
import { getSupabase } from '../lib/supabase.js';
import {
  generateAIReply,
  resolveContatoInfo,
  getWaAIConfig,
  sendUtalkMessage,
  sendUtalkReaction,
  getUtalkConfig,
} from '../lib/waAI.js';

const router = Router();

// ─── 1. WEBHOOK — Recebe mensagens do Umbler uTalk ───────────────────────────

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    console.log('[WA Webhook] Payload recebido:', JSON.stringify(body).slice(0, 1500));

    // O uTalk pode enviar o payload de duas formas (Webhook global vs API)
    const content = body.Payload?.Content || body.Payload || body;

    // Extrai campos do payload do uTalk
    const fromPhone: string =
      content.Contact?.PhoneNumber ||
      content.contact?.phone ||
      content.fromPhone ||
      content.from ||
      content.sender?.phone ||
      '';
    const targetMessageId: string = 
      content.Reaction?.MessageId ||
      content.reactionMessageId ||
      '';

    const utalkMessageId: string =
      content.id ||
      content.MessageId ||
      content.messageId ||
      content.message?.id ||
      content.LastMessage?.Id ||
      '';

    let messageText: string =
      content.Text ||
      content.LastMessage?.Content ||
      content.LastMessage?.text ||
      content.message?.text ||
      content.message?.body ||
      content.message ||
      content.text ||
      content.body ||
      '';

    const contatoNome: string =
      content.Contact?.Name ||
      content.contact?.name ||
      content.senderName ||
      content.pushName ||
      '';

    // Ignora eventos que não sejam mensagens recebidas
    const event: string = body.event || body.Type || '';
    const eventLower = event.toLowerCase();
    const allowedEvents = ['message', 'conversa', 'chat', 'image', 'video', 'audio', 'document', 'file', 'reaction'];
    
    // DEBUG: Salva o payload cru na tabela para podermos ver no SQL sem atraso da Vercel
    try {
      const sb = getSupabase();
      await sb.from('wa_mensagens').insert({
        // UUID falso, vai falhar se tiver FK constraint?
        // Ao invés de inserir na wa_mensagens que pode ter foreign key estrita, vou usar console.error que aparece melhor na vercel
      });
      console.error('[DEBUG RAW PAYLOAD]', JSON.stringify(body));
    } catch(e) {}

    if (event && !allowedEvents.some(e => eventLower.includes(e))) {
      console.log(`[WA Webhook] EARLY EXIT 1: Evento ignorado: ${event}`);
      return res.status(200).json({ received: true });
    }

    // Ignora mensagens enviadas (só processa recebidas)
    // Para reações, LastMessage.Source se refere à mensagem original (que pode ser do admin), então não podemos usar isso para bloquear reações.
    const isReaction = ['reaction', 'reacao'].includes(eventLower) || !!content.Reaction?.Emoji || !!content.reaction;
    
    const isOutgoing = 
      content.message?.fromMe === true || 
      content.direction === 'outgoing' || 
      content.IsFromMe === true ||
      content['chat[dir]'] === 'o' ||
      (content.LastMessage?.Source && content.LastMessage.Source !== 'Contact');

    // Removido o EARLY EXIT das mensagens de saída para podermos sincronizar com o painel Atendimento IA.
    // O controle se a IA deve responder será feito mais abaixo.

    // -- Extração de Mídias e Reações
    let midiaUrl: string =
      content.Media?.Url || content.mediaUrl || content.MediaUrl || content.FileUrl || content.fileUrl || content.message?.mediaUrl || content['chat[file]'] || content['chat[media]'] || content.LastMessage?.File?.Url || content.File?.Url || '';
    let midiaMimetype: string =
      content.Media?.MimeType || content.mimetype || content.MimeType || content.message?.mimetype || content['chat[mimetype]'] || content.LastMessage?.File?.ContentType || content.File?.ContentType || '';
    const reacaoEmoji: string =
      content.Reaction?.Emoji || content.reaction || content.Reaction || content.message?.reaction || '';

    // Verifica se existe um objeto File, mesmo sem URL (o uTalk às vezes manda Url null e Data "")
    const hasFileObject = !!(content.Media || content.LastMessage?.File || content.File);

    // Trata payload url-encoded onde chat[body] contém o link da mídia
    const chatType = content['chat[type]'] || content.Type || content.type || eventLower;
    if (['image', 'video', 'audio', 'document', 'ptt'].includes(chatType)) {
      if (!midiaUrl && content['chat[body]'] && content['chat[body]'].startsWith('http')) {
        midiaUrl = content['chat[body]'];
        messageText = content['chat[caption]'] || ''; // Se tiver legenda
      }
    }

    let tipoMensagem = 'texto';
    if (reacaoEmoji) tipoMensagem = 'reacao';
    else if (chatType === 'image' || midiaMimetype.includes('image') || midiaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) tipoMensagem = 'imagem';
    else if (chatType === 'video' || midiaMimetype.includes('video') || midiaUrl.match(/\.(mp4|avi|mov)$/i)) tipoMensagem = 'video';
    else if (chatType === 'audio' || chatType === 'ptt' || midiaMimetype.includes('audio') || midiaUrl.match(/\.(mp3|ogg|wav)$/i)) tipoMensagem = 'audio';
    else if (midiaUrl || hasFileObject) tipoMensagem = 'documento';

    // Se a mensagem for de mídia, corrigimos o tipo baseando-se no mimetype
    if (hasFileObject && midiaMimetype.includes('image')) tipoMensagem = 'imagem';
    else if (hasFileObject && midiaMimetype.includes('video')) tipoMensagem = 'video';
    else if (hasFileObject && midiaMimetype.includes('audio')) tipoMensagem = 'audio';

    // Se tiver mídia ou reação, o messageText pode vir vazio, então permitimos passar
    if (!fromPhone || (!messageText && !midiaUrl && !reacaoEmoji && !hasFileObject)) {
      console.warn(`[WA Webhook] EARLY EXIT 3: Payload incompleto. fromPhone: "${fromPhone}", messageText: "${messageText}", mediaUrl: "${midiaUrl}", reaction: "${reacaoEmoji}", hasFileObject: ${hasFileObject}`);
      return res.status(200).json({ received: true });
    }

    if (reacaoEmoji) {
      console.log(`[WA Webhook] REACTION PAYLOAD DEBUG:`, JSON.stringify(content).slice(0, 2000));
    }

    if (!messageText) {
      if (tipoMensagem === 'imagem') messageText = '[Imagem recebida]';
      else if (tipoMensagem === 'audio') messageText = '[Áudio recebido]';
      else if (tipoMensagem === 'video') messageText = '[Vídeo recebido]';
      else if (tipoMensagem === 'documento') messageText = '[Documento recebido]';
      else if (tipoMensagem === 'reacao') messageText = `[Reagiu com: ${reacaoEmoji}]`;
    }

    // DEBUG: Oculto (não concatenado no texto para não poluir a interface)
    // console.log(`[WA Webhook] Payload bruto recebido de ${fromPhone}`);

    console.log(`[WA Webhook] Passou pelas validações iniciais. fromPhone: ${fromPhone}, messageText: ${messageText.slice(0, 50)}...`);

    const supabase = getSupabase();

    // ── Busca ou cria conversa ──────────────────────────────────────────────
    // Se for grupo, a Utalk pode mandar PhoneNumber como 5511999999999.
    // Nesse caso, usamos o Contact.Id ou GroupIdentifier para diferenciar.
    const isGroupContact = content.Contact?.ContactType === 'Group' || content.Contact?.ContactType === 'GroupMessage';
    
    // Se for mensagem de saída, o fromPhone pode ser o do admin. Vamos priorizar o destino.
    let targetPhone = fromPhone;
    if (isOutgoing) {
      const dest = content.toPhone || content.to || content.receiver?.phone || '';
      if (dest) targetPhone = dest;
    }

    let foneNorm = targetPhone.replace(/\D/g, '');
    
    if (isGroupContact && content.Contact?.Id) {
      foneNorm = content.Contact.Id; // Ex: akPX6gNhnJL3LoOF (preserva as letras)
    }

    let { data: conversa } = await supabase
      .from('wa_conversas')
      .select('*')
      .or(`contato_telefone.eq.${foneNorm},contato_telefone.eq.55${foneNorm}`)
      .not('status', 'eq', 'encerrada')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── Roteamento Automático ──────────────
    let orgIdRoteada = conversa?.organizacao_id || null;

    if (!orgIdRoteada) {
      const systemPhoneStr = isOutgoing ? fromPhone : (content.toPhone || content.to || '');
      const systemPhone = systemPhoneStr.replace(/\D/g, '');
      const { data: configs } = await supabase
        .from('wa_config')
        .select('organizacao_id, palavras_chave_roteamento, utalk_from_phone');

      if (configs && configs.length > 0) {
        // 1. Tenta rotear pelo número de destino (se o cliente enviou mensagem para um número exclusivo de uma org)
        if (systemPhone) {
          const toPhoneNorm = systemPhone.startsWith('55') ? systemPhone : `55${systemPhone}`;
          const configMatch = configs.find(c => {
            if (!c.utalk_from_phone) return false;
            const configFone = c.utalk_from_phone.replace(/\D/g, '');
            const configFoneNorm = configFone.startsWith('55') ? configFone : `55${configFone}`;
            return configFoneNorm === toPhoneNorm;
          });
          if (configMatch) {
            orgIdRoteada = configMatch.organizacao_id;
            console.log(`[WA Webhook] Roteado para org ${orgIdRoteada} por número de destino (${toPhoneNorm})`);
          }
        }

        // 2. Se não roteou pelo número, tenta pelas palavras-chave
        if (!orgIdRoteada) {
          const textoMsg = messageText.toLowerCase();
          for (const config of configs) {
            if (!config.palavras_chave_roteamento) continue;
            const palavras = config.palavras_chave_roteamento.split(',').map((p: string) => p.trim().toLowerCase());
            
            if (palavras.some((p: string) => p && textoMsg.includes(p))) {
              orgIdRoteada = config.organizacao_id;
              console.log(`[WA Webhook] Roteado para org ${orgIdRoteada} por palavra-chave na mensagem`);
              break;
            }
          }
        }

        // Se conseguiu rotear, atualiza a conversa existente
        if (orgIdRoteada && conversa) {
          await supabase.from('wa_conversas').update({ organizacao_id: orgIdRoteada }).eq('id', conversa.id);
          conversa.organizacao_id = orgIdRoteada;
        }
      }
    }

    if (!conversa) {
      // Resolve info do contato (aluno ou lead?)
      const contatoInfo = await resolveContatoInfo(foneNorm);

      const { data: novaConversa, error: insertErr } = await supabase
        .from('wa_conversas')
        .insert([{
          organizacao_id: orgIdRoteada,
          contato_telefone: foneNorm,
          contato_nome: contatoNome || contatoInfo.nome || null,
          contato_email: contatoInfo.email || null,
          usuario_id: contatoInfo.usuarioId || null,
          is_aluno: contatoInfo.isAluno,
          status: 'ia_ativa',
        }])
        .select()
        .single();

      if (insertErr || !novaConversa) {
        console.error('[WA Webhook] Erro ao criar conversa:', insertErr);
        return res.status(500).json({ error: 'Erro ao criar conversa' });
      }
      conversa = novaConversa;
    }

    // ── Deduplicação de Retries do Webhook ──────────────────────────────────
    if (conversa) {
      const { data: ultimaMsg } = await supabase
        .from('wa_mensagens')
        .select('conteudo, criado_em')
        .eq('conversa_id', conversa.id)
        .eq('enviado_por', 'contato')
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimaMsg && ultimaMsg.conteudo === messageText) {
        const diffSecs = (new Date().getTime() - new Date(ultimaMsg.criado_em).getTime()) / 1000;
        if (diffSecs < 60) {
          console.log(`[WA Webhook] EARLY EXIT: Mensagem duplicada (retry). Ignorando.`);
          return res.status(200).json({ received: true });
        }
      }
    }

    // Se for reação, tenta achar a mensagem original
    let reacaoParaId = null;
    if (tipoMensagem === 'reacao' && targetMessageId) {
      const { data: msgOriginal } = await supabase
        .from('wa_mensagens')
        .select('id')
        .eq('utalk_message_id', targetMessageId)
        .maybeSingle();
      if (msgOriginal) reacaoParaId = msgOriginal.id;
    }

    // -- Verifica se veio um arquivo em Base64 em vez de URL (ou se tem thumbnail disponível)
    const midiaBase64 = content.LastMessage?.File?.Data || content.File?.Data || content.Data || content.LastMessage?.Thumbnail?.Data || content.Thumbnail?.Data || '';
    if (midiaBase64 && !midiaUrl) {
      try {
        const buffer = Buffer.from(midiaBase64, 'base64');
        const ext = midiaMimetype.split('/')[1] || 'bin';
        const fileName = `${conversa.id}/${Date.now()}_media.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('whatsapp_midias')
          .upload(fileName, buffer, {
            contentType: midiaMimetype || 'application/octet-stream'
          });
        
        if (uploadData && !uploadErr) {
          midiaUrl = supabase.storage.from('whatsapp_midias').getPublicUrl(uploadData.path).data.publicUrl;
          if (tipoMensagem === 'texto') {
             if (midiaMimetype.includes('image')) tipoMensagem = 'imagem';
             else if (midiaMimetype.includes('video')) tipoMensagem = 'video';
             else if (midiaMimetype.includes('audio')) tipoMensagem = 'audio';
             else tipoMensagem = 'documento';
          }
        } else {
          console.error('[WA Webhook] Erro ao enviar midia base64 para storage:', uploadErr);
        }
      } catch (err) {
        console.error('[WA Webhook] Erro ao decodificar base64:', err);
      }
    }

    // Removido o corte do DEBUG PAYLOAD para podermos inspecionar o JSON completo no BD

    // ── Salva mensagem recebida no banco ────────────────────────────────────
    const direcaoMsg = isOutgoing ? 'saida' : 'entrada';
    const enviadoPorMsg = isOutgoing ? 'humano' : 'contato';

    const { error: insertMsgErr } = await supabase.from('wa_mensagens').insert([{
      conversa_id: conversa.id,
      direcao: direcaoMsg,
      conteudo: messageText,
      enviado_por: enviadoPorMsg,
      tipo_mensagem: tipoMensagem,
      midia_url: midiaUrl || null,
      midia_mimetype: midiaMimetype || null,
      reacao_emoji: reacaoEmoji || null,
      utalk_message_id: utalkMessageId || null,
      reacao_para_id: reacaoParaId,
    }]);

    if (insertMsgErr) {
      console.error('[WA Webhook] Erro ao inserir mensagem no banco:', insertMsgErr.message);
    }

    // Atualiza ultima_mensagem_em
    await supabase
      .from('wa_conversas')
      .update({ ultima_mensagem_em: new Date().toISOString() })
      .eq('id', conversa.id);

    // Se for mensagem de saída (atendente no cel/utalk), passamos o status para humano e abortamos a IA
    if (isOutgoing && !isReaction) {
      if (conversa.status === 'ia_ativa' || conversa.status === 'aguardando_humano') {
        await supabase.from('wa_conversas').update({ status: 'em_atendimento' }).eq('id', conversa.id);
      }
      return res.status(200).json({ received: true, info: 'Mensagem de saida sincronizada' });
    }

    // ── Se conversa está com humano, não processa IA ─────────────────────────
    if (conversa.status === 'em_atendimento') {
      console.log(`[WA Webhook] Conversa ${conversa.id} está com humano, ignorando IA.`);
      return res.status(200).json({ received: true });
    }

    if (conversa.status === 'aguardando_humano') {
      console.log(`[WA Webhook] Conversa ${conversa.id} aguardando humano, IA pausada.`);
      // Notifica via Supabase que chegou nova mensagem mesmo aguardando humano
      // (o Realtime no frontend vai pegar automaticamente)
      return res.status(200).json({ received: true });
    }

    const aiConfig = await getWaAIConfig(conversa.organizacao_id || undefined);

    if (aiConfig.iaAtiva === false) {
      console.log(`[WA Webhook] IA desativada para a org ${conversa.organizacao_id}. Ignorando IA.`);
      if (conversa.status === 'ia_ativa') {
        await supabase
          .from('wa_conversas')
          .update({ status: 'aguardando_humano', ultima_mensagem_em: new Date().toISOString() })
          .eq('id', conversa.id);
      }
      return res.status(200).json({ received: true });
    }

    // ── Busca histórico da conversa para contexto da IA ─────────────────────
    const { data: historico } = await supabase
      .from('wa_mensagens')
      .select('direcao, conteudo, enviado_por')
      .eq('conversa_id', conversa.id)
      .order('criado_em', { ascending: true })
      .limit(30);

    const historicoParsed = (historico || []).map(m => ({
      direcao: m.direcao as 'entrada' | 'saida',
      conteudo: m.conteudo,
      enviado_por: m.enviado_por as 'ia' | 'humano' | 'contato',
    }));

    // ── Gera resposta da IA ─────────────────────────────────────────────────
    const contatoInfo = await resolveContatoInfo(foneNorm);
    const { resposta, transbordo } = await generateAIReply(historicoParsed, aiConfig, contatoInfo);

    // ── Salva resposta da IA no banco (primeiro sem utalk_message_id para rapidez) ───────────────────────────────────────
    const { data: iaMsg } = await supabase.from('wa_mensagens').insert([{
      conversa_id: conversa.id,
      direcao: 'saida',
      conteudo: resposta,
      enviado_por: 'ia',
      tipo_mensagem: 'texto',
    }]).select('id').single();

    // ── Se detectou transbordo, muda status da conversa ─────────────────────
    if (transbordo) {
      await supabase
        .from('wa_conversas')
        .update({ status: 'aguardando_humano', ultima_mensagem_em: new Date().toISOString() })
        .eq('id', conversa.id);
      console.log(`[WA Webhook] Conversa ${conversa.id} marcada para transbordo humano.`);
    }

    // ── Envia resposta pelo uTalk ────────────────────────────────────────────
    const utalkConfig = await getUtalkConfig(conversa.organizacao_id || undefined);
    if (utalkConfig) {
      const sent = await sendUtalkMessage(foneNorm, resposta, utalkConfig);
      if (!sent) {
        console.error(`[WA Webhook] Falha ao enviar resposta para ${foneNorm}`);
      } else if (typeof sent === 'string' && iaMsg) {
        // Atualiza a mensagem da IA com o ID retornado pelo uTalk
        await supabase.from('wa_mensagens').update({ utalk_message_id: sent }).eq('id', iaMsg.id);
      }
    } else {
      console.warn('[WA Webhook] Sem configuração uTalk. Mensagem salva mas não enviada.');
    }

    // Responde ao uTalk SÓ no final para a Vercel não matar a função antes de terminar
    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[WA Webhook] Erro geral:', error?.message);
    return res.status(500).json({ error: error?.message });
  }
});

// ─── 2. SEND — Atendente humano envia mensagem pelo painel ───────────────────

router.post('/send', async (req: Request, res: Response) => {
  try {
    const { conversa_id, mensagem, atendente_id, midia_url, midia_mimetype } = req.body;

    if (!conversa_id || (!mensagem && !midia_url)) {
      return res.status(400).json({ error: 'conversa_id e mensagem (ou mídia) são obrigatórios.' });
    }

    const supabase = getSupabase();

    const { data: conversa, error: convErr } = await supabase
      .from('wa_conversas')
      .select('*')
      .eq('id', conversa_id)
      .single();

    if (convErr || !conversa) {
      return res.status(404).json({ error: 'Conversa não encontrada.' });
    }

    let nomeAtendente = 'Atendente';
    if (atendente_id) {
      const { data: usr } = await supabase.from('usuarios').select('nome').eq('id', atendente_id).maybeSingle();
      if (usr?.nome) {
        nomeAtendente = usr.nome.trim();
      }
    }
    const mensagemAssinada = mensagem ? `*[${nomeAtendente}]*\n\n${mensagem}` : `*[${nomeAtendente}]* enviou um anexo`;

    let tipoMensagem = 'texto';
    if (midia_mimetype?.includes('image')) tipoMensagem = 'imagem';
    else if (midia_mimetype?.includes('video')) tipoMensagem = 'video';
    else if (midia_mimetype?.includes('audio')) tipoMensagem = 'audio';
    else if (midia_url) tipoMensagem = 'documento';

    // Envia pelo uTalk
    let utalkMessageId = null;
    const utalkConfig = await getUtalkConfig(conversa.organizacao_id || undefined);
    if (utalkConfig) {
      const result = await sendUtalkMessage(conversa.contato_telefone, mensagemAssinada, utalkConfig, midia_url, midia_mimetype);
      if (!result) {
        return res.status(500).json({ error: 'Falha ao enviar pelo WhatsApp.' });
      }
      if (typeof result === 'string') {
        utalkMessageId = result;
      }
    }

    // Salva mensagem no banco
    const { error: msgErr } = await supabase.from('wa_mensagens').insert([{
      conversa_id,
      direcao: 'saida',
      conteudo: mensagemAssinada,
      enviado_por: 'humano',
      tipo_mensagem: tipoMensagem,
      midia_url: midia_url || null,
      midia_mimetype: midia_mimetype || null,
      utalk_message_id: utalkMessageId || null,
    }]);

    if (msgErr) {
      return res.status(500).json({ error: 'Erro ao salvar mensagem.' });
    }

    // Atualiza ultima_mensagem_em
    await supabase
      .from('wa_conversas')
      .update({ ultima_mensagem_em: new Date().toISOString() })
      .eq('id', conversa_id);

    return res.json({ success: true, utalkMessageId });
  } catch (error: any) {
    console.error('[WA Send]', error?.message);
    return res.status(500).json({ error: error.message });
  }
});

// ─── 3. SEND REACTION — Atendente reage a uma mensagem pelo painel ─────────────

router.post('/send-reaction', async (req: Request, res: Response) => {
  try {
    const { conversa_id, mensagem_id, emoji, atendente_id } = req.body;

    if (!conversa_id || !mensagem_id || !emoji) {
      return res.status(400).json({ error: 'conversa_id, mensagem_id e emoji são obrigatórios.' });
    }

    const supabase = getSupabase();

    // 1. Busca a mensagem original
    const { data: msgOriginal, error: msgErr } = await supabase
      .from('wa_mensagens')
      .select('utalk_message_id, conversa_id')
      .eq('id', mensagem_id)
      .single();

    if (msgErr || !msgOriginal) {
      return res.status(404).json({ error: 'Mensagem original não encontrada.' });
    }

    if (!msgOriginal.utalk_message_id) {
      return res.status(400).json({ error: 'Mensagem original não possui ID do uTalk para ser reagida.' });
    }

    // 2. Busca a conversa para pegar a organização
    const { data: conversa, error: convErr } = await supabase
      .from('wa_conversas')
      .select('organizacao_id')
      .eq('id', conversa_id)
      .single();

    if (convErr || !conversa) {
      return res.status(404).json({ error: 'Conversa não encontrada.' });
    }

    // 3. Busca config do uTalk
    const utalkConfig = await getUtalkConfig(conversa.organizacao_id || undefined);
    if (!utalkConfig) {
      return res.status(500).json({ error: 'Configuração do uTalk não encontrada.' });
    }

    // 4. Envia a reação via API
    const result = await sendUtalkReaction(utalkConfig, msgOriginal.utalk_message_id, emoji);
    if (!result) {
      return res.status(500).json({ error: 'Falha ao enviar reação pelo uTalk.' });
    }

    // 5. Salva a reação no banco
    const { error: insertErr } = await supabase.from('wa_mensagens').insert([{
      conversa_id,
      direcao: 'saida',
      conteudo: `[Reagiu com: ${emoji}]`,
      enviado_por: 'humano',
      tipo_mensagem: 'reacao',
      reacao_emoji: emoji,
      reacao_para_id: mensagem_id,
    }]);

    if (insertErr) {
      return res.status(500).json({ error: 'Erro ao salvar reação no banco.' });
    }

    // Atualiza ultima_mensagem_em
    await supabase
      .from('wa_conversas')
      .update({ ultima_mensagem_em: new Date().toISOString() })
      .eq('id', conversa_id);

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[WA Send Reaction]', error?.message);
    return res.status(500).json({ error: error.message });
  }
});

// ─── 4. TAKEOVER — Atendente assume a conversa ───────────────────────────────

router.patch('/conversas/:id/takeover', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { atendente_id, contexto } = req.body;

    const supabase = getSupabase();
    const { error } = await supabase
      .from('wa_conversas')
      .update({
        status: 'em_atendimento',
        atendente_id: atendente_id || null,
        ultima_mensagem_em: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });

    if (contexto && typeof contexto === 'string' && contexto.trim().length > 0) {
      await supabase.from('wa_mensagens').insert({
        conversa_id: id,
        direcao: 'sistema',
        conteudo: contexto.trim(),
        enviado_por: 'sistema'
      });
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── 4. RELEASE — Devolve conversa para a IA ─────────────────────────────────

router.patch('/conversas/:id/release', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();
    const { error } = await supabase
      .from('wa_conversas')
      .update({ status: 'ia_ativa', atendente_id: null })
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── 5. CLOSE — Encerra conversa ─────────────────────────────────────────────

router.patch('/conversas/:id/close', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();
    const { error } = await supabase
      .from('wa_conversas')
      .update({
        status: 'encerrada',
        encerrado_em: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── 6. LIST — Lista conversas para o painel ─────────────────────────────────

router.get('/conversas', async (req: Request, res: Response) => {
  try {
    const { status, org_id, limit = '50' } = req.query;
    const supabase = getSupabase();

    let query = supabase
      .from('wa_conversas')
      .select(`
        *,
        atendente:usuarios!wa_conversas_atendente_id_fkey(id, nome, email),
        organizacao:organizacoes(nome)
      `)
      .order('ultima_mensagem_em', { ascending: false })
      .limit(Number(limit));

    if (status) query = query.eq('status', status as string);
    if (org_id) query = query.eq('organizacao_id', org_id as string);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.json(data || []);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── 7. MESSAGES — Histórico de mensagens de uma conversa ────────────────────

router.get('/conversas/:id/mensagens', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();

    // Descobre o contato dessa conversa para agrupar todas as conversas do mesmo número
    const { data: conv } = await supabase
      .from('wa_conversas')
      .select('contato_telefone')
      .eq('id', id)
      .maybeSingle();

    let convIds = [id];
    if (conv) {
      const { data: allConvs } = await supabase
        .from('wa_conversas')
        .select('id')
        .eq('contato_telefone', conv.contato_telefone);
      if (allConvs && allConvs.length > 0) {
        convIds = allConvs.map(c => c.id);
      }
    }

    const { data, error } = await supabase
      .from('wa_mensagens')
      .select('*')
      .in('conversa_id', convIds)
      .order('criado_em', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── 8. METRICS — Métricas de atendimento ────────────────────────────────────

router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const { org_id, periodo = '30' } = req.query;
    const supabase = getSupabase();

    const desde = new Date();
    desde.setDate(desde.getDate() - Number(periodo));
    const desdeIso = desde.toISOString();

    let query = supabase
      .from('wa_conversas')
      .select('id, status, criado_em, encerrado_em, atendente_id, organizacao_id')
      .gte('criado_em', desdeIso);

    if (org_id) query = query.eq('organizacao_id', org_id as string);

    const { data: conversas, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const total = conversas?.length || 0;
    const encerradas = conversas?.filter(c => c.status === 'encerrada') || [];
    const comTransbordo = conversas?.filter(
      c => c.atendente_id || c.status === 'em_atendimento' || c.status === 'aguardando_humano'
    ) || [];

    // Tempo médio de atendimento (para conversas encerradas com horário)
    const temposMs = encerradas
      .filter(c => c.encerrado_em && c.criado_em)
      .map(c => new Date(c.encerrado_em!).getTime() - new Date(c.criado_em).getTime());

    const tempoMedioMin = temposMs.length > 0
      ? Math.round(temposMs.reduce((a, b) => a + b, 0) / temposMs.length / 60000)
      : 0;

    // Por dia (últimos 30 dias)
    const porDia: Record<string, number> = {};
    conversas?.forEach(c => {
      const dia = c.criado_em.slice(0, 10);
      porDia[dia] = (porDia[dia] || 0) + 1;
    });

    return res.json({
      total,
      ativas: conversas?.filter(c => c.status === 'ia_ativa').length || 0,
      aguardando_humano: conversas?.filter(c => c.status === 'aguardando_humano').length || 0,
      em_atendimento: conversas?.filter(c => c.status === 'em_atendimento').length || 0,
      encerradas: encerradas.length,
      taxa_transbordo_pct: total > 0 ? Math.round((comTransbordo.length / total) * 100) : 0,
      tempo_medio_min: tempoMedioMin,
      por_dia: porDia,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── 9. CONFIG — Busca configuração do canal WhatsApp ────────────────────────

router.get('/config/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('wa_config')
      .select('*')
      .eq('organizacao_id', orgId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    // Busca configuracoes globais
    const { data: globalData } = await supabase
      .from('configuracoes_globais')
      .select('chave, valor')
      .in('chave', ['wa_ia_prompt_global', 'wa_utalk_global_token', 'wa_utalk_global_from_phone', 'wa_utalk_global_organization_id', 'wa_ia_ativa_global']);

    const globMap: Record<string, string> = {};
    if (globalData) {
      globalData.forEach(row => { globMap[row.chave] = row.valor; });
    }

    return res.json({ 
      config: data || null, 
      prompt_global: globMap['wa_ia_prompt_global'] || '',
      global_tokens: {
        wa_utalk_global_token: globMap['wa_utalk_global_token'] || '',
        wa_utalk_global_from_phone: globMap['wa_utalk_global_from_phone'] || '',
        wa_utalk_global_organization_id: globMap['wa_utalk_global_organization_id'] || '',
        wa_ia_ativa_global: globMap['wa_ia_ativa_global'] === 'false' ? false : true,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── 10. GLOBAL CONFIG SAVE — Salva configurações globais (super_admin) ────────

router.post('/config/global', async (req: Request, res: Response) => {
  try {
    const { prompt, wa_utalk_global_token, wa_utalk_global_from_phone, wa_utalk_global_organization_id, wa_ia_ativa_global } = req.body;
    const supabase = getSupabase();
    
    const updates = [];
    if (prompt !== undefined) updates.push({ chave: 'wa_ia_prompt_global', valor: prompt, atualizado_em: new Date().toISOString() });
    if (wa_utalk_global_token !== undefined) updates.push({ chave: 'wa_utalk_global_token', valor: wa_utalk_global_token, atualizado_em: new Date().toISOString() });
    if (wa_utalk_global_from_phone !== undefined) updates.push({ chave: 'wa_utalk_global_from_phone', valor: wa_utalk_global_from_phone, atualizado_em: new Date().toISOString() });
    if (wa_utalk_global_organization_id !== undefined) updates.push({ chave: 'wa_utalk_global_organization_id', valor: wa_utalk_global_organization_id, atualizado_em: new Date().toISOString() });
    if (wa_ia_ativa_global !== undefined) updates.push({ chave: 'wa_ia_ativa_global', valor: wa_ia_ativa_global ? 'true' : 'false', atualizado_em: new Date().toISOString() });

    if (updates.length > 0) {
      const { error } = await supabase.from('configuracoes_globais').upsert(updates, { onConflict: 'chave' });
      if (error) return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── 11. CONFIG SAVE — Salva configuração do canal ────────────────────────────

router.post('/config/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { utalk_token, utalk_from_phone, utalk_organization_id, ia_ativa, ia_prompt_override, palavras_chave_roteamento } = req.body;
    const supabase = getSupabase();

    const { error } = await supabase
      .from('wa_config')
      .upsert([{
        organizacao_id: orgId,
        utalk_token: utalk_token || null,
        utalk_from_phone: utalk_from_phone || null,
        utalk_organization_id: utalk_organization_id || null,
        palavras_chave_roteamento: palavras_chave_roteamento || null,
        ia_ativa: ia_ativa !== undefined ? ia_ativa : true,
        ia_prompt_override: ia_prompt_override || null,
        atualizado_em: new Date().toISOString(),
      }], { onConflict: 'organizacao_id' });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── 12. BASE DE CONHECIMENTO — Busca e salva a base enriquecida ─────────────

router.get('/base/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('wa_base_conhecimento')
      .select('*')
      .eq('organizacao_id', orgId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || { organizacao_id: orgId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/base/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const {
      comportamento,
      regras_de_negocio,
      tabelas_banco,
      websites,
      documentos,
      perguntas_respostas,
      script_de_vendas_e_objecoes,
      fluxo_de_transbordo,
    } = req.body;
    const supabase = getSupabase();

    const { error } = await supabase
      .from('wa_base_conhecimento')
      .upsert([{
        organizacao_id: orgId,
        comportamento: comportamento ?? null,
        regras_de_negocio: regras_de_negocio ?? null,
        tabelas_banco: tabelas_banco ?? null,
        websites: websites ?? null,
        documentos: documentos ?? null,
        perguntas_respostas: perguntas_respostas ?? null,
        script_de_vendas_e_objecoes: script_de_vendas_e_objecoes ?? null,
        fluxo_de_transbordo: fluxo_de_transbordo ?? null,
        atualizado_em: new Date().toISOString(),
      }], { onConflict: 'organizacao_id' });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;

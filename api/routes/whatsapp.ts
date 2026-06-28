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
  getUtalkConfig,
} from '../lib/waAI.js';

const router = Router();

// ─── 1. WEBHOOK — Recebe mensagens do Umbler uTalk ───────────────────────────

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    console.log('[WA Webhook] Payload recebido:', JSON.stringify(body).slice(0, 1500));

    // O uTalk pode enviar o payload de duas formas (Webhook global vs API)
    const content = body.Payload?.Content || body;

    // Extrai campos do payload do uTalk
    const fromPhone: string =
      content.Contact?.PhoneNumber ||
      content.contact?.phone ||
      content.fromPhone ||
      content.from ||
      content.sender?.phone ||
      '';
    const messageText: string =
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

    // Ignora eventos que não sejam mensagens de texto recebidas
    const event: string = body.event || body.Type || '';
    if (event && !event.includes('message') && !event.includes('conversa') && !event.includes('Message') && event !== '') {
      console.log(`[WA Webhook] EARLY EXIT 1: Evento ignorado: ${event}`);
      return res.status(200).json({ received: true });
    }

    // Ignora mensagens enviadas (só processa recebidas)
    const isOutgoing = 
      content.message?.fromMe === true || 
      content.direction === 'outgoing' || 
      content.IsFromMe === true ||
      (content.LastMessage?.Source && content.LastMessage.Source !== 'Contact');

    if (isOutgoing) {
      console.log(`[WA Webhook] EARLY EXIT 2: Mensagem de saída ignorada.`);
      return res.status(200).json({ received: true });
    }

    if (!fromPhone || !messageText) {
      console.warn(`[WA Webhook] EARLY EXIT 3: Payload incompleto. fromPhone: "${fromPhone}", messageText: "${messageText}"`);
      return res.status(200).json({ received: true });
    }

    console.log(`[WA Webhook] Passou pelas validações iniciais. fromPhone: ${fromPhone}, messageText: ${messageText.slice(0, 50)}...`);

    const supabase = getSupabase();

    // ── Busca ou cria conversa ──────────────────────────────────────────────
    const foneNorm = fromPhone.replace(/\D/g, '');
    let { data: conversa } = await supabase
      .from('wa_conversas')
      .select('*')
      .or(`contato_telefone.eq.${foneNorm},contato_telefone.eq.55${foneNorm}`)
      .not('status', 'eq', 'encerrada')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── Roteamento Automático por Palavras-chave ──────────────
    let orgIdRoteada = conversa?.organizacao_id || null;

    if (!orgIdRoteada) {
      const { data: configs } = await supabase
        .from('wa_config')
        .select('organizacao_id, palavras_chave_roteamento')
        .not('palavras_chave_roteamento', 'is', null);

      if (configs && configs.length > 0) {
        const textoMsg = messageText.toLowerCase();
        for (const config of configs) {
          if (!config.palavras_chave_roteamento) continue;
          const palavras = config.palavras_chave_roteamento.split(',').map((p: string) => p.trim().toLowerCase());
          
          if (palavras.some((p: string) => p && textoMsg.includes(p))) {
            orgIdRoteada = config.organizacao_id;
            console.log(`[WA Webhook] Roteado para org ${orgIdRoteada} por palavra-chave na mensagem: ${textoMsg}`);
            
            // Se já existia conversa, atualiza no banco
            if (conversa) {
              await supabase.from('wa_conversas').update({ organizacao_id: orgIdRoteada }).eq('id', conversa.id);
              conversa.organizacao_id = orgIdRoteada;
            }
            break;
          }
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

    // ── Salva mensagem recebida no banco ────────────────────────────────────
    await supabase.from('wa_mensagens').insert([{
      conversa_id: conversa.id,
      direcao: 'entrada',
      conteudo: messageText,
      enviado_por: 'contato',
    }]);

    // Atualiza ultima_mensagem_em
    await supabase
      .from('wa_conversas')
      .update({ ultima_mensagem_em: new Date().toISOString() })
      .eq('id', conversa.id);

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

    // ── Salva resposta da IA no banco ───────────────────────────────────────
    await supabase.from('wa_mensagens').insert([{
      conversa_id: conversa.id,
      direcao: 'saida',
      conteudo: resposta,
      enviado_por: 'ia',
    }]);

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
    const { conversa_id, mensagem, atendente_id } = req.body;

    if (!conversa_id || !mensagem) {
      return res.status(400).json({ error: 'conversa_id e mensagem são obrigatórios.' });
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
    const mensagemAssinada = `*[${nomeAtendente}]*\n\n${mensagem}`;

    // Salva mensagem no banco
    const { error: msgErr } = await supabase.from('wa_mensagens').insert([{
      conversa_id,
      direcao: 'saida',
      conteudo: mensagemAssinada,
      enviado_por: 'humano',
    }]);

    if (msgErr) {
      return res.status(500).json({ error: 'Erro ao salvar mensagem.' });
    }

    // Atualiza ultima_mensagem_em
    await supabase
      .from('wa_conversas')
      .update({ ultima_mensagem_em: new Date().toISOString() })
      .eq('id', conversa_id);

    // Envia pelo uTalk
    const utalkConfig = await getUtalkConfig(conversa.organizacao_id || undefined);
    if (utalkConfig) {
      const sent = await sendUtalkMessage(conversa.contato_telefone, mensagemAssinada, utalkConfig);
      if (!sent) {
        return res.status(500).json({ error: 'Mensagem salva mas falha ao enviar pelo WhatsApp.' });
      }
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[WA Send]', error?.message);
    return res.status(500).json({ error: error.message });
  }
});

// ─── 3. TAKEOVER — Atendente assume a conversa ───────────────────────────────

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

    const { data, error } = await supabase
      .from('wa_mensagens')
      .select('*')
      .eq('conversa_id', id)
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
      .in('chave', ['wa_ia_prompt_global', 'wa_utalk_global_token', 'wa_utalk_global_from_phone', 'wa_utalk_global_organization_id']);

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
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── 10. GLOBAL CONFIG SAVE — Salva configurações globais (super_admin) ────────

router.post('/config/global', async (req: Request, res: Response) => {
  try {
    const { prompt, wa_utalk_global_token, wa_utalk_global_from_phone, wa_utalk_global_organization_id } = req.body;
    const supabase = getSupabase();
    
    const updates = [];
    if (prompt !== undefined) updates.push({ chave: 'wa_ia_prompt_global', valor: prompt, atualizado_em: new Date().toISOString() });
    if (wa_utalk_global_token !== undefined) updates.push({ chave: 'wa_utalk_global_token', valor: wa_utalk_global_token, atualizado_em: new Date().toISOString() });
    if (wa_utalk_global_from_phone !== undefined) updates.push({ chave: 'wa_utalk_global_from_phone', valor: wa_utalk_global_from_phone, atualizado_em: new Date().toISOString() });
    if (wa_utalk_global_organization_id !== undefined) updates.push({ chave: 'wa_utalk_global_organization_id', valor: wa_utalk_global_organization_id, atualizado_em: new Date().toISOString() });

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

export default router;

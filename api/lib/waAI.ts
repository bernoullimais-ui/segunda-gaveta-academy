/**
 * api/lib/waAI.ts — Lógica de IA para o módulo de Atendimento WhatsApp
 *
 * Responsabilidades:
 *   - Gerar resposta da IA com histórico de conversa
 *   - Detectar sinal de transbordo para humano
 *   - Identificar contato como aluno ou lead via telefone
 *   - Montar system prompt enriquecido a partir da base de conhecimento
 */
import { generateContentWithRetry } from './gemini.js';
import { getSupabase } from './supabase.js';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface WaMensagem {
  direcao: 'entrada' | 'saida';
  conteudo: string;
  enviado_por: 'ia' | 'humano' | 'contato';
}

export interface WaContatoInfo {
  telefone: string;
  nome?: string;
  isAluno: boolean;
  usuarioId?: string;
  email?: string;
}

/** Estrutura da base de conhecimento enriquecida por organização */
export interface WaBaseConhecimento {
  id?: string;
  organizacao_id?: string;
  /** 1. Comportamento — persona, tom de voz, regras de formatação */
  comportamento?: {
    nome_assistente?: string;
    persona?: string;
    tom_de_voz?: string;
    regras_formatacao?: string;
  } | null;
  /** 2. Regras de Negócio — limites operacionais, cupons, trocas */
  regras_de_negocio?: {
    texto?: string;
  } | null;
  /** 3. Tabelas do banco — dados ao vivo do Supabase */
  tabelas_banco?: Array<{
    tabela: string;
    colunas: string[];
    filtro?: string;
    descricao?: string;
  }> | null;
  /** 4. Websites — links de referência externa */
  websites?: Array<{
    url: string;
    descricao?: string;
  }> | null;
  /** 5. Documentos — manuais, PDFs, termos de uso (texto extraído) */
  documentos?: Array<{
    nome: string;
    conteudo: string;
    storage_path?: string;
  }> | null;
  /** 6. FAQ — perguntas e respostas frequentes */
  perguntas_respostas?: Array<{
    pergunta: string;
    resposta: string;
  }> | null;
  /** 7. Script de vendas e objeções */
  script_de_vendas_e_objecoes?: {
    texto?: string;
  } | null;
  /** 8. Fluxo de transbordo */
  fluxo_de_transbordo?: {
    condicoes?: string;
    mensagem_transbordo?: string;
    horario_atendimento?: string;
  } | null;
}

export interface WaAIConfig {
  promptGlobal: string;
  promptOverride?: string | null;
  orgName?: string;
  iaAtiva: boolean;
  baseConhecimento?: WaBaseConhecimento | null;
}

export interface AIReplyResult {
  resposta: string;
  transbordo: boolean;
}

// ─── Monta system prompt enriquecido a partir da base de conhecimento ─────────

export async function buildEnrichedSystemPrompt(
  config: WaAIConfig,
  contato: WaContatoInfo
): Promise<string> {
  const base = config.baseConhecimento;
  const supabase = getSupabase();

  // Se não há base de conhecimento configurada, usa o fluxo legado
  if (!base) {
    const prompt = config.promptOverride || config.promptGlobal;
    const contextoContato = contato.isAluno
      ? `\n\n[CONTEXTO INTERNO — NÃO REVELAR AO USUÁRIO: O contato ${contato.nome || contato.telefone} JÁ É ALUNO cadastrado na plataforma${contato.email ? ` (e-mail: ${contato.email})` : ''}. Trate com prioridade.]`
      : `\n\n[CONTEXTO INTERNO — NÃO REVELAR AO USUÁRIO: O contato ${contato.nome || contato.telefone} NÃO é aluno cadastrado. É um lead/prospecto.]`;
    return prompt + contextoContato;
  }

  const secoes: string[] = [];

  // ── 1. Comportamento ────────────────────────────────────────────────────────
  const comp = base.comportamento;
  if (comp) {
    const nomeAssistente = comp.nome_assistente || 'Assistente Virtual';
    const orgLabel = config.orgName ? ` da ${config.orgName}` : '';
    let secao = `[IDENTIDADE E COMPORTAMENTO]\n`;
    secao += `Você é ${nomeAssistente}${orgLabel}.\n`;
    if (comp.persona) secao += `Persona: ${comp.persona}\n`;
    if (comp.tom_de_voz) secao += `Tom de voz: ${comp.tom_de_voz}\n`;
    if (comp.regras_formatacao) secao += `Regras de formatação: ${comp.regras_formatacao}\n`;
    secoes.push(secao.trim());
  } else {
    // Fallback para o prompt global/override
    secoes.push(config.promptOverride || config.promptGlobal);
  }

  // ── 2. Regras de Negócio ────────────────────────────────────────────────────
  const regras = base.regras_de_negocio;
  if (regras?.texto?.trim()) {
    secoes.push(`[REGRAS DE NEGÓCIO]\n${regras.texto.trim()}`);
  }

  // ── 3. Tabelas do Banco (dados ao vivo) ────────────────────────────────────
  if (base.tabelas_banco && base.tabelas_banco.length > 0) {
    const linhas: string[] = ['[DADOS AO VIVO DO SISTEMA]'];
    for (const t of base.tabelas_banco) {
      try {
        let query = supabase.from(t.tabela).select(t.colunas.length > 0 ? t.colunas.join(', ') : '*').limit(50);
        // Aplica filtros simples do tipo "coluna=valor"
        if (t.filtro) {
          const partes = t.filtro.split('=');
          if (partes.length === 2) {
            const col = partes[0].trim();
            const val = partes[1].trim().replace(/['"]/g, '');
            query = query.eq(col, val === 'true' ? true : val === 'false' ? false : val);
          }
        }
        const { data } = await query;
        if (data && data.length > 0) {
          const desc = t.descricao ? ` (${t.descricao})` : '';
          linhas.push(`Tabela ${t.tabela}${desc}:\n${JSON.stringify(data, null, 2)}`);
        }
      } catch (err) {
        console.warn(`[WaAI] Erro ao buscar tabela ${t.tabela}:`, err);
      }
    }
    if (linhas.length > 1) secoes.push(linhas.join('\n'));
  }

  // ── 4. Websites ─────────────────────────────────────────────────────────────
  if (base.websites && base.websites.length > 0) {
    const linhas = ['[LINKS DE REFERÊNCIA EXTERNA]'];
    base.websites.forEach(w => {
      linhas.push(`- ${w.descricao ? `${w.descricao}: ` : ''}${w.url}`);
    });
    secoes.push(linhas.join('\n'));
  }

  // ── 5. Documentos ───────────────────────────────────────────────────────────
  if (base.documentos && base.documentos.length > 0) {
    const linhas = ['[DOCUMENTOS INSTITUCIONAIS]'];
    base.documentos.forEach(d => {
      if (d.conteudo?.trim()) {
        linhas.push(`--- ${d.nome} ---\n${d.conteudo.trim()}`);
      }
    });
    if (linhas.length > 1) secoes.push(linhas.join('\n\n'));
  }

  // ── 6. FAQ ──────────────────────────────────────────────────────────────────
  if (base.perguntas_respostas && base.perguntas_respostas.length > 0) {
    const linhas = ['[PERGUNTAS E RESPOSTAS FREQUENTES]'];
    base.perguntas_respostas.forEach((qa, i) => {
      linhas.push(`P${i + 1}: ${qa.pergunta}\nR${i + 1}: ${qa.resposta}`);
    });
    secoes.push(linhas.join('\n\n'));
  }

  // ── 7. Script de Vendas e Objeções ─────────────────────────────────────────
  const script = base.script_de_vendas_e_objecoes;
  if (script?.texto?.trim()) {
    secoes.push(`[SCRIPT DE VENDAS E CONTORNO DE OBJEÇÕES]\n${script.texto.trim()}`);
  }

  // ── 8. Fluxo de Transbordo ──────────────────────────────────────────────────
  const transbordo = base.fluxo_de_transbordo;
  if (transbordo) {
    const linhas = ['[FLUXO DE TRANSBORDO PARA HUMANO]'];
    if (transbordo.condicoes) linhas.push(`Transferir para humano quando: ${transbordo.condicoes}`);
    if (transbordo.mensagem_transbordo) linhas.push(`Mensagem ao transferir: "${transbordo.mensagem_transbordo}". Inclua a palavra TRANSBORDO internamente.`);
    if (transbordo.horario_atendimento) linhas.push(`Horário de atendimento humano: ${transbordo.horario_atendimento}`);
    secoes.push(linhas.join('\n'));
  } else {
    secoes.push('[FLUXO DE TRANSBORDO]\nQuando precisar transferir para humano, inclua a palavra TRANSBORDO em algum lugar da sua resposta.');
  }

  // ── Contexto do contato ─────────────────────────────────────────────────────
  const contextoContato = contato.isAluno
    ? `\n\n[CONTEXTO INTERNO — NÃO REVELAR AO USUÁRIO: O contato ${contato.nome || contato.telefone} JÁ É ALUNO cadastrado na plataforma${contato.email ? ` (e-mail: ${contato.email})` : ''}. Trate com prioridade.]`
    : `\n\n[CONTEXTO INTERNO — NÃO REVELAR AO USUÁRIO: O contato ${contato.nome || contato.telefone} NÃO é aluno cadastrado. É um lead/prospecto.]`;

  return secoes.join('\n\n') + contextoContato;
}

// ─── Função principal: gera resposta da IA ──────────────────────────────────

export async function generateAIReply(
  historico: WaMensagem[],
  config: WaAIConfig,
  contato: WaContatoInfo
): Promise<AIReplyResult> {
  // Monta o system prompt com a base de conhecimento enriquecida
  const systemInstruction = await buildEnrichedSystemPrompt(config, contato);

  // Monta o histórico no formato de conteúdo do Gemini
  const contents = historico.map(msg => ({
    role: msg.direcao === 'entrada' ? 'user' : 'model',
    parts: [{ text: msg.conteudo }]
  }));

  // Garante que a última mensagem é do usuário (requisito do Gemini)
  if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
    return { resposta: 'Olá! Como posso te ajudar?', transbordo: false };
  }

  try {
    const result = await generateContentWithRetry({
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 500,
      }
    });

    const resposta = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const transbordo = detectTransbordo(resposta);

    // Remove a palavra TRANSBORDO da resposta que o cliente vai receber
    const respostaLimpa = resposta
      .replace(/\bTRANSBORDO\b/gi, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    // Usa o nome configurado na base de conhecimento ou fallback para "Gabi"
    const nomeAssistente = config.baseConhecimento?.comportamento?.nome_assistente;
    const orgLabel = config.orgName ? ` da ${config.orgName}` : '';
    const assinatura = nomeAssistente
      ? `*[${nomeAssistente}${orgLabel}]*\n\n`
      : '*[Gabi, assistente virtual]*\n\n';

    return { resposta: assinatura + respostaLimpa, transbordo };
  } catch (error: any) {
    console.error('[WaAI] Erro ao gerar resposta:', error?.message);
    return {
      resposta: 'Desculpe, tive um problema técnico. Vou chamar um especialista para te ajudar!',
      transbordo: true
    };
  }
}

// ─── Detecta sinal de transbordo na resposta da IA ──────────────────────────

export function detectTransbordo(resposta: string): boolean {
  const lower = resposta.toLowerCase();
  return (
    resposta.includes('TRANSBORDO') ||
    lower.includes('transferir para') ||
    lower.includes('vou te conectar') ||
    lower.includes('chamar um especialista') ||
    lower.includes('um atendente humano') ||
    lower.includes('falar com uma pessoa')
  );
}

// ─── Resolve informações do contato a partir do telefone ────────────────────

export async function resolveContatoInfo(telefone: string): Promise<WaContatoInfo> {
  const supabase = getSupabase();

  // Normaliza telefone: remove DDI brasileiro se tiver, mantém DDD + número
  const foneNormalizado = telefone.replace(/\D/g, '');
  // Variações comuns: com ou sem 55
  const variantes = [
    foneNormalizado,
    foneNormalizado.startsWith('55') ? foneNormalizado.slice(2) : `55${foneNormalizado}`
  ];

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, auth_id, nome, email, telefone')
    .or(variantes.map(v => `telefone.ilike.%${v}%`).join(','))
    .maybeSingle();

  if (usuario) {
    return {
      telefone,
      nome: usuario.nome,
      isAluno: true,
      usuarioId: usuario.auth_id || usuario.id,
      email: usuario.email
    };
  }

  return { telefone, isAluno: false };
}

// ─── Busca configuração da IA (prompt global + override por org + base) ───────

export async function getWaAIConfig(organizacaoId?: string): Promise<WaAIConfig> {
  const supabase = getSupabase();

  // Busca prompt adequado (Triagem se nulo, Global se houver org mas sem override)
  const chavePrompt = organizacaoId ? 'wa_ia_prompt_global' : 'wa_ia_prompt_triagem';

  // Busca configurações globais (Prompt e Ativação)
  const { data: globalConfigs } = await supabase
    .from('configuracoes_globais')
    .select('chave, valor')
    .in('chave', [chavePrompt, 'wa_ia_ativa_global']);

  let promptGlobal = 'Você é um assistente virtual. Por favor, pergunte sobre qual curso o usuário tem interesse.';
  let iaAtiva = true;

  if (globalConfigs) {
    const promptObj = globalConfigs.find(c => c.chave === chavePrompt);
    if (promptObj && promptObj.valor) promptGlobal = promptObj.valor;

    const ativaObj = globalConfigs.find(c => c.chave === 'wa_ia_ativa_global');
    if (ativaObj && ativaObj.valor === 'false') {
      iaAtiva = false;
    }
  }

  // Busca configuração e prompt da organização (se houver)
  let promptOverride: string | null = null;
  let orgName: string | undefined;
  let baseConhecimento: WaBaseConhecimento | null = null;

  if (organizacaoId) {
    const [waConfigResult, orgResult, baseResult] = await Promise.all([
      supabase
        .from('wa_config')
        .select('ia_prompt_override, ia_ativa')
        .eq('organizacao_id', organizacaoId)
        .maybeSingle(),
      supabase
        .from('organizacoes')
        .select('nome')
        .eq('id', organizacaoId)
        .maybeSingle(),
      supabase
        .from('wa_base_conhecimento')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .maybeSingle(),
    ]);

    if (waConfigResult.data) {
      if (waConfigResult.data.ia_prompt_override) promptOverride = waConfigResult.data.ia_prompt_override;
      if (waConfigResult.data.ia_ativa !== null && waConfigResult.data.ia_ativa !== undefined) {
        iaAtiva = waConfigResult.data.ia_ativa;
      }
    }

    orgName = orgResult.data?.nome;
    baseConhecimento = baseResult.data || null;
  }

  return { promptGlobal, promptOverride, orgName, iaAtiva, baseConhecimento };
}

// ─── Envia mensagem pelo Umbler uTalk ────────────────────────────────────────

export async function sendUtalkMessage(
  telefone: string,
  mensagem: string,
  utalkConfig: { token: string; fromPhone: string; organizationId: string },
  midiaUrl?: string,
  midiaMimetype?: string
): Promise<string | boolean> {
  let cleanTo = telefone.replace(/\D/g, '');
  if (!cleanTo.startsWith('55')) cleanTo = `55${cleanTo}`;

  const cleanFrom = utalkConfig.fromPhone.replace(/\D/g, '');

  try {
    let requestBody: any;
    const headers: any = {
      Authorization: `Bearer ${utalkConfig.token}`,
      token: utalkConfig.token,
      'x-token': utalkConfig.token
    };

    if (midiaUrl) {
      // Quando tem mídia, a API do uTalk exige multipart/form-data com o binário
      const form = new FormData();
      form.append('toPhone', cleanTo);
      form.append('fromPhone', cleanFrom);
      form.append('organizationId', utalkConfig.organizationId);
      if (mensagem) form.append('message', mensagem);

      // Baixa o arquivo do Supabase Storage
      const fileRes = await fetch(midiaUrl);
      if (fileRes.ok) {
        const blob = await fileRes.blob();
        const fileName = midiaUrl.split('/').pop()?.split('?')[0] || 'anexo';
        form.append('file', blob, fileName);
      } else {
        console.warn('[WaAI] Não foi possível baixar a mídia do URL:', midiaUrl);
      }

      requestBody = form;
      // Não setamos 'Content-Type' manualmente, o fetch/FormData resolvem o boundary
    } else {
      // Quando é só texto, manda JSON
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify({
        toPhone: cleanTo,
        fromPhone: cleanFrom,
        organizationId: utalkConfig.organizationId,
        message: mensagem
      });
    }

    const response = await fetch('https://app-utalk.umbler.com/api/v1/messages/simplified/', {
      method: 'POST',
      headers,
      body: requestBody
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[WaAI] Erro no uTalk:', response.status, err);
      return false;
    }

    const data = await response.json().catch(() => ({}));
    return data.id || data.MessageId || data.messageId || true;
  } catch (error: any) {
    console.error('[WaAI] Exceção ao enviar pelo uTalk:', error?.message);
    return false;
  }
}

// ─── Envia Reação pelo Umbler uTalk ────────────────────────────────────────
export async function sendUtalkReaction(
  utalkConfig: { token: string; organizationId: string },
  messageId: string,
  emoji: string | null
): Promise<boolean> {
  try {
    const headers: any = {
      Authorization: `Bearer ${utalkConfig.token}`,
      token: utalkConfig.token,
      'x-token': utalkConfig.token,
      'Content-Type': 'application/json'
    };

    const requestBody = JSON.stringify({
      organizationId: utalkConfig.organizationId,
      messageId: messageId,
      emoji: emoji
    });

    const response = await fetch('https://app-utalk.umbler.com/api/v1/messages/reactions/', {
      method: 'POST',
      headers,
      body: requestBody
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[WaAI] Erro ao enviar reação uTalk:', response.status, err);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('[WaAI] Exceção ao enviar reação pelo uTalk:', error?.message);
    return false;
  }
}

// ─── Busca configuração uTalk por organização ou global ──────────────────────

export async function getUtalkConfig(organizacaoId?: string): Promise<{
  token: string;
  fromPhone: string;
  organizationId: string;
} | null> {
  const supabase = getSupabase();

  let orgToken = '';
  let orgFromPhone = '';
  let orgOrgId = '';

  // 1. Busca config específica da organização
  if (organizacaoId) {
    const { data } = await supabase
      .from('wa_config')
      .select('utalk_token, utalk_from_phone, utalk_organization_id')
      .eq('organizacao_id', organizacaoId)
      .maybeSingle();

    if (data) {
      orgToken = data.utalk_token || '';
      orgFromPhone = data.utalk_from_phone || '';
      orgOrgId = data.utalk_organization_id || '';
    }
  }

  // 2. Busca config Global de fallback
  const { data: globData } = await supabase
    .from('configuracoes_globais')
    .select('chave, valor')
    .in('chave', ['wa_utalk_global_token', 'wa_utalk_global_from_phone', 'wa_utalk_global_organization_id']);

  const globMap: Record<string, string> = {};
  if (globData) {
    globData.forEach((row: any) => { globMap[row.chave] = row.valor; });
  }

  const globalToken = globMap['wa_utalk_global_token'] || process.env.UTALK_TOKEN || '';
  const globalFromPhone = globMap['wa_utalk_global_from_phone'] || process.env.UTALK_FROM_PHONE || '';
  const globalOrgId = globMap['wa_utalk_global_organization_id'] || process.env.UTALK_ORGANIZATION_ID || '';

  // 3. Mescla Híbrido: Privilegia a Organização, se vazio usa o Global
  const token = orgToken || globalToken;
  const fromPhone = orgFromPhone || globalFromPhone;
  const organizationId = orgOrgId || globalOrgId;

  if (token && fromPhone && organizationId) {
    return { token, fromPhone, organizationId };
  }

  return null;
}

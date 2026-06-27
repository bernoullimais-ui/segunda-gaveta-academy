/**
 * api/lib/waAI.ts — Lógica de IA para o módulo de Atendimento WhatsApp
 *
 * Responsabilidades:
 *   - Gerar resposta da IA com histórico de conversa
 *   - Detectar sinal de transbordo para humano
 *   - Identificar contato como aluno ou lead via telefone
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

export interface WaAIConfig {
  promptGlobal: string;
  promptOverride?: string | null;
  orgName?: string;
}

export interface AIReplyResult {
  resposta: string;
  transbordo: boolean;
}

// ─── Função principal: gera resposta da IA ──────────────────────────────────

export async function generateAIReply(
  historico: WaMensagem[],
  config: WaAIConfig,
  contato: WaContatoInfo
): Promise<AIReplyResult> {
  const prompt = config.promptOverride || config.promptGlobal;

  // Contexto do contato para injetar no prompt
  const contextoContato = contato.isAluno
    ? `\n\n[CONTEXTO INTERNO — NÃO REVELAR AO USUÁRIO: O contato ${contato.nome || contato.telefone} JÁ É ALUNO cadastrado na plataforma${contato.email ? ` (e-mail: ${contato.email})` : ''}. Trate com prioridade e mencione que reconheceu o cadastro.]`
    : `\n\n[CONTEXTO INTERNO — NÃO REVELAR AO USUÁRIO: O contato ${contato.nome || contato.telefone} NÃO é aluno cadastrado. É um lead/prospecto.]`;

  const systemInstruction = prompt + contextoContato;

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

    const assinatura = '\n\n[Gabi, assistente virtual da Segunda Gaveta Academy]';
    return { resposta: respostaLimpa + assinatura, transbordo };
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

// ─── Busca configuração da IA (prompt global + override por org) ─────────────

export async function getWaAIConfig(organizacaoId?: string): Promise<WaAIConfig> {
  const supabase = getSupabase();

  // Busca prompt global
  const { data: globalConfig } = await supabase
    .from('configuracoes_globais')
    .select('valor')
    .eq('chave', 'wa_ia_prompt_global')
    .maybeSingle();

  const promptGlobal = globalConfig?.valor || 'Você é um assistente virtual da Segunda Gaveta Academy. Responda em português, seja amigável e profissional.';

  // Busca configuração e prompt da organização (se houver)
  let promptOverride: string | null = null;
  let orgName: string | undefined;

  if (organizacaoId) {
    const { data: waConfig } = await supabase
      .from('wa_config')
      .select('ia_prompt_override')
      .eq('organizacao_id', organizacaoId)
      .maybeSingle();

    if (waConfig?.ia_prompt_override) {
      promptOverride = waConfig.ia_prompt_override;
    }

    const { data: org } = await supabase
      .from('organizacoes')
      .select('nome')
      .eq('id', organizacaoId)
      .maybeSingle();

    orgName = org?.nome;
  }

  return { promptGlobal, promptOverride, orgName };
}

// ─── Envia mensagem pelo Umbler uTalk ────────────────────────────────────────

export async function sendUtalkMessage(
  telefone: string,
  mensagem: string,
  utalkConfig: { token: string; fromPhone: string; organizationId: string }
): Promise<boolean> {
  let cleanTo = telefone.replace(/\D/g, '');
  if (!cleanTo.startsWith('55')) cleanTo = `55${cleanTo}`;

  const cleanFrom = utalkConfig.fromPhone.replace(/\D/g, '');

  try {
    const response = await fetch('https://app-utalk.umbler.com/api/v1/messages/simplified/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${utalkConfig.token}`,
        token: utalkConfig.token,
        'x-token': utalkConfig.token
      },
      body: JSON.stringify({
        toPhone: cleanTo,
        fromPhone: cleanFrom,
        organizationId: utalkConfig.organizationId,
        message: mensagem
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[WaAI] Erro no uTalk:', response.status, err);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('[WaAI] Exceção ao enviar pelo uTalk:', error?.message);
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

  // Busca config específica da organização
  if (organizacaoId) {
    const { data } = await supabase
      .from('wa_config')
      .select('utalk_token, utalk_from_phone, utalk_organization_id, ia_ativa')
      .eq('organizacao_id', organizacaoId)
      .maybeSingle();

    if (data?.utalk_token && data?.utalk_from_phone && data?.utalk_organization_id) {
      return {
        token: data.utalk_token,
        fromPhone: data.utalk_from_phone,
        organizationId: data.utalk_organization_id
      };
    }
  }

  // Fallback: primeira config disponível (número centralizado)
  const { data } = await supabase
    .from('wa_config')
    .select('utalk_token, utalk_from_phone, utalk_organization_id')
    .not('utalk_token', 'is', null)
    .limit(1)
    .maybeSingle();

  if (data?.utalk_token && data?.utalk_from_phone && data?.utalk_organization_id) {
    return {
      token: data.utalk_token,
      fromPhone: data.utalk_from_phone,
      organizationId: data.utalk_organization_id
    };
  }

  // Fallback final: variáveis de ambiente
  const token = process.env.UTALK_TOKEN;
  const fromPhone = process.env.UTALK_FROM_PHONE;
  const organizationId = process.env.UTALK_ORGANIZATION_ID;

  if (token && fromPhone && organizationId) {
    return { token, fromPhone, organizationId };
  }

  return null;
}

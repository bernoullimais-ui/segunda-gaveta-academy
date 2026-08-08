/**
 * api/lib/focusnf.ts — Cliente da API Focus NF
 *
 * Responsabilidade: encapsular todas as chamadas à API da Focus NF
 * para emissão, consulta e cancelamento de NFS-e.
 *
 * Documentação: https://focusnfe.com.br/doc/#introducao-url-de-acesso
 *
 * Autenticação: HTTP Basic Auth com o token do emissor como username
 * e senha vazia. Ex: Authorization: Basic base64("TOKEN:")
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface FocusNFPrestador {
  cnpj?: string;
  cpf?: string;
  inscricao_municipal?: string;
  codigo_municipio: string;
  item_lista_servico: string;
  cnae?: string;
  regime_tributario: number;  // 1=Simples, 2=Simples excesso, 3=Normal
  aliquota_iss?: number;      // ex: 2.00 (porcentagem)
  iss_retido?: boolean;
  discriminacao?: string;
  nome?: string;
}

export interface FocusNFTomador {
  cpf?: string;
  cnpj?: string;
  nome: string;
  email?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    codigo_municipio?: string;
    uf?: string;
    cep?: string;
  };
}

export interface FocusNFEmissaoPayload {
  data_emissao: string;           // ISO 8601, ex: '2026-07-25T10:00:00-03:00'
  prestador: FocusNFPrestador;
  tomador: FocusNFTomador;
  servico: {
    aliquota: number;             // ex: 2.00
    base_calculo: number;         // valor do serviço em reais
    discriminacao: string;        // descrição do serviço
    iss_retido: boolean;
    item_lista_servico: string;
    codigo_cnae?: string;
    valor_servicos: number;       // mesmo que base_calculo
    valor_iss?: number;
    valor_deducoes?: number;
  };
  natureza_operacao?: number;     // 1=Tributação no município (default)
}

export interface FocusNFResponse {
  status: string;         // 'autorizado', 'processando_autorizacao', 'erro_autorizacao', 'cancelado'
  numero?: string;
  codigo_verificacao?: string;
  caminho_xml_nota_fiscal?: string;
  caminho_danfse?: string;       // URL do PDF
  mensagem_sefaz?: string;
  erros?: Array<{ codigo: string; mensagem: string; correcao?: string }>;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const FOCUS_NF_BASE_URL = 'https://api.focusnfe.com.br';
const FOCUS_NF_SANDBOX_URL = 'https://homologacao.focusnfe.com.br';

// Mapeamento de status da Focus NF para nosso status interno
export const FOCUS_STATUS_MAP: Record<string, string> = {
  'autorizado':                  'AUTHORIZED',
  'processando_autorizacao':     'PROCESSING',
  'erro_autorizacao':            'ERROR',
  'cancelado':                   'CANCELLED',
  'aguardando_autorizacao':      'PROCESSING',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBaseUrl(ambiente: 'sandbox' | 'producao' = 'producao'): string {
  return ambiente === 'sandbox' ? FOCUS_NF_SANDBOX_URL : FOCUS_NF_BASE_URL;
}

function buildAuthHeader(token: string): string {
  // Basic Auth: base64("token:")
  const credentials = Buffer.from(`${token}:`).toString('base64');
  return `Basic ${credentials}`;
}

async function focusRequest(
  token: string,
  ambiente: 'sandbox' | 'producao',
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: object
): Promise<{ ok: boolean; status: number; data: any }> {
  const url = `${getBaseUrl(ambiente)}${path}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': buildAuthHeader(token),
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  try {
    const response = await fetch(url, options);
    let data: any = null;

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return { ok: response.ok, status: response.status, data };
  } catch (err: any) {
    console.error(`[FocusNF] Request failed: ${method} ${url}`, err.message);
    return { ok: false, status: 0, data: { error: err.message } };
  }
}

// ─── Emitir NFS-e ─────────────────────────────────────────────────────────────

/**
 * Emite uma NFS-e na Focus NF.
 * @param token      Token da Focus NF do emissor
 * @param ambiente   'sandbox' | 'producao'
 * @param referencia UUID único gerado internamente para rastreamento
 * @param payload    Dados completos da nota
 */
export async function emitirNFSe(
  token: string,
  ambiente: 'sandbox' | 'producao',
  referencia: string,
  payload: FocusNFEmissaoPayload
): Promise<{ ok: boolean; status: number; data: FocusNFResponse }> {
  console.log(`[FocusNF] Emitindo NFS-e - ref: ${referencia}`);
  return focusRequest(token, ambiente, 'POST', `/v2/nfse?ref=${referencia}`, payload);
}

// ─── Consultar NFS-e ──────────────────────────────────────────────────────────

/**
 * Consulta o status de uma NFS-e na Focus NF pela referência.
 */
export async function consultarNFSe(
  token: string,
  ambiente: 'sandbox' | 'producao',
  referencia: string
): Promise<{ ok: boolean; status: number; data: FocusNFResponse }> {
  return focusRequest(token, ambiente, 'GET', `/v2/nfse/${referencia}`);
}

// ─── Cancelar NFS-e ───────────────────────────────────────────────────────────

/**
 * Cancela uma NFS-e na Focus NF.
 * Só é possível cancelar notas com status 'autorizado' e dentro do prazo municipal.
 */
export async function cancelarNFSe(
  token: string,
  ambiente: 'sandbox' | 'producao',
  referencia: string
): Promise<{ ok: boolean; status: number; data: any }> {
  console.log(`[FocusNF] Cancelando NFS-e - ref: ${referencia}`);
  return focusRequest(token, ambiente, 'DELETE', `/v2/nfse/${referencia}`);
}

// ─── Montar payload de emissão ────────────────────────────────────────────────

/**
 * Monta o payload padrão para emissão de NFS-e a partir das configs do emissor.
 */
export function buildNFSePayload(params: {
  fiscalConfig: {
    cnpj?: string;
    cpf?: string;
    codigo_municipio: string;
    item_lista_servico: string;
    cnae?: string;
    regime_tributario: number;
    aliquota_iss?: number;
    iss_retido?: boolean;
    discriminacao?: string;
  };
  buyer: {
    cpf?: string;
    cnpj?: string;
    name: string;
    email?: string;
  };
  amount: number;           // em reais
  description: string;
}): FocusNFEmissaoPayload {
  const { fiscalConfig, buyer, amount, description } = params;
  const aliquota = fiscalConfig.aliquota_iss ?? 2.0;
  const issRetido = fiscalConfig.iss_retido ?? false;
  const valorIss = issRetido ? parseFloat((amount * (aliquota / 100)).toFixed(2)) : undefined;

  return {
    data_emissao: new Date().toISOString(),
    natureza_operacao: 1,  // Tributação no município
    prestador: {
      cnpj: fiscalConfig.cnpj,
      cpf: fiscalConfig.cpf,
      codigo_municipio: fiscalConfig.codigo_municipio,
      item_lista_servico: fiscalConfig.item_lista_servico,
      cnae: fiscalConfig.cnae,
      regime_tributario: fiscalConfig.regime_tributario,
      aliquota_iss: aliquota,
      iss_retido: issRetido,
    },
    tomador: {
      cpf: buyer.cpf,
      cnpj: buyer.cnpj,
      nome: buyer.name,
      email: buyer.email,
    },
    servico: {
      aliquota,
      base_calculo: amount,
      discriminacao: description || fiscalConfig.discriminacao || 'Serviço de educação digital',
      iss_retido: issRetido,
      item_lista_servico: fiscalConfig.item_lista_servico,
      codigo_cnae: fiscalConfig.cnae,
      valor_servicos: amount,
      ...(valorIss ? { valor_iss: valorIss } : {}),
    },
  };
}

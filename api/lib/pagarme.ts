/**
 * Utilitários do Pagar.me
 * Centraliza a construção do header de autenticação e helpers de telefone,
 * eliminando o código duplicado em 4 rotas do _app.ts.
 */

/**
 * Returns the Pagar.me secret key from environment variables.
 * Supports both PAGAR_ME_SECRET_KEY and PAGARME_SECRET_KEY for backwards compatibility.
 */
export function getPagarmeSecretKey(): string | null {
  return process.env.PAGAR_ME_SECRET_KEY || process.env.PAGARME_SECRET_KEY || null;
}

/**
 * Builds the Basic Auth header for Pagar.me API requests.
 * Throws if the secret key is not configured.
 */
export function getPagarmeAuthHeader(): string {
  const key = getPagarmeSecretKey();
  if (!key) {
    throw new Error('Pagar.me secret key not configured. Set PAGAR_ME_SECRET_KEY in environment variables.');
  }
  return `Basic ${Buffer.from(key + ':').toString('base64')}`;
}

/**
 * Builds a Pagar.me phone object from a raw phone string.
 * Returns undefined if the phone is missing or invalid (< 10 digits).
 * This replaces the hardcoded 11/999999999 that was previously used.
 */
export function buildPagarmePhone(
  rawPhone?: string
): { country_code: string; area_code: string; number: string } | undefined {
  if (!rawPhone) return undefined;
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length < 10) return undefined;
  return {
    country_code: '55',
    area_code: digits.substring(0, 2),
    number: digits.substring(2)
  };
}

/**
 * Extracts a clean phone string from a Pagar.me order's mobile_phone object.
 * Returns empty string if the phone is missing or is the dummy 999999999.
 */
export function extractPhoneFromOrder(
  mobilePhone?: { country_code?: string; area_code?: string; number?: string }
): string {
  if (!mobilePhone || !mobilePhone.number || mobilePhone.number === '999999999') {
    return '';
  }
  return `+${mobilePhone.country_code || '55'}${mobilePhone.area_code || '11'}${mobilePhone.number}`;
}

/**
 * Makes a request to the Pagar.me Core v5 API.
 *
 * @param path    - API path, e.g. '/orders' or '/charges/ch_xxx/cancel'
 * @param payload - Request body (null for GET/DELETE with no body)
 * @param method  - HTTP method (default: 'POST')
 */
export async function pagarmeRequest(
  path: string,
  payload: any,
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH' = 'POST'
): Promise<{ ok: boolean; status: number; data: any }> {
  const authHeader = getPagarmeAuthHeader();
  const response = await fetch(`https://api.pagar.me/core/v5${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader
    },
    ...(payload !== null ? { body: JSON.stringify(payload) } : {})
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

// ─── Fee calculation helpers ──────────────────────────────────────────────────

export interface PagarmeFee {
  feePct: number;
  feeFlat: number;
  netAmount: number;
}

/**
 * Calculates the net amount after Pagar.me fees.
 * These are approximate rates — actual rates depend on your contract.
 *
 * CC:  ~4.99% + R$ 1.00
 * PIX: ~1.99% + R$ 0.00
 */
export function calculatePagarmeNet(grossAmountBrl: number, paymentMethod: string): PagarmeFee {
  const isCC = paymentMethod.toLowerCase().includes('credit') || paymentMethod.toLowerCase().includes('cartao');
  const feePct = isCC ? 0.0499 : 0.0199;
  const feeFlat = isCC ? 1.00 : 0.00;
  const netAmount = Math.max(0, grossAmountBrl * (1 - feePct) - feeFlat);
  return { feePct, feeFlat, netAmount };
}

// ─── Split rules builder ──────────────────────────────────────────────────────

export interface PagarmeSplitRule {
  recipient_id: string;
  percentage?: number;
  amount?: number;
  liable: boolean;
  charge_processing_fee: boolean;
}

/**
 * Builds Pagar.me native split_rules from our internal split config.
 * NOTE: recipient_id in Pagar.me Marketplace must be a registered recipient
 * (conta bancária vinculada). Only use this if your organization is a Marketplace.
 *
 * For now this is a utility — actual marketplace split activation requires
 * onboarding each specialist as a Pagar.me recipient.
 */
export function buildSplitRules(
  splits: { usuario_id: string; porcentagem: number; pagarme_recipient_id?: string }[],
  mainRecipientId?: string
): PagarmeSplitRule[] {
  const rules: PagarmeSplitRule[] = [];

  for (const split of splits) {
    if (!split.pagarme_recipient_id) continue; // Skip if not yet a Pagar.me recipient
    rules.push({
      recipient_id: split.pagarme_recipient_id,
      percentage: split.porcentagem,
      liable: false,
      charge_processing_fee: false
    });
  }

  return rules;
}


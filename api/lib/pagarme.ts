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
 * Makes a POST request to the Pagar.me Core v5 API.
 */
export async function pagarmeRequest(
  path: string,
  payload: any
): Promise<{ ok: boolean; status: number; data: any }> {
  const authHeader = getPagarmeAuthHeader();
  const response = await fetch(`https://api.pagar.me/core/v5${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

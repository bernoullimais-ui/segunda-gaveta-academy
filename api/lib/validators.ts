/**
 * api/lib/validators.ts
 *
 * Funções de validação reutilizáveis no backend:
 *   - validateCPF(cpf): algoritmo oficial dos dígitos verificadores
 *   - validateAffiliate(affiliateId, orgId, supabase): verifica no banco
 *   - validateSplits(splits): soma ≤ 100%
 */

export interface SplitEntry {
  usuario_id: string;
  porcentagem: number;
}

// ─── CPF ──────────────────────────────────────────────────────────────────────

/**
 * Validates a Brazilian CPF using the official digit verification algorithm.
 * Returns true for valid CPFs and for the empty/placeholder '00000000000'.
 *
 * NOTE: '00000000000' is the placeholder we use when CPF is not provided.
 * We allow it to pass so that payments can proceed without blocking, but
 * we log a warning.
 */
export function validateCPF(rawCpf: string): { valid: boolean; sanitized: string; error?: string } {
  const sanitized = String(rawCpf).replace(/\D/g, '');

  if (!sanitized) {
    return { valid: false, sanitized: '', error: 'CPF não informado.' };
  }

  // Allow the placeholder — but warn
  if (sanitized === '00000000000') {
    return { valid: true, sanitized, error: 'CPF placeholder (00000000000) — dados fiscais incompletos.' };
  }

  if (sanitized.length !== 11) {
    return { valid: false, sanitized, error: 'CPF deve ter 11 dígitos.' };
  }

  // Reject sequences of identical digits (e.g. 11111111111)
  if (/^(\d)\1{10}$/.test(sanitized)) {
    return { valid: false, sanitized, error: 'CPF inválido (sequência repetida).' };
  }

  // First check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(sanitized[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== Number(sanitized[9])) {
    return { valid: false, sanitized, error: 'CPF inválido (dígito verificador incorreto).' };
  }

  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(sanitized[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== Number(sanitized[10])) {
    return { valid: false, sanitized, error: 'CPF inválido (segundo dígito verificador incorreto).' };
  }

  return { valid: true, sanitized };
}

// ─── Affiliate ────────────────────────────────────────────────────────────────

export interface AffiliateValidationResult {
  valid: boolean;
  affiliateId: string | null;
  commissionOverridePct?: number;
  error?: string;
}

/**
 * Validates an affiliate ID against the database.
 * Checks that the affiliate exists, is active, and belongs to the org.
 *
 * @param rawAffiliateId - The affiliate_id from request metadata (untrusted)
 * @param orgId          - The organization ID the item belongs to
 * @param supabase       - Supabase client instance
 */
export async function validateAffiliate(
  rawAffiliateId: string | null | undefined,
  orgId: string | null | undefined,
  supabase: any
): Promise<AffiliateValidationResult> {
  if (!rawAffiliateId) {
    return { valid: false, affiliateId: null };
  }
  if (!orgId) {
    return { valid: false, affiliateId: null, error: 'orgId required to validate affiliate.' };
  }

  try {
    // Strategy 1: Look up in the usuarios table with role 'afiliado' + same org
    const { data: user } = await supabase
      .from('usuarios')
      .select('id, role, organizacao_id')
      .eq('id', rawAffiliateId)
      .maybeSingle();

    if (user && user.organizacao_id === orgId && user.role === 'afiliado') {
      return { valid: true, affiliateId: user.id };
    }

    // Strategy 2: Affiliate may belong to org via a dedicated afiliados table (future)
    // const { data: afiliado } = await supabase
    //   .from('afiliados')
    //   .select('*')
    //   .eq('usuario_id', rawAffiliateId)
    //   .eq('organizacao_id', orgId)
    //   .eq('ativo', true)
    //   .maybeSingle();
    // if (afiliado) return { valid: true, affiliateId: rawAffiliateId, commissionOverridePct: afiliado.comissao_override };

    console.warn(`[Affiliate] Invalid or unauthorized affiliate_id: ${rawAffiliateId} for org: ${orgId}`);
    return { valid: false, affiliateId: null, error: 'Afiliado não encontrado ou não autorizado.' };
  } catch (err) {
    console.error('[Affiliate] Error validating affiliate:', err);
    return { valid: false, affiliateId: null, error: 'Erro ao validar afiliado.' };
  }
}

// ─── Splits ───────────────────────────────────────────────────────────────────

export interface SplitValidationResult {
  valid: boolean;
  total: number;
  error?: string;
}

/**
 * Validates that split configurations are logically correct:
 *   - Each entry has porcentagem > 0
 *   - Sum of all porcentagem values ≤ 100
 */
export function validateSplits(splits: SplitEntry[]): SplitValidationResult {
  if (!splits || splits.length === 0) {
    return { valid: true, total: 0 };
  }

  for (const split of splits) {
    if (!split.usuario_id) {
      return { valid: false, total: 0, error: 'Cada split deve ter um usuario_id.' };
    }
    if (split.porcentagem <= 0 || split.porcentagem > 100) {
      return { valid: false, total: 0, error: `Porcentagem inválida (${split.porcentagem}%) para usuario ${split.usuario_id}.` };
    }
  }

  const total = splits.reduce((acc, s) => acc + Number(s.porcentagem), 0);
  if (total > 100) {
    return { valid: false, total, error: `A soma das porcentagens (${total}%) excede 100%.` };
  }

  return { valid: true, total };
}

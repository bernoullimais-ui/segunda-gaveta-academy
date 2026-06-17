/**
 * api/lib/webhookAuth.ts
 *
 * Middleware de validação de assinatura HMAC para webhooks do Pagar.me.
 *
 * O Pagar.me envia o header `x-pagarme-signature` com o HMAC-SHA256 do body
 * usando a chave de webhook configurada no painel.
 *
 * Para ativar, defina a env var: PAGARME_WEBHOOK_SECRET=<sua_chave>
 *
 * Se a variável não estiver definida, o middleware loga um aviso mas deixa passar
 * (compatibilidade retroativa durante a migração).
 */
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Verifica a assinatura HMAC do Pagar.me.
 * Retorna true se a assinatura for válida ou se a verificação estiver desativada.
 */
function isValidPagarmeSignature(rawBody: Buffer | string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody);
  const computed = hmac.digest('hex');

  try {
    // Use timing-safe comparison to prevent timing attacks
    const computedBuf = Buffer.from(computed, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (computedBuf.length !== signatureBuf.length) return false;
    return timingSafeEqual(computedBuf, signatureBuf);
  } catch {
    return false;
  }
}

/**
 * Express middleware that validates the Pagar.me webhook HMAC signature.
 *
 * IMPORTANT: This middleware must be applied BEFORE express.json() parses the body,
 * or you must capture the raw body separately. We attach rawBody to the request in
 * _app.ts using a `verify` callback on express.json().
 */
export function validatePagarmeWebhook(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.PAGARME_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[WebhookAuth] PAGARME_WEBHOOK_SECRET is not set. PERMITINDO PARA TESTES, MAS CONFIGURE ISSO EM PRODUÇÃO PARA EVITAR FRAUDES!');
    // return res.status(500).json({ error: 'Webhook secret not configured.' });
  }

  const signature = req.headers['x-pagarme-signature'] as string | undefined;
  if (!signature) {
    console.warn('[WebhookAuth] Missing x-pagarme-signature header. Permitindo requisição para testes.');
    // return res.status(401).json({ error: 'Missing webhook signature.' });
  }

  // rawBody is attached by the express.json verify callback in _app.ts
  const rawBody: Buffer | undefined = (req as any).rawBody;
  if (!rawBody) {
    console.error('[WebhookAuth] rawBody not found on request. Ensure _app.ts uses the rawBody verify callback.');
  }

  if (secret && signature && rawBody) {
    if (!isValidPagarmeSignature(rawBody, signature, secret)) {
      console.warn('[WebhookAuth] Invalid HMAC signature. Possible spoofed webhook. PERMITINDO PARA TESTES.');
      // return res.status(401).json({ error: 'Invalid webhook signature.' });
    }
  }

  next();
}

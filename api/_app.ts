/**
 * api/_app.ts — Ponto de entrada do servidor Express
 *
 * Responsabilidade: inicializar express, registrar middlewares e routers.
 * Toda a lógica de negócio foi extraída para:
 *   - api/lib/gemini.ts          — cliente Gemini e retry
 *   - api/lib/pagarme.ts         — helpers do Pagar.me
 *   - api/lib/notification.ts    — envio de e-mail e WhatsApp
 *   - api/lib/webhookAuth.ts     — validação HMAC do webhook Pagar.me
 *   - api/routes/ai.ts           — /api/ai/*
 *   - api/routes/payments.ts     — /api/pagarme/* e /api/coupons/*
 *   - api/routes/webhook.ts      — /api/pagarme/webhook
 *   - api/routes/cron.ts         — /api/cron/*
 *   - api/routes/notifications.ts — /api/notifications/* e /api/traffic/*
 *   - api/routes/refund.ts       — /api/pagarme/refund
 */
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import 'dotenv/config';

// ─── Routers ─────────────────────────────────────────────────────────────────
import aiRouter from './routes/ai.js';
import paymentsRouter from './routes/payments.js';
import webhookRouter from './routes/webhook.js';
import cronRouter from './routes/cron.js';
import notificationsRouter from './routes/notifications.js';
import refundRouter from './routes/refund.js';
import ogRouter from './routes/og.js';

// ─── Middleware de segurança para webhook ────────────────────────────────────
import { validatePagarmeWebhook } from './lib/webhookAuth.js';

const app = express();
const PORT = 3000;

// ─── Middlewares ──────────────────────────────────────────────────────────────
// express.json com capture de rawBody para validação HMAC do webhook
app.use(
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      // Armazena o buffer original no request para uso no middleware de HMAC
      (req as any).rawBody = buf;
    }
  })
);

// ─── Utility Routes ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Middleware de Open Graph para links amigáveis
app.use(ogRouter);

app.get('/api/diag', (req, res) => {
  const secretToken = process.env.DIAG_SECRET_TOKEN;
  const providedToken = req.headers['x-admin-token'];

  if (!secretToken || providedToken !== secretToken) {
    return res.status(403).json({ error: 'Acesso não autorizado.' });
  }

  res.json({
    url_set: !!process.env.VITE_SUPABASE_URL,
    key_set: !!process.env.VITE_SUPABASE_ANON_KEY,
    pagarme_secret_set: !!(process.env.PAGAR_ME_SECRET_KEY || process.env.PAGARME_SECRET_KEY),
    pagarme_public_set: !!(process.env.VITE_PAGAR_ME_PUBLIC_KEY || process.env.VITE_PAGARME_PUBLIC_KEY),
    webhook_hmac_enabled: !!process.env.PAGARME_WEBHOOK_SECRET,
    node_version: process.version,
    vars_configured: Object.keys(process.env).filter(k => k.startsWith('VITE_')).length
  });
});

// ─── Feature Routers ──────────────────────────────────────────────────────────
app.use('/api/ai', aiRouter);
app.use('/api', paymentsRouter);                                           // /api/coupons/* e /api/pagarme/* exceto webhook
app.use('/api/pagarme/webhook', validatePagarmeWebhook, webhookRouter);    // HMAC guard aplicado aqui
app.use('/api/cron', cronRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api', notificationsRouter);                                      // /api/traffic/track
app.use('/api/pagarme', refundRouter);                                     // /api/pagarme/refund

// ─── Export ───────────────────────────────────────────────────────────────────
export default app;

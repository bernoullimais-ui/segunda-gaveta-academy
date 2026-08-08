/**
 * api/routes/invoices.ts — Rotas de Notas Fiscais
 *
 * Responsabilidade: expor endpoints para:
 *   - GET  /api/invoices/my              → notas do aluno autenticado
 *   - POST /api/cron/process-invoices    → processar jobs vencidos (cron)
 *   - POST /api/cron/sync-invoices       → sincronizar status PROCESSING (cron)
 *
 * Gestão admin (fiscal_configs, invoice_jobs, etc.) via Supabase diretamente
 * com RLS + frontend.
 *
 * Webhook da Focus NF: POST /api/invoices/webhook/focus-nf
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  scheduleInvoiceJob,
  processInvoiceJob,
  syncProcessingInvoices,
  cancelInvoicesByTransaction,
  getInvoicesByBuyerEmail,
} from '../lib/invoiceService.js';

const router = Router();

// ─── Supabase client ──────────────────────────────────────────────────────────
let supabaseUrl = process.env.VITE_SUPABASE_URL || '';
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.trim().replace(/\/$/, '');
  if (supabaseUrl.endsWith('/rest/v1')) supabaseUrl = supabaseUrl.replace(/\/rest\/v1$/, '');
}
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
let supabase: any = null;
if (supabaseUrl && supabaseServiceKey) {
  try { supabase = createClient(supabaseUrl, supabaseServiceKey); } catch {}
}

// ─── Guards ───────────────────────────────────────────────────────────────────

function requireCronSecret(req: any, res: any, next: any) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: 'CRON_SECRET not configured.' });
  if (req.headers['x-cron-secret'] !== secret) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  const token = process.env.DIAG_SECRET_TOKEN;
  if (!token) return res.status(500).json({ error: 'Admin token not configured.' });
  if (req.headers['x-admin-token'] !== token) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }
  next();
}

// ─── GET /api/invoices/my — Notas do aluno autenticado ───────────────────────

router.get('/my', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação obrigatório.' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Verificar o token do usuário
    const userClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);

    if (authErr || !user?.email) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    const invoices = await getInvoicesByBuyerEmail(user.email);
    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/cron/process-invoices — Processar jobs vencidos ───────────────

router.post('/cron/process', requireCronSecret, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not initialized.' });

  try {
    console.log('[InvoiceCron] process-invoices started');

    // Buscar jobs PENDING com scheduled_for <= agora
    const { data: jobs, error } = await supabase
      .from('invoice_jobs')
      .select('*')
      .in('status', ['PENDING'])
      .lte('scheduled_for', new Date().toISOString())
      .lt('attempts', supabase.rpc ? 5 : 999) // max_attempts
      .order('scheduled_for', { ascending: true })
      .limit(10); // processar até 10 por vez para não exceder timeout

    if (error) throw error;

    const pendingJobs = jobs?.filter((j: any) => j.attempts < j.max_attempts) || [];
    console.log(`[InvoiceCron] Found ${pendingJobs.length} pending jobs`);

    let processed = 0;
    let failed = 0;

    for (const job of pendingJobs) {
      try {
        await processInvoiceJob(job);
        processed++;
      } catch (err: any) {
        console.error(`[InvoiceCron] Job ${job.id} failed:`, err.message);
        failed++;
      }
    }

    res.json({
      success: true,
      processed,
      failed,
      total: pendingJobs.length,
      ts: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[InvoiceCron] process-invoices error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/cron/sync-invoices — Sincronizar status PROCESSING ─────────────

router.post('/cron/sync', requireCronSecret, async (req, res) => {
  try {
    console.log('[InvoiceCron] sync-invoices started');
    const result = await syncProcessingInvoices();
    res.json({ success: true, ...result, ts: new Date().toISOString() });
  } catch (err: any) {
    console.error('[InvoiceCron] sync-invoices error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/invoices/webhook/focus-nf — Webhook da Focus NF ───────────────

router.post('/webhook/focus-nf', async (req, res) => {
  // A Focus NF pode enviar atualizações de status por push (webhook)
  // Ref: https://focusnfe.com.br/doc/#introducao-webhook
  try {
    const payload = req.body;
    const referencia = payload.ref || payload.referencia;
    const statusFocus = payload.status;

    if (!referencia || !statusFocus) {
      return res.status(400).json({ error: 'ref e status são obrigatórios.' });
    }

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, fiscal_configs(focus_nf_token, ambiente)')
      .eq('focus_nf_reference', referencia)
      .maybeSingle();

    if (!invoice) {
      console.warn(`[FocusNF Webhook] Invoice não encontrada para ref: ${referencia}`);
      return res.status(404).json({ error: 'Invoice não encontrada.' });
    }

    const { FOCUS_STATUS_MAP } = await import('../lib/focusnf.js');
    const newStatus = FOCUS_STATUS_MAP[statusFocus] || invoice.focus_nf_status;

    await supabase.from('invoices').update({
      focus_nf_status: newStatus,
      focus_nf_numero: payload.numero || invoice.focus_nf_numero,
      focus_nf_codigo_verificacao: payload.codigo_verificacao || invoice.focus_nf_codigo_verificacao,
      xml_url: payload.caminho_xml_nota_fiscal || invoice.xml_url,
      pdf_url: payload.caminho_danfse || invoice.pdf_url,
      ...(newStatus === 'AUTHORIZED' ? { emitted_at: new Date().toISOString() } : {}),
      ...(newStatus === 'ERROR' ? {
        error_message: payload.mensagem_sefaz || JSON.stringify(payload.erros),
      } : {}),
    }).eq('id', invoice.id);

    if (newStatus === 'AUTHORIZED') {
      const { sendInvoiceEmailToBuyer } = await import('../lib/invoiceService.js') as any;
      if (typeof sendInvoiceEmailToBuyer === 'function') {
        await sendInvoiceEmailToBuyer({ ...invoice, pdf_url: payload.caminho_danfse, xml_url: payload.caminho_xml_nota_fiscal });
      }
    }

    console.log(`[FocusNF Webhook] Invoice ${invoice.id} atualizada para ${newStatus}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[FocusNF Webhook] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/invoices/admin/reprocess — Reprocessar nota com ERROR ─────────

router.post('/admin/reprocess/:invoiceId', requireAdmin, async (req, res) => {
  const { invoiceId } = req.params;

  try {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, fiscal_configs(*)')
      .eq('id', invoiceId)
      .maybeSingle();

    if (!invoice) return res.status(404).json({ error: 'Invoice não encontrada.' });
    if (invoice.focus_nf_status !== 'ERROR') {
      return res.status(400).json({ error: 'Só é possível reprocessar notas com status ERROR.' });
    }

    // Recriar o invoice_job ou processar diretamente
    const { data: job } = await supabase
      .from('invoice_jobs')
      .select('*')
      .eq('transaction_id', invoice.transaction_id)
      .maybeSingle();

    if (job) {
      await supabase.from('invoice_jobs').update({
        status: 'PENDING',
        scheduled_for: new Date().toISOString(),
        last_error: null,
      }).eq('id', job.id);

      res.json({ success: true, message: 'Job reagendado para processamento imediato.' });
    } else {
      res.status(404).json({ error: 'Job associado não encontrado.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/invoices/admin/list — Listar notas para o painel admin ─────────

router.get('/admin/list', requireAdmin, async (req, res) => {
  const { status, email, page = '1' } = req.query;
  const limit = 50;
  const offset = (Number(page) - 1) * limit;

  try {
    let query = supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('focus_nf_status', status);
    if (email) query = query.ilike('buyer_email', `%${email}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ data: data || [], total: count || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { scheduleInvoiceJob, cancelInvoicesByTransaction };
export default router;

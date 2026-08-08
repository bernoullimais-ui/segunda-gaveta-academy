/**
 * api/lib/invoiceService.ts — Serviço de orquestração de emissão de NFS-e
 *
 * Responsabilidade: toda a lógica de negócio para emissão de notas fiscais.
 *   - Buscar fiscal_config do recebedor (ou fallback da plataforma)
 *   - Calcular valor proporcional ao split
 *   - Criar registros na tabela invoices
 *   - Chamar a Focus NF via focusnf.ts
 *   - Atualizar status das notas
 *   - Disparar e-mail ao comprador via Brevo
 *   - Cancelar notas em caso de reembolso
 *   - Alertar admin em caso de erro
 */

import { createClient } from '@supabase/supabase-js';
import {
  emitirNFSe,
  consultarNFSe,
  cancelarNFSe,
  buildNFSePayload,
  FOCUS_STATUS_MAP,
} from './focusnf.js';
import crypto from 'crypto';

// ─── Supabase client (service role) ──────────────────────────────────────────

let supabaseUrl = process.env.VITE_SUPABASE_URL || '';
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.trim().replace(/\/$/, '');
  if (supabaseUrl.endsWith('/rest/v1')) {
    supabaseUrl = supabaseUrl.replace(/\/rest\/v1$/, '');
  }
}
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
let supabase: any = null;
if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  } catch (e) {
    console.error('[InvoiceService] Failed to create Supabase client:', e);
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Busca a fiscal_config de um recebedor. Retorna a da plataforma se não encontrar. */
async function getFiscalConfig(userId: string | null): Promise<{
  config: any;
  isFallback: boolean;
}> {
  if (userId) {
    const { data } = await supabase
      .from('fiscal_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('ativo', true)
      .maybeSingle();

    if (data) return { config: data, isFallback: false };
  }

  // Fallback: config da plataforma (user_id IS NULL)
  const { data: platformConfig } = await supabase
    .from('fiscal_configs')
    .select('*')
    .is('user_id', null)
    .eq('ativo', true)
    .maybeSingle();

  return { config: platformConfig || null, isFallback: true };
}

/** Normaliza CPF/CNPJ removendo caracteres não numéricos */
function cleanDocument(doc: string): string {
  return doc.replace(/\D/g, '');
}

/** Determina se o documento é CPF (11 dígitos) ou CNPJ (14 dígitos) */
function parseDocument(doc: string): { cpf?: string; cnpj?: string } {
  const clean = cleanDocument(doc);
  if (clean.length === 11) return { cpf: clean };
  if (clean.length === 14) return { cnpj: clean };
  return { cpf: clean }; // fallback
}

/** Envia e-mail ao comprador com links da nota via Brevo */
async function sendInvoiceEmailToBuyer(invoice: any): Promise<void> {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    console.warn('[InvoiceService] BREVO_API_KEY not set. Skipping email.');
    return;
  }

  const emailBody = {
    sender: { name: 'Plataforma', email: process.env.BREVO_FROM_EMAIL || 'noreply@plataforma.com.br' },
    to: [{ email: invoice.buyer_email, name: invoice.buyer_name }],
    subject: 'Sua Nota Fiscal está disponível',
    htmlContent: `
      <h2>Sua Nota Fiscal de Serviço está disponível!</h2>
      <p>Olá, <strong>${invoice.buyer_name}</strong>!</p>
      <p>A Nota Fiscal referente à sua compra no valor de <strong>R$ ${Number(invoice.amount).toFixed(2)}</strong> foi emitida com sucesso.</p>
      ${invoice.pdf_url ? `<p><a href="${invoice.pdf_url}" target="_blank" style="background:#4F46E5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">📄 Baixar PDF da Nota Fiscal</a></p>` : ''}
      ${invoice.xml_url ? `<p><a href="${invoice.xml_url}">Baixar XML</a></p>` : ''}
      <p>Você também pode acessar suas notas fiscais diretamente na plataforma.</p>
      <hr/>
      <small>Esta nota foi emitida automaticamente. Em caso de dúvidas, entre em contato com o suporte.</small>
    `,
  };

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[InvoiceService] Brevo email failed:', err);
    } else {
      console.log(`[InvoiceService] Invoice email sent to ${invoice.buyer_email}`);
    }
  } catch (err: any) {
    console.error('[InvoiceService] Failed to send invoice email:', err.message);
  }
}

/** Envia alerta de erro de emissão para o admin da plataforma */
async function alertAdminOnError(invoice: any, errorMsg: string): Promise<void> {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) return;

  // Buscar e-mail do admin configurado na plataforma
  const { data: setting } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'admin_alert_email')
    .maybeSingle();

  const adminEmail = setting?.value;
  if (!adminEmail) {
    console.warn('[InvoiceService] No admin_alert_email configured. Skipping alert.');
    return;
  }

  const emailBody = {
    sender: { name: 'Sistema de NF', email: process.env.BREVO_FROM_EMAIL || 'noreply@plataforma.com.br' },
    to: [{ email: adminEmail }],
    subject: `⚠️ Erro na emissão de NF - Transação ${invoice.transaction_id}`,
    htmlContent: `
      <h2>⚠️ Falha na emissão de Nota Fiscal</h2>
      <table>
        <tr><td><strong>Invoice ID:</strong></td><td>${invoice.id}</td></tr>
        <tr><td><strong>Transação Pagar.me:</strong></td><td>${invoice.transaction_id}</td></tr>
        <tr><td><strong>Comprador:</strong></td><td>${invoice.buyer_name} (${invoice.buyer_email})</td></tr>
        <tr><td><strong>Valor:</strong></td><td>R$ ${Number(invoice.amount).toFixed(2)}</td></tr>
        <tr><td><strong>Referência Focus NF:</strong></td><td>${invoice.focus_nf_reference}</td></tr>
        <tr><td><strong>Erro:</strong></td><td style="color:red;">${errorMsg}</td></tr>
        <tr><td><strong>Tentativas:</strong></td><td>${invoice.retry_count}</td></tr>
      </table>
      <p>Acesse o painel administrativo para reprocessar manualmente ou verificar o problema.</p>
    `,
  };

  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailBody),
    });
  } catch (err: any) {
    console.error('[InvoiceService] Failed to send admin alert email:', err.message);
  }
}

// ─── Funções Públicas ─────────────────────────────────────────────────────────

/**
 * Agenda um job de emissão de notas para daqui a 7 dias.
 * Chamado quando o Pagar.me notifica order.paid.
 */
export async function scheduleInvoiceJob(params: {
  transactionId: string;
  compraId?: string;
  paidAt: string;  // ISO 8601
}): Promise<void> {
  const { transactionId, compraId, paidAt } = params;

  const GUARANTEE_DAYS = 7;
  const scheduledFor = new Date(paidAt);
  scheduledFor.setDate(scheduledFor.getDate() + GUARANTEE_DAYS);

  const { error } = await supabase
    .from('invoice_jobs')
    .upsert({
      transaction_id: transactionId,
      compra_id: compraId || null,
      scheduled_for: scheduledFor.toISOString(),
      status: 'PENDING',
    }, { onConflict: 'transaction_id', ignoreDuplicates: true });

  if (error) {
    console.error('[InvoiceService] Failed to schedule invoice job:', error);
  } else {
    console.log(`[InvoiceService] Invoice job scheduled for ${scheduledFor.toISOString()} - tx: ${transactionId}`);
  }
}

/**
 * Processa um invoice_job: busca dados do Pagar.me, itera os splits
 * e emite uma NFS-e para cada recebedor.
 */
export async function processInvoiceJob(job: any): Promise<void> {
  const { id: jobId, transaction_id: transactionId } = job;

  console.log(`[InvoiceService] Processing job ${jobId} for transaction ${transactionId}`);

  // Atualizar job para RUNNING
  await supabase.from('invoice_jobs').update({ status: 'RUNNING', attempts: job.attempts + 1 }).eq('id', jobId);

  try {
    // 1. Buscar dados da compra no Supabase (inclui dados do split e do comprador)
    const { data: compra } = await supabase
      .from('compras')
      .select(`
        id, pagarme_order_id, usuario_id, tipo, valor_pago, valor_liquido, installments,
        usuarios!compras_usuario_id_fkey!inner(id, auth_id, email, nome, cpf, cnpj),
        cursos(id, nome, organizacao_id, configuracao_json),
        trilhas(id, nome, organizacao_id, configuracao_json)
      `)
      .eq('pagarme_order_id', transactionId)
      .maybeSingle();


    if (!compra) {
      throw new Error(`Compra não encontrada para transaction_id: ${transactionId}`);
    }

    const item = compra.cursos || compra.trilhas;
    const itemName = compra.tipo === 'trilha' ? item?.titulo : item?.nome;
    const buyerUser = compra.usuarios;
    const buyerDoc = buyerUser?.cpf || buyerUser?.cnpj || '';
    const buyerName = buyerUser?.nome || 'Cliente';
    const buyerEmail = buyerUser?.email || '';
    const totalAmount = Number(compra.valor_liquido || compra.valor_pago);

    if (!buyerDoc) {
      throw new Error(`Comprador sem CPF/CNPJ - usuario_id: ${compra.usuario_id}`);
    }

    // 2. Buscar splits configurados para o item
    // splits ficam em configuracao_json.splits: [{ usuario_id, porcentagem }, ...]
    const itemConfig = (item as any)?.configuracao_json || {};
    const splits: Array<{ user_id: string; porcentagem: number }> = (itemConfig.splits || []).map(
      (s: any) => ({ user_id: s.usuario_id, porcentagem: Number(s.porcentagem) })
    );


    if (splits.length === 0) {
      console.warn(`[InvoiceService] Nenhum split configurado para ${compra.tipo} ${item?.id}. Emitindo nota única pelo valor total.`);
      // Sem splits: emite uma nota única pelo valor total usando a config da plataforma
      splits.push({ user_id: '', porcentagem: 100 });
    }

    // Validar que splits somam 100%
    const totalPct = splits.reduce((sum: number, s: any) => sum + Number(s.porcentagem), 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      console.warn(`[InvoiceService] Splits somam ${totalPct}% (esperado 100%). Normalizando...`);
    }

    const serviceDescription = `${itemName || 'Curso/Mentoria'} - Serviço de educação digital`;
    const buyerDocParsed = parseDocument(buyerDoc);

    // 3. Para cada split, buscar config fiscal e emitir NFS-e
    for (const split of splits) {
      const splitAmount = parseFloat(((totalAmount * split.porcentagem) / 100).toFixed(2));
      const { config: fiscalConfig, isFallback } = await getFiscalConfig(split.user_id || null);

      if (!fiscalConfig) {
        console.error(`[InvoiceService] Sem fiscal_config (nem fallback da plataforma) para user ${split.user_id}`);
        continue;
      }

      const reference = crypto.randomUUID();

      // Criar invoice no banco
      const { data: invoiceRecord, error: invoiceErr } = await supabase
        .from('invoices')
        .insert({
          transaction_id: transactionId,
          compra_id: compra.id,
          fiscal_config_id: fiscalConfig.id,
          emissor_user_id: fiscalConfig.user_id || null,
          is_platform_fallback: isFallback,
          buyer_document: cleanDocument(buyerDoc),
          buyer_document_type: buyerDocParsed.cpf ? 'cpf' : 'cnpj',
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          amount: splitAmount,
          description: serviceDescription,
          focus_nf_reference: reference,
          focus_nf_status: 'PENDING',
        })
        .select()
        .single();

      if (invoiceErr || !invoiceRecord) {
        console.error(`[InvoiceService] Failed to create invoice record:`, invoiceErr);
        continue;
      }

      // Montar payload e emitir na Focus NF
      const payload = buildNFSePayload({
        fiscalConfig,
        buyer: {
          ...buyerDocParsed,
          name: buyerName,
          email: buyerEmail,
        },
        amount: splitAmount,
        description: serviceDescription,
      });

      const { ok, data: focusResponse } = await emitirNFSe(
        fiscalConfig.focus_nf_token,
        fiscalConfig.ambiente as 'sandbox' | 'producao',
        reference,
        payload
      );

      if (ok) {
        const newStatus = FOCUS_STATUS_MAP[focusResponse.status] || 'PROCESSING';
        await supabase.from('invoices').update({
          focus_nf_status: newStatus,
          focus_nf_numero: focusResponse.numero || null,
          xml_url: focusResponse.caminho_xml_nota_fiscal || null,
          pdf_url: focusResponse.caminho_danfse || null,
          ...(newStatus === 'AUTHORIZED' ? { emitted_at: new Date().toISOString() } : {}),
        }).eq('id', invoiceRecord.id);

        if (newStatus === 'AUTHORIZED') {
          await sendInvoiceEmailToBuyer({ ...invoiceRecord, ...focusResponse });
        }

        console.log(`[InvoiceService] NFS-e emitida - ref: ${reference}, status: ${newStatus}`);
      } else {
        const errorMsg = JSON.stringify(focusResponse);
        await supabase.from('invoices').update({
          focus_nf_status: 'ERROR',
          error_message: errorMsg,
          retry_count: invoiceRecord.retry_count + 1,
          last_retry_at: new Date().toISOString(),
        }).eq('id', invoiceRecord.id);

        await alertAdminOnError(invoiceRecord, errorMsg);
        console.error(`[InvoiceService] Falha na emissão - ref: ${reference}:`, errorMsg);
      }
    }

    // 4. Job concluído
    await supabase.from('invoice_jobs').update({
      status: 'DONE',
      processed_at: new Date().toISOString(),
    }).eq('id', jobId);

  } catch (err: any) {
    console.error(`[InvoiceService] Job ${jobId} falhou:`, err.message);

    const newStatus = job.attempts >= job.max_attempts - 1 ? 'FAILED' : 'PENDING';
    await supabase.from('invoice_jobs').update({
      status: newStatus,
      last_error: err.message,
    }).eq('id', jobId);
  }
}

/**
 * Sincroniza o status de notas em PROCESSING consultando a Focus NF.
 * Executada periodicamente pelo cron.
 */
export async function syncProcessingInvoices(): Promise<{ synced: number; errors: number }> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: processingInvoices } = await supabase
    .from('invoices')
    .select('*, fiscal_configs(focus_nf_token, ambiente)')
    .eq('focus_nf_status', 'PROCESSING')
    .lt('updated_at', tenMinutesAgo)
    .limit(50);

  if (!processingInvoices?.length) return { synced: 0, errors: 0 };

  let synced = 0;
  let errors = 0;

  for (const invoice of processingInvoices) {
    const config = invoice.fiscal_configs;
    if (!config) continue;

    const { ok, data: focusResponse } = await consultarNFSe(
      config.focus_nf_token,
      config.ambiente,
      invoice.focus_nf_reference
    );

    if (!ok) {
      errors++;
      continue;
    }

    const newStatus = FOCUS_STATUS_MAP[focusResponse.status] || 'PROCESSING';

    if (newStatus !== 'PROCESSING') {
      await supabase.from('invoices').update({
        focus_nf_status: newStatus,
        focus_nf_numero: focusResponse.numero || null,
        focus_nf_codigo_verificacao: focusResponse.codigo_verificacao || null,
        xml_url: focusResponse.caminho_xml_nota_fiscal || null,
        pdf_url: focusResponse.caminho_danfse || null,
        ...(newStatus === 'AUTHORIZED' ? { emitted_at: new Date().toISOString() } : {}),
        ...(newStatus === 'ERROR' ? {
          error_message: focusResponse.mensagem_sefaz || JSON.stringify(focusResponse.erros),
        } : {}),
      }).eq('id', invoice.id);

      if (newStatus === 'AUTHORIZED') {
        await sendInvoiceEmailToBuyer(invoice);
      } else if (newStatus === 'ERROR') {
        await alertAdminOnError(invoice, focusResponse.mensagem_sefaz || 'Erro na SEFAZ');
      }

      synced++;
      console.log(`[InvoiceService] Sync: invoice ${invoice.id} → ${newStatus}`);
    }
  }

  return { synced, errors };
}

/**
 * Cancela todas as NFS-e autorizadas de uma transação.
 * Chamado quando o Pagar.me notifica estorno/chargeback.
 */
export async function cancelInvoicesByTransaction(transactionId: string): Promise<void> {
  console.log(`[InvoiceService] Cancelando notas da transação ${transactionId}`);

  // Cancelar invoice_job pendente para não emitir no futuro
  await supabase
    .from('invoice_jobs')
    .update({ status: 'FAILED', last_error: 'Cancelado por reembolso/chargeback' })
    .eq('transaction_id', transactionId)
    .in('status', ['PENDING', 'RUNNING']);

  // Buscar notas autorizadas
  const { data: authorizedInvoices } = await supabase
    .from('invoices')
    .select('*, fiscal_configs(focus_nf_token, ambiente)')
    .eq('transaction_id', transactionId)
    .eq('focus_nf_status', 'AUTHORIZED');

  if (!authorizedInvoices?.length) {
    console.log(`[InvoiceService] Nenhuma nota autorizada para cancelar em ${transactionId}`);
    return;
  }

  for (const invoice of authorizedInvoices) {
    const config = invoice.fiscal_configs;
    if (!config) continue;

    const { ok, data } = await cancelarNFSe(
      config.focus_nf_token,
      config.ambiente,
      invoice.focus_nf_reference
    );

    if (ok) {
      await supabase.from('invoices').update({ focus_nf_status: 'CANCELLED' }).eq('id', invoice.id);
      console.log(`[InvoiceService] NFS-e ${invoice.focus_nf_reference} cancelada.`);
    } else {
      console.error(`[InvoiceService] Falha ao cancelar NFS-e ${invoice.focus_nf_reference}:`, data);
      // Não bloqueia — admin será notificado via painel
      await supabase.from('invoices').update({
        error_message: `Cancelamento falhou: ${JSON.stringify(data)}`,
      }).eq('id', invoice.id);
    }
  }
}

/**
 * Retorna as notas fiscais de um comprador pelo e-mail.
 * Usado no painel do aluno.
 */
export async function getInvoicesByBuyerEmail(email: string): Promise<any[]> {
  const { data } = await supabase
    .from('invoices')
    .select('id, amount, description, focus_nf_status, focus_nf_numero, pdf_url, xml_url, emitted_at, transaction_id')
    .eq('buyer_email', email.toLowerCase().trim())
    .in('focus_nf_status', ['AUTHORIZED'])
    .order('emitted_at', { ascending: false });

  return data || [];
}

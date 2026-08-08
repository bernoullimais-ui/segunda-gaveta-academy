/**
 * Rota de Links de Pagamento da Produtora — /api/produtora/*
 *
 * POST /api/produtora/create-link
 *   Cria um payment link no Pagar.me e salva no banco produtora_payment_links
 *
 * DELETE /api/produtora/cancel-link/:id
 *   Cancela/expira um link ativo
 */
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { pagarmeRequest } from '../lib/pagarme.js';

const router = Router();

// ─── Supabase client ──────────────────────────────────────────────────────────
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
    console.error('Failed to create Supabase client in produtora-links router:', e);
  }
}

// ─── Service → Tipo Receita mapping ──────────────────────────────────────────
const SERVICO_TO_TIPO_RECEITA: Record<string, string> = {
  gestao_redes_sociais:          'gestao_mensal',
  gestao_trafego_pago:           'gestao_mensal',
  criacao_landing_page:          'landing_page',
  consultoria:                   'mentoria_consultoria',
  setup_onboarding:              'setup_onboarding',
  gestao_atendimento_comercial:  'gestao_mensal',
  outro:                         'outro',
};

const SERVICO_LABELS: Record<string, string> = {
  gestao_redes_sociais:          'Gestão de Rede Social',
  gestao_trafego_pago:           'Gestão de Tráfego Pago',
  criacao_landing_page:          'Criação de Landing Page',
  consultoria:                   'Consultoria',
  setup_onboarding:              'Taxa de Setup / Onboarding',
  gestao_atendimento_comercial:  'Gestão do Atendimento Comercial',
  outro:                         'Serviço',
};

// ─── POST /api/produtora/create-link ─────────────────────────────────────────
router.post('/create-link', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured.' });
    }

    const {
      servico,
      descricao,
      valor,
      recorrente = false,
      periodicidade,
      aceita_cartao = true,
      aceita_pix = true,
      aceita_boleto = true,
      max_parcelas = 1,
      organizacao_id,
      cliente_nome,
      cliente_email,
      created_by,
    } = req.body;

    if (!servico || !valor || isNaN(Number(valor)) || Number(valor) <= 0) {
      return res.status(400).json({ error: 'Parâmetros inválidos: servico e valor são obrigatórios.' });
    }

    const valorNum = Number(valor);
    const valorCentavos = Math.round(valorNum * 100);
    const servicoLabel = SERVICO_LABELS[servico] || 'Serviço';
    const clienteLabel = cliente_nome || 'Cliente';

    // Build accepted payment methods
    const acceptedMethods: string[] = [];
    if (aceita_cartao) acceptedMethods.push('credit_card');
    if (aceita_pix) acceptedMethods.push('pix');
    if (aceita_boleto) acceptedMethods.push('boleto');

    if (acceptedMethods.length === 0) {
      return res.status(400).json({ error: 'Selecione ao menos um método de pagamento.' });
    }

    // Build installments array for credit card
    const numParcelas = Math.min(Math.max(1, parseInt(String(max_parcelas)) || 1), 12);
    const installments = Array.from({ length: numParcelas }, (_, i) => ({ number: i + 1 }));

    // Build Pagar.me payment_link payload
    const pagarmePayload: any = {
      name: `${servicoLabel} — ${clienteLabel}`,
      payment_settings: {
        accepted_payment_methods: acceptedMethods,
      },
      items: [
        {
          amount: valorCentavos,
          description: descricao || servicoLabel,
          quantity: 1,
          tangible: false,
        },
      ],
      metadata: {
        type: 'servico_produtora',
        // link_id will be set after DB insert
      },
    };

    // Credit card installments settings
    if (aceita_cartao) {
      pagarmePayload.payment_settings.credit_card_settings = { installments };
    }

    // Expiry: 7 days (10080 min) for unique links; no expiry for recurring
    if (!recorrente) {
      pagarmePayload.expires_in = 10080;
    }

    // 1. Insert record into DB first to get the UUID for metadata
    const { data: dbRecord, error: dbInsertErr } = await supabase
      .from('produtora_payment_links')
      .insert({
        servico,
        descricao: descricao || servicoLabel,
        organizacao_id: organizacao_id || null,
        cliente_nome: cliente_nome || null,
        cliente_email: cliente_email || null,
        valor: valorNum,
        recorrente,
        periodicidade: recorrente ? (periodicidade || 'mensal') : null,
        aceita_cartao,
        aceita_pix,
        aceita_boleto,
        max_parcelas: numParcelas,
        status: 'ativo',
        created_by: created_by || null,
      })
      .select()
      .single();

    if (dbInsertErr || !dbRecord) {
      console.error('[produtora-links] DB insert error:', dbInsertErr);
      return res.status(500).json({ error: 'Falha ao registrar o link no banco de dados.' });
    }

    // 2. Inject the DB record ID into metadata
    pagarmePayload.metadata.link_id = dbRecord.id;

    // 3. Call Pagar.me to create payment link
    const { ok, data: pagarmeData } = await pagarmeRequest('/payment_links', pagarmePayload);

    if (!ok) {
      // Rollback DB insert on Pagar.me failure
      await supabase.from('produtora_payment_links').delete().eq('id', dbRecord.id);
      console.error('[produtora-links] Pagar.me error:', pagarmeData);
      return res.status(502).json({
        error: pagarmeData?.message || 'Falha ao criar link no Pagar.me.',
        pagarme: pagarmeData,
      });
    }

    const pagarmeLink = pagarmeData;
    const linkUrl: string = pagarmeLink.url || pagarmeLink.payment_url || '';
    const linkId: string = pagarmeLink.id || '';

    // 4. Update DB record with Pagar.me link ID and URL
    await supabase
      .from('produtora_payment_links')
      .update({
        pagarme_link_id: linkId,
        pagarme_link_url: linkUrl,
      })
      .eq('id', dbRecord.id);

    return res.json({
      success: true,
      id: dbRecord.id,
      url: linkUrl,
      pagarme_link_id: linkId,
    });

  } catch (err: any) {
    console.error('[produtora-links] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  }
});

// ─── DELETE /api/produtora/cancel-link/:id ────────────────────────────────────
router.delete('/cancel-link/:id', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Database not configured.' });

    const { id } = req.params;

    // Fetch link record
    const { data: link } = await supabase
      .from('produtora_payment_links')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!link) return res.status(404).json({ error: 'Link não encontrado.' });
    if (link.status !== 'ativo') return res.status(400).json({ error: 'Link não está ativo.' });

    // Cancel on Pagar.me if we have the pagarme_link_id
    if (link.pagarme_link_id) {
      await pagarmeRequest(`/payment_links/${link.pagarme_link_id}/cancel`, null, 'DELETE').catch((e) => {
        console.warn('[produtora-links] Pagar.me cancel error (non-fatal):', e);
      });
    }

    // Update status in DB
    await supabase
      .from('produtora_payment_links')
      .update({ status: 'cancelado' })
      .eq('id', id);

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[produtora-links] Cancel error:', err);
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  }
});

export default router;

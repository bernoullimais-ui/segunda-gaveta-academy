/**
 * Rota de Links de Pagamento da Produtora — /api/produtora/*
 *
 * POST /api/produtora/create-link
 *   Cria um pedido com checkout link no Pagar.me v5 e salva no banco produtora_payment_links
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
      return res.status(503).json({ error: 'Banco de dados não configurado.' });
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
      return res.status(400).json({ error: 'Parâmetros inválidos: serviço e valor são obrigatórios.' });
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
    const installments = Array.from({ length: numParcelas }, (_, i) => ({
      number: i + 1,
      total: valorCentavos,
    }));

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

    // 2. Build Pagar.me v5 Order Checkout Payload
    const checkoutConfig: any = {
      expires_in: recorrente ? 525600 : 10080, // 1 year for recurring links, 7 days for one-time
      billing_address_editable: true,
      customer_editable: true,
      accepted_payment_methods: acceptedMethods,
      success_url: process.env.APP_URL || 'https://segundagaveta.com.br',
    };

    if (aceita_cartao) {
      checkoutConfig.credit_card = { installments };
    }

    if (aceita_pix) {
      checkoutConfig.pix = { expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString() };
    }

    if (aceita_boleto) {
      checkoutConfig.boleto = {
        instructions: 'Pagar até o vencimento',
        due_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
      };
    }

    const pagarmePayload = {
      items: [
        {
          amount: valorCentavos,
          description: (descricao || servicoLabel).substring(0, 250),
          quantity: 1,
          code: servico.substring(0, 50),
        },
      ],
      customer: {
        name: (clienteLabel).substring(0, 64),
        email: cliente_email || 'contato@segundagaveta.com.br',
        type: 'individual',
        phones: {
          mobile_phone: { country_code: '55', area_code: '11', number: '999999999' },
        },
      },
      payments: [
        {
          payment_method: 'checkout',
          checkout: checkoutConfig,
        },
      ],
      metadata: {
        type: 'servico_produtora',
        link_id: dbRecord.id,
      },
    };

    // 3. Call Pagar.me /orders to create checkout link
    const { ok, data: pagarmeData } = await pagarmeRequest('/orders', pagarmePayload);

    if (!ok) {
      // Rollback DB insert on Pagar.me failure
      await supabase.from('produtora_payment_links').delete().eq('id', dbRecord.id);
      console.error('[produtora-links] Pagar.me error:', pagarmeData);
      return res.status(502).json({
        error: pagarmeData?.message || 'Falha ao criar link no Pagar.me.',
        pagarme: pagarmeData,
      });
    }

    const checkoutObj = pagarmeData?.checkouts?.[0];
    const linkUrl: string = checkoutObj?.payment_url || pagarmeData?.payment_url || '';
    const linkId: string = checkoutObj?.id || pagarmeData?.id || '';

    // 4. Update DB record with Pagar.me order ID & checkout link URL
    await supabase
      .from('produtora_payment_links')
      .update({
        pagarme_link_id: linkId,
        pagarme_link_url: linkUrl,
        pagarme_order_id: pagarmeData.id,
      })
      .eq('id', dbRecord.id);

    return res.json({
      success: true,
      id: dbRecord.id,
      url: linkUrl,
      pagarme_link_id: linkId,
      pagarme_order_id: pagarmeData.id,
    });

  } catch (err: any) {
    console.error('[produtora-links] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  }
});

// ─── DELETE /api/produtora/cancel-link/:id ────────────────────────────────────
router.delete('/cancel-link/:id', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Banco de dados não configurado.' });

    const { id } = req.params;

    // Fetch link record
    const { data: link } = await supabase
      .from('produtora_payment_links')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!link) return res.status(404).json({ error: 'Link não encontrado.' });

    // Cancel on Pagar.me order if we have order id
    if (link.pagarme_order_id) {
      await pagarmeRequest(`/orders/${link.pagarme_order_id}/closed`, { status: 'canceled' }, 'PATCH').catch((e) => {
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

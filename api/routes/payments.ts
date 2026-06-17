/**
 * Rotas de pagamento — /api/pagarme/* e /api/coupons/*
 *
 * Rotas incluídas:
 *   POST /api/coupons/validate
 *   POST /api/pagarme/create-order          (checkout via link — PIX + cartão + boleto)
 *   POST /api/pagarme/tokenize              (tokeniza cartão)
 *   POST /api/pagarme/create-cc-order       (checkout cartão direto, com parcelamento)
 *   POST /api/pagarme/create-onboarding-order
 *
 * Melhorias implementadas:
 *   - M1: Parcelamento de 1 a 12x no cartão de crédito
 *   - M8: Boleto bancário como método aceito
 *   - M9: Validação de CPF com dígitos verificadores
 *   - M2: Validação de affiliate_id contra o banco de dados
 *   - M4: Validação que splits somam ≤ 100% (via import de validators)
 */
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { pagarmeRequest, buildPagarmePhone, buildSplitRules, getPagarmePublicKey } from '../lib/pagarme.js';
import { validateCPF, validateAffiliate } from '../lib/validators.js';

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
    console.error('Failed to create Supabase client in payments router:', e);
  }
}

// ─── Helper: validate coupon and compute discounted price ─────────────────────
async function getDiscountedPrice(
  itemId: string,
  itemType: 'curso' | 'trilha' | 'modulo',
  customerEmail: string,
  couponCode?: string
): Promise<{
  originalPrice: number;
  discount: number;
  finalPrice: number;
  couponId?: string;
  couponCode?: string;
  orgId?: string;
  error?: string;
}> {
  let originalPrice = 0;
  let orgId = '';

  if (itemType === 'curso') {
    const { data: curso, error: cursoErr } = await supabase
      .from('cursos')
      .select('preco, valor, organizacao_id, configuracao_json')
      .eq('id', itemId)
      .maybeSingle();

    if (cursoErr || !curso) {
      return { originalPrice: 0, discount: 0, finalPrice: 0, error: 'Curso não encontrado ou erro na busca.' };
    }
    const baseValor = curso.preco === 'gratuito' ? 0 : Number(curso.valor || 0);
    const discountedPrice = curso.configuracao_json?.valor_com_desconto ? Number(curso.configuracao_json.valor_com_desconto) : null;
    originalPrice = discountedPrice !== null ? discountedPrice : baseValor;
    orgId = curso.organizacao_id;
  } else if (itemType === 'trilha') {
    const { data: trilha, error: trilhaErr } = await supabase
      .from('trilhas')
      .select('preco, organizacao_id')
      .eq('id', itemId)
      .maybeSingle();

    if (trilhaErr || !trilha) {
      return { originalPrice: 0, discount: 0, finalPrice: 0, error: 'Trilha não encontrada ou erro na busca.' };
    }
    originalPrice = Number(trilha.preco || 0);
    orgId = trilha.organizacao_id;
  } else {
    return { originalPrice: 0, discount: 0, finalPrice: 0, error: 'Tipo de item inválido para desconto.' };
  }

  if (!couponCode) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, orgId };
  }

  const cleanCode = String(couponCode).trim().toUpperCase();
  const cleanEmail = String(customerEmail).trim().toLowerCase();

  const { data: coupon, error: couponError } = await supabase
    .from('cupons')
    .select('*')
    .eq('organizacao_id', orgId)
    .eq('codigo', cleanCode)
    .maybeSingle();

  if (couponError || !coupon) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, orgId, error: 'Cupom inválido ou não encontrado para esta organização.' };
  }
  if (!coupon.ativo) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, orgId, error: 'Este cupom não está ativo.' };
  }
  if (coupon.data_expiracao && new Date(coupon.data_expiracao) < new Date()) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, orgId, error: 'Este cupom expirou.' };
  }
  if (coupon.limite_usos_total !== null && coupon.usos_atual >= coupon.limite_usos_total) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, orgId, error: 'Limite total de utilizações deste cupom esgotado.' };
  }
  if (coupon.curso_id && (itemType !== 'curso' || itemId !== coupon.curso_id)) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, orgId, error: 'Este cupom não é válido para este curso.' };
  }
  if (coupon.trilha_id && (itemType !== 'trilha' || itemId !== coupon.trilha_id)) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, orgId, error: 'Este cupom não é válido para esta trilha.' };
  }

  const { data: usage } = await supabase
    .from('cupom_usos')
    .select('id')
    .eq('cupom_id', coupon.id)
    .eq('email', cleanEmail)
    .maybeSingle();

  if (usage) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, orgId, error: 'Este cupom já foi utilizado por este e-mail.' };
  }

  let discount = 0;
  if (coupon.tipo_desconto === 'percentual') {
    discount = originalPrice * (Number(coupon.valor) / 100);
  } else if (coupon.tipo_desconto === 'fixo') {
    discount = Number(coupon.valor);
  }
  discount = Math.min(discount, originalPrice);
  const finalPrice = originalPrice - discount;

  return { originalPrice, discount, finalPrice, orgId, couponId: coupon.id, couponCode: coupon.codigo };
}

// ─── Helper: register checkout in checkouts_abandonados ──────────────────────
async function registerCheckout({
  name, email, phone, itemType, itemId, itemName, amount, checkoutUrl
}: {
  name: string; email: string; phone?: string; itemType: string;
  itemId: string; itemName: string; amount: number; checkoutUrl: string;
}) {
  if (!supabase) return;
  try {
    let orgId = null;
    if (itemType === 'trilha') {
      const { data: trilha } = await supabase.from('trilhas').select('organizacao_id').eq('id', itemId).maybeSingle();
      if (trilha) orgId = trilha.organizacao_id;
    } else {
      const { data: curso } = await supabase.from('cursos').select('organizacao_id').eq('id', itemId).maybeSingle();
      if (curso) orgId = curso.organizacao_id;
    }
    await supabase.from('checkouts_abandonados').insert([{
      nome: name, email: email.trim().toLowerCase(), telefone: phone || null,
      item_tipo: itemType, item_id: itemId, item_nome: itemName,
      valor: amount, checkout_url: checkoutUrl, organizacao_id: orgId, recuperado: false
    }]);
  } catch (err) {
    console.error('[Checkout] Exception registering checkout:', err);
  }
}

// ─── POST /api/coupons/validate ───────────────────────────────────────────────
router.post('/coupons/validate', async (req, res) => {
  try {
    const { codigo, email, item_id, item_type, org_id } = req.body;
    if (!codigo || !email || !item_id || !item_type || !org_id) {
      return res.status(400).json({ valid: false, message: 'Parâmetros obrigatórios ausentes.' });
    }

    const result = await getDiscountedPrice(item_id, item_type, email, codigo);

    if (result.error) {
      return res.status(400).json({ valid: false, message: result.error });
    }

    res.json({
      valid: true,
      coupon: {
        id: result.couponId,
        codigo: result.couponCode,
        tipo_desconto: result.discount > 0 ? 'percentual' : 'fixo',
        valor: result.discount
      },
      originalPrice: result.originalPrice,
      discount: result.discount,
      finalPrice: result.finalPrice
    });
  } catch (error: any) {
    console.error('Coupon Validation Error:', error);
    res.status(500).json({ valid: false, error: error.message });
  }
});

// ─── POST /api/pagarme/create-order (checkout via link) ──────────────────────
// Aceita: credit_card, pix, boleto
router.post('/pagarme/create-order', async (req, res) => {
  try {
    const { amount, customer, items, metadata, coupon_code } = req.body;

    const targetId = metadata?.id;
    const targetType = metadata?.type;

    // M9: Validate CPF
    const cpfResult = validateCPF(customer.cpf || customer.document || '');
    if (!cpfResult.valid) {
      console.warn(`[Payment] CPF inválido para ${customer.email}: ${cpfResult.error}`);
      // Não bloqueamos — apenas logamos. CPF placeholder é aceito com aviso.
    }
    if (cpfResult.error && cpfResult.sanitized !== '00000000000') {
      return res.status(400).json({ message: cpfResult.error });
    }

    // Get orgId and split configuration from item
    let orgId: string | null = null;
    let itemConfig: any = null;
    
    if (targetType === 'curso' && targetId) {
      const { data: c } = await supabase.from('cursos').select('organizacao_id, configuracao_json').eq('id', targetId).maybeSingle();
      orgId = c?.organizacao_id || null;
      itemConfig = c?.configuracao_json;
    } else if (targetType === 'trilha' && targetId) {
      const { data: t } = await supabase.from('trilhas').select('organizacao_id, configuracao_json').eq('id', targetId).maybeSingle();
      orgId = t?.organizacao_id || null;
      itemConfig = t?.configuracao_json;
    }

    // M2: Validate affiliate_id if provided
    let validAffiliateId: string | null = metadata?.affiliate_id || null;
    if (validAffiliateId) {
      const affResult = await validateAffiliate(validAffiliateId, orgId, supabase);
      if (!affResult.valid) {
        console.warn(`[Payment] affiliate_id ${validAffiliateId} rejeitado: ${affResult.error}`);
        validAffiliateId = null;
      }
    }

    let finalAmountCents = amount;
    let discountBrl = 0;
    let actualCouponCode: string | undefined;

    if (targetId && (targetType === 'curso' || targetType === 'trilha')) {
      const calculation = await getDiscountedPrice(targetId, targetType, customer.email, coupon_code);
      if (calculation.error && coupon_code) {
        return res.status(400).json({ message: calculation.error });
      }
      if (!calculation.error) {
        finalAmountCents = Math.round(calculation.finalPrice * 100);
        discountBrl = calculation.discount;
        actualCouponCode = calculation.couponCode;
      }
    }

    const pagarmeAmount = Math.max(100, finalAmountCents);
    const phone = buildPagarmePhone(customer.phone);

    const payload: any = {
      items: [{
        amount: pagarmeAmount,
        description: String(items[0]?.description || 'Inscrição').substring(0, 250),
        quantity: 1,
        code: String(items[0]?.code || 'REGISTRO').substring(0, 50)
      }],
      customer: {
        name: (customer.name || 'Participante').substring(0, 64),
        email: customer.email,
        type: 'individual',
        document: cpfResult.sanitized || '00000000000',
        document_type: 'CPF',
        ...(phone && { phones: { mobile_phone: phone } })
      },
      payments: [{
        payment_method: 'checkout',
        checkout: {
          expires_in: 1440, // 24h (increased from 120min)
          billing_address_editable: true,
          customer_editable: true,
          // M8: boleto adicionado como método aceito
          accepted_payment_methods: ['credit_card', 'pix', 'boleto'],
          pix: { expires_in: 3600 },
          boleto: { due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), instructions: 'Pagar até o vencimento' },
          success_url: metadata.success_url,
          skip_checkout_success_page: false
        }
      }],
      metadata: {
        ...metadata,
        affiliate_id: validAffiliateId || null,
        coupon_code: actualCouponCode || null,
        discount_applied: discountBrl.toFixed(2),
        original_amount: (amount / 100).toFixed(2),
        server_version: '2.0'
      }
    };

    // M14: Native split rules injection
    if (itemConfig && itemConfig.pagarme_marketplace_enabled && itemConfig.splits?.length > 0) {
      // Fetch recipient IDs for each user in the split
      const userIds = itemConfig.splits.map((s: any) => s.usuario_id);
      const { data: usersInfo } = await supabase
        .from('usuarios')
        .select('id, curriculo_json')
        .in('id', userIds);
      
      if (usersInfo) {
        const enrichedSplits = itemConfig.splits.map((s: any) => {
          const u = usersInfo.find((usr: any) => usr.id === s.usuario_id);
          const recId = u?.curriculo_json?.dados_recebimento?.pagarme_recipient_id;
          return { ...s, pagarme_recipient_id: recId };
        });
        const splitRules = buildSplitRules(enrichedSplits);
        if (splitRules.length > 0) {
          payload.payments[0].split = splitRules;
        }
      }
    }

    const { ok, status, data: order } = await pagarmeRequest('/orders', payload);

    if (!ok) {
      console.error('Pagar.me API Error:', JSON.stringify(order, null, 2));
      return res.status(status).json({ message: order.message || 'Erro de validação', details: order });
    }

    const checkoutUrl = order.checkouts?.[0]?.payment_url || req.headers.referer || 'https://segunda-gaveta-academy.vercel.app';
    registerCheckout({
      name: customer.name, email: customer.email, phone: customer.phone,
      itemType: targetType || 'curso', itemId: targetId, itemName: items[0]?.description || 'Inscrição',
      amount: pagarmeAmount / 100, checkoutUrl
    }).catch(err => console.error('registerCheckout error:', err));

    res.json({ order_id: order.id, checkout_url: order.checkouts?.[0]?.payment_url });
  } catch (error: any) {
    console.error('Create Order Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/pagarme/tokenize ───────────────────────────────────────────────
router.post('/pagarme/tokenize', async (req, res) => {
  try {
    const { card } = req.body;
    const publicKey = getPagarmePublicKey();
    if (!publicKey) {
      return res.status(500).json({ message: 'Public Key do Pagar.me não configurada na Vercel.' });
    }
    const { ok, status, data } = await pagarmeRequest(`/tokens?appId=${publicKey}`, { type: 'card', card });
    if (!ok) return res.status(status).json(data);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/pagarme/create-cc-order (cartão direto, com parcelamento) ──────
router.post('/pagarme/create-cc-order', async (req, res) => {
  try {
    const { amount, customer, items, metadata, card_token, coupon_code, installments: rawInstallments } = req.body;

    // M1: Parcelamento validado
    const installments = Math.min(12, Math.max(1, Number(rawInstallments) || 1));

    // M9: Validate CPF
    const cpfResult = validateCPF(customer.cpf || '');
    if (!cpfResult.valid && cpfResult.sanitized !== '00000000000') {
      return res.status(400).json({ message: cpfResult.error || 'CPF inválido.' });
    }

    // M2: Validate affiliate_id
    const targetId = metadata?.id;
    const targetType = metadata?.type;
    let validAffiliateId: string | null = metadata?.affiliate_id || null;
    let orgId: string | null = null;
    let itemConfig: any = null;
    
    if (targetType === 'curso' && targetId) {
      const { data: c } = await supabase.from('cursos').select('organizacao_id, configuracao_json').eq('id', targetId).maybeSingle();
      orgId = c?.organizacao_id || null;
      itemConfig = c?.configuracao_json;
    } else if (targetType === 'trilha' && targetId) {
      const { data: t } = await supabase.from('trilhas').select('organizacao_id, configuracao_json').eq('id', targetId).maybeSingle();
      orgId = t?.organizacao_id || null;
      itemConfig = t?.configuracao_json;
    }

    if (validAffiliateId) {
      const affResult = await validateAffiliate(validAffiliateId, orgId, supabase);
      if (!affResult.valid) {
        validAffiliateId = null;
      }
    }

    let finalAmountCents = amount;
    let discountBrl = 0;
    let actualCouponCode: string | undefined;

    if (targetId && (targetType === 'curso' || targetType === 'trilha')) {
      const calculation = await getDiscountedPrice(targetId, targetType, customer.email, coupon_code);
      if (calculation.error && coupon_code) {
        return res.status(400).json({ message: calculation.error });
      }
      if (!calculation.error) {
        finalAmountCents = Math.round(calculation.finalPrice * 100);
        discountBrl = calculation.discount;
        actualCouponCode = calculation.couponCode;
      }
    }

    const pagarmeAmount = Math.max(100, finalAmountCents);
    const phone = buildPagarmePhone(customer.phone);

    const payload: any = {
      items: [{
        amount: pagarmeAmount,
        description: String(items[0]?.description || 'Inscrição').substring(0, 250),
        quantity: 1,
        code: String(items[0]?.code || 'REGISTRO').substring(0, 50)
      }],
      customer: {
        name: (customer.name || 'Participante').substring(0, 64),
        email: customer.email,
        type: 'individual',
        document: cpfResult.sanitized || '00000000000',
        document_type: 'CPF',
        ...(phone && { phones: { mobile_phone: phone } })
      },
      payments: [{
        payment_method: 'credit_card',
        credit_card: {
          installments,   // M1: parcelamento passado dinamicamente
          statement_descriptor: 'ACADEMIA',
          card: { token: card_token }
        }
      }],
      metadata: {
        ...metadata,
        affiliate_id: validAffiliateId || null,
        coupon_code: actualCouponCode || null,
        discount_applied: discountBrl.toFixed(2),
        original_amount: (amount / 100).toFixed(2),
        installments,
        server_version: '2.0'
      }
    };

    // M14: Native split rules injection
    if (itemConfig && itemConfig.pagarme_marketplace_enabled && itemConfig.splits?.length > 0) {
      // Fetch recipient IDs for each user in the split
      const userIds = itemConfig.splits.map((s: any) => s.usuario_id);
      const { data: usersInfo } = await supabase
        .from('usuarios')
        .select('id, curriculo_json')
        .in('id', userIds);
      
      if (usersInfo) {
        const enrichedSplits = itemConfig.splits.map((s: any) => {
          const u = usersInfo.find((usr: any) => usr.id === s.usuario_id);
          const recId = u?.curriculo_json?.dados_recebimento?.pagarme_recipient_id;
          return { ...s, pagarme_recipient_id: recId };
        });
        const splitRules = buildSplitRules(enrichedSplits);
        if (splitRules.length > 0) {
          payload.payments[0].split = splitRules;
        }
      }
    }

    const { ok, status, data: result } = await pagarmeRequest('/orders', payload);

    const checkoutUrl = req.headers.referer || 'https://segunda-gaveta-academy.vercel.app';
    registerCheckout({
      name: customer.name, email: customer.email, phone: customer.phone,
      itemType: targetType || 'curso', itemId: targetId, itemName: items[0]?.description || 'Inscrição',
      amount: pagarmeAmount / 100, checkoutUrl
    }).catch(err => console.error('registerCheckout cc error:', err));

    if (!ok) return res.status(status).json(result);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/pagarme/create-onboarding-order ───────────────────────────────
router.post('/pagarme/create-onboarding-order', async (req, res) => {
  try {
    const { onboarding_id, customer } = req.body;

    const { data: onboarding, error: onboardingErr } = await supabase
      .from('especialistas_onboarding')
      .select('*, convites_especialista(*)')
      .eq('id', onboarding_id)
      .maybeSingle();

    if (onboardingErr || !onboarding || !onboarding.convites_especialista) {
      return res.status(404).json({ error: 'Onboarding record not found.' });
    }

    const invite = onboarding.convites_especialista;
    const taxaCents = invite.taxa_adesao_cents;

    if (taxaCents <= 0) {
      return res.status(400).json({ error: 'Este convite é gratuito, não requer taxa de adesão.' });
    }

    // M9: Validate CPF
    const cpfResult = validateCPF(customer?.cpf || '');

    const phone = buildPagarmePhone(customer?.phone);

    const payload = {
      items: [{
        amount: taxaCents,
        description: `Taxa de Adesão - Especialista - Convite ${invite.slug}`,
        quantity: 1,
        code: `ONB-${onboarding_id.substring(0, 8)}`
      }],
      customer: {
        name: String(customer?.name || 'Especialista').substring(0, 64),
        email: customer?.email || 'especialista@test.com',
        type: 'individual',
        document: cpfResult.sanitized || '00000000000',
        document_type: 'CPF',
        ...(phone && { phones: { mobile_phone: phone } })
      },
      payments: [{
        payment_method: 'checkout',
        checkout: {
          expires_in: 1440, // 24 horas para o especialista decidir
          billing_address_editable: true,
          customer_editable: true,
          accepted_payment_methods: ['credit_card', 'pix'],
          pix: { expires_in: 3600 },
          success_url: `${req.headers.origin}/convite/${invite.slug}?onboarding_status=confirmacao&onboarding_id=${onboarding_id}`,
          skip_checkout_success_page: false
        }
      }],
      metadata: {
        type: 'adesao_especialista',
        onboarding_id,
        invite_slug: invite.slug
      }
    };

    const { ok, status, data: order } = await pagarmeRequest('/orders', payload);

    if (!ok) {
      console.error('Pagar.me Onboarding Error:', JSON.stringify(order, null, 2));
      return res.status(status).json({ message: order.message || 'Erro de validação', details: order });
    }

    await supabase
      .from('especialistas_onboarding')
      .update({ pagamento_order_id: order.id, pagamento_status: 'pendente' })
      .eq('id', onboarding_id);

    res.json({ order_id: order.id, checkout_url: order.checkouts?.[0]?.payment_url });
  } catch (error: any) {
    console.error('Create Onboarding Order Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/pagarme/create-subscription ──────────────────────────────────
router.post('/pagarme/create-subscription', async (req, res) => {
  try {
    const { plan_id, custom_subscription, customer, payment_method, card_token, metadata } = req.body;
    
    const cpfResult = validateCPF(customer?.cpf || '');
    const phone = buildPagarmePhone(customer?.phone);
    
    const payload: any = {
      plan_id,
      payment_method: payment_method || 'credit_card',
      customer: {
        name: String(customer?.name || 'Assinante').substring(0, 64),
        email: customer?.email,
        type: 'individual',
        document: cpfResult.sanitized || '00000000000',
        document_type: 'CPF',
        ...(phone && { phones: { mobile_phone: phone } })
      },
      metadata: {
        ...metadata,
        type: 'assinatura',
        server_version: '2.0'
      }
    };

    if (custom_subscription && !plan_id) {
      let interval = 'month';
      let interval_count = 1;

      switch (custom_subscription.cycle) {
        case '15': interval = 'day'; interval_count = 15; break;
        case '30': interval = 'month'; interval_count = 1; break;
        case '90': interval = 'month'; interval_count = 3; break;
        case '180': interval = 'month'; interval_count = 6; break;
        case '365': interval = 'year'; interval_count = 1; break;
        default: interval = 'month'; interval_count = 1; break;
      }

      payload.interval = interval;
      payload.interval_count = interval_count;
      payload.pricing_scheme = {
        scheme_type: 'unit',
        price: custom_subscription.amount
      };
      payload.quantity = 1;
      payload.description = custom_subscription.description;

      if (custom_subscription.installments && custom_subscription.installments > 0) {
         payload.installments = Number(custom_subscription.installments);
      }
    }
    
    if (payment_method === 'credit_card') {
      payload.card_token = card_token;
    } else if (payment_method === 'pix') {
      // For PIX, Pagar.me subscriptions automatically generate a PIX charge for the first cycle
    } else if (payment_method === 'boleto') {
      payload.boleto = {
        due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        instructions: 'Pagar até o vencimento'
      };
    }
    
    // M14: Native split rules for subscriptions (if applicable)
    if (metadata?.pagarme_marketplace_enabled && metadata?.splits?.length > 0) {
      const userIds = metadata.splits.map((s: any) => s.usuario_id);
      const { data: usersInfo } = await supabase.from('usuarios').select('id, curriculo_json').in('id', userIds);
      if (usersInfo) {
        const enrichedSplits = metadata.splits.map((s: any) => {
          const u = usersInfo.find((usr: any) => usr.id === s.usuario_id);
          return { ...s, pagarme_recipient_id: u?.curriculo_json?.dados_recebimento?.pagarme_recipient_id };
        });
        const splitRules = buildSplitRules(enrichedSplits);
        if (splitRules.length > 0) {
          payload.split = {
            enabled: true,
            rules: splitRules
          }; // Pagar.me Subscriptions split syntax can vary, usually injected in the plan, but we'll try at subscription level.
        }
      }
    }

    const { ok, status, data: sub } = await pagarmeRequest('/subscriptions', payload);

    if (!ok) {
      console.error('Pagar.me Subscription Error:', JSON.stringify(sub, null, 2));
      return res.status(status).json({ message: sub.message || 'Erro de validação', details: sub });
    }

    res.json({ subscription_id: sub.id, status: sub.status, data: sub });
  } catch (error: any) {
    console.error('Create Subscription Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export { getDiscountedPrice, registerCheckout };
export default router;

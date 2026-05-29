/**
 * Rotas de pagamento — /api/pagarme/* e /api/coupons/*
 * Extraído de api/_app.ts para modularizar o servidor Express.
 *
 * Rotas incluídas:
 *   POST /api/coupons/validate
 *   POST /api/pagarme/create-order          (checkout via link)
 *   POST /api/pagarme/tokenize              (tokeniza cartão)
 *   POST /api/pagarme/create-cc-order       (checkout cartão direto)
 *   POST /api/pagarme/create-onboarding-order
 */
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { pagarmeRequest, buildPagarmePhone } from '../lib/pagarme.js';

const router = Router();

// ─── Supabase client (reutiliza as mesmas env vars) ──────────────────────────
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
  error?: string;
}> {
  let originalPrice = 0;
  let orgId = '';

  if (itemType === 'curso') {
    const { data: curso, error: cursoErr } = await supabase
      .from('cursos')
      .select('preco, valor, organizacao_id')
      .eq('id', itemId)
      .maybeSingle();

    if (cursoErr || !curso) {
      return { originalPrice: 0, discount: 0, finalPrice: 0, error: 'Curso não encontrado ou erro na busca.' };
    }
    originalPrice = curso.preco === 'gratuito' ? 0 : Number(curso.valor || 0);
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
    return { originalPrice, discount: 0, finalPrice: originalPrice };
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
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: 'Cupom inválido ou não encontrado para esta organização.' };
  }
  if (!coupon.ativo) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: 'Este cupom não está ativo.' };
  }
  if (coupon.data_expiracao && new Date(coupon.data_expiracao) < new Date()) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: 'Este cupom expirou.' };
  }
  if (coupon.limite_usos_total !== null && coupon.usos_atual >= coupon.limite_usos_total) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: 'Limite total de utilizações deste cupom esgotado.' };
  }
  if (coupon.curso_id && (itemType !== 'curso' || itemId !== coupon.curso_id)) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: 'Este cupom não é válido para este curso.' };
  }
  if (coupon.trilha_id && (itemType !== 'trilha' || itemId !== coupon.trilha_id)) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: 'Este cupom não é válido para esta trilha.' };
  }

  const { data: usage } = await supabase
    .from('cupom_usos')
    .select('id')
    .eq('cupom_id', coupon.id)
    .eq('email', cleanEmail)
    .maybeSingle();

  if (usage) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: 'Este cupom já foi utilizado por este e-mail.' };
  }

  let discount = 0;
  if (coupon.tipo_desconto === 'percentual') {
    discount = originalPrice * (Number(coupon.valor) / 100);
  } else if (coupon.tipo_desconto === 'fixo') {
    discount = Number(coupon.valor);
  }
  discount = Math.min(discount, originalPrice);
  const finalPrice = originalPrice - discount;

  return { originalPrice, discount, finalPrice, couponId: coupon.id, couponCode: coupon.codigo };
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
    console.error('Coupon Validation Endpoint Error:', error);
    res.status(500).json({ valid: false, error: error.message });
  }
});

// ─── Helper: register checkout in checkouts_abandonados ─────────────────────
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
    console.log(`[Notification] Checkout registered for ${email} (${itemName})`);
  } catch (err) {
    console.error('[Notification] Exception registering checkout:', err);
  }
}

// ─── POST /api/pagarme/create-order (checkout via link) ──────────────────────
router.post('/create-order', async (req, res) => {
  try {
    const { amount, customer, items, metadata, coupon_code } = req.body;

    const targetId = metadata?.id;
    const targetType = metadata?.type;
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

    const payload = {
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
        document: String(customer.cpf || '').replace(/\D/g, '') || '00000000000',
        document_type: 'CPF',
        ...(phone && { phones: { mobile_phone: phone } })
      },
      payments: [{
        payment_method: 'checkout',
        checkout: {
          expires_in: 120,
          billing_address_editable: true,
          customer_editable: true,
          accepted_payment_methods: ['credit_card', 'pix'],
          pix: { expires_in: 3600 },
          success_url: metadata.success_url,
          skip_checkout_success_page: false
        }
      }],
      metadata: {
        ...metadata,
        coupon_code: actualCouponCode || null,
        discount_applied: discountBrl.toFixed(2),
        original_amount: (amount / 100).toFixed(2),
        server_version: '1.6'
      }
    };

    const { ok, status, data: order } = await pagarmeRequest('/orders', payload);

    if (!ok) {
      console.error('Pagar.me API Error RAW:', JSON.stringify(order, null, 2));
      return res.status(status).json({ message: order.message || 'Erro de validação', details: order });
    }

    const checkoutUrl = order.checkouts?.[0]?.payment_url || req.headers.referer || 'https://segunda-gaveta-academy.vercel.app';
    registerCheckout({
      name: customer.name, email: customer.email, phone: customer.phone,
      itemType: targetType || 'curso', itemId: targetId, itemName: items[0]?.description || 'Inscrição',
      amount: pagarmeAmount / 100, checkoutUrl
    }).catch(err => console.error('registerCheckout background error:', err));

    res.json({ order_id: order.id, checkout_url: order.checkouts?.[0]?.payment_url });
  } catch (error: any) {
    console.error('Create Order Runtime Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/pagarme/tokenize ───────────────────────────────────────────────
router.post('/tokenize', async (req, res) => {
  try {
    const { card } = req.body;
    const { ok, status, data } = await pagarmeRequest('/tokens?appId=v5', { type: 'card', card });
    if (!ok) return res.status(status).json(data);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/pagarme/create-cc-order (cartão direto) ───────────────────────
router.post('/create-cc-order', async (req, res) => {
  try {
    const { amount, customer, items, metadata, card_token, coupon_code } = req.body;

    const targetId = metadata?.id;
    const targetType = metadata?.type;
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

    const payload = {
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
        document: String(customer.cpf || '').replace(/\D/g, '') || '00000000000',
        document_type: 'CPF',
        ...(phone && { phones: { mobile_phone: phone } })
      },
      payments: [{
        payment_method: 'credit_card',
        credit_card: {
          installments: 1,
          card: { token: card_token }
        }
      }],
      metadata: {
        ...metadata,
        coupon_code: actualCouponCode || null,
        discount_applied: discountBrl.toFixed(2),
        original_amount: (amount / 100).toFixed(2),
        server_version: '1.6'
      }
    };

    const { ok, status, data: result } = await pagarmeRequest('/orders', payload);

    const checkoutUrl = req.headers.referer || 'https://segunda-gaveta-academy.vercel.app';
    registerCheckout({
      name: customer.name, email: customer.email, phone: customer.phone,
      itemType: targetType || 'curso', itemId: targetId, itemName: items[0]?.description || 'Inscrição',
      amount: pagarmeAmount / 100, checkoutUrl
    }).catch(err => console.error('registerCheckout cc background error:', err));

    if (!ok) return res.status(status).json(result);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/pagarme/create-onboarding-order ───────────────────────────────
router.post('/create-onboarding-order', async (req, res) => {
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
        document: String(customer?.cpf || '').replace(/\D/g, '') || '00000000000',
        document_type: 'CPF',
        ...(phone && { phones: { mobile_phone: phone } })
      },
      payments: [{
        payment_method: 'checkout',
        checkout: {
          expires_in: 120,
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
      console.error('Pagar.me Onboarding API Error:', JSON.stringify(order, null, 2));
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

export { getDiscountedPrice, registerCheckout };
export default router;

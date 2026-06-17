/**
 * Webhook do Pagar.me — POST /api/pagarme/webhook
 * Processa order.paid e order.payment_failed.
 *
 * Melhorias implementadas:
 *   - M2: Valida affiliate_id contra o banco de dados
 *   - M4: Valida que splits somam ≤ 100%
 *   - M5: Desconta taxa do Pagar.me antes de calcular splits
 *   - M11: Armazena pagarme_order_id para lookup de estorno
 */
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { extractPhoneFromOrder, calculatePagarmeNet } from '../lib/pagarme.js';
import { validateAffiliate, validateSplits } from '../lib/validators.js';
import {
  notifyWelcome,
  notifyOnboarding,
  notifyPaymentFailed
} from '../lib/notification.js';

const router = Router();

// ─── Supabase client ─────────────────────────────────────────────────────────
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
    console.error('Failed to create Supabase client in webhook router:', e);
  }
}

// ─── Helper: get item name ────────────────────────────────────────────────────
async function getItemName(targetType: string, targetItemId: string): Promise<string> {
  if (targetType === 'trilha') {
    const { data: trilha } = await supabase
      .from('trilhas')
      .select('titulo')
      .eq('id', targetItemId)
      .maybeSingle();
    return trilha?.titulo || 'Trilha';
  }
  const { data: curso } = await supabase
    .from('cursos')
    .select('nome')
    .eq('id', targetItemId)
    .maybeSingle();
  return curso?.nome || 'Curso';
}

// ─── Helper: get phone from order with checkouts_abandonados fallback ─────────
async function resolveCustomerPhone(
  mobilePhone: any,
  customerEmail: string
): Promise<string> {
  const fromOrder = extractPhoneFromOrder(mobilePhone);
  if (fromOrder) return fromOrder;

  const { data: latestCheckout } = await supabase
    .from('checkouts_abandonados')
    .select('telefone')
    .eq('email', customerEmail)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  return latestCheckout?.telefone || '';
}

// ─── POST /webhook ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const event = req.body;
    console.log('Webhook received:', event.type);

    // ── order.paid ──────────────────────────────────────────────────────────
    if (event.type === 'order.paid') {
      const order = event.data;
      const {
        type, onboarding_id, participant_id, curso_id, course_id, id,
        coupon_code, discount_applied, utm_source, utm_medium, utm_campaign, affiliate_id
      } = order.metadata || {};

      // ── Onboarding payment ──────────────────────────────────────────────
      if (type === 'adesao_especialista' && onboarding_id) {
        console.log(`Processing onboarding payment for onboarding_id: ${onboarding_id}`);
        const { error: updErr } = await supabase
          .from('especialistas_onboarding')
          .update({ taxa_paga: true, pagamento_status: 'pago', pagamento_order_id: order.id })
          .eq('id', onboarding_id);

        if (updErr) {
          console.error(`Failed to update onboarding payment for ${onboarding_id}:`, updErr);
          return res.status(500).send('Database onboarding status update failed');
        }

        try {
          const { data: onbInfo } = await supabase
            .from('especialistas_onboarding')
            .select('id, usuarios(id, nome, email, telefone, organizacoes(nome))')
            .eq('id', onboarding_id)
            .maybeSingle();

          if (onbInfo?.usuarios) {
            const user = onbInfo.usuarios as any;
            await notifyOnboarding({
              email: user.email,
              name: user.nome || 'Especialista',
              phone: user.telefone || undefined,
              orgName: user.organizacoes?.nome || 'Minha Instituição'
            });
          }
        } catch (errOnb) {
          console.error('[Notification Error] Failed to send onboarding notification:', errOnb);
        }

        return res.json({ success: true });
      }

      // ── Regular course/trilha purchase ──────────────────────────────────
      let targetItemId = id || curso_id || course_id;
      const targetType = type || 'curso';
      const customerEmail = order.customer?.email?.toLowerCase()?.trim();
      const customerName = order.customer?.name || 'Aluno';
      const totalPaidCents = order.amount || 0;
      const totalPaidBrl = totalPaidCents / 100;
      const paymentMethod = order.charges?.[0]?.payment_method || 'checkout';

      let finalUserId: string | null = null;
      let finalOrgId: string | null = null;
      const table = targetType === 'trilha' ? 'trilha_participantes' : 'curso_participantes';
      const idField = targetType === 'trilha' ? 'trilha_id' : 'curso_id';

      // 1. Resolve usuario_id, item_id, and organizacao_id
      if (participant_id) {
        console.log(`Processing update using participant_id: ${participant_id}`);

        if (targetType === 'trilha') {
          const { data: part } = await supabase
            .from('trilha_participantes')
            .select('usuario_id, trilha_id, trilhas(organizacao_id)')
            .eq('id', participant_id)
            .maybeSingle();
          if (part) {
            finalUserId = part.usuario_id;
            if (!targetItemId) targetItemId = part.trilha_id;
            finalOrgId = (part.trilhas as any)?.organizacao_id || null;
          }
        } else {
          const { data: part } = await supabase
            .from('curso_participantes')
            .select('usuario_id, curso_id, cursos(organizacao_id)')
            .eq('id', participant_id)
            .maybeSingle();
          if (part) {
            finalUserId = part.usuario_id;
            if (!targetItemId) targetItemId = part.curso_id;
            finalOrgId = (part.cursos as any)?.organizacao_id || null;
          }
        }

        const { error: updErr } = await supabase
          .from(table)
          .update({
            status: targetType === 'trilha' ? 'pago' : 'inscrito',
            cupom_codigo: coupon_code || null,
            valor_pago: totalPaidBrl
          })
          .eq('id', participant_id);

        if (updErr) {
          console.error(`Failed to update status for participant ${participant_id}:`, updErr);
          return res.status(500).send('Database enrollment status update failed');
        }
      } else if (targetItemId && customerEmail) {
        console.log(`Processing direct checkout for email: ${customerEmail} - Item: ${targetItemId} (${targetType})`);

        // Find org_id
        if (targetType === 'trilha') {
          const { data: trilha } = await supabase.from('trilhas').select('organizacao_id').eq('id', targetItemId).maybeSingle();
          if (trilha) finalOrgId = trilha.organizacao_id;
        } else {
          const { data: curso } = await supabase.from('cursos').select('organizacao_id').eq('id', targetItemId).maybeSingle();
          if (curso) finalOrgId = curso.organizacao_id;
        }

        // Find or create profile
        let { data: existingUser, error: userErr } = await supabase
          .from('usuarios')
          .select('id, auth_id, email')
          .eq('email', customerEmail)
          .maybeSingle();

        if (userErr) {
          console.error(`Error querying user: ${customerEmail}`, userErr);
          return res.status(500).send('Database check failed');
        }

        if (existingUser) {
          finalUserId = existingUser.auth_id || existingUser.id;
        } else {
          const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
          console.log(`Creating new auth user for direct checkout: ${customerEmail}`);

          const { data: newAuth, error: authErr } = await supabase.auth.admin.createUser({
            email: customerEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { nome: customerName }
          });

          if (authErr || !newAuth.user) {
            console.error(`Supabase Auth creation failed for: ${customerEmail}`, authErr);
            return res.status(500).send('Auth user creation failed');
          }

          finalUserId = newAuth.user.id;

          const { error: profileErr } = await supabase
            .from('usuarios')
            .insert([{
              id: finalUserId,
              auth_id: finalUserId,
              email: customerEmail,
              nome: customerName,
              role: 'membro',
              organizacao_id: finalOrgId
            }]);

          if (profileErr) {
            console.error(`Profile creation failed for: ${customerEmail}`, profileErr);
            return res.status(500).send('User profile creation failed');
          }

          // Notify new user with access credentials
          try {
            const appUrl = process.env.APP_URL || 'https://segunda-gaveta-academy.vercel.app';
            const { sendEmail } = await import('../lib/notification.js');
            await sendEmail({
              to: customerEmail,
              name: customerName,
              subject: 'Sua conta foi criada — Bem-vindo(a)!',
              htmlContent: `
                <div style="font-family: sans-serif; max-width: 520px; margin: auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
                  <h2 style="color: #1e293b; margin-bottom: 8px;">Olá, ${customerName}! 🎉</h2>
                  <p style="color: #475569;">Seu pagamento foi confirmado e sua conta foi criada automaticamente.</p>
                  <p style="color: #475569;">Para acessar a plataforma, clique no botão abaixo para definir sua senha:</p>
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${appUrl}/login?reset=true" style="background: #4f46e5; color: #fff; padding: 14px 28px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">
                      Definir Minha Senha de Acesso
                    </a>
                  </div>
                  <p style="color: #94a3b8; font-size: 12px;">Seu e-mail de acesso é: <strong>${customerEmail}</strong></p>
                  <p style="color: #94a3b8; font-size: 12px;">Se não realizou esta compra, ignore este e-mail.</p>
                </div>
              `
            });
          } catch (emailErr) {
            console.error(`[Notification Error] Failed to send welcome email to ${customerEmail}:`, emailErr);
          }
        }

        // Update/Insert enrollment
        const { data: existingEnrollment } = await supabase
          .from(table)
          .select('id')
          .eq(idField, targetItemId)
          .eq('usuario_id', finalUserId)
          .maybeSingle();

        if (existingEnrollment) {
          const { error: updateEnrollErr } = await supabase
            .from(table)
            .update({
              status: targetType === 'trilha' ? 'pago' : 'inscrito',
              cupom_codigo: coupon_code || null,
              valor_pago: totalPaidBrl
            })
            .eq('id', existingEnrollment.id);

          if (updateEnrollErr) {
            console.error(`Failed to update enrollment for: ${customerEmail}`, updateEnrollErr);
            return res.status(500).send('Enrollment update failed');
          }
        } else {
          const { error: insertEnrollErr } = await supabase
            .from(table)
            .insert([{
              [idField]: targetItemId,
              usuario_id: finalUserId,
              status: targetType === 'trilha' ? 'pago' : 'inscrito',
              progresso: 0,
              cupom_codigo: coupon_code || null,
              valor_pago: totalPaidBrl
            }]);

          if (insertEnrollErr) {
            console.error(`Failed to insert enrollment for: ${customerEmail}`, insertEnrollErr);
            return res.status(500).send('Enrollment insertion failed');
          }
        }
      }

      // 2. Handle Coupon Stats & Usages
      if (coupon_code && finalOrgId) {
        const cleanCouponCode = String(coupon_code).trim().toUpperCase();
        const { data: coupon } = await supabase
          .from('cupons')
          .select('id, usos_atual')
          .eq('organizacao_id', finalOrgId)
          .eq('codigo', cleanCouponCode)
          .maybeSingle();

        if (coupon) {
          await supabase
            .from('cupons')
            .update({ usos_atual: (coupon.usos_atual || 0) + 1 })
            .eq('id', coupon.id);

          await supabase.from('cupom_usos').insert([{
            cupom_id: coupon.id,
            usuario_id: finalUserId,
            email: customerEmail,
            curso_id: targetType === 'curso' ? targetItemId : null,
            trilha_id: targetType === 'trilha' ? targetItemId : null,
            valor_desconto: discount_applied ? Number(discount_applied) : 0.00
          }]);
        }
      }

      // 3. Register purchase in compras table
      if (finalUserId) {
        let affiliateCommissionPct = 0;
        let splitsConfig: { usuario_id: string; porcentagem: number }[] = [];
        let pagarmeOrderId: string | null = order.id || null;
        let pagarmeChargeId: string | null = order.charges?.[0]?.id || null;

        if (targetType === 'curso' && targetItemId) {
          const { data: curso } = await supabase
            .from('cursos')
            .select('configuracao_json')
            .eq('id', targetItemId)
            .maybeSingle();

          if (curso?.configuracao_json) {
            affiliateCommissionPct = Number((curso.configuracao_json as any).comissao_afiliado) || 0;
            splitsConfig = (curso.configuracao_json as any).splits || [];
          }
        }

        // M2: Validate affiliate_id against the database
        let validatedAffiliateId: string | null = affiliate_id || null;
        if (validatedAffiliateId && finalOrgId) {
          const affResult = await validateAffiliate(validatedAffiliateId, finalOrgId, supabase);
          if (!affResult.valid) {
            console.warn(`[Webhook] Rejecting unvalidated affiliate_id ${validatedAffiliateId}:`, affResult.error);
            validatedAffiliateId = null;
          }
        }

        // M4: Validate split sum
        const splitValidation = validateSplits(splitsConfig);
        if (!splitValidation.valid) {
          console.error(`[Webhook] Invalid split config for ${targetItemId}: ${splitValidation.error}`);
          // Continue but zero out splits to avoid corrupted data
          splitsConfig = [];
        }

        // M5: Deduct Pagar.me fee before calculating splits
        const { netAmount: netRevenueBrl } = calculatePagarmeNet(totalPaidBrl, paymentMethod);

        const affiliateShare = validatedAffiliateId ? (totalPaidBrl * affiliateCommissionPct) / 100 : 0.00;
        // Splits calculated on NET revenue (after Pagar.me fee) minus affiliate commission
        const afterAffiliateBrl = netRevenueBrl - affiliateShare;
        const calculatedCoproducersList = splitsConfig.map(split => ({
          usuario_id: split.usuario_id,
          porcentagem: split.porcentagem,
          valor: Number(((afterAffiliateBrl * split.porcentagem) / 100).toFixed(2))
        }));

        const { error: purchaseErr } = await supabase.from('compras').insert([{
          usuario_id: finalUserId,
          tipo: targetType,
          item_id: targetItemId || null,
          curso_id: targetType === 'curso' ? targetItemId : null,
          trilha_id: targetType === 'trilha' ? targetItemId : null,
          valor_pago: totalPaidBrl,
          valor_liquido: Number(netRevenueBrl.toFixed(2)),     // M5: valor líquido armazenado
          metodo_pagamento: paymentMethod,
          status: 'pago',
          cupom_codigo: coupon_code || null,
          desconto_aplicado: discount_applied ? Number(discount_applied) : 0.00,
          utm_source: utm_source || null,
          utm_medium: utm_medium || null,
          utm_campaign: utm_campaign || null,
          affiliate_id: validatedAffiliateId || null,           // M2: apenas afiliado validado
          comissao_afiliado: Number(affiliateShare.toFixed(2)),
          comissao_coprodutores: calculatedCoproducersList,
          // pagarme_order_id: pagarmeOrderId,                     // M11: para estorno (coluna faltando no DB)
          // pagarme_charge_id: pagarmeChargeId,                   // M11: para estorno (coluna faltando no DB)
          pagarme_subscription_id: order.subscription?.id || order.charges?.[0]?.subscription_id || null // M6: Assinatura
        }]);

        if (purchaseErr) {
          console.error('Failed to insert into compras table:', purchaseErr);
        } else if (validatedAffiliateId) {
          // M7: Marcar conversão no rastreamento de cliques
          try {
            // Find the most recent click for this affiliate + course
            const { data: latestClick } = await supabase
              .from('clicks_afiliados')
              .select('id')
              .eq('affiliate_id', validatedAffiliateId)
              .eq(targetType === 'curso' ? 'curso_id' : 'trilha_id', targetItemId)
              .order('criado_em', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (latestClick) {
              await supabase
                .from('clicks_afiliados')
                .update({ converteu: true })
                .eq('id', latestClick.id);
            }
          } catch (errClick) {
            console.error('Failed to update click conversion:', errClick);
          }
        }
      }

      // 4. Update checkouts_abandonados & trigger welcome notification
      if (customerEmail && targetItemId) {
        try {
          await supabase
            .from('checkouts_abandonados')
            .update({ recuperado: true })
            .eq('email', customerEmail)
            .eq('item_id', targetItemId);

          const itemName = await getItemName(targetType, targetItemId);
          const customerPhone = await resolveCustomerPhone(
            order.customer?.phones?.mobile_phone,
            customerEmail
          );

          console.log(`[Notification] Dispatching welcome notification to ${customerEmail}`);
          await notifyWelcome({
            email: customerEmail,
            name: customerName,
            phone: customerPhone || undefined,
            courseName: itemName
          });
        } catch (errWelcome) {
          console.error('[Notification Error] Failed to send welcome notification:', errWelcome);
        }
      }

    // ── order.payment_failed / charge.failed ──────────────────────────────
    } else if (event.type === 'order.payment_failed' || event.type === 'charge.failed') {
      const dataObj = event.data;
      const metadata = dataObj.metadata || dataObj.order?.metadata || {};
      const customer = dataObj.customer || dataObj.order?.customer || {};

      const customerEmail = customer.email?.toLowerCase()?.trim();
      const customerName = customer.name || 'Aluno';
      const targetItemId = metadata.id || metadata.curso_id || metadata.course_id;
      const targetType = metadata.type || 'curso';

      if (customerEmail && targetItemId) {
        try {
          const itemName = await getItemName(targetType, targetItemId);
          const customerPhone = await resolveCustomerPhone(
            customer.phones?.mobile_phone,
            customerEmail
          );
          const checkoutLink = metadata.success_url
            ? metadata.success_url.split('/pagamento-sucesso')[0]
            : `https://segunda-gaveta-academy.vercel.app/${targetType}/${targetItemId}`;

          console.log(`[Notification] Dispatching payment failed notification to ${customerEmail}`);
          await notifyPaymentFailed({
            email: customerEmail,
            name: customerName,
            phone: customerPhone || undefined,
            itemName,
            checkoutLink
          });
        } catch (errFail) {
          console.error('[Notification Error] Failed to send payment failed notification:', errFail);
        }
      }

    // ── subscription.created / subscription.canceled ───────────────────────
    } else if (event.type === 'subscription.created' || event.type === 'subscription.canceled') {
      const sub = event.data;
      const customerEmail = sub.customer?.email?.toLowerCase()?.trim();
      const planId = sub.plan?.id; // pagarme_plan_id
      
      if (customerEmail && planId) {
        try {
          const { data: user } = await supabase.from('usuarios').select('id').eq('email', customerEmail).maybeSingle();
          const { data: plano } = await supabase.from('planos_assinatura').select('id').eq('pagarme_plan_id', planId).maybeSingle();
          
          if (user && plano) {
            if (event.type === 'subscription.created') {
              // Check if exists
              const { data: existingSub } = await supabase.from('assinaturas').select('id').eq('pagarme_subscription_id', sub.id).maybeSingle();
              if (existingSub) {
                await supabase.from('assinaturas').update({
                  status: sub.status,
                  proxima_cobranca: sub.current_cycle?.end_at || sub.next_billing_at || null
                }).eq('id', existingSub.id);
              } else {
                await supabase.from('assinaturas').insert([{
                  usuario_id: user.id,
                  plano_id: plano.id,
                  pagarme_subscription_id: sub.id,
                  status: sub.status,
                  proxima_cobranca: sub.current_cycle?.end_at || sub.next_billing_at || null
                }]);
              }
            } else if (event.type === 'subscription.canceled') {
              await supabase.from('assinaturas')
                .update({ status: 'canceled' })
                .eq('pagarme_subscription_id', sub.id);
            }
          }
        } catch (errSub) {
          console.error('[Webhook] Error processing subscription event:', errSub);
        }
      }
    }

    res.status(200).send('Webhook received');
  } catch (error: any) {
    console.error('Webhook Error:', error);
    res.status(500).send(error.message);
  }
});

export default router;

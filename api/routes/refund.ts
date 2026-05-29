/**
 * api/routes/refund.ts — Endpoint de estorno via Pagar.me
 *
 * POST /api/pagarme/refund
 *   Body: { compra_id: string, motivo?: string }
 *   Auth: requer x-admin-token header
 *
 * Fluxo:
 *   1. Valida token de admin
 *   2. Busca a compra no Supabase
 *   3. Chama a API do Pagar.me para estornar a charge
 *   4. Atualiza compras.status = 'estornado' no banco
 *   5. Remove participante (curso_participantes ou trilha_participantes)
 *   6. Retorna resultado
 */
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { pagarmeRequest } from '../lib/pagarme.js';

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

// ─── Admin auth guard ─────────────────────────────────────────────────────────
function requireAdmin(req: any, res: any, next: any) {
  const token = process.env.DIAG_SECRET_TOKEN;
  if (!token) return res.status(500).json({ error: 'Admin token not configured.' });
  if (req.headers['x-admin-token'] !== token) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }
  next();
}

// ─── POST /refund ─────────────────────────────────────────────────────────────
router.post('/refund', requireAdmin, async (req, res) => {
  const { compra_id, motivo } = req.body;

  if (!compra_id) {
    return res.status(400).json({ error: 'compra_id é obrigatório.' });
  }

  try {
    // 1. Buscar compra
    const { data: compra, error: compraErr } = await supabase
      .from('compras')
      .select('*')
      .eq('id', compra_id)
      .maybeSingle();

    if (compraErr || !compra) {
      return res.status(404).json({ error: 'Compra não encontrada.' });
    }
    if (compra.status === 'estornado') {
      return res.status(400).json({ error: 'Esta compra já foi estornada.' });
    }
    if (compra.status !== 'pago') {
      return res.status(400).json({ error: 'Só é possível estornar compras com status "pago".' });
    }

    // 2. Buscar order_id via Pagar.me (necessário para localizar a charge)
    // Estratégia: buscar a charge pelo valor + email no Pagar.me ou usar metadata
    // Se não temos o charge_id gravado, fazemos lookup pelo order
    let pagarmeChargeId: string | null = compra.pagarme_charge_id || null;

    if (!pagarmeChargeId && compra.pagarme_order_id) {
      // Buscar charges do order
      const { ok, data: orderData } = await pagarmeRequest(`/orders/${compra.pagarme_order_id}`, null, 'GET');
      if (ok && orderData?.charges?.length > 0) {
        const paidCharge = orderData.charges.find((c: any) => c.status === 'paid');
        if (paidCharge) pagarmeChargeId = paidCharge.id;
      }
    }

    // 3. Estornar via Pagar.me
    let pagarmeResult: any = null;
    if (pagarmeChargeId) {
      const { ok, data } = await pagarmeRequest(
        `/charges/${pagarmeChargeId}/cancel`,
        { cancel_amount: Math.round(Number(compra.valor_pago) * 100) },
        'DELETE'
      );
      if (!ok) {
        console.error('[Refund] Pagar.me cancel failed:', data);
        return res.status(502).json({
          error: 'Falha ao processar estorno no Pagar.me. Verifique manualmente.',
          pagarme_error: data
        });
      }
      pagarmeResult = data;
    } else {
      // Sem charge_id — estorno deve ser feito manualmente no painel
      console.warn(`[Refund] No charge_id for compra ${compra_id}. Manual refund required.`);
    }

    // 4. Atualizar status no banco
    const { error: updateErr } = await supabase
      .from('compras')
      .update({
        status: 'estornado',
        estorno_motivo: motivo || 'Solicitado via admin',
        estorno_em: new Date().toISOString(),
        pagarme_charge_id: pagarmeChargeId
      })
      .eq('id', compra_id);

    if (updateErr) {
      console.error('[Refund] Failed to update compras status:', updateErr);
      return res.status(500).json({ error: 'Estorno processado no Pagar.me mas falhou ao atualizar banco.' });
    }

    // 5. Remover participante (soft-remove: status = 'estornado')
    const table = compra.tipo === 'trilha' ? 'trilha_participantes' : 'curso_participantes';
    const idField = compra.tipo === 'trilha' ? 'trilha_id' : 'curso_id';
    const itemId = compra.tipo === 'trilha' ? compra.trilha_id : compra.curso_id;

    if (itemId && compra.usuario_id) {
      await supabase
        .from(table)
        .update({ status: 'estornado' })
        .eq(idField, itemId)
        .eq('usuario_id', compra.usuario_id);
    }

    res.json({
      success: true,
      message: pagarmeChargeId
        ? 'Estorno realizado com sucesso no Pagar.me e acesso revogado.'
        : 'Compra marcada como estornada. Estorno financeiro requer ação manual no Pagar.me.',
      pagarme: pagarmeResult
    });
  } catch (err: any) {
    console.error('[Refund] Unexpected error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /refund/list — listar estornos recentes ─────────────────────────────
router.get('/refund/list', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('compras')
      .select('id, usuario_id, tipo, item_id, valor_pago, status, estorno_motivo, estorno_em, usuarios(nome, email)')
      .eq('status', 'estornado')
      .order('estorno_em', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

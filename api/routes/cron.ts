/**
 * Rotas de CRON — /api/cron/*
 * Extraído de api/_app.ts.
 *
 * Rotas incluídas:
 *   POST /api/cron/recover-carts
 *   GET  /api/cron/recover-carts
 */
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { notifyAbandonedCart } from '../lib/notification.js';

const router = Router();

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
    console.error('Failed to create Supabase client in cron router:', e);
  }
}

async function handleCartRecovery(req: any, res: any) {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase client not initialized' });
  }

  try {
    console.log('[Cron] Running recover-carts job...');
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: abandonados, error: errFetch } = await supabase
      .from('checkouts_abandonados')
      .select('*')
      .eq('recuperado', false)
      .lt('criado_em', fifteenMinutesAgo)
      .gt('criado_em', twentyFourHoursAgo);

    if (errFetch) {
      console.error('[Cron] Error fetching checkouts:', errFetch);
      return res.status(500).json({ error: errFetch.message });
    }

    console.log(`[Cron] Found ${abandonados?.length || 0} potentially abandoned checkouts`);

    if (!abandonados || abandonados.length === 0) {
      return res.json({ success: true, processed: 0 });
    }

    let processedCount = 0;
    let recoveredCount = 0;

    for (const checkout of abandonados) {
      const emailClean = checkout.email.trim().toLowerCase();
      let alreadyPurchased = false;

      const { data: userRecord } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', emailClean)
        .maybeSingle();

      if (userRecord) {
        const { data: purchase } = await supabase
          .from('compras')
          .select('id')
          .eq('usuario_id', userRecord.id)
          .eq('item_id', checkout.item_id)
          .eq('status', 'pago')
          .maybeSingle();

        if (purchase) {
          alreadyPurchased = true;
        } else {
          const table = checkout.item_tipo === 'trilha' ? 'trilha_participantes' : 'curso_participantes';
          const idField = checkout.item_tipo === 'trilha' ? 'trilha_id' : 'curso_id';
          const { data: enrollment } = await supabase
            .from(table)
            .select('id')
            .eq('usuario_id', userRecord.id)
            .eq(idField, checkout.item_id)
            .in('status', checkout.item_tipo === 'trilha' ? ['pago'] : ['inscrito', 'pago'])
            .maybeSingle();
          if (enrollment) alreadyPurchased = true;
        }
      }

      if (alreadyPurchased) {
        console.log(`[Cron] Customer ${emailClean} already purchased ${checkout.item_nome}. Marking as recovered.`);
        await supabase.from('checkouts_abandonados').update({ recuperado: true }).eq('id', checkout.id);
        continue;
      }

      console.log(`[Cron] Sending recovery notification to ${emailClean} for ${checkout.item_nome}`);
      await notifyAbandonedCart({
        email: checkout.email,
        name: checkout.nome,
        phone: checkout.telefone || undefined,
        itemName: checkout.item_nome,
        checkoutLink: checkout.checkout_url
      });

      await supabase.from('checkouts_abandonados').update({ recuperado: true }).eq('id', checkout.id);

      processedCount++;
      recoveredCount++;
    }

    res.json({ success: true, processed: processedCount, notifications_sent: recoveredCount });
  } catch (error: any) {
    console.error('[Cron Error] Exception in recover-carts job:', error);
    res.status(500).json({ error: error.message });
  }
}

router.post('/recover-carts', handleCartRecovery);
router.get('/recover-carts', handleCartRecovery);

export default router;

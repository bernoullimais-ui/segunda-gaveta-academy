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

// ─── M10: Expire course access ───────────────────────────────────────────────
/**
 * GET/POST /api/cron/expire-access
 *
 * Revokes access for participants whose enrollment period has expired.
 * Should be called daily (e.g., via Vercel cron or external scheduler).
 *
 * Logic:
 *   1. Fetch all cursos where duracao_tipo = 'com_limite' or 'days' (has expiration)
 *   2. For each course, find participants where (inscrito_em + duracao) < now
 *   3. Update status to 'expirado' in curso_participantes
 */
async function handleExpireAccess(_req: any, res: any) {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase client not initialized' });
  }

  try {
    console.log('[Cron] Running expire-access job...');

    // 1. Find courses with limited access duration
    const { data: cursosComLimite, error: cursosErr } = await supabase
      .from('cursos')
      .select('id, nome, duracao_tipo, duracao, duracao_dias')
      .in('duracao_tipo', ['com_limite', 'days', 'meses', 'semanas'])
      .not('duracao', 'is', null);

    if (cursosErr) {
      console.error('[ExpireAccess] Error fetching cursos:', cursosErr);
      return res.status(500).json({ error: cursosErr.message });
    }

    if (!cursosComLimite || cursosComLimite.length === 0) {
      return res.json({ success: true, expired: 0, message: 'No courses with expiration configured.' });
    }

    let totalExpired = 0;
    const now = new Date();

    for (const curso of cursosComLimite) {
      // Determine duration in days
      let durationDays: number | null = null;
      if (curso.duracao_dias) {
        durationDays = Number(curso.duracao_dias);
      } else if (curso.duracao_tipo === 'meses' && curso.duracao) {
        durationDays = Number(curso.duracao) * 30;
      } else if (curso.duracao_tipo === 'semanas' && curso.duracao) {
        durationDays = Number(curso.duracao) * 7;
      } else if (curso.duracao) {
        durationDays = Number(curso.duracao);
      }

      if (!durationDays || durationDays <= 0) continue;

      // 2. Find active participants enrolled longer than durationDays
      const { data: participants, error: partErr } = await supabase
        .from('curso_participantes')
        .select('id, usuario_id, created_at')
        .eq('curso_id', curso.id)
        .in('status', ['inscrito', 'pago', 'ativo'])
        .not('created_at', 'is', null);

      if (partErr) {
        console.error(`[ExpireAccess] Error fetching participants for ${curso.nome}:`, partErr);
        continue;
      }

      for (const participant of (participants || [])) {
        const enrolledAt = new Date(participant.created_at);
        const expiresAt = new Date(enrolledAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

        if (now > expiresAt) {
          const { error: updateErr } = await supabase
            .from('curso_participantes')
            .update({
              status: 'expirado',
              expirado_em: expiresAt.toISOString()
            })
            .eq('id', participant.id);

          if (!updateErr) {
            totalExpired++;
            console.log(`[ExpireAccess] Expired access for user ${participant.usuario_id} in course ${curso.nome}`);
          } else {
            console.error(`[ExpireAccess] Failed to expire ${participant.id}:`, updateErr);
          }
        }
      }
    }

    console.log(`[ExpireAccess] Job complete. Total expired: ${totalExpired}`);
    res.json({ success: true, expired: totalExpired, courses_checked: cursosComLimite.length });
  } catch (error: any) {
    console.error('[ExpireAccess] Exception:', error);
    res.status(500).json({ error: error.message });
  }
}

router.post('/expire-access', handleExpireAccess);
router.get('/expire-access', handleExpireAccess);

export default router;


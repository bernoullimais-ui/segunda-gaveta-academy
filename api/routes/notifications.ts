/**
 * Rotas de notificações — /api/notifications/* e /api/traffic/*
 * Extraído de api/_app.ts.
 *
 * Rotas incluídas:
 *   POST /api/notifications/test
 *   POST /api/traffic/track
 */
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  notifyWelcome,
  notifyOnboarding,
  notifyAffiliateInvite,
  notifyAbandonedCart,
  notifyPaymentFailed
} from '../lib/notification.js';

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
    console.error('Failed to create Supabase client in notifications router:', e);
  }
}

// ─── POST /test ────────────────────────────────────────────────────────────────
router.post('/test', async (req, res) => {
  const { type, email, name, phone, courseName, inviteLink, commission, checkoutLink, orgName } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    console.log(`[Test Endpoint] Triggering notification test for ${email} type ${type}`);
    let success = false;

    switch (type) {
      case 'welcome':
        await notifyWelcome({ email, name: name || 'Aluno Teste', phone: phone || undefined, courseName: courseName || 'Curso de Teste' });
        success = true;
        break;
      case 'onboarding':
        await notifyOnboarding({ email, name: name || 'Especialista Teste', phone: phone || undefined, orgName: orgName || 'Instituição de Teste' });
        success = true;
        break;
      case 'affiliate_invite':
        await notifyAffiliateInvite({
          email, name: name || 'Afiliado Teste', phone: phone || undefined,
          courseName: courseName || 'Curso de Teste',
          inviteLink: inviteLink || 'https://segunda-gaveta-academy.vercel.app/invite-test',
          commission: commission || 30
        });
        success = true;
        break;
      case 'abandoned_cart':
        await notifyAbandonedCart({
          email, name: name || 'Cliente Teste', phone: phone || undefined,
          itemName: courseName || 'Curso de Teste',
          checkoutLink: checkoutLink || 'https://segunda-gaveta-academy.vercel.app/checkout-test'
        });
        success = true;
        break;
      case 'payment_failed':
        await notifyPaymentFailed({
          email, name: name || 'Cliente Teste', phone: phone || undefined,
          itemName: courseName || 'Curso de Teste',
          checkoutLink: checkoutLink || 'https://segunda-gaveta-academy.vercel.app/checkout-test'
        });
        success = true;
        break;
      default:
        return res.status(400).json({
          error: `Invalid notification type: ${type}. Choose from 'welcome', 'onboarding', 'affiliate_invite', 'abandoned_cart', 'payment_failed'`
        });
    }

    res.json({ success, message: `Notification of type '${type}' sent successfully to ${email}` });
  } catch (error: any) {
    console.error('[Test Endpoint Error] Failed to send test notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /traffic/track (used on landing pages) ──────────────────────────────
router.post('/traffic/track', async (req, res) => {
  try {
    const { organizacao_id, curso_id, trilha_id, event_type, utm_source, utm_medium, utm_campaign, visitor_id, affiliate_id } = req.body;
    if (!organizacao_id || !event_type) {
      return res.status(400).json({ error: 'organizacao_id e event_type são obrigatórios.' });
    }

    const { error } = await supabase.from('traffic_events').insert([{
      organizacao_id,
      curso_id: curso_id || null,
      trilha_id: trilha_id || null,
      event_type,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      visitor_id: visitor_id || null
    }]);

    if (error) {
      console.error('Failed to insert traffic_event:', error);
      // We do not return 500 here, we still try to track affiliate click
    }

    // M7: Track Affiliate Click
    if (affiliate_id && event_type === 'pageview') {
      const ip_hash = req.headers['x-forwarded-for'] || req.socket.remoteAddress || visitor_id || 'unknown';
      
      const { error: clickErr } = await supabase.from('clicks_afiliados').insert([{
        affiliate_id,
        curso_id: curso_id || null,
        trilha_id: trilha_id || null,
        ip_hash: typeof ip_hash === 'string' ? ip_hash.split(',')[0] : String(ip_hash)
      }]);
      
      if (clickErr) {
        console.error('Failed to insert clicks_afiliados:', clickErr);
      }
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Traffic tracking error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

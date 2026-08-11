/**
 * Rota de Link na Bio (Linktree) — /api/bio-links/*
 *
 * POST /api/bio-links/track-click
 *   Registra um clique em um link personalizado e incrementa contador em organizacoes.config_json
 *
 * GET /api/bio-links/stats/:orgId
 *   Retorna estatísticas de cliques por link para o painel do especialista
 */
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

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
    console.error('Failed to create Supabase client in bio-links router:', e);
  }
}

// ─── POST /api/bio-links/track-click ─────────────────────────────────────────
router.post('/track-click', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Database not configured.' });

    const { organizacao_id, link_id, link_url } = req.body;

    if (!organizacao_id || !link_id) {
      return res.status(400).json({ error: 'organizacao_id e link_id são obrigatórios.' });
    }

    const userAgent = req.headers['user-agent'] || null;
    const referrer = req.headers['referer'] || req.headers['referrer'] || null;

    // 1. Record click in bio_link_clicks table if table exists
    await supabase.from('bio_link_clicks').insert({
      organizacao_id,
      link_id,
      link_url: link_url || '',
      user_agent: userAgent ? String(userAgent).substring(0, 500) : null,
      referrer: referrer ? String(referrer).substring(0, 500) : null,
    }).catch((e: any) => {
      console.warn('[bio-links] Click log table error (non-fatal):', e);
    });

    // 2. Increment clicks in config_json.bio_links_config.custom_links
    const { data: org } = await supabase
      .from('organizacoes')
      .select('config_json')
      .eq('id', organizacao_id)
      .maybeSingle();

    if (org?.config_json?.bio_links_config?.custom_links) {
      const bioConfig = org.config_json.bio_links_config;
      let updated = false;

      const updatedLinks = bioConfig.custom_links.map((link: any) => {
        if (link.id === link_id) {
          updated = true;
          return { ...link, clicks: (link.clicks || 0) + 1 };
        }
        return link;
      });

      if (updated) {
        const newConfigJson = {
          ...org.config_json,
          bio_links_config: {
            ...bioConfig,
            custom_links: updatedLinks,
          },
        };

        await supabase
          .from('organizacoes')
          .update({ config_json: newConfigJson })
          .eq('id', organizacao_id);
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[bio-links] Track click error:', err);
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  }
});

// ─── GET /api/bio-links/stats/:orgId ─────────────────────────────────────────
router.get('/stats/:orgId', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Database not configured.' });

    const { orgId } = req.params;

    const { data: clicks, error } = await supabase
      .from('bio_link_clicks')
      .select('link_id, created_at')
      .eq('organizacao_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const clickCounts: Record<string, number> = {};
    (clicks || []).forEach((c: any) => {
      clickCounts[c.link_id] = (clickCounts[c.link_id] || 0) + 1;
    });

    return res.json({
      total_clicks: (clicks || []).length,
      clicks_by_link: clickCounts,
      recent_clicks: clicks || [],
    });
  } catch (err: any) {
    console.error('[bio-links] Stats error:', err);
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  }
});

export default router;

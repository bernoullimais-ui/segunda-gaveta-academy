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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
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

    // 2. Increment clicks in config_json.bio_links_config.click_counts & custom_links
    const { data: org } = await supabase
      .from('organizacoes')
      .select('config_json')
      .eq('id', organizacao_id)
      .maybeSingle();

    if (org?.config_json) {
      const bioConfig = org.config_json.bio_links_config || {};
      const customLinks = bioConfig.custom_links || [];
      const clickCounts = bioConfig.click_counts || {};

      clickCounts[link_id] = (clickCounts[link_id] || 0) + 1;

      const updatedLinks = customLinks.map((link: any) => {
        if (link.id === link_id) {
          return { ...link, clicks: (link.clicks || 0) + 1 };
        }
        return link;
      });

      const newConfigJson = {
        ...org.config_json,
        bio_links_config: {
          ...bioConfig,
          custom_links: updatedLinks,
          click_counts: clickCounts,
        },
      };

      await supabase
        .from('organizacoes')
        .update({ config_json: newConfigJson })
        .eq('id', organizacao_id);
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

    const { data: org } = await supabase
      .from('organizacoes')
      .select('config_json')
      .eq('id', orgId)
      .maybeSingle();

    const configClicks = org?.config_json?.bio_links_config?.click_counts || {};

    const { data: clicks } = await supabase
      .from('bio_link_clicks')
      .select('link_id, created_at')
      .eq('organizacao_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1000);

    const clickCounts: Record<string, number> = { ...configClicks };
    (clicks || []).forEach((c: any) => {
      if (c.link_id) {
        const tableCount = (clicks || []).filter((x: any) => x.link_id === c.link_id).length;
        clickCounts[c.link_id] = Math.max(clickCounts[c.link_id] || 0, tableCount);
      }
    });

    const totalClicks = Object.values(clickCounts).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);

    return res.json({
      total_clicks: Math.max(totalClicks, (clicks || []).length),
      clicks_by_link: clickCounts,
      recent_clicks: clicks || [],
    });
  } catch (err: any) {
    console.error('[bio-links] Stats error:', err);
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  }
});

export default router;


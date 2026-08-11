/**
 * Rota de Link na Bio (Linktree) — /api/bio-links/*
 *
 * Estratégia: armazena contadores de cliques diretamente em
 *   organizacoes.config_json.bio_links_config.click_counts
 * Não depende de tabela externa — funciona 100% sem migrações.
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.error('Failed to create Supabase client in bio-links router:', e);
  }
}

// ─── POST /api/bio-links/track-click ─────────────────────────────────────────
// Stores clicks directly in organizacoes.config_json (no external table needed)
router.post('/track-click', async (req, res) => {
  try {
    if (!supabase) {
      console.error('[bio-links] Supabase not configured. URL:', supabaseUrl ? 'set' : 'missing', 'KEY:', supabaseKey ? 'set' : 'missing');
      return res.status(503).json({ error: 'Database not configured.' });
    }

    const { organizacao_id, link_id, link_url } = req.body;

    if (!organizacao_id || !link_id) {
      return res.status(400).json({ error: 'organizacao_id e link_id são obrigatórios.' });
    }

    // 1. Fetch current config_json
    const { data: org, error: fetchErr } = await supabase
      .from('organizacoes')
      .select('config_json')
      .eq('id', organizacao_id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[bio-links] Fetch error:', fetchErr);
      return res.status(500).json({ error: fetchErr.message });
    }
    if (!org) {
      return res.status(404).json({ error: 'Organização não encontrada.' });
    }

    // 2. Update click_counts in config_json
    const bioConfig = org.config_json?.bio_links_config || {};
    const clickCounts: Record<string, number> = { ...(bioConfig.click_counts || {}) };
    clickCounts[link_id] = (clickCounts[link_id] || 0) + 1;

    // Also update custom_links clicks counter if the link is a custom link
    const customLinks = (bioConfig.custom_links || []).map((link: any) => {
      if (link.id === link_id) {
        return { ...link, clicks: (link.clicks || 0) + 1 };
      }
      return link;
    });

    const totalClicks = Object.values(clickCounts).reduce((a: number, b: any) => a + Number(b), 0);

    const newConfigJson = {
      ...(org.config_json || {}),
      bio_links_config: {
        ...bioConfig,
        custom_links: customLinks,
        click_counts: clickCounts,
        total_clicks: totalClicks,
      },
    };

    const { error: updateErr } = await supabase
      .from('organizacoes')
      .update({ config_json: newConfigJson })
      .eq('id', organizacao_id);

    if (updateErr) {
      console.error('[bio-links] Update error:', updateErr);
      return res.status(500).json({ error: updateErr.message });
    }

    // 3. Also try to insert into bio_link_clicks table (best effort - table may not exist)
    await supabase.from('bio_link_clicks').insert({
      organizacao_id,
      link_id,
      link_url: link_url || '',
      user_agent: String(req.headers['user-agent'] || '').substring(0, 500),
      referrer: String(req.headers['referer'] || '').substring(0, 500),
    }).catch(() => {}); // non-fatal, table may not exist

    return res.json({ success: true, click_counts: clickCounts, total_clicks: totalClicks });
  } catch (err: any) {
    console.error('[bio-links] Track click error:', err);
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  }
});

// ─── GET /api/bio-links/stats/:orgId ─────────────────────────────────────────
// Reads click_counts from config_json (always works, no external table needed)
router.get('/stats/:orgId', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Database not configured.' });

    const { orgId } = req.params;

    const { data: org, error } = await supabase
      .from('organizacoes')
      .select('config_json')
      .eq('id', orgId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const clickCounts: Record<string, number> = org?.config_json?.bio_links_config?.click_counts || {};
    const totalClicks = Object.values(clickCounts).reduce((a: number, b: any) => a + Number(b), 0);

    return res.json({
      total_clicks: totalClicks,
      clicks_by_link: clickCounts,
    });
  } catch (err: any) {
    console.error('[bio-links] Stats error:', err);
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  }
});

export default router;

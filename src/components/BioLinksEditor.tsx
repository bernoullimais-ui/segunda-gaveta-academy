import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Link as LinkIcon,
  Plus,
  Trash2,
  Save,
  MoveUp,
  MoveDown,
  Sparkles,
  Eye,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  Palette,
  Share2,
  BarChart3,
  Globe,
  Instagram,
  Youtube,
  Linkedin,
  MessageSquare,
  Video,
  Shield,
  Loader2,
  Image as ImageIcon,
  Pencil,
  BookOpen,
  Award
} from 'lucide-react';
import { BioLinksPage } from './BioLinksPage';

interface BioLinksEditorProps {
  orgId: string;
  loggedUser?: any;
  showToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

const THEME_OPTIONS = [
  { id: 'glassmorphic_dark', name: 'Dark Glassmorphic', color: '#6366f1', desc: 'Fundo escuro profundo com cartões estilo vidro fosco' },
  { id: 'clean_light', name: 'Clean Light', color: '#3b82f6', desc: 'Design limpo e moderno com cartões brancos e sombras' },
  { id: 'gradient_sunset', name: 'Gradient Sunset', color: '#ec4899', desc: 'Degradê vibrante roxo e azul com toques rosa' },
  { id: 'cyberpunk_neon', name: 'Cyberpunk Neon', color: '#06b6d4', desc: 'Fundo preto com detalhes cyan e fuchsia fluorescentes' },
  { id: 'minimal_dark', name: 'Minimal Dark', color: '#71717a', desc: 'Minimalismo escuro elegante com tipografia refinada' },
];

export function BioLinksEditor({ orgId, loggedUser, showToast }: BioLinksEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'links' | 'aparencia' | 'sociais' | 'pixels_seo' | 'metricas'>('links');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [orgSlug, setOrgSlug] = useState('');

  // Main Config State
  const [config, setConfig] = useState<any>({
    ativo: true,
    titulo: '',
    subtitulo: '',
    avatar_url: '',
    theme: 'glassmorphic_dark',
    custom_primary_color: '#6366f1',
    background_image_url: '',
    exibir_cursos: true,
    exibir_trilhas: true,
    social_links: {
      whatsapp: '',
      instagram: '',
      youtube: '',
      tiktok: '',
      linkedin: '',
      site: '',
    },
    custom_links: [],
    seo: {
      title: '',
      description: '',
      og_image_url: '',
    },
    pixels: {
      meta_pixel_id: '',
      google_analytics_id: '',
      tiktok_pixel_id: '',
    },
  });

  // Link editing temp state
  const [newLink, setNewLink] = useState({
    titulo: '',
    url: '',
    destaque: false,
    cor_botao: '#6366f1',
  });

  // Analytics & Course State
  const [stats, setStats] = useState<any>(null);
  const [cursos, setCursos] = useState<any[]>([]);
  const [trilhas, setTrilhas] = useState<any[]>([]);

  useEffect(() => {
    const fetchOrgBioConfig = async () => {
      if (!orgId) return;
      setLoading(true);
      try {
        const { data: orgData } = await supabase
          .from('organizacoes')
          .select('id, nome, logo_url, slug, config_json')
          .eq('id', orgId)
          .single();

        if (orgData) {
          setOrgSlug(orgData.slug || '');
          const existing = orgData.config_json?.bio_links_config || {};

          setConfig({
            ativo: existing.ativo !== false,
            titulo: existing.titulo || orgData.nome || '',
            subtitulo: existing.subtitulo || '',
            avatar_url: existing.avatar_url || orgData.logo_url || '',
            theme: existing.theme || 'glassmorphic_dark',
            custom_primary_color: existing.custom_primary_color || '#6366f1',
            background_image_url: existing.background_image_url || '',
            exibir_cursos: existing.exibir_cursos !== false,
            exibir_trilhas: existing.exibir_trilhas !== false,
            social_links: existing.social_links || {
              whatsapp: '',
              instagram: '',
              youtube: '',
              tiktok: '',
              linkedin: '',
              site: '',
            },
            custom_links: existing.custom_links || [],
            seo: existing.seo || { title: '', description: '', og_image_url: '' },
            pixels: existing.pixels || { meta_pixel_id: '', google_analytics_id: '', tiktok_pixel_id: '' },
          });
        }

        // Fetch cursos & trilhas for click report
        const { data: coursesData } = await supabase
          .from('cursos')
          .select('id, nome, slug, status')
          .eq('organizacao_id', orgId);
        if (coursesData) setCursos(coursesData);

        const { data: trilhasData } = await supabase
          .from('trilhas')
          .select('id, nome, slug')
          .eq('organizacao_id', orgId);
        if (trilhasData) setTrilhas(trilhasData);

        // Fetch click analytics (API + Supabase fallback)
        let statsLoaded = false;
        try {
          const res = await fetch(`/api/bio-links/stats/${orgId}`).catch(() => null);
          if (res && res.ok) {
            const statsData = await res.json();
            if (statsData && typeof statsData.total_clicks === 'number') {
              setStats(statsData);
              statsLoaded = true;
            }
          }
        } catch (e) {}

        if (!statsLoaded) {
          try {
            const { data: dbClicks } = await supabase
              .from('bio_link_clicks')
              .select('link_id')
              .eq('organizacao_id', orgId);

            if (dbClicks) {
              const clickCounts: Record<string, number> = {};
              dbClicks.forEach((c: any) => {
                if (c.link_id) {
                  clickCounts[c.link_id] = (clickCounts[c.link_id] || 0) + 1;
                }
              });
              setStats({
                total_clicks: dbClicks.length,
                clicks_by_link: clickCounts,
              });
            }
          } catch (e) {
            console.warn('[bio-links] Direct Supabase stats error:', e);
          }
        }
      } catch (err: any) {
        console.error('Error loading bio links config:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrgBioConfig();
  }, [orgId]);

  // Re-fetch stats when user switches to 'metricas' tab
  useEffect(() => {
    if (activeTab === 'metricas' && orgId) {
      const refreshStats = async () => {
        const { data: orgData } = await supabase
          .from('organizacoes')
          .select('config_json')
          .eq('id', orgId)
          .maybeSingle();

        const configClicks = orgData?.config_json?.bio_links_config?.click_counts || {};

        const { data: dbClicks } = await supabase
          .from('bio_link_clicks')
          .select('link_id')
          .eq('organizacao_id', orgId);

        const clickCounts: Record<string, number> = { ...configClicks };
        if (dbClicks) {
          dbClicks.forEach((c: any) => {
            if (c.link_id) {
              const tableCount = dbClicks.filter((x: any) => x.link_id === c.link_id).length;
              clickCounts[c.link_id] = Math.max(clickCounts[c.link_id] || 0, tableCount);
            }
          });
        }

        const totalClicks = Object.values(clickCounts).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);

        setStats({
          total_clicks: Math.max(totalClicks, (dbClicks || []).length),
          clicks_by_link: clickCounts,
        });

        if (orgData?.config_json?.bio_links_config) {
          setConfig((prev: any) => ({
            ...prev,
            click_counts: clickCounts,
          }));
        }
      };

      refreshStats();
    }
  }, [activeTab, orgId]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      // 1. Fetch current org config_json first to merge without overwriting
      const { data: orgData } = await supabase
        .from('organizacoes')
        .select('config_json')
        .eq('id', orgId)
        .single();

      const currentConfigJson = orgData?.config_json || {};

      const updatedConfigJson = {
        ...currentConfigJson,
        bio_links_config: config,
      };

      const { error } = await supabase
        .from('organizacoes')
        .update({ config_json: updatedConfigJson })
        .eq('id', orgId);

      if (error) throw error;

      showToast('Configurações do Link na Bio salvas com sucesso!', 'success');
    } catch (err: any) {
      console.error('Error saving bio links config:', err);
      showToast(`Erro ao salvar: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Link Handlers
  const handleAddLink = () => {
    if (!newLink.titulo.trim() || !newLink.url.trim()) {
      showToast('Informe o título e a URL do link.', 'info');
      return;
    }

    let urlFormatted = newLink.url.trim();
    if (!urlFormatted.startsWith('http://') && !urlFormatted.startsWith('https://')) {
      urlFormatted = `https://${urlFormatted}`;
    }

    const item = {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      titulo: newLink.titulo.trim(),
      url: urlFormatted,
      destaque: newLink.destaque,
      cor_botao: newLink.cor_botao,
      ativo: true,
      clicks: 0,
    };

    setConfig((prev: any) => ({
      ...prev,
      custom_links: [...prev.custom_links, item],
    }));

    setNewLink({ titulo: '', url: '', destaque: false, cor_botao: '#6366f1' });
    showToast('Link adicionado!', 'success');
  };

  const handleRemoveLink = (id: string) => {
    setConfig((prev: any) => ({
      ...prev,
      custom_links: prev.custom_links.filter((l: any) => l.id !== id),
    }));
  };

  const handleToggleLinkActive = (id: string) => {
    setConfig((prev: any) => ({
      ...prev,
      custom_links: prev.custom_links.map((l: any) =>
        l.id === id ? { ...l, ativo: !l.ativo } : l
      ),
    }));
  };

  const handleToggleLinkDestaque = (id: string) => {
    setConfig((prev: any) => ({
      ...prev,
      custom_links: prev.custom_links.map((l: any) =>
        l.id === id ? { ...l, destaque: !l.destaque } : l
      ),
    }));
  };

  const handleMoveLink = (index: number, direction: 'up' | 'down') => {
    const list = [...config.custom_links];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    setConfig((prev: any) => ({ ...prev, custom_links: list }));
  };

  // Edit Link Handlers
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editLinkData, setEditLinkData] = useState<{
    id: string;
    titulo: string;
    url: string;
    destaque: boolean;
    cor_botao: string;
  }>({ id: '', titulo: '', url: '', destaque: false, cor_botao: '#6366f1' });

  const handleStartEditLink = (link: any) => {
    setEditingLinkId(link.id);
    setEditLinkData({
      id: link.id,
      titulo: link.titulo || '',
      url: link.url || '',
      destaque: !!link.destaque,
      cor_botao: link.cor_botao || '#6366f1',
    });
  };

  const handleCancelEditLink = () => {
    setEditingLinkId(null);
  };

  const handleSaveEditLink = () => {
    if (!editLinkData.titulo.trim() || !editLinkData.url.trim()) {
      showToast('Informe o título e a URL do link.', 'info');
      return;
    }

    let urlFormatted = editLinkData.url.trim();
    if (!urlFormatted.startsWith('http://') && !urlFormatted.startsWith('https://')) {
      urlFormatted = `https://${urlFormatted}`;
    }

    setConfig((prev: any) => ({
      ...prev,
      custom_links: prev.custom_links.map((l: any) =>
        l.id === editLinkData.id
          ? {
              ...l,
              titulo: editLinkData.titulo.trim(),
              url: urlFormatted,
              destaque: editLinkData.destaque,
              cor_botao: editLinkData.cor_botao,
            }
          : l
      ),
    }));

    setEditingLinkId(null);
    showToast('Link atualizado!', 'success');
  };

  const publicUrl = orgSlug
    ? `https://${orgSlug}.segundagaveta.com.br/links`
    : `${window.location.origin}/l/default`;

  const copyPublicUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    showToast('URL copiada para a área de transferência!', 'info');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="ml-3 text-sm font-semibold text-slate-600">Carregando editor do Link na Bio...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-xl shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Link na Bio ("Linktree")</h2>
              <p className="text-xs text-slate-500 font-medium">
                Página oficial para compartilhar no Instagram, TikTok e WhatsApp com suporte a SEO e Pixels
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={copyPublicUrl}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors"
          >
            {copiedUrl ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copiedUrl ? 'Copiado!' : 'Copiar URL'}
          </button>

          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Abrir Página
          </a>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvar...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* Main Grid: Left Editor (2 cols) & Right Live Preview (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Editor Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sub-tabs Navigation */}
          <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveTab('links')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'links'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" /> Links Customizados ({config.custom_links?.length || 0})
            </button>

            <button
              onClick={() => setActiveTab('aparencia')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'aparencia'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Palette className="w-3.5 h-3.5" /> Perfil & Temas Visuais
            </button>

            <button
              onClick={() => setActiveTab('sociais')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'sociais'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" /> Redes Sociais
            </button>

            <button
              onClick={() => setActiveTab('pixels_seo')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'pixels_seo'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Pixels & SEO
            </button>

            <button
              onClick={() => setActiveTab('metricas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'metricas'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Cliques & Relatório
            </button>
          </div>

          {/* TAB 1: LINKS CUSTOMIZADOS */}
          {activeTab === 'links' && (
            <div className="space-y-6">
              {/* Form: Adicionar Novo Link */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" /> Adicionar Novo Link Personalizado
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Título do Link</label>
                    <input
                      type="text"
                      placeholder="Ex: 🔥 Grupo VIP no WhatsApp"
                      value={newLink.titulo}
                      onChange={(e) => setNewLink({ ...newLink, titulo: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">URL de Destino</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={newLink.url}
                      onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={newLink.destaque}
                        onChange={(e) => setNewLink({ ...newLink, destaque: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                      />
                      ★ Marcar como Destaque (Glow/Pulse)
                    </label>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">Cor do Borda/Botão:</span>
                      <input
                        type="color"
                        value={newLink.cor_botao}
                        onChange={(e) => setNewLink({ ...newLink, cor_botao: e.target.value })}
                        className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAddLink}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
                  >
                    Adicionar Link
                  </button>
                </div>
              </div>

              {/* Lista de Links Adicionados */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">Links Cadastrados ({config.custom_links?.length || 0})</h3>

                {config.custom_links?.length === 0 ? (
                  <p className="text-slate-400 text-xs text-center py-8">
                    Nenhum link adicionado ainda. Preencha o formulário acima para adicionar o primeiro link!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {config.custom_links.map((link: any, index: number) => (
                      <div key={link.id}>
                        {editingLinkId === link.id ? (
                          <div className="p-4 rounded-xl border border-indigo-300 bg-indigo-50/40 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-indigo-900 uppercase">Editar Link</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Título do Link</label>
                                <input
                                  type="text"
                                  value={editLinkData.titulo}
                                  onChange={(e) => setEditLinkData({ ...editLinkData, titulo: e.target.value })}
                                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">URL de Destino</label>
                                <input
                                  type="url"
                                  value={editLinkData.url}
                                  onChange={(e) => setEditLinkData({ ...editLinkData, url: e.target.value })}
                                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-indigo-100">
                              <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={editLinkData.destaque}
                                    onChange={(e) => setEditLinkData({ ...editLinkData, destaque: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                                  />
                                  ★ Destaque (Glow/Pulse)
                                </label>

                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-500">Cor do Botão:</span>
                                  <input
                                    type="color"
                                    value={editLinkData.cor_botao}
                                    onChange={(e) => setEditLinkData({ ...editLinkData, cor_botao: e.target.value })}
                                    className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleCancelEditLink}
                                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveEditLink}
                                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
                                >
                                  Salvar Link
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                              link.ativo !== false ? 'bg-slate-50 border-slate-200' : 'bg-slate-100/60 border-slate-200 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex flex-col gap-1 text-slate-400">
                                <button
                                  type="button"
                                  onClick={() => handleMoveLink(index, 'up')}
                                  disabled={index === 0}
                                  className="hover:text-slate-700 disabled:opacity-30"
                                >
                                  <MoveUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveLink(index, 'down')}
                                  disabled={index === config.custom_links.length - 1}
                                  className="hover:text-slate-700 disabled:opacity-30"
                                >
                                  <MoveDown className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-sm truncate">{link.titulo}</span>
                                  {link.destaque && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700">
                                      Destaque
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 truncate max-w-xs">{link.url}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditLink(link)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 border border-slate-200 bg-white transition-colors flex items-center gap-1 text-xs font-bold"
                                title="Editar Link"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleLinkDestaque(link.id)}
                                className={`p-1.5 rounded-lg text-xs font-bold border ${
                                  link.destaque
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                    : 'bg-white border-slate-200 text-slate-500'
                                }`}
                                title="Alternar Destaque"
                              >
                                ★
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleLinkActive(link.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                  link.ativo !== false
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : 'bg-slate-200 border-slate-300 text-slate-600'
                                }`}
                              >
                                {link.ativo !== false ? 'Ativo' : 'Oculto'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveLink(link.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                title="Remover Link"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Toggles de Conteúdo Automático */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">Vitrine Automática de Cursos e Trilhas</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                    <div>
                      <span className="text-sm font-bold text-slate-800 block">Exibir Cursos Publicados</span>
                      <span className="text-xs text-slate-500">Mostra os cards dos seus cursos automaticamente</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.exibir_cursos !== false}
                      onChange={(e) => setConfig({ ...config, exibir_cursos: e.target.checked })}
                      className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                    <div>
                      <span className="text-sm font-bold text-slate-800 block">Exibir Trilhas de Aprendizagem</span>
                      <span className="text-xs text-slate-500">Mostra as formações e trilhas ativas</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.exibir_trilhas !== false}
                      onChange={(e) => setConfig({ ...config, exibir_trilhas: e.target.checked })}
                      className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PERFIL & APARÊNCIA */}
          {activeTab === 'aparencia' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">Informações do Perfil</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nome / Título da Bio</label>
                    <input
                      type="text"
                      value={config.titulo}
                      onChange={(e) => setConfig({ ...config, titulo: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Subtítulo / Bio Curta</label>
                    <input
                      type="text"
                      placeholder="Ex: Especialista em Produção Audiovisual"
                      value={config.subtitulo}
                      onChange={(e) => setConfig({ ...config, subtitulo: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">URL do Foto de Perfil (Avatar)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={config.avatar_url}
                    onChange={(e) => setConfig({ ...config, avatar_url: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Seleção de Tema Visual */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">Tema Visual da Página</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {THEME_OPTIONS.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setConfig({ ...config, theme: theme.id })}
                      className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                        config.theme === theme.id
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-slate-900 text-sm">{theme.name}</span>
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.color }} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{theme.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Imagem de Fundo Personalizada (Opcional)</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={config.background_image_url || ''}
                    onChange={(e) => setConfig({ ...config, background_image_url: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REDES SOCIAIS */}
          {activeTab === 'sociais' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Links de Redes Sociais & Contato</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp (Com DDD)
                  </label>
                  <input
                    type="text"
                    placeholder="5511999999999"
                    value={config.social_links?.whatsapp || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        social_links: { ...config.social_links, whatsapp: e.target.value },
                      })
                    }
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
                    <Instagram className="w-3.5 h-3.5 text-pink-500" /> Instagram (@usuario)
                  </label>
                  <input
                    type="text"
                    placeholder="meu.perfil"
                    value={config.social_links?.instagram || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        social_links: { ...config.social_links, instagram: e.target.value },
                      })
                    }
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
                    <Youtube className="w-3.5 h-3.5 text-red-500" /> YouTube (@canal)
                  </label>
                  <input
                    type="text"
                    placeholder="@meucanal"
                    value={config.social_links?.youtube || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        social_links: { ...config.social_links, youtube: e.target.value },
                      })
                    }
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
                    <Video className="w-3.5 h-3.5 text-cyan-500" /> TikTok (@usuario)
                  </label>
                  <input
                    type="text"
                    placeholder="@meutiktok"
                    value={config.social_links?.tiktok || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        social_links: { ...config.social_links, tiktok: e.target.value },
                      })
                    }
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
                    <Linkedin className="w-3.5 h-3.5 text-blue-600" /> LinkedIn (usuario)
                  </label>
                  <input
                    type="text"
                    placeholder="meu-perfil-linkedin"
                    value={config.social_links?.linkedin || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        social_links: { ...config.social_links, linkedin: e.target.value },
                      })
                    }
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
                    <Globe className="w-3.5 h-3.5 text-purple-500" /> Site Oficial
                  </label>
                  <input
                    type="text"
                    placeholder="https://meusite.com.br"
                    value={config.social_links?.site || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        social_links: { ...config.social_links, site: e.target.value },
                      })
                    }
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PIXELS & SEO */}
          {activeTab === 'pixels_seo' && (
            <div className="space-y-6">
              {/* Pixels */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">Pixels de Conversão & Rastreamento</h3>
                <p className="text-xs text-slate-500">
                  Insira o ID do seu Pixel para rastrear visualizações e cliques automaticamente.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Meta / Facebook Pixel ID</label>
                    <input
                      type="text"
                      placeholder="Ex: 123456789012345"
                      value={config.pixels?.meta_pixel_id || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          pixels: { ...config.pixels, meta_pixel_id: e.target.value },
                        })
                      }
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Google Analytics ID (GA4)</label>
                    <input
                      type="text"
                      placeholder="Ex: G-XXXXXXXXXX"
                      value={config.pixels?.google_analytics_id || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          pixels: { ...config.pixels, google_analytics_id: e.target.value },
                        })
                      }
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">TikTok Pixel ID</label>
                    <input
                      type="text"
                      placeholder="Ex: CXXXXXXXXXXXX"
                      value={config.pixels?.tiktok_pixel_id || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          pixels: { ...config.pixels, tiktok_pixel_id: e.target.value },
                        })
                      }
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* SEO & OpenGraph */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">Configuração de SEO & Preview em Redes Sociais</h3>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Título SEO (OpenGraph)</label>
                  <input
                    type="text"
                    placeholder="Ex: Bruno Maia — Links Oficiais & Cursos"
                    value={config.seo?.title || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        seo: { ...config.seo, title: e.target.value },
                      })
                    }
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Descrição SEO</label>
                  <textarea
                    rows={2}
                    placeholder="Descrição exibida no preview ao enviar o link no WhatsApp ou redes sociais..."
                    value={config.seo?.description || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        seo: { ...config.seo, description: e.target.value },
                      })
                    }
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Imagem de Preview (OG Thumbnail)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={config.seo?.og_image_url || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        seo: { ...config.seo, og_image_url: e.target.value },
                      })
                    }
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MÉTRICAS DE CLIQUES */}
          {activeTab === 'metricas' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Relatório de Cliques por Categoria</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Métricas e contagem de acessos gravadas na plataforma</p>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-700 font-black text-lg rounded-2xl flex items-center gap-2">
                  <span>{stats?.total_clicks || 0}</span>
                  <span className="text-xs font-semibold text-indigo-600">cliques registrados</span>
                </div>
              </div>

              {/* 1. Links Personalizados */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Links Personalizados</h4>
                </div>

                {config.custom_links?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl">Nenhum link personalizado cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {config.custom_links?.map((link: any) => {
                      const count = stats?.clicks_by_link?.[link.id] ?? config?.click_counts?.[link.id] ?? link.clicks ?? 0;
                      return (
                        <div key={link.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 text-sm block truncate">{link.titulo}</span>
                            <span className="text-xs text-slate-400 truncate max-w-xs block">{link.url}</span>
                          </div>
                          <div className="px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-lg text-xs font-black shrink-0">
                            {count} {count === 1 ? 'clique' : 'cliques'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Cursos & Treinamentos */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Cursos & Treinamentos</h4>
                </div>

                {(cursos || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl">Nenhum curso cadastrado nesta organização.</p>
                ) : (
                  <div className="space-y-2">
                    {(cursos || []).map((c: any) => {
                      const count = stats?.clicks_by_link?.[c.id] ?? config?.click_counts?.[c.id] ?? 0;
                      const url = `/public/curso/${c.slug || c.id}`;
                      return (
                        <div key={c.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 text-sm block truncate">{c.nome}</span>
                            <span className="text-xs text-slate-400 truncate max-w-xs block">{url}</span>
                          </div>
                          <div className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-black shrink-0">
                            {count} {count === 1 ? 'clique' : 'cliques'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Trilhas de Aprendizagem */}
              {(trilhas || []).length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-600" />
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Trilhas de Aprendizagem</h4>
                  </div>

                  <div className="space-y-2">
                    {(trilhas || []).map((t: any) => {
                      const count = stats?.clicks_by_link?.[t.id] ?? config?.click_counts?.[t.id] ?? 0;
                      const url = `/public/trilha/${t.slug || t.id}`;
                      return (
                        <div key={t.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 text-sm block truncate">{t.nome}</span>
                            <span className="text-xs text-slate-400 truncate max-w-xs block">{url}</span>
                          </div>
                          <div className="px-3 py-1.5 bg-purple-100 text-purple-800 rounded-lg text-xs font-black shrink-0">
                            {count} {count === 1 ? 'clique' : 'cliques'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Redes Sociais */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Redes Sociais & Contato</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: 'whatsapp', name: 'WhatsApp' },
                    { key: 'instagram', name: 'Instagram' },
                    { key: 'youtube', name: 'YouTube' },
                    { key: 'tiktok', name: 'TikTok' },
                    { key: 'linkedin', name: 'LinkedIn' },
                    { key: 'site', name: 'Site Oficial' },
                  ]
                    .filter((s) => config.social_links?.[s.key])
                    .map((s) => {
                      const count = stats?.clicks_by_link?.[s.key] ?? config?.click_counts?.[s.key] ?? 0;
                      return (
                        <div key={s.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="font-bold text-slate-800 text-xs">{s.name}</span>
                          <span className="px-2.5 py-1 bg-slate-200 text-slate-800 rounded-md text-xs font-black">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Preview Panel (1 col) */}
        <div className="sticky top-6 hidden lg:block">
          <div className="bg-slate-900 p-4 rounded-[40px] shadow-2xl border-4 border-slate-800 w-full max-w-[340px] mx-auto">
            <div className="flex justify-center mb-2">
              <div className="w-16 h-4 bg-slate-800 rounded-full" />
            </div>

            <div className="rounded-[30px] overflow-hidden max-h-[580px] overflow-y-auto">
              <BioLinksPage previewConfig={config} orgId={orgId} />
            </div>
          </div>

          <p className="text-[11px] text-center text-slate-400 mt-3 font-medium">
            📱 Simulação ao vivo de tela de smartphone
          </p>
        </div>
      </div>
    </div>
  );
}

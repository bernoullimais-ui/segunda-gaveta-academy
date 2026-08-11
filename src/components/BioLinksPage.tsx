import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  ExternalLink,
  MessageSquare,
  Globe,
  Instagram,
  Youtube,
  Linkedin,
  BookOpen,
  Sparkles,
  Share2,
  Check,
  ChevronRight,
  ShieldCheck,
  Zap,
  Play,
  Star,
  Award,
  Video,
  Music,
  Send,
  Link as LinkIcon
} from 'lucide-react';

interface BioLinksPageProps {
  slug?: string;
  orgId?: string;
  previewConfig?: any; // For Live Preview in Admin
}

const THEME_STYLES: Record<string, {
  bg: string;
  cardBg: string;
  cardHover: string;
  textColor: string;
  subtextColor: string;
  accent: string;
  border: string;
  badgeBg: string;
}> = {
  glassmorphic_dark: {
    bg: 'bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white',
    cardBg: 'bg-white/10 backdrop-blur-md border-white/15',
    cardHover: 'hover:bg-white/20 hover:border-white/30 hover:scale-[1.02]',
    textColor: 'text-white',
    subtextColor: 'text-slate-300',
    accent: 'from-indigo-500 to-purple-500',
    border: 'border-white/20',
    badgeBg: 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40',
  },
  clean_light: {
    bg: 'bg-gradient-to-b from-slate-50 via-indigo-50/30 to-slate-100 text-slate-900',
    cardBg: 'bg-white shadow-lg shadow-slate-200/50 border-slate-200/80',
    cardHover: 'hover:border-indigo-300 hover:shadow-indigo-100/60 hover:scale-[1.02]',
    textColor: 'text-slate-900',
    subtextColor: 'text-slate-600',
    accent: 'from-indigo-600 to-blue-600',
    border: 'border-slate-200',
    badgeBg: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  },
  gradient_sunset: {
    bg: 'bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-950 text-white',
    cardBg: 'bg-purple-950/40 backdrop-blur-md border-purple-500/20',
    cardHover: 'hover:bg-purple-900/50 hover:border-purple-400/40 hover:scale-[1.02]',
    textColor: 'text-white',
    subtextColor: 'text-purple-200',
    accent: 'from-pink-500 via-purple-500 to-indigo-500',
    border: 'border-purple-500/30',
    badgeBg: 'bg-pink-500/30 text-pink-200 border border-pink-400/40',
  },
  cyberpunk_neon: {
    bg: 'bg-black text-white',
    cardBg: 'bg-slate-900/90 border-cyan-500/40 shadow-lg shadow-cyan-950/50',
    cardHover: 'hover:border-cyan-400 hover:shadow-cyan-500/30 hover:scale-[1.02]',
    textColor: 'text-cyan-400',
    subtextColor: 'text-slate-300',
    accent: 'from-cyan-400 to-fuchsia-500',
    border: 'border-cyan-500/50',
    badgeBg: 'bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-500/50',
  },
  minimal_dark: {
    bg: 'bg-zinc-950 text-zinc-100',
    cardBg: 'bg-zinc-900 border-zinc-800',
    cardHover: 'hover:bg-zinc-850 hover:border-zinc-700 hover:scale-[1.02]',
    textColor: 'text-zinc-100',
    subtextColor: 'text-zinc-400',
    accent: 'from-zinc-100 to-zinc-400',
    border: 'border-zinc-800',
    badgeBg: 'bg-zinc-800 text-zinc-300 border border-zinc-700',
  },
};

export function BioLinksPage({ slug, orgId, previewConfig }: BioLinksPageProps) {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<any>(null);
  const [bioConfig, setBioConfig] = useState<any>(previewConfig || null);
  const [cursos, setCursos] = useState<any[]>([]);
  const [trilhas, setTrilhas] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (previewConfig) {
      setBioConfig(previewConfig);
    }

    const loadBioData = async () => {
      try {
        let targetSlug = slug;
        let targetOrgId = orgId;

        // If no slug or orgId, check subdomain and URL path
        if (!targetSlug && !targetOrgId) {
          const hostname = window.location.hostname;
          const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
          const isMainDomain =
            hostname === 'segundagavetaacademy.com.br' ||
            hostname === 'www.segundagavetaacademy.com.br' ||
            hostname === 'segundagaveta.com.br' ||
            hostname === 'www.segundagaveta.com.br' ||
            hostname.endsWith('.vercel.app');

          if (!isLocalhost && !isMainDomain) {
            const parts = hostname.split('.');
            if (parts.length > 2) {
              targetSlug = parts[0];
            }
          }

          if (!targetSlug) {
            const path = window.location.pathname;
            const match = path.match(/^\/(?:l|bio)\/([a-zA-Z0-9-]+)/);
            if (match && match[1]) {
              targetSlug = match[1];
            }
          }
        }

        let fetchedOrg = null;
        if (targetOrgId) {
          const { data: orgData } = await supabase
            .from('organizacoes')
            .select('*')
            .eq('id', targetOrgId)
            .maybeSingle();
          fetchedOrg = orgData;
        } else if (targetSlug) {
          const { data: orgData } = await supabase
            .from('organizacoes')
            .select('*')
            .eq('slug', targetSlug)
            .maybeSingle();
          fetchedOrg = orgData;
        }

        if (fetchedOrg) {
          setOrg(fetchedOrg);
          if (!previewConfig) {
            const cfg = fetchedOrg.config_json?.bio_links_config || {};
            setBioConfig(cfg);
          }

          const currentCfg = previewConfig || fetchedOrg.config_json?.bio_links_config || {};

          // Fetch published courses
          if (currentCfg.exibir_cursos !== false) {
            try {
              const { data: coursesData, error: cErr } = await supabase
                .from('cursos')
                .select('*')
                .eq('organizacao_id', fetchedOrg.id);

              if (cErr) console.warn('[BioLinks] Cursos fetch error:', cErr);

              if (coursesData && coursesData.length > 0) {
                const activeCourses = coursesData.filter((c: any) =>
                  !c.status || ['publicado', 'ativo'].includes(String(c.status).toLowerCase())
                );
                const finalCourses = activeCourses.length > 0 ? activeCourses : coursesData;
                setCursos(finalCourses.slice(0, 6));
              }
            } catch (err) {
              console.error('[BioLinks] Error fetching courses:', err);
            }
          }

          // Fetch published trilhas
          if (currentCfg.exibir_trilhas !== false) {
            try {
              const { data: trilhasData, error: tErr } = await supabase
                .from('trilhas')
                .select('*')
                .eq('organizacao_id', fetchedOrg.id);

              if (tErr) console.warn('[BioLinks] Trilhas fetch error:', tErr);

              if (trilhasData && trilhasData.length > 0) {
                setTrilhas(trilhasData.slice(0, 4));
              }
            } catch (err) {
              console.error('[BioLinks] Error fetching trilhas:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error loading Bio Links data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadBioData();
  }, [slug, orgId, previewConfig]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-400">Carregando links oficiais...</p>
      </div>
    );
  }

  const themeKey = bioConfig?.theme || 'glassmorphic_dark';
  const currentTheme = THEME_STYLES[themeKey] || THEME_STYLES.glassmorphic_dark;

  const title = bioConfig?.titulo || org?.nome || 'Links Oficiais';
  const subtitle = bioConfig?.subtitulo || 'Especialista Segunda Gaveta';
  const avatarUrl = bioConfig?.avatar_url || org?.logo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';
  const customLinks = bioConfig?.custom_links || [];
  const socialLinks = bioConfig?.social_links || {};

  const handleLinkClick = async (linkId: string, linkUrl: string, linkTitle: string) => {
    // 1. Pixel events
    if (typeof window !== 'undefined') {
      // Meta / Facebook Pixel
      if ((window as any).fbq) {
        (window as any).fbq('trackCustom', 'BioLinkClick', {
          link_id: linkId,
          link_url: linkUrl,
          link_title: linkTitle,
        });
      }
      // Google Analytics
      if ((window as any).gtag) {
        (window as any).gtag('event', 'click', {
          event_category: 'bio_link',
          event_label: linkTitle,
          value: linkUrl,
        });
      }
      // TikTok Pixel
      if ((window as any).ttq) {
        (window as any).ttq.track('ClickButton', {
          contents: [{ content_id: linkId, content_name: linkTitle }],
        });
      }
    }

    // 2. Track click on server & Supabase directly
    if (org?.id && !previewConfig) {
      const payload = {
        organizacao_id: org.id,
        link_id: linkId,
        link_url: linkUrl || '',
      };

      // A) Fetch with keepalive: true to prevent browser cancellation on page unload/navigation
      try {
        fetch('/api/bio-links/track-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      } catch (e) {}

      // B) Also insert directly into Supabase bio_link_clicks table
      try {
        supabase
          .from('bio_link_clicks')
          .insert({
            organizacao_id: org.id,
            link_id: linkId,
            link_url: linkUrl || '',
          })
          .then(() => {})
          .catch(() => {});
      } catch (e) {}
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title,
        text: subtitle,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`min-h-screen ${currentTheme.bg} flex flex-col items-center justify-between p-4 sm:p-6 transition-colors duration-300 relative overflow-x-hidden`}
      style={
        bioConfig?.background_image_url
          ? {
              backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.95)), url(${bioConfig.background_image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
            }
          : undefined
      }
    >
      {/* Background glow ambient lights */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/20 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md mx-auto space-y-6 z-10 pt-4 pb-12">
        {/* Top Header Controls */}
        <div className="flex justify-end">
          <button
            onClick={handleShare}
            className={`p-2.5 rounded-full ${currentTheme.cardBg} ${currentTheme.border} ${currentTheme.cardHover} transition-all shadow-sm`}
            title="Compartilhar"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Profile Card */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-xl">
              <img
                src={avatarUrl}
                alt={title}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div className="absolute bottom-1 right-1 p-1 bg-blue-600 text-white rounded-full border-2 border-slate-900 shadow-md" title="Especialista Verificado">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h1 className={`text-xl sm:text-2xl font-black ${currentTheme.textColor} tracking-tight`}>
                {title}
              </h1>
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            </div>
            {subtitle && (
              <p className={`text-sm ${currentTheme.subtextColor} font-medium mt-1 max-w-xs mx-auto leading-relaxed`}>
                {subtitle}
              </p>
            )}
          </div>

          {/* Social Icons Row */}
          {Object.keys(socialLinks).some((k) => socialLinks[k]) && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {socialLinks.whatsapp && (
                <a
                  href={`https://wa.me/${socialLinks.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleLinkClick('whatsapp', `https://wa.me/${socialLinks.whatsapp}`, 'WhatsApp')}
                  className={`p-2.5 rounded-full ${currentTheme.cardBg} ${currentTheme.cardHover} transition-all border border-emerald-500/40 text-emerald-400`}
                  title="WhatsApp"
                >
                  <MessageSquare className="w-4 h-4" />
                </a>
              )}
              {socialLinks.instagram && (
                <a
                  href={`https://instagram.com/${socialLinks.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleLinkClick('instagram', `https://instagram.com/${socialLinks.instagram}`, 'Instagram')}
                  className={`p-2.5 rounded-full ${currentTheme.cardBg} ${currentTheme.cardHover} transition-all border border-pink-500/40 text-pink-400`}
                  title="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {socialLinks.youtube && (
                <a
                  href={`https://youtube.com/${socialLinks.youtube}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleLinkClick('youtube', `https://youtube.com/${socialLinks.youtube}`, 'YouTube')}
                  className={`p-2.5 rounded-full ${currentTheme.cardBg} ${currentTheme.cardHover} transition-all border border-red-500/40 text-red-400`}
                  title="YouTube"
                >
                  <Youtube className="w-4 h-4" />
                </a>
              )}
              {socialLinks.tiktok && (
                <a
                  href={`https://tiktok.com/@${socialLinks.tiktok.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleLinkClick('tiktok', `https://tiktok.com/@${socialLinks.tiktok}`, 'TikTok')}
                  className={`p-2.5 rounded-full ${currentTheme.cardBg} ${currentTheme.cardHover} transition-all border border-cyan-500/40 text-cyan-400`}
                  title="TikTok"
                >
                  <Video className="w-4 h-4" />
                </a>
              )}
              {socialLinks.linkedin && (
                <a
                  href={`https://linkedin.com/in/${socialLinks.linkedin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleLinkClick('linkedin', `https://linkedin.com/in/${socialLinks.linkedin}`, 'LinkedIn')}
                  className={`p-2.5 rounded-full ${currentTheme.cardBg} ${currentTheme.cardHover} transition-all border border-blue-500/40 text-blue-400`}
                  title="LinkedIn"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
              )}
              {socialLinks.site && (
                <a
                  href={socialLinks.site.startsWith('http') ? socialLinks.site : `https://${socialLinks.site}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleLinkClick('site', socialLinks.site, 'Site Oficial')}
                  className={`p-2.5 rounded-full ${currentTheme.cardBg} ${currentTheme.cardHover} transition-all border border-purple-500/40 text-purple-400`}
                  title="Site Oficial"
                >
                  <Globe className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Custom Links List */}
        <div className="space-y-3 pt-2">
          {customLinks
            .filter((l: any) => l.ativo !== false)
            .map((link: any) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleLinkClick(link.id, link.url, link.titulo)}
                className={`relative group flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 ${
                  currentTheme.cardBg
                } ${currentTheme.cardHover} ${
                  link.destaque ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20 animate-pulse' : ''
                }`}
                style={link.cor_botao ? { borderColor: `${link.cor_botao}80` } : undefined}
              >
                {link.destaque && (
                  <span className={`absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${currentTheme.badgeBg}`}>
                    ★ Destaque
                  </span>
                )}

                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="p-2 rounded-xl bg-white/10 text-white shrink-0"
                    style={link.cor_botao ? { backgroundColor: link.cor_botao, color: '#fff' } : undefined}
                  >
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <span className={`font-bold text-sm sm:text-base ${currentTheme.textColor} truncate`}>
                    {link.titulo}
                  </span>
                </div>

                <ChevronRight className={`w-4 h-4 ${currentTheme.subtextColor} group-hover:translate-x-1 transition-transform shrink-0 ml-2`} />
              </a>
            ))}
        </div>

        {/* Cursos em Destaque */}
        {bioConfig?.exibir_cursos !== false && cursos.length > 0 && (
          <div className="space-y-3 pt-4">
            <div className="flex items-center gap-2 px-1">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <h2 className={`text-xs font-bold uppercase tracking-wider ${currentTheme.subtextColor}`}>
                Cursos & Treinamentos
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {cursos.map((c) => {
                const valorFmt = c.valor || c.preco
                  ? `R$ ${Number(c.valor || c.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : 'Gratuito';

                const courseUrl = `/public/curso/${c.slug || c.id}`;

                return (
                  <a
                    key={c.id}
                    href={courseUrl}
                    onClick={() => handleLinkClick(c.id, courseUrl, c.nome)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${currentTheme.cardBg} ${currentTheme.cardHover}`}
                  >
                    <img
                      src={c.capa_url || c.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=200&q=80'}
                      alt={c.nome}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-800"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold text-sm ${currentTheme.textColor} truncate`}>{c.nome}</h3>
                      <p className={`text-xs ${currentTheme.subtextColor} line-clamp-1 mt-0.5`}>
                        {c.descricao || 'Página oficial do curso'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs font-black text-emerald-400">{valorFmt}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-md font-semibold border border-indigo-500/30">
                          Matrículas Abertas
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${currentTheme.subtextColor} shrink-0`} />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Trilhas em Destaque */}
        {bioConfig?.exibir_trilhas !== false && trilhas.length > 0 && (
          <div className="space-y-3 pt-4">
            <div className="flex items-center gap-2 px-1">
              <Award className="w-4 h-4 text-purple-400" />
              <h2 className={`text-xs font-bold uppercase tracking-wider ${currentTheme.subtextColor}`}>
                Trilhas de Aprendizagem
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {trilhas.map((t) => (
                <a
                  key={t.id}
                  href={`/public/trilha/${t.slug || t.id}`}
                  onClick={() => handleLinkClick(t.id, `/public/trilha/${t.slug || t.id}`, t.nome)}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${currentTheme.cardBg} ${currentTheme.cardHover}`}
                >
                  <img
                    src={t.capa_url || t.thumbnail_url || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=200&q=80'}
                    alt={t.nome}
                    className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-800"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-sm ${currentTheme.textColor} truncate`}>{t.nome}</h3>
                    <p className={`text-xs ${currentTheme.subtextColor} line-clamp-1 mt-0.5`}>
                      {t.descricao || 'Formação completa'}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${currentTheme.subtextColor} shrink-0`} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <footer className="w-full text-center py-4 z-10">
        <a
          href="https://segundagavetaacademy.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${currentTheme.subtextColor} hover:opacity-100 opacity-70 transition-opacity`}
        >
          <span>Desenvolvido por</span>
          <span className="font-bold text-indigo-400">Segunda Gaveta Academy</span>
        </a>
      </footer>
    </div>
  );
}

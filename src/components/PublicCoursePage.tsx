import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Play, 
  CheckCircle, 
  ArrowRight, 
  Users, 
  Clock, 
  BookOpen,
  Award,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Loader2,
  Calendar,
  Gift,
  Star,
  Quote,
  X,
  Lock,
  Mail,
  User as UserIcon,
  CreditCard,
  LayoutDashboard,
  FileText,
  HelpCircle
} from 'lucide-react';
import ReactPlayer from 'react-player';
import { PaymentModal } from './PaymentModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';

interface PublicCoursePageProps {
  courseId: string;
  isTrilha?: boolean;
}

const FormattedTitle = ({ content, className, style }: { content?: string; className?: string; style?: React.CSSProperties }) => {
  if (!content) return null;
  const html = String(content)
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>');

  return (
    <span 
      className={className} 
      style={style} 
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
};

const TopCountdownBar = ({ lp }: { lp: any }) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!lp?.countdown_enabled || !lp?.countdown_end_date) {
      setTimeLeft(null);
      return;
    }
    
    const calculateTimeLeft = () => {
      const difference = +new Date(lp.countdown_end_date) - +new Date();
      if (difference <= 0) return null;
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const updated = calculateTimeLeft();
      setTimeLeft(updated);
      if (!updated) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [lp?.countdown_enabled, lp?.countdown_end_date]);

  if (!timeLeft) return null;

  const pad = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className="w-full bg-slate-950/95 py-[5px] px-4 shadow-md [transform:translateZ(0)]">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 sm:gap-6 text-white text-center">
        <span 
          className={`text-xs sm:text-sm font-semibold tracking-wide text-slate-200 ${lp?.countdown_text_style || ''}`}
          style={lp?.countdown_text_color ? { color: lp.countdown_text_color } : undefined}
        >
          {lp?.countdown_title || 'Oferta por tempo limitado'}
        </span>
        <div 
          className={`flex items-center gap-1.5 text-xs font-mono font-bold shrink-0 ${lp?.countdown_text_style || ''}`}
          style={lp?.countdown_text_color ? { color: lp.countdown_text_color } : undefined}
        >
          <Clock className="w-3.5 h-3.5 text-primary shrink-0" style={{ color: lp?.countdown_icon_color || lp?.countdown_text_color || undefined }} />
          <span className="tracking-wider">
            {timeLeft.days > 0 ? `${pad(timeLeft.days)}d ` : ''}{pad(timeLeft.hours)}h {pad(timeLeft.minutes)}m {pad(timeLeft.seconds)}s
          </span>
        </div>
      </div>
    </div>
  );
};

const Nav = ({ layout, item, lp, onEnrollClick, timeLeft }: NavProps) => {
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [orgSlug, setOrgSlug] = React.useState('');
  const [isScrolled, setIsScrolled] = React.useState(false);

  const pad = (num: number) => num.toString().padStart(2, '0');

  const orgRawPhone = item?.organizacoes?.config_json?.suporte_telefone || item?.organizacoes?.config_json?.suporte_whatsapp || '71999511275';
  const instructorRawPhone = lp?.instructor?.whatsapp_url || lp?.instructor_whatsapp_url || lp?.whatsapp_number || item?.whatsapp_suporte;
  const instructorPhoneClean = getCleanPhone(instructorRawPhone, orgRawPhone);

  const courseTitle = item?.nome || 'este curso';
  const whatsappUrl = instructorPhoneClean
    ? `https://wa.me/${instructorPhoneClean}?text=${encodeURIComponent(`Olá. Quero informações sobre o curso "${courseTitle}"`)}`
    : '#';

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setLoggedIn(true);
        setOrgSlug(item?.organizacoes?.slug || '');
      }
    });

    const handleScroll = () => {
      const scrolled = window.scrollY > 20;
      setIsScrolled(prev => (prev !== scrolled ? scrolled : prev));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [item]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Top Countdown Bar - Isolated Component */}
      <TopCountdownBar lp={lp} />

      <nav 
        className={`w-full transition-all duration-300 ${
          isScrolled 
            ? `backdrop-blur-md ${layout === 'escuro' ? 'bg-slate-950/90' : 'bg-white/90'}`
            : 'bg-transparent border-transparent'
        }`}
        style={{ backgroundColor: isScrolled && lp?.nav_bg_color ? lp.nav_bg_color : undefined }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 sm:h-[65px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink min-w-0">
            {(lp?.logo_url || item?.organizacoes?.logo_url) ? (
              <img 
                src={lp?.logo_url || item?.organizacoes?.logo_url} 
                alt="Logo" 
                className="object-contain shrink min-w-0 max-w-[280px] sm:max-w-[440px]" 
                style={{ 
                  height: lp?.nav_logo_height ? `${lp.nav_logo_height}px` : '44px',
                  maxHeight: '100%'
                }}
              />
            ) : (
              <div 
                className="shrink-0 bg-primary rounded-xl flex items-center justify-center text-white font-bold tracking-tighter uppercase"
                style={{ 
                  width: '40px',
                  height: '40px',
                  fontSize: '18px'
                }}
              >
                {item?.organizacoes?.nome?.[0] || 'S'}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            <div className="hidden lg:flex items-center gap-8">
              <a 
                href="#sobre" 
                className={`typo-link text-sm font-medium italic tracking-wide transition-colors ${lp?.nav_link_style || ''} ${layout === 'escuro' ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                style={lp?.nav_link_color ? { color: lp.nav_link_color } : undefined}
              >
                Sobre
              </a>
              <a 
                href="#instrutor" 
                className={`typo-link text-sm font-medium italic tracking-wide transition-colors ${lp?.nav_link_style || ''} ${layout === 'escuro' ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                style={lp?.nav_link_color ? { color: lp.nav_link_color } : undefined}
              >
                Expert
              </a>
              <a 
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`typo-link text-sm font-medium italic tracking-wide transition-colors ${lp?.nav_link_style || ''} ${layout === 'escuro' ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                style={lp?.nav_link_color ? { color: lp.nav_link_color } : undefined}
              >
                Fale Conosco
              </a>
              <a
                href={loggedIn && orgSlug ? `/projeto/${orgSlug}` : '/login'}
                className={`typo-link text-sm font-medium italic underline underline-offset-4 decoration-current transition-colors ${lp?.nav_link_style || ''} ${layout === 'escuro' ? 'text-slate-200 hover:text-white' : 'text-slate-800 hover:text-slate-950'}`}
                style={lp?.nav_link_color ? { color: lp.nav_link_color, textDecorationColor: lp.nav_link_color } : undefined}
              >
                Login
              </a>
            </div>
            
            <button
              onClick={onEnrollClick}
              className={`typo-btn px-5 sm:px-7 py-[5px] bg-primary text-white rounded-[10px] font-serif italic text-sm sm:text-base hover:opacity-95 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/25 whitespace-nowrap ${lp?.nav_cta_style || ''}`}
              style={lp?.nav_cta_color ? { color: lp.nav_cta_color } : undefined}
            >
              {Boolean(item?.em_breve || item?.configuracao_json?.em_breve || item?.status === 'em_breve' || lp?.cta_text?.toLowerCase().includes('breve') || lp?.cta_text?.toLowerCase().includes('cadastrar') || lp?.cta_text?.toLowerCase().includes('espera')) ? 'Em Breve' : (lp?.cta_text || 'Acesse agora')}
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
};

const ensureAbsoluteUrl = (url?: string) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#' || trimmed === 'http://#' || trimmed === 'https://#') return '';
  if (/^(f|ht)tps?:\/\//i.test(trimmed) || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const getCleanPhone = (phoneOrUrl?: string, fallbackOrgPhone?: string) => {
  if (phoneOrUrl && typeof phoneOrUrl === 'string') {
    const cleaned = phoneOrUrl.replace(/\D/g, '');
    if (cleaned.length >= 8) {
      if (cleaned.length === 10 || cleaned.length === 11) {
        return `55${cleaned}`;
      }
      return cleaned;
    }
  }
  if (fallbackOrgPhone && typeof fallbackOrgPhone === 'string') {
    const cleanedOrg = fallbackOrgPhone.replace(/\D/g, '');
    if (cleanedOrg.length >= 8) {
      if (cleanedOrg.length === 10 || cleanedOrg.length === 11) {
        return `55${cleanedOrg}`;
      }
      return cleanedOrg;
    }
  }
  return '';
};

interface FooterProps {
  layout: 'escuro' | 'claro';
  item: any;
  lp?: any;
  style?: React.CSSProperties;
}

const Footer = ({ layout, item, lp = {}, style }: FooterProps) => {
  const specialistName = item?.professor_nome || lp.instructor_name || lp.instructor?.name || 'Especialista';

  const websiteUrl = ensureAbsoluteUrl(lp.instructor?.website_url || lp.instructor_website_url);
  const instagramUrl = ensureAbsoluteUrl(lp.instructor?.instagram_url || lp.instructor_instagram_url);
  const youtubeUrl = ensureAbsoluteUrl(lp.instructor?.youtube_url || lp.instructor_youtube_url);
  const linkedinUrl = ensureAbsoluteUrl(lp.instructor?.linkedin_url || lp.instructor_linkedin_url);

  // WhatsApp Segunda Gaveta (Organização)
  const orgRawPhone = item?.organizacoes?.config_json?.suporte_telefone || item?.organizacoes?.config_json?.suporte_whatsapp || '71999511275';
  const orgPhoneClean = getCleanPhone(orgRawPhone, '71999511275');
  const segundaGavetaWaUrl = orgPhoneClean
    ? `https://wa.me/${orgPhoneClean}?text=${encodeURIComponent("Olá. Quero informações sobre os serviços da Segunda Gaveta")}`
    : '#';

  // WhatsApp do Especialista (Relacionado ao curso da página)
  const instructorRawPhone = lp.instructor?.whatsapp_url || lp.instructor_whatsapp_url;
  const instructorPhoneClean = getCleanPhone(instructorRawPhone, orgRawPhone);
  const courseTitle = item?.nome || 'este curso';
  const specialistWaUrl = instructorPhoneClean
    ? `https://wa.me/${instructorPhoneClean}?text=${encodeURIComponent(`Olá. Quero informações sobre o curso "${courseTitle}"`)}`
    : '#';

  return (
    <footer className="py-16 sm:py-24 bg-slate-950 text-slate-300 font-sans" style={style}>
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-stretch text-left">
          
          {/* Left Side: Brand Logo & Tagline */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-12 sm:space-y-16 lg:space-y-0 py-1">
            <div className="flex items-center gap-3">
              <img 
                src="https://static.wixstatic.com/media/0e8544_53ba61f9cc6b4143a45c75425fc76cf3~mv2.png" 
                alt="Segunda Gaveta Logo" 
                className="h-12 sm:h-14 w-auto max-w-[240px] object-contain" 
              />
            </div>

            <h3 className="text-3xl sm:text-4xl text-white font-serif font-normal leading-snug tracking-tight max-w-sm">
              Boas ideias no lugar <span className="italic font-serif">certo.</span>
            </h3>
          </div>

          {/* Right Side: 3 Columns of Links */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 text-left">
            
            {/* Coluna 1: Redes Sociais da Segunda Gaveta */}
            <div className="space-y-4">
              <h4 className="font-bold text-white text-sm sm:text-base tracking-wider">
                Segunda Gaveta
              </h4>
              <ul className="space-y-2.5 text-sm sm:text-base text-slate-400">
                <li>
                  <a href="https://segundagaveta.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Site
                  </a>
                </li>
                <li>
                  <a href="https://instagram.com/segundagaveta" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Instagram
                  </a>
                </li>
                <li>
                  <a href="https://youtube.com/@segundagaveta" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    YouTube
                  </a>
                </li>
                <li>
                  <a href="https://linkedin.com/company/segundagaveta" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    LinkedIn
                  </a>
                </li>
                <li>
                  {segundaGavetaWaUrl !== '#' ? (
                    <a href={segundaGavetaWaUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      WhatsApp
                    </a>
                  ) : (
                    <span className="text-slate-600 cursor-not-allowed">WhatsApp</span>
                  )}
                </li>
              </ul>
            </div>

            {/* Coluna 2: Redes Sociais do Especialista */}
            <div className="space-y-4">
              <h4 className="font-bold text-white text-sm sm:text-base tracking-wider">
                {specialistName}
              </h4>
              <ul className="space-y-2.5 text-sm sm:text-base text-slate-400">
                <li>
                  {websiteUrl ? (
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      Site
                    </a>
                  ) : (
                    <span className="text-slate-600 cursor-not-allowed">Site</span>
                  )}
                </li>
                <li>
                  {instagramUrl ? (
                    <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      Instagram
                    </a>
                  ) : (
                    <span className="text-slate-600 cursor-not-allowed">Instagram</span>
                  )}
                </li>
                <li>
                  {youtubeUrl ? (
                    <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      YouTube
                    </a>
                  ) : (
                    <span className="text-slate-600 cursor-not-allowed">YouTube</span>
                  )}
                </li>
                <li>
                  {linkedinUrl ? (
                    <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      LinkedIn
                    </a>
                  ) : (
                    <span className="text-slate-600 cursor-not-allowed">LinkedIn</span>
                  )}
                </li>
                <li>
                  {specialistWaUrl !== '#' ? (
                    <a href={specialistWaUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      WhatsApp
                    </a>
                  ) : (
                    <span className="text-slate-600 cursor-not-allowed">WhatsApp</span>
                  )}
                </li>
              </ul>
            </div>

            {/* Coluna 3: Navegação na Página */}
            <div className="space-y-4">
              <h4 className="font-bold text-white text-sm sm:text-base tracking-wider">
                Navegação
              </h4>
              <ul className="space-y-2.5 text-sm sm:text-base text-slate-400">
                <li>
                  <a href="#curriculo" className="hover:text-white transition-colors">
                    Guia
                  </a>
                </li>
                <li>
                  <a href="#instrutor" className="hover:text-white transition-colors">
                    Expert
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="#suporte" className="hover:text-white transition-colors">
                    Suporte
                  </a>
                </li>
              </ul>
            </div>

          </div>

        </div>

        {/* Bottom Horizontal Line & Copyright */}
        <div className="mt-16 pt-8 text-center">
          <p className="text-xs sm:text-sm text-slate-400 font-sans tracking-wide">
            2026 Segunda Gaveta Company | Todos os direitos reservados.
          </p>
        </div>

      </div>
    </footer>
  );
};

interface EnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  enrollStep: 'data' | 'payment' | 'success';
  isFree: boolean;
  enrollData: any;
  onEnrollDataChange: (data: any) => void;
  isProcessing: boolean;
  onRegister: () => void;
  isTrilha: boolean;
  itemName: string;
}

const EnrollmentModal = ({
  isOpen,
  onClose,
  enrollStep,
  isFree,
  enrollData,
  onEnrollDataChange,
  isProcessing,
  onRegister,
  isTrilha,
  itemName
}: EnrollmentModalProps) => {
  // #8 Email validation state
  const [emailError, setEmailError] = React.useState('');

  const validateEmail = (email: string) => {
    if (!email) return 'E-mail obrigatório';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido';
    return '';
  };

  const handleSubmit = () => {
    const err = validateEmail(enrollData.email);
    setEmailError(err);
    if (err) return;
    if (!enrollData.nome.trim()) return;
    onRegister();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[999999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-300">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="p-8 md:p-12">
          {enrollStep === 'data' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-slate-900 typo-title">
                  {isFree ? 'Inscrição Gratuita' : 'Área de Inscrição'}
                </h2>
                <p className="text-slate-700 typo-text">
                  {isFree ? 'Preencha seus dados para começar agora mesmo.' : 'Complete seus dados para prosseguir para o pagamento.'}
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input
                    type="text"
                    value={enrollData.nome}
                    onChange={e => onEnrollDataChange({...enrollData, nome: e.target.value})}
                    placeholder="Seu nome completo"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-primary focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input
                    type="email"
                    value={enrollData.email}
                    onChange={e => { onEnrollDataChange({...enrollData, email: e.target.value}); setEmailError(''); }}
                    onBlur={e => setEmailError(validateEmail(e.target.value))}
                    placeholder="Seu melhor e-mail"
                    className={`w-full pl-12 pr-4 py-4 bg-slate-50 border rounded-2xl outline-none focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 ${
                      emailError ? 'border-red-300 focus:border-red-400' : 'border-slate-100 focus:border-primary'
                    }`}
                  />
                  {emailError && <p className="text-red-500 text-xs mt-1 ml-2 font-medium">{emailError}</p>}
                </div>
                {!isFree && (
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input
                      type="text"
                      value={enrollData.cpf}
                      onChange={e => onEnrollDataChange({...enrollData, cpf: e.target.value})}
                      placeholder="Seu CPF (para emissão de nota)"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-primary focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                )}
                {isFree && (
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input
                      type="password"
                      value={enrollData.password}
                      onChange={e => onEnrollDataChange({...enrollData, password: e.target.value})}
                      placeholder="Crie uma senha de acesso"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-primary focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                )}
              </div>

              <button
                disabled={isProcessing || !enrollData.nome.trim() || !enrollData.email || !!emailError}
                onClick={handleSubmit}
                className="typo-btn w-full py-5 bg-primary text-white rounded-2xl font-bold text-lg hover:opacity-90 shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {isFree ? 'Confirmar Inscrição' : 'Ir para o Pagamento'} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {enrollStep === 'success' && (
            <div className="text-center space-y-8 py-4">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-slate-900 typo-title">Inscrição Confirmada!</h2>
                <p className="text-slate-700 leading-relaxed typo-text">
                  Parabéns! Você já pode acessar todo o conteúdo do {isTrilha ? 'curso' : 'programa'} <strong>{itemName}</strong> agora mesmo.
                </p>
              </div>
              <a 
                href="/"
                className="block w-full py-5 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 shadow-xl shadow-emerald-200 active:scale-95 transition-all text-center"
              >
                Começar a Estudar Agora
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TestimonialsCarousel = ({ testimonials, layout, primaryColor, lp }: { testimonials: any[], layout: string, primaryColor: string, lp?: any }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!testimonials || testimonials.length === 0) return null;

  const current = testimonials[currentIndex] || testimonials[0];
  const quoteColor = lp?.section_about_bg_color || '#0f172a';

  const handlePrev = () => {
    setCurrentIndex(prev => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto px-4 py-8 sm:py-12 flex flex-col items-center justify-center text-center [transform:translateZ(0)] [backface-visibility:hidden] antialiased">

      {/* Testimonial Active Card */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-8 sm:px-14 py-6 flex flex-col justify-center items-center">
        {/* Top-Left Double Quote */}
        <span 
          className="absolute -top-10 -left-6 sm:-top-16 sm:-left-10 text-7xl sm:text-9xl font-serif select-none pointer-events-none leading-none z-0 opacity-20"
          style={{ color: quoteColor }}
        >
          “
        </span>

        {/* Stacked Grid Container so section height is fixed to largest testimonial */}
        <div className="w-full grid grid-cols-1 grid-rows-1 items-center justify-items-center">
          {testimonials.map((t: any, idx: number) => {
            const isActive = idx === currentIndex;
            return (
              <div 
                key={idx}
                className={`col-start-1 row-start-1 w-full flex flex-col items-center justify-center transition-opacity duration-300 ease-in-out ${
                  isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none invisible'
                }`}
              >
                {/* Student Name */}
                <h3 
                  className={`relative z-10 text-3xl sm:text-4xl lg:text-5xl font-serif font-normal text-white tracking-tight text-center ${lp?.testimonial_name_style || 'typo-title-2'}`}
                  style={lp?.testimonial_name_color ? { color: lp.testimonial_name_color } : undefined}
                >
                  <FormattedTitle content={t.name} />
                </h3>

                {/* Testimonial Text */}
                <p 
                  className={`relative z-10 text-base sm:text-lg lg:text-xl text-slate-300/90 leading-relaxed font-sans max-w-2xl text-center mt-4 ${lp?.testimonial_text_style || 'typo-body-1'}`}
                  style={lp?.testimonial_text_color ? { color: lp.testimonial_text_color } : undefined}
                >
                  {t.text}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom-Right Double Quote */}
        <span 
          className="absolute -bottom-10 -right-6 sm:-bottom-16 sm:-right-10 text-7xl sm:text-9xl font-serif select-none pointer-events-none leading-none z-0 opacity-20"
          style={{ color: quoteColor }}
        >
          ”
        </span>
      </div>

      {/* Navigation Arrows (Left & Right) */}
      {testimonials.length > 1 && (
        <>
          <button 
            onClick={handlePrev}
            aria-label="Anterior"
            className="absolute left-0 sm:left-2 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white hover:scale-125 active:scale-95 transition-all z-20 cursor-pointer"
          >
            <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10" />
          </button>
          <button 
            onClick={handleNext}
            aria-label="Próximo"
            className="absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white hover:scale-125 active:scale-95 transition-all z-20 cursor-pointer"
          >
            <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" />
          </button>
        </>
      )}

      {/* Student Photos / Avatars Navigation Bar */}
      <div className="relative z-10 flex items-center justify-center gap-4 mt-10">
        {testimonials.map((t: any, idx: number) => {
          const isActive = idx === currentIndex;
          return (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`relative rounded-full transition-all duration-300 cursor-pointer flex items-center justify-center ${
                isActive 
                  ? 'w-14 h-14 sm:w-16 sm:h-16 border-2 border-white scale-110 shadow-xl opacity-100 z-10' 
                  : 'w-9 h-9 sm:w-10 sm:h-10 opacity-40 hover:opacity-80 scale-90'
              }`}
            >
              {t.photo_url ? (
                <img 
                  src={t.photo_url} 
                  alt={t.name} 
                  className="w-full h-full rounded-full object-cover" 
                />
              ) : (
                <div className={`w-full h-full rounded-full flex items-center justify-center text-white font-bold ${isActive ? 'bg-primary text-sm' : 'bg-white/30 text-xs'}`}>
                  {t.name?.[0]}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const TrustAndGuarantee = ({ layout, guaranteeDays, style }: { layout: string, guaranteeDays: number, style?: React.CSSProperties }) => {
  return (
    <section className={`py-20 ${
      layout === 'escuro' 
        ? 'bg-slate-950/60 text-slate-300' 
        : 'bg-slate-50 text-slate-600'
    }`} style={style}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* Guarantee Card */}
          <div className={`p-8 md:p-10 rounded-[32px] border flex flex-col sm:flex-row items-center sm:items-start gap-6 transition-all duration-300 hover:scale-[1.02] ${
            layout === 'escuro' 
              ? 'bg-slate-900/40 border-slate-800 hover:border-amber-500/30' 
              : 'bg-white border-slate-200/60 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:border-amber-500/20'
          }`}>
            <div className="w-16 h-16 shrink-0 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center">
              <Award className="w-9 h-9" />
            </div>
            <div className="space-y-3 text-center sm:text-left">
              <h3 className={`text-xl font-bold ${layout === 'escuro' ? 'text-white' : 'text-slate-900'}`}>
                Garantia Incondicional de {guaranteeDays} Dias
              </h3>
              <p className="text-sm leading-relaxed opacity-85">
                Sem riscos! Se por qualquer motivo você não gostar ou achar que o curso não é para você, basta nos enviar um e-mail em até {guaranteeDays} dias que devolveremos 100% do seu dinheiro, sem burocracia.
              </p>
            </div>
          </div>

          {/* Secure Payment Card */}
          <div className={`p-8 md:p-10 rounded-[32px] border flex flex-col sm:flex-row items-center sm:items-start gap-6 transition-all duration-300 hover:scale-[1.02] ${
            layout === 'escuro' 
              ? 'bg-slate-900/40 border-slate-800 hover:border-primary/30' 
              : 'bg-white border-slate-200/60 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:border-primary/20'
          }`}>
            <div className="w-16 h-16 shrink-0 bg-primary/10 text-primary rounded-3xl flex items-center justify-center">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-3 text-center sm:text-left">
              <h3 className={`text-xl font-bold ${layout === 'escuro' ? 'text-white' : 'text-slate-900'}`}>
                Ambiente de Pagamento 100% Seguro
              </h3>
              <p className="text-sm leading-relaxed opacity-85">
                Seu pagamento é processado pela Pagar.me (Stone Co.), uma das maiores e mais seguras adquirentes do país. Seus dados estão completamente protegidos sob criptografia SSL de nível bancário.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const CountdownTimer = ({ timeLeft, title, layout }: { timeLeft: { days: number, hours: number, minutes: number, seconds: number } | null, title?: string, layout: string }) => {
  if (!timeLeft) return null;

  const pad = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className={`p-6 rounded-3xl border text-left mt-6 animate-pulse max-w-md ${
      layout === 'escuro' 
        ? 'bg-slate-800/30 border-slate-700/60 shadow-[0_0_20px_rgba(var(--primary-rgb,37,99,235),0.1)]' 
        : 'bg-white border-slate-200/60 shadow-sm'
    }`}>
      <span className={`text-[10px] font-bold tracking-widest uppercase block mb-3 text-primary`}>
        {title || 'Lote promocional termina em:'}
      </span>
      <div className="flex gap-2.5 text-center">
        {/* Days */}
        <div className="flex flex-col">
          <div className={`w-12 sm:w-14 py-3 rounded-2xl text-xl sm:text-2xl font-black ${
            layout === 'escuro' ? 'bg-slate-900 text-white border border-slate-800' : 'bg-slate-50 text-slate-900 border border-slate-100'
          }`}>
            {pad(timeLeft.days)}
          </div>
          <span className="text-[9px] font-black text-slate-500 mt-1 uppercase tracking-wider">Dias</span>
        </div>

        <span className={`text-xl sm:text-2xl font-black mt-2 ${layout === 'escuro' ? 'text-slate-700' : 'text-slate-300'}`}>:</span>

        {/* Hours */}
        <div className="flex flex-col">
          <div className={`w-12 sm:w-14 py-3 rounded-2xl text-xl sm:text-2xl font-black ${
            layout === 'escuro' ? 'bg-slate-900 text-white border border-slate-800' : 'bg-slate-50 text-slate-900 border border-slate-100'
          }`}>
            {pad(timeLeft.hours)}
          </div>
          <span className="text-[9px] font-black text-slate-500 mt-1 uppercase tracking-wider">Horas</span>
        </div>
        
        <span className={`text-xl sm:text-2xl font-black mt-2 ${layout === 'escuro' ? 'text-slate-700' : 'text-slate-300'}`}>:</span>

        {/* Minutes */}
        <div className="flex flex-col">
          <div className={`w-12 sm:w-14 py-3 rounded-2xl text-xl sm:text-2xl font-black ${
            layout === 'escuro' ? 'bg-slate-900 text-white border border-slate-800' : 'bg-slate-50 text-slate-900 border border-slate-100'
          }`}>
            {pad(timeLeft.minutes)}
          </div>
          <span className="text-[9px] font-black text-slate-500 mt-1 uppercase tracking-wider">Minutos</span>
        </div>

        <span className={`text-xl sm:text-2xl font-black mt-2 ${layout === 'escuro' ? 'text-slate-700' : 'text-slate-300'}`}>:</span>

        {/* Seconds */}
        <div className="flex flex-col">
          <div className={`w-12 sm:w-14 py-3 rounded-2xl text-xl sm:text-2xl font-black ${
            layout === 'escuro' ? 'bg-slate-900 text-white border border-slate-800' : 'bg-slate-50 text-slate-900 border border-slate-100'
          }`}>
            {pad(timeLeft.seconds)}
          </div>
          <span className="text-[9px] font-black text-slate-500 mt-1 uppercase tracking-wider">Segundos</span>
        </div>
      </div>
    </div>
  );
};

const TargetAudienceSection = ({ targetAudience, layout, style }: { targetAudience: string, layout: string, style?: React.CSSProperties }) => {
  if (!targetAudience?.trim()) return null;

  return (
    <section className={`py-24 ${
      layout === 'escuro' ? 'bg-slate-950/60' : 'bg-slate-50'
    }`} style={style}>
      <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
        <h2 className={`text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight typo-title ${
          layout === 'escuro' ? 'text-white' : 'text-slate-900'
        }`}>
          Para quem é este programa?
        </h2>
        
        <div className={`p-8 md:p-12 rounded-[35px] border ${
          layout === 'escuro' 
            ? 'bg-transparent border-white/20 text-slate-300/90' 
            : 'bg-transparent border-slate-200 text-slate-700'
        } backdrop-blur-sm text-center text-base sm:text-lg lg:text-xl leading-relaxed font-sans typo-body-1 space-y-4`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {targetAudience}
          </ReactMarkdown>
        </div>
      </div>
    </section>
  );
};

const WhatsAppFloatingButton = ({ item, lp }: { item: any, lp?: any }) => {
  const orgRawPhone = item?.organizacoes?.config_json?.suporte_telefone || item?.organizacoes?.config_json?.suporte_whatsapp || '71999511275';
  const instructorRawPhone = lp?.instructor?.whatsapp_url || lp?.instructor_whatsapp_url || lp?.whatsapp_number || item?.whatsapp_suporte;
  const cleanPhone = getCleanPhone(instructorRawPhone, orgRawPhone);
  
  if (!cleanPhone) return null;

  const courseTitle = item?.nome || 'este curso';
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Olá. Quero informações sobre o curso "${courseTitle}"`)}`;

  return (
    <a 
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-8 left-8 z-[90] flex items-center gap-3 bg-emerald-500 text-white px-5 py-3.5 rounded-full shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all duration-300 group font-bold text-sm tracking-wide border border-emerald-400/20 cursor-pointer"
    >
      <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-20 animate-ping pointer-events-none group-hover:hidden"></span>
      <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.402.002 9.761-4.324 9.764-9.63.001-2.57-1.002-4.985-2.826-6.81C16.388 2.336 13.984 1.33 11.41 1.33c-5.405 0-9.766 4.326-9.769 9.632-.001 1.884.5 3.717 1.449 5.309L2.085 22.3l6.236-1.635c.162.088.324.17.48.25-.16.036-.312.062-.48.062zM17.487 14.4c-.27-.13-.1.6-1.59-.8-.285-.143-.49-.215-.7-.52-.21-.3-.7-.6-.82-.72-.12-.12-.22-.16-.3-.3-.08-.13 0-.74-.15-.92-.15-.17-.38-.6-.62-.87-.24-.26-.45-.48-.7-.48-.25 0-.48.12-.66.3-.18.17-.7.68-.7 1.66s.72 1.93.82 2.06c.1.13 1.42 2.16 3.44 3.03 2.02.87 2.02.58 2.38.54.36-.04 1.15-.47 1.31-.92.16-.45.16-.83.11-.92-.05-.08-.22-.13-.49-.26z"/>
      </svg>
      <span>Dúvidas? Fale Conosco</span>
    </a>
  );
};

class ModalErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() { 
    if (this.state.hasError) return <div className="fixed inset-0 z-[200] bg-white p-10 overflow-auto"><h1 className="text-red-500 font-bold text-2xl typo-title">Erro de Renderização no Modal</h1><pre className="text-sm bg-slate-100 p-4 mt-4">{String(this.state.error?.stack || this.state.error)}</pre></div>; 
    return this.props.children; 
  }
}

// LeadModal rendered as a portal directly into document.body
// to guarantee it's always on top of everything
interface LeadModalPortalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  leadData: { nome: string; email: string; telefone: string };
  setLeadData: (d: any) => void;
  isSubmitting: boolean;
  leadSuccess: boolean;
  itemNome?: string;
}
const LeadModalPortal: React.FC<LeadModalPortalProps> = ({ show, onClose, onSubmit, leadData, setLeadData, isSubmitting, leadSuccess, itemNome }) => {
  if (!show) return null;
  const modal = (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: 'relative', width: '100%', maxWidth: '28rem', background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', color: '#0f172a' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', padding: '0.5rem', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
        >
          <X className="w-5 h-5" />
        </button>
        {leadSuccess ? (
          <div style={{ textAlign: 'center', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '4rem', height: '4rem', background: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <CheckCircle className="w-9 h-9" />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Interesse Registrado!</h3>
            <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: '1.6', margin: 0 }}>
              Obrigado! Entraremos em contato via <strong>WhatsApp e E-mail</strong> assim que as matrículas para <strong>{itemNome}</strong> forem liberadas.
            </p>
            <button
              onClick={onClose}
              style={{ width: '100%', padding: '0.75rem', background: '#059669', color: 'white', fontWeight: 700, borderRadius: '1rem', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
            >
              Concluído
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', background: '#fef3c7', color: '#92400e', fontSize: '0.7rem', fontWeight: 900, borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✨ Curso Em Breve</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Lista de Espera VIP</h3>
              <p style={{ color: '#475569', fontSize: '0.875rem', margin: 0 }}>Cadastre seus dados para receber o aviso em primeira mão e condições exclusivas de lançamento!</p>
            </div>
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.375rem' }}>Nome Completo</label>
                <div style={{ position: 'relative' }}>
                  <UserIcon style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1.25rem', height: '1.25rem', color: '#94a3b8' }} />
                  <input
                    type="text"
                    required
                    placeholder="Seu nome completo"
                    value={leadData.nome}
                    onChange={e => setLeadData({ ...leadData, nome: e.target.value })}
                    style={{ width: '100%', paddingLeft: '2.75rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '0.875rem', color: '#1e293b', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.375rem' }}>E-mail</label>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1.25rem', height: '1.25rem', color: '#94a3b8' }} />
                  <input
                    type="email"
                    required
                    placeholder="seuemail@exemplo.com"
                    value={leadData.email}
                    onChange={e => setLeadData({ ...leadData, email: e.target.value })}
                    style={{ width: '100%', paddingLeft: '2.75rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '0.875rem', color: '#1e293b', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.375rem' }}>WhatsApp / Celular</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.875rem' }}>📱</span>
                  <input
                    type="tel"
                    required
                    placeholder="(00) 90000-0000"
                    value={leadData.telefone}
                    onChange={e => setLeadData({ ...leadData, telefone: e.target.value })}
                    style={{ width: '100%', paddingLeft: '2.75rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '0.875rem', color: '#1e293b', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ width: '100%', padding: '0.875rem', background: '#2563eb', color: 'white', fontWeight: 700, fontSize: '1rem', borderRadius: '1rem', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {isSubmitting ? <Loader2 style={{ width: '1.25rem', height: '1.25rem', animation: 'spin 1s linear infinite' }} /> : <><span>Quero ser Notificado(a)</span><ArrowRight style={{ width: '1.25rem', height: '1.25rem' }} /></>}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
  return createPortal(modal, document.body);
};

export const PublicCoursePage: React.FC<PublicCoursePageProps> = ({ courseId, isTrilha }) => {
  const [item, setItem] = useState<any>(null);
  const [cursosTrilha, setCursosTrilha] = useState<any[]>([]);
  const [planosAssinatura, setPlanosAssinatura] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // #4 Real participant count
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  // #2 Sticky CTA
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  const heroRef = React.useRef<HTMLElement>(null);

  const [isHeroPlaying, setIsHeroPlaying] = useState(false);
  const [isPlayingAboutVideo, setIsPlayingAboutVideo] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadData, setLeadData] = useState({ nome: '', email: '', telefone: '' });
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [enrollMode, setEnrollMode] = useState<'free' | 'paid' | null>(null);
  const [enrollStep, setEnrollStep] = useState<'data' | 'payment' | 'success'>('data');
  const [enrollData, setEnrollData] = useState({ nome: '', email: '', cpf: '', password: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [openModules, setOpenModules] = useState<Record<number, boolean>>({});
  const [openFaqs, setOpenFaqs] = useState<Record<number, boolean>>({}); 

  const toggleModule = (idx: number) => {
    setOpenModules(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleFaq = (idx: number) => {
    setOpenFaqs(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);
  
  // Resolução dinâmica da versão da página de vendas (URL param ?v= ou ?version=)
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const versionParam = searchParams.get('v') || searchParams.get('version');
  
  const configJson = item?.configuracao_json;
  const lpVersions = configJson?.lp_versions || {};
  const activeVerId = configJson?.active_version_id || 'v1';

  let lpRaw = null;
  if (versionParam && lpVersions[versionParam]) {
    lpRaw = lpVersions[versionParam];
  } else if (Object.keys(lpVersions).length > 0) {
    lpRaw = lpVersions[activeVerId] || Object.values(lpVersions).find((v: any) => v.is_default) || Object.values(lpVersions)[0];
  } else {
    lpRaw = configJson?.lp;
  }

  const lp = {
    enabled: true,
    hero_title: item?.nome || '',
    hero_subtitle: item?.descricao || '',
    cta_text: 'Matricule-se Agora',
    primary_color: '#2563eb',
    layout_tipo: 'escuro' as const,
    benefits: [],
    testimonials: [],
    bonuses: [],
    faq: [],
    guarantee_days: 7,
    ...(lpRaw || {}),
    instructor: { 
      ...(lpRaw?.instructor || {}),
      name: lpRaw?.instructor?.name || item?.professor_nome || item?.instrutores?.[0]?.nome || item?.instrutores?.[0]?.usuarios?.nome || '', 
      bio: lpRaw?.instructor?.bio || item?.professor_bio || item?.instrutores?.[0]?.mini_bio || '', 
      avatar_url: lpRaw?.instructor?.avatar_url || item?.professor_foto_url || item?.instrutores?.[0]?.foto_url || item?.instrutores?.[0]?.usuarios?.avatar_url || '', 
      role: lpRaw?.instructor?.role || '',
      website_url: lpRaw?.instructor?.website_url || lpRaw?.instructor_website_url || '',
      instagram_url: lpRaw?.instructor?.instagram_url || lpRaw?.instructor_instagram_url || '',
      youtube_url: lpRaw?.instructor?.youtube_url || lpRaw?.instructor_youtube_url || '',
      linkedin_url: lpRaw?.instructor?.linkedin_url || lpRaw?.instructor_linkedin_url || '',
      whatsapp_url: lpRaw?.instructor?.whatsapp_url || lpRaw?.instructor_whatsapp_url || '',
    }
  };

  const getSectionStyle = (sectionKey: string, defaultStyle: React.CSSProperties = {}) => {
    const bgColor = lp[`section_${sectionKey}_bg_color`];
    const bgImage = lp[`section_${sectionKey}_bg_image`];
    
    let style: React.CSSProperties = { ...defaultStyle };
    if (bgColor) style.backgroundColor = bgColor;
    if (bgImage) {
      style.backgroundImage = `url(${bgImage})`;
      style.backgroundSize = 'cover';
      style.backgroundPosition = 'center';
      style.backgroundBlendMode = bgColor ? 'overlay' : 'normal';
    }
    return style;
  };

  const [isMobileScreen, setIsMobileScreen] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobileScreen(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (item?.nome) {
      document.title = item.nome;
    }
  }, [item?.nome]);

  useEffect(() => {
    if (!lp.countdown_enabled || !lp.countdown_end_date) {
      setTimeLeft(null);
      return;
    }
    
    const calculateTimeLeft = () => {
      const difference = +new Date(lp.countdown_end_date) - +new Date();
      if (difference <= 0) {
        return null;
      }
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const updated = calculateTimeLeft();
      setTimeLeft(updated);
      if (!updated) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lp.countdown_enabled, lp.countdown_end_date]);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  // #1 Open Graph meta tags
  useEffect(() => {
    if (!item) return;
    const title = item.nome || lp.hero_title || 'Curso Online';
    const description = lp.hero_subtitle || item.descricao || '';
    const image = item.capa_url || item.thumbnail_url || lp.instructor?.avatar_url || item.professor_foto_url || item.organizacoes?.logo_url || '';
    document.title = item.nome || 'Curso Online';
    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property='${property}']`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    const setMetaName = (name: string, content: string) => {
      let el = document.querySelector(`meta[name='${name}']`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('og:title', title);
    setMeta('og:description', description);
    setMeta('og:image', image);
    setMeta('og:type', 'website');
    setMeta('og:url', window.location.href);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', image);
    setMetaName('description', description);
  }, [item, lp]);

  // #2 Sticky CTA — IntersectionObserver on hero section
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyCTA(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    if (heroRef.current) observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, [item]);

  const isFree = isTrilha ? (item?.preco === 0) : (item?.preco === 'gratuito');
  const selectedPlan = planosAssinatura?.find(p => p.pagarme_plan_id === selectedPlanId);
  const config = item?.configuracao_json || {};
  const isEmBreve = Boolean(
    item?.em_breve === true ||
    item?.em_breve === 'true' ||
    item?.em_breve === 1 ||
    item?.status === 'em_breve' ||
    config?.em_breve === true ||
    config?.em_breve === 'true' ||
    config?.status === 'em_breve' ||
    lp?.cta_text?.toLowerCase().includes('breve') ||
    lp?.cta_text?.toLowerCase().includes('cadastrar') ||
    lp?.cta_text?.toLowerCase().includes('espera')
  );
  const discountedPrice = !selectedPlan && !isTrilha && config.valor_com_desconto ? parseFloat(config.valor_com_desconto) : null;
  const itemPrice = selectedPlan ? (selectedPlan.valor_cents / 100) : (isTrilha ? (item?.preco || 0) : (parseFloat(item?.valor) || 0));
  const finalPrice = discountedPrice !== null ? discountedPrice : itemPrice;

  const paymentModel = config.pagamento_modelo || 'fixo';
  const paymentCycle = config.pagamento_ciclo || '30';
  const paymentInstallmentsLimit = config.pagamento_parcelas_limite || '12';

  const renderPriceBlock = (isDarkLayout: boolean) => {
    if (isEmBreve) {
      return (
        <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span className={`text-sm sm:text-base font-black ${isDarkLayout ? 'text-amber-400' : 'text-amber-700'} uppercase tracking-wider`}>
            Em Breve — Cadastre-se na Lista de Espera
          </span>
        </div>
      );
    }

    if (isFree) {
      return (
        <div className="flex items-center gap-2">
          <span className={`text-3xl font-black ${isDarkLayout ? 'text-emerald-400' : 'text-emerald-600'} uppercase`}>Grátis</span>
          <span className="text-slate-400 line-through text-sm">R$ {isTrilha ? '497,00' : '197,00'}</span>
        </div>
      );
    }

    if (planosAssinatura && planosAssinatura.length > 0) {
      return (
        <div className="space-y-2">
          <span className={`text-xs font-bold ${isDarkLayout ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest`}>Escolha seu Plano</span>
          <div className="flex flex-col gap-2">
            {planosAssinatura.map(plano => (
              <button
                key={plano.id}
                onClick={() => setSelectedPlanId(plano.pagarme_plan_id)}
                className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all w-full sm:w-64 ${
                  selectedPlanId === plano.pagarme_plan_id 
                    ? (isDarkLayout ? 'border-primary bg-primary/10' : 'border-primary bg-primary/5') 
                    : (isDarkLayout ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                }`}
              >
                <div className="text-left">
                  <div className={`font-bold ${selectedPlanId === plano.pagarme_plan_id ? 'text-primary' : (isDarkLayout ? 'text-slate-300' : 'text-slate-700')}`}>{plano.nome}</div>
                  <div className="text-xs text-slate-500">{plano.intervalo === 'month' ? 'Mensal' : 'Anual'}</div>
                </div>
                <div className={`font-black ${selectedPlanId === plano.pagarme_plan_id ? (isDarkLayout ? 'text-white' : 'text-slate-900') : (isDarkLayout ? 'text-slate-400' : 'text-slate-600')}`}>
                  R$ {(plano.valor_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (paymentModel === 'recorrente') {
      return (
        <div>
          <span className={`text-[10px] font-black ${isDarkLayout ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest mb-1 block`}>Assinatura</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold ${isDarkLayout ? 'text-white' : 'text-slate-900'}`}>R$</span>
            <span className={`text-5xl font-black ${isDarkLayout ? 'text-white' : 'text-slate-900'}`}>{finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span className={`text-lg font-medium ${isDarkLayout ? 'text-slate-300' : 'text-slate-500'}`}>/ {paymentCycle === '30' ? 'mês' : paymentCycle === '365' ? 'ano' : paymentCycle + ' dias'}</span>
          </div>
        </div>
      );
    }

    if (paymentModel === 'parcelado') {
      return (
        <div>
          <span className={`text-[10px] font-black ${isDarkLayout ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest mb-1 block`}>Investimento</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold ${isDarkLayout ? 'text-white' : 'text-slate-900'}`}>R$</span>
            <span className={`text-5xl font-black ${isDarkLayout ? 'text-white' : 'text-slate-900'}`}>{finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span className={`text-lg font-medium ${isDarkLayout ? 'text-slate-300' : 'text-slate-500'}`}>/ mês (x{paymentInstallmentsLimit})</span>
          </div>
        </div>
      );
    }

    // Fixo com Destaque para Parcelas
    const installmentValue = finalPrice / 10;
    return (
      <div className="flex flex-col text-left">
        <span className={`text-[10px] font-black ${isDarkLayout ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest mb-1 block`}>Valor do Investimento</span>
        
        {discountedPrice !== null && (
          <div className={`text-sm ${isDarkLayout ? 'text-slate-400' : 'text-slate-500'} mb-1 font-medium`}>
            De <span className="line-through">R$ {itemPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> por apenas:
          </div>
        )}

        <div className="flex flex-wrap items-baseline gap-1 md:gap-2">
          <span className={`text-2xl md:text-3xl font-black ${isDarkLayout ? 'text-white' : 'text-slate-900'}`}>10x</span>
          <span className={`text-lg md:text-xl font-bold ${isDarkLayout ? 'text-white' : 'text-slate-900'}`}>R$</span>
          <span className={`text-5xl md:text-6xl font-black tracking-tight ${isDarkLayout ? 'text-white' : 'text-slate-900'}`}>{installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className={`text-[10px] md:text-xs font-bold ${isDarkLayout ? 'text-emerald-400' : 'text-emerald-600'} uppercase tracking-wider ml-1 self-center md:self-baseline`}>
            sem <br className="hidden sm:block md:hidden" /> juros
          </span>
        </div>
        <div className={`text-sm ${isDarkLayout ? 'text-slate-400' : 'text-slate-500'} mt-1 font-semibold`}>
          ou R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} à vista
        </div>
      </div>
    );
  };

  const handleEnrollClick = () => {
    const isEmBreveCheck = Boolean(
      isEmBreve ||
      item?.em_breve === true ||
      item?.em_breve === 'true' ||
      item?.em_breve === 1 ||
      item?.status === 'em_breve' ||
      config?.em_breve === true ||
      config?.em_breve === 'true' ||
      config?.status === 'em_breve' ||
      lp?.cta_text?.toLowerCase().includes('breve') ||
      lp?.cta_text?.toLowerCase().includes('cadastrar') ||
      lp?.cta_text?.toLowerCase().includes('espera')
    );

    if (isEmBreveCheck) {
      setLeadData({ nome: '', email: '', telefone: '' });
      setLeadSuccess(false);
      setShowLeadModal(true);
      setShowEnrollModal(false);
      return;
    }
    if (isFree) {
      setEnrollMode('free');
      setEnrollStep('data');
    } else {
      setEnrollMode('paid');
      setEnrollStep('data');
    }
    setShowEnrollModal(true);
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadData.nome.trim() || !leadData.email.trim() || !leadData.telefone.trim()) return;

    setIsSubmittingLead(true);
    try {
      const orgId = item?.organizacao_id || item?.organizacoes?.id || null;
      const courseName = item?.nome || 'Curso';
      const payload: any = {
        nome: leadData.nome.trim(),
        email: leadData.email.trim(),
        telefone: leadData.telefone.trim(),
        mensagem: `Interesse no lançamento (Em Breve): ${courseName}`,
        organizacao_id: orgId,
        curso_id: item?.id || null,
        lido: false
      };

      const { error } = await supabase.from('leads_contato').insert([payload]);
      if (error) throw error;

      setLeadSuccess(true);
    } catch (err: any) {
      console.error('Erro ao salvar lead:', err);
      alert('Erro ao enviar cadastro: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const processRegistration = async () => {
    setIsProcessing(true);
    try {
      // 1. Verificar se usuário já existe ou criar novo
      const { data: existingUser } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', enrollData.email)
        .maybeSingle();

      let userId = existingUser?.id;

      if (!userId) {
        // Tentar criar no Auth
        const password = enrollData.password || Math.random().toString(36).slice(-8);
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: enrollData.email,
          password: password,
          options: {
            data: {
              nome: enrollData.nome,
              cpf: enrollData.cpf
            }
          }
        });

        if (authErr) {
          if (authErr.message.includes('already registered')) {
            // Usuário existe no Auth mas não na tabela usuarios — tudo bem, o upsert abaixo vai criar o perfil
            // Tentamos continuar com o ID retornado (pode vir em authData.user mesmo em re-signups)
            if (!authData?.user?.id) {
              // Última tentativa: signIn silencioso para recuperar o ID
              // Como não temos senha, peço para o usuário tentar pelo painel
              throw new Error("Seu e-mail já possui uma conta. Acesse o painel para fazer login e continuar a compra.");
            }
          } else {
            throw authErr;
          }
        }

        userId = authData?.user?.id;
      }

      if (userId) {
        // Garantir que existe na tabela usuarios antes de prosseguir
        const { error: upsertErr } = await supabase.from('usuarios').upsert({
          id: userId,
          auth_id: userId,
          nome: enrollData.nome,
          email: enrollData.email,
          role: 'membro',
          organizacao_id: item.organizacao_id
        });

        if (upsertErr) {
          console.error("Erro ao criar perfil de usuário:", upsertErr);
          throw new Error("Não foi possível criar seu perfil de acesso: " + upsertErr.message);
        }
      } else {
        throw new Error("Falha ao identificar ou criar conta de usuário.");
      }

      // 1.1 Verificar se já tem participação (inscrito ou pendente)
      const table = isTrilha ? 'trilha_participantes' : 'curso_participantes';
      const idField = isTrilha ? 'trilha_id' : 'curso_id';

      const { data: existingParticipation } = await supabase
        .from(table)
        .select('id, status')
        .eq(idField, item.id)
        .eq('usuario_id', userId)
        .maybeSingle();

      if (existingParticipation) {
        if (existingParticipation.status === 'inscrito') {
          // Já está plenamente inscrito — sucesso direto
          setParticipantId(existingParticipation.id);
          setEnrollStep('success');
          setIsProcessing(false);
          return;
        }
        // status === 'pendente': pagamento anterior não concluído — permitir nova tentativa
        setParticipantId(existingParticipation.id);
        if (isFree) {
          // Atualizar para inscrito (caso gratuito ficou pendente por algum motivo)
          await supabase.from(table).update({ status: 'inscrito' }).eq('id', existingParticipation.id);
          setEnrollStep('success');
          setIsProcessing(false);
          return;
        }
        // Para pago: vai direto para o pagamento sem recriar o registro
        setEnrollStep('payment');
        setShowPaymentModal(true);
        setIsProcessing(false);
        return;
      }

      // 2. Criar registro de participante pela primeira vez
      const { data: participant, error: partErr } = await supabase
        .from(table)
        .upsert(
          {
            [idField]: item.id,
            usuario_id: userId,
            status: isFree ? 'inscrito' : 'pendente',
            progresso: 0
          },
          { onConflict: `${idField},usuario_id`, ignoreDuplicates: false }
        )
        .select()
        .single();

      if (partErr) throw partErr;
      setParticipantId(participant.id);

      if (isFree) {
        setEnrollStep('success');
      } else {
        // Registra a intenção de checkout para automação de carrinho abandonado
        try {
          fetch('/api/payments/checkout-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: enrollData.nome,
              email: enrollData.email,
              phone: enrollData.telefone,
              itemType: isTrilha ? 'trilha' : 'curso',
              itemId: item.id,
              itemName: item.nome,
              amount: item.preco || 0,
              checkoutUrl: window.location.href
            })
          });
        } catch (e) {
          console.error("Erro ao registrar intenção de checkout:", e);
        }

        setEnrollStep('payment');
        setShowPaymentModal(true);
      }
    } catch (err: any) {
      console.error("Enrollment error:", err);
      alert("Erro ao processar inscrição: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        const idColumn = isUuid(courseId) ? 'id' : 'slug';

        if (isTrilha) {
          const { data: trilha, error: trilhaErr } = await supabase
            .from('trilhas')
            .select('*, organizacoes(*)')
            .eq(idColumn, courseId)
            .single();
          if (trilhaErr) throw trilhaErr;
          setItem(trilha);
          const { data: tc, error: tcErr } = await supabase
            .from('trilha_cursos')
            .select('curso_id, cursos(*)')
            .eq('trilha_id', trilha.id);
          if (!tcErr && tc) setCursosTrilha(tc.map((t: any) => t.cursos));
        } else {
          const { data, error } = await supabase
            .from('cursos')
            .select('*, organizacoes(*)')
            .eq(idColumn, courseId)
            .single();
          if (error) throw error;
          setItem(data);
          // #4 Fetch real participant count
          const { count } = await supabase
            .from('curso_participantes')
            .select('id', { count: 'exact', head: true })
            .eq('curso_id', courseId)
            .eq('status', 'inscrito');
          if (count !== null) setParticipantCount(count);
        }
        
        // M6: Fetch planos_assinatura
        const { data: plansData } = await supabase
          .from('planos_assinatura')
          .select('*')
          .eq(isTrilha ? 'trilha_id' : 'curso_id', courseId)
          .eq('ativo', true)
          .order('valor_cents', { ascending: true });
        
        if (plansData && plansData.length > 0) {
          setPlanosAssinatura(plansData);
          setSelectedPlanId(plansData[0].pagarme_plan_id); // default to first active plan
        }
      } catch (err: any) {
        console.error('Error fetching public content:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    if (courseId) fetchData();
  }, [courseId, isTrilha]);

  useEffect(() => {
    if (!item) return;

    // 1. Capture UTM and Affiliate parameters
    const params = new URLSearchParams(window.location.search);
    const utm_source = params.get('utm_source');
    const utm_medium = params.get('utm_medium');
    const utm_campaign = params.get('utm_campaign');
    const ref = params.get('ref');

    if (utm_source) sessionStorage.setItem('utm_source', utm_source);
    if (utm_medium) sessionStorage.setItem('utm_medium', utm_medium);
    if (utm_campaign) sessionStorage.setItem('utm_campaign', utm_campaign);
    if (ref) sessionStorage.setItem('affiliate_ref_id', ref);

    // 2. Generate/Retrieve visitor_id
    let visitorId = localStorage.getItem('sg_visitor_id');
    if (!visitorId) {
      visitorId = 'visitor_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now();
      localStorage.setItem('sg_visitor_id', visitorId);
    }

    // 3. Track page_view
    const trackPageView = async () => {
      try {
        await fetch('/api/traffic/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organizacao_id: item.organizacao_id,
            curso_id: isTrilha ? null : item.id,
            trilha_id: isTrilha ? item.id : null,
            event_type: 'page_view',
            utm_source: utm_source || sessionStorage.getItem('utm_source') || null,
            utm_medium: utm_medium || sessionStorage.getItem('utm_medium') || null,
            utm_campaign: utm_campaign || sessionStorage.getItem('utm_campaign') || null,
            visitor_id: visitorId,
            affiliate_id: ref || sessionStorage.getItem('affiliate_ref_id') || null
          })
        });
      } catch (err) {
        console.error('Error tracking page view:', err);
      }
    };

    trackPageView();
  }, [item, isTrilha]);


  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-700 font-medium typo-text">Preparando sua experiência...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <X className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 typo-title">Ops! Algo deu errado.</h2>
        <p className="text-slate-700 max-w-md typo-text">{error || 'Não foi possível encontrar este conteúdo público.'}</p>
        <button onClick={() => window.location.reload()} className="typo-btn px-6 py-2 bg-primary text-white rounded-full font-bold">Tentar novamente</button>
      </div>
    );
  }

  // Only block if the admin has EXPLICITLY set enabled to false (not just absent)
  if (lpRaw && lpRaw.enabled === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2 typo-title">Página em manutenção</h1>
          <p className="text-slate-700 mb-6 typo-text">Esta página de vendas está temporariamente desativada pelo instrutor.</p>
          <a href="/" className="inline-block px-8 py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-all">
            Voltar
          </a>
        </div>
      </div>
    );
  }
  const layout = 'escuro';

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '37, 99, 235';
  };
  const primaryRgb = hexToRgb(lp.primary_color || '#2563eb');

  const sectionMap: Record<string, React.ReactNode> = {
    info: (
      <section key="info" className="bg-slate-950/60 py-10" style={getSectionStyle('info')}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col items-center gap-8">
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 w-full">
            {(isTrilha ? [
              { icon: BookOpen, text: `${cursosTrilha.length} Cursos` },
              { icon: Clock, text: `${item.carga_horaria || '04'} horas de conteúdo` },
              { icon: Calendar, text: item.tempo === 'com_limite' ? `Acesso por ${item.duracao || ''} ${item.duracao_tipo || 'meses'}` : 'Acesso vitalício' },
              ...(item.tem_certificado ? [{ icon: Award, text: 'Certificado Incluso' }] : [])
            ] : [
              { icon: BookOpen, text: `${item.curriculo_json?.length || 0} Módulos` },
              { icon: Play, text: `${item.curriculo_json?.reduce((acc: number, secao: any) => acc + (secao.etapas?.length || 0), 0) || 0} Aulas` },
              { icon: Clock, text: `${item.carga_horaria || '04'} horas de conteúdo` },
              { icon: Calendar, text: item.tempo === 'com_limite' ? `Acesso por ${item.duracao || ''} ${item.duracao_tipo || 'meses'}` : 'Acesso vitalício' },
              ...(item.tem_certificado ? [{ icon: Award, text: 'Certificado Incluso' }] : [])
            ]).map((stat, i) => {
              const aboutSectionBgColor = lp.section_about_bg_color || '#0f172a';
              return (
                <div 
                  key={i} 
                  className="px-6 py-3.5 rounded-2xl border bg-transparent backdrop-blur-sm flex items-center gap-3.5 transition-all shadow-sm"
                  style={{ borderColor: aboutSectionBgColor, color: aboutSectionBgColor }}
                >
                  <stat.icon className="w-5 h-5 sm:w-7 sm:h-7 shrink-0" style={{ color: aboutSectionBgColor }} />
                  <span className="text-sm sm:text-xl font-semibold tracking-tight whitespace-nowrap" style={{ color: aboutSectionBgColor }}>{stat.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    ),
    about: (
      <section key="about" id="sobre" className="relative w-full overflow-hidden bg-slate-900 text-left" style={getSectionStyle('about')}>
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[550px] lg:min-h-[650px] w-full items-stretch">
          <div className="p-8 sm:p-12 lg:p-20 xl:p-24 flex flex-col justify-center text-left space-y-6 sm:space-y-8 max-w-[672px] mx-auto w-full">
            <div className="space-y-3 max-w-[768px]">
              <h2 
                className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white leading-[1.15] tracking-tight ${lp.about_title_style || 'typo-title-1'}`}
                style={lp.about_title_color ? { color: lp.about_title_color } : undefined}
              >
                <FormattedTitle content={lp.about_title || item.nome} />
              </h2>
            </div>

            <div 
              className={`text-base sm:text-lg lg:text-xl text-slate-300/90 leading-relaxed font-sans space-y-4 ${lp.about_text_style || 'typo-body-1'}`}
              style={lp.about_text_color ? { color: lp.about_text_color } : undefined}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {lp.about || item.descricao}
              </ReactMarkdown>
            </div>
          </div>

          <div className="relative w-full h-full min-h-[400px] lg:min-h-full overflow-hidden bg-slate-900">
            {lp.hero_video_url ? (
              <div className="relative w-full h-full min-h-[400px] lg:min-h-full bg-black group">
                {isPlayingAboutVideo ? (
                  <ReactPlayer 
                    url={lp.hero_video_url} 
                    width="100%" 
                    height="100%" 
                    playing={true} 
                    controls={true} 
                  />
                ) : (
                  <div className="relative w-full h-full cursor-pointer" onClick={() => setIsPlayingAboutVideo(true)}>
                    <img 
                      src={lp.about_image_url || item.capa_url || item.thumbnail_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1200'} 
                      alt="Sobre o Programa" 
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/95 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-all">
                        <svg 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke={lp.section_about_bg_color || '#0f172a'} 
                          strokeWidth="2.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          className="w-9 h-9 sm:w-11 sm:h-11 ml-1.5"
                        >
                          <polygon points="6 3 20 12 6 21 6 3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <img 
                src={lp.about_image_url || item.capa_url || item.thumbnail_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1200'} 
                alt="Sobre o Programa" 
                className="w-full h-full object-cover object-center"
              />
            )}
          </div>
        </div>
      </section>
    ),
    copy: (lp.copy_section_text || lp.copy_section_cta_text) ? (
      <section key="copy" id="copy-cta" className="py-24 sm:py-32 bg-slate-900 relative text-center overflow-hidden" style={getSectionStyle('copy')}>
        <div className="max-w-[768px] mx-auto px-6 flex flex-col items-center justify-center space-y-8 lg:space-y-10">
          {lp.copy_section_text && (
            <div 
              className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif text-white font-normal leading-[1.25] tracking-tight ${lp.copy_text_style || 'typo-title-1'}`}
              style={lp.copy_text_color ? { color: lp.copy_text_color } : undefined}
            >
              <FormattedTitle content={lp.copy_section_text} />
            </div>
          )}
          
          <button 
            onClick={handleEnrollClick}
            className={`px-8 sm:px-10 py-4 text-white rounded-2xl font-serif italic text-lg sm:text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group ${lp.copy_cta_style || 'typo-btn-1'}`}
            style={{ 
              backgroundColor: lp.section_curriculum_bg_color || lp.section_about_bg_color || '#0f172a',
              color: lp.copy_cta_color || '#ffffff'
            }}
          >
            <span>{lp.copy_section_cta_text || lp.cta_text || 'Acesse o guia'}</span>
          </button>
        </div>
      </section>
    ) : null,
    features: lp.benefits?.length > 0 ? (
      <section key="features" id="vantagens" className="py-20 sm:py-28 bg-slate-900/60 text-center overflow-hidden" style={getSectionStyle('features')}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-0 items-stretch text-center">
            {(lp.benefits || []).slice(0, 3).map((benefit: any, idx: number) => {
              const itemObj = typeof benefit === 'object' && benefit !== null ? benefit : { title: typeof benefit === 'string' ? benefit : '', description: '' };
              const totalItems = Math.min(lp.benefits.length, 3);
              const isNotLast = idx < (totalItems - 1);
              return (
                <div 
                  key={idx} 
                  className={`px-4 sm:px-8 py-4 flex flex-col items-center justify-start text-center space-y-4 ${
                    isNotLast ? 'md:border-r md:border-white/20' : ''
                  }`}
                >
                  <h4 
                    className={`text-5xl sm:text-6xl lg:text-7xl font-serif font-normal text-white leading-none tracking-tight ${lp.benefit_title_style || 'typo-title-2'}`}
                    style={lp.benefit_title_color ? { color: lp.benefit_title_color } : undefined}
                  >
                    <FormattedTitle content={itemObj.title} />
                  </h4>

                  {itemObj.description && (
                    <p 
                      className={`text-sm sm:text-base text-slate-300/90 leading-relaxed font-sans max-w-xs mx-auto text-center ${lp.benefit_text_style || 'typo-body-2'}`}
                      style={lp.benefit_text_color ? { color: lp.benefit_text_color } : undefined}
                    >
                      {itemObj.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    ) : null,
    testimonials: lp.testimonials?.length > 0 ? (
      <section key="testimonials" id="depoimentos" className="py-24 sm:py-32 bg-slate-900 relative overflow-hidden" style={getSectionStyle('testimonials')}>
        <div className="max-w-5xl mx-auto px-6 text-center space-y-8 relative z-10">
          <TestimonialsCarousel testimonials={lp.testimonials} layout={layout} primaryColor={lp.primary_color} lp={lp} />
        </div>
      </section>
    ) : null,
    audience: (
      <TargetAudienceSection key="audience" targetAudience={lp.target_audience} layout={layout} style={getSectionStyle('audience')} lp={lp} />
    ),
    instructor: (
      <section key="instructor" id="instrutor" className="relative w-full overflow-hidden bg-slate-950 text-left [transform:translateZ(0)] [backface-visibility:hidden] antialiased" style={getSectionStyle('instructor')}>
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[550px] lg:min-h-[650px] w-full items-stretch">
          <div className="relative w-full h-full min-h-[400px] lg:min-h-full overflow-hidden bg-slate-900">
            <img 
              src={lp.instructor?.avatar_url || item.professor_foto_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1000'} 
              alt={lp.instructor?.name || item.professor_nome || 'Instrutor'} 
              className="w-full h-full object-cover object-center"
            />
          </div>

          <div className="p-8 sm:p-12 lg:p-20 xl:p-24 flex flex-col justify-center text-left space-y-6 sm:space-y-8 max-w-[672px] mx-auto w-full [transform:translateZ(0)] [backface-visibility:hidden] antialiased">
            <div className="space-y-3 max-w-[768px]">
              <h2 
                className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white leading-[1.15] tracking-tight ${lp.instructor_name_style || 'typo-title-1'}`}
                style={lp.instructor_name_color ? { color: lp.instructor_name_color } : undefined}
              >
                <FormattedTitle content={lp.instructor?.name || item.professor_nome || 'Especialista'} />
              </h2>
              {Boolean(lp.instructor?.role?.trim()) && (
                <p 
                  className={`text-lg sm:text-xl text-primary font-medium tracking-wide ${lp.instructor_role_style || ''}`}
                  style={lp.instructor_role_color ? { color: lp.instructor_role_color } : undefined}
                >
                  {lp.instructor.role}
                </p>
              )}
            </div>
            
            <div 
              className={`text-base sm:text-lg text-slate-300/90 leading-relaxed font-sans space-y-4 ${lp.instructor_bio_style || 'typo-body-2'}`}
              style={lp.instructor_bio_color ? { color: lp.instructor_bio_color } : undefined}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {lp.instructor?.bio || item.professor_bio || 'Comprometido em guiar alunos na jornada de transformação profissional através de métodos validados no mercado.'}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </section>
    ),
    curriculum: !isTrilha ? (
      <section key="curriculum" id="curriculo" className="relative w-full overflow-hidden bg-slate-950 text-left" style={getSectionStyle('curriculum')}>
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[550px] lg:min-h-[650px] w-full items-stretch">
          <div className="p-8 sm:p-12 lg:p-20 xl:p-24 flex flex-col justify-center text-left space-y-6 sm:space-y-8 max-w-[672px] mx-auto w-full">
            <h2 
              className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white leading-[1.15] tracking-tight max-w-[768px] ${lp.curriculum_title_style || 'typo-title-1'}`}
              style={lp.curriculum_title_color ? { color: lp.curriculum_title_color } : undefined}
            >
              <FormattedTitle content={lp.curriculum_title || 'O que você verá por aqui:'} />
            </h2>
            
            <div className="space-y-4 w-full">
              {item.curriculo_json?.map((modulo: any, idx: number) => {
                const isExpanded = !!openModules[idx];
                return (
                  <div key={idx} className="w-full">
                    <div 
                      onClick={() => toggleModule(idx)}
                      className="px-6 py-4 rounded-2xl border bg-transparent backdrop-blur-sm hover:border-primary/60 hover:bg-white/10 transition-all flex items-center justify-between cursor-pointer select-none group"
                      style={lp.curriculum_module_color ? { borderColor: lp.curriculum_module_color } : { borderColor: 'rgba(255, 255, 255, 0.2)' }}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <span 
                          className={`font-serif text-2xl font-semibold text-white/90 ${lp.curriculum_number_style || ''}`}
                          style={lp.curriculum_number_color ? { color: lp.curriculum_number_color } : (lp.curriculum_module_color ? { color: lp.curriculum_module_color } : undefined)}
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span 
                          className={`font-medium text-white text-base sm:text-lg tracking-tight ${lp.curriculum_module_style || ''}`}
                          style={lp.curriculum_module_color ? { color: lp.curriculum_module_color } : undefined}
                        >
                          {modulo.nome}
                        </span>
                      </div>
                      <ChevronDown 
                        className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                        style={lp.curriculum_module_color ? { color: lp.curriculum_module_color } : undefined}
                      />
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden px-6 py-4 mt-2 bg-white/5 rounded-2xl border border-white/10 space-y-2 text-slate-300"
                        >
                          {modulo.etapas && modulo.etapas.length > 0 ? (
                            modulo.etapas.map((etapa: any, sIdx: number) => (
                              <div key={sIdx} className="py-2 flex items-center justify-between text-slate-300 hover:text-white transition-colors">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-slate-500 font-mono w-5">{(sIdx + 1).toString().padStart(2, '0')}</span>
                                  {etapa.tipo === 'video' ? (
                                    <Play className="w-4 h-4 text-primary fill-primary/10 shrink-0" />
                                  ) : etapa.tipo === 'quiz' ? (
                                    <HelpCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                                  ) : (
                                    <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                                  )}
                                  <span 
                                    className={`text-sm font-medium ${lp.curriculum_lesson_style || ''}`}
                                    style={lp.curriculum_lesson_color ? { color: lp.curriculum_lesson_color } : undefined}
                                  >
                                    {etapa.nome}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-2 text-slate-500 text-xs font-medium">Este módulo não possui etapas cadastradas.</div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 w-full">
              <button 
                onClick={handleEnrollClick}
                className={`w-full py-4 px-6 bg-primary text-white rounded-2xl font-serif italic text-lg sm:text-xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center text-center ${lp.curriculum_cta_style || 'typo-btn-1'}`}
                style={{ color: lp.section_about_bg_color || '#0f172a' }}
              >
                <span>{lp.copy_section_cta_text || lp.cta_text || 'Acesse agora'}</span>
              </button>
            </div>
          </div>

          <div className="relative w-full h-full min-h-[400px] lg:min-h-full overflow-hidden bg-slate-900">
            <img 
              src={lp.curriculum_image_url || lp.about_image_url || item.capa_url || item.thumbnail_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1200'} 
              alt="Conteúdo do Curso" 
              className="w-full h-full object-cover object-center"
            />
          </div>
        </div>
      </section>
    ) : null,
    faq: lp.faq?.length > 0 ? (
      <section key="faq" id="faq" className="py-24 sm:py-32 bg-slate-950" style={getSectionStyle('faq')}>
        <div className="max-w-[768px] mx-auto px-6 text-center space-y-10">
          <h2 
            className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white tracking-tight ${lp.faq_title_style || 'typo-title-1'}`}
            style={lp.faq_title_color ? { color: lp.faq_title_color } : undefined}
          >
            <FormattedTitle content={lp.faq_title || 'Perguntas frequentes:'} />
          </h2>
          
          <div className="space-y-4 w-full">
            {lp.faq.map((f: any, idx: number) => {
              const isFaqExpanded = !!openFaqs[idx];
              return f.question && (
                <div key={idx} className="w-full text-left">
                  <div 
                    onClick={() => toggleFaq(idx)}
                    className="px-6 py-4 rounded-2xl border bg-transparent backdrop-blur-sm hover:border-primary/60 hover:bg-white/10 transition-all flex items-center justify-between cursor-pointer select-none group"
                    style={lp.faq_question_color ? { borderColor: lp.faq_question_color } : { borderColor: 'rgba(255, 255, 255, 0.2)' }}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <span 
                        className="font-serif text-2xl font-semibold text-white/90"
                        style={lp.faq_question_color ? { color: lp.faq_question_color } : undefined}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span 
                        className={`font-medium text-white text-base sm:text-lg tracking-tight ${lp.faq_question_style || ''}`}
                        style={lp.faq_question_color ? { color: lp.faq_question_color } : undefined}
                      >
                        {f.question}
                      </span>
                    </div>
                    <ChevronDown 
                      className={`w-5 h-5 transition-transform duration-300 ${isFaqExpanded ? 'rotate-180' : ''}`} 
                      style={lp.faq_question_color ? { color: lp.faq_question_color } : undefined}
                    />
                  </div>

                  <AnimatePresence initial={false}>
                    {isFaqExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden px-6 py-5 mt-2 bg-white/5 rounded-2xl border border-white/10 text-slate-300 text-base leading-relaxed"
                      >
                        <p 
                          className={`text-slate-300 leading-relaxed text-base sm:text-lg ${lp.faq_answer_style || 'typo-body-2'}`}
                          style={lp.faq_answer_color ? { color: lp.faq_answer_color } : undefined}
                        >
                          {f.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="pt-4 w-full">
            <button 
              onClick={handleEnrollClick}
              className={`w-full py-4 px-6 bg-primary text-white rounded-2xl font-serif italic text-lg sm:text-xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center text-center ${lp.curriculum_cta_style || 'typo-btn-1'}`}
              style={{ color: lp.section_about_bg_color || '#0f172a' }}
            >
              <span>{lp.copy_section_cta_text || lp.cta_text || 'Acesse agora'}</span>
            </button>
          </div>
        </div>
      </section>
    ) : null,
    bonuses: lp.bonuses?.length > 0 ? (
      <section key="bonuses" className="py-32 bg-emerald-950/40 text-white overflow-hidden relative" style={getSectionStyle('bonuses')}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16 space-y-4 max-w-[768px] mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full text-xs font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/20">
              Oportunidade Única
            </div>
            <h2 className="text-4xl md:text-5xl font-bold typo-title">Bônus Exclusivos Para Você</h2>
            <p className="text-slate-700 text-lg typo-text">Inscreva-se hoje e leve gratuitamente estes materiais complementares.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {lp.bonuses.map((bonus: any, idx: number) => (
              <div key={idx} className="bg-slate-900/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-800 hover:border-emerald-500/50 transition-all group">
                 <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                   <Gift className="w-7 h-7 text-emerald-400" />
                 </div>
                 <h4 className="text-xl font-bold mb-3 typo-title">{bonus.title}</h4>
                 {bonus.value && (
                   <div className="mb-3 flex items-center gap-2">
                     <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Valor:</span>
                     <span className="text-slate-500 line-through text-sm">R$ {bonus.value}</span>
                     <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Grátis</span>
                   </div>
                 )}
                 <p className="text-slate-700 leading-relaxed typo-text">{bonus.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    ) : null,
    guarantee: (
      <TrustAndGuarantee key="guarantee" layout={layout} guaranteeDays={lp.guarantee_days || 7} style={getSectionStyle('guarantee')} />
    ),
    pricing: (
      <section key="pricing" className="py-24 sm:py-32 bg-slate-900 relative overflow-hidden" style={getSectionStyle('pricing')}>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[180px]"></div>
         </div>

         <div className="max-w-[768px] mx-auto px-4 sm:px-6 text-center relative z-10 space-y-8 sm:space-y-10">
            {/* Section Title */}
            <h2 
              className={`text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-white tracking-tight ${lp.pricing_title_style || 'typo-title-1'}`}
              style={lp.pricing_title_color ? { color: lp.pricing_title_color } : undefined}
            >
              <FormattedTitle content={lp.pricing_title || 'Escolha o seu futuro hoje'} />
            </h2>

            {/* Section Subtitle */}
            {(lp.pricing_subtitle || 'Não deixe para depois a oportunidade de se tornar um especialista com quem realmente entende do assunto.') && (
              <p 
                className={`text-lg sm:text-xl text-slate-300/90 max-w-2xl mx-auto font-sans leading-relaxed ${lp.pricing_subtitle_style || 'typo-body-1'}`}
                style={lp.pricing_subtitle_color ? { color: lp.pricing_subtitle_color } : undefined}
              >
                <FormattedTitle content={lp.pricing_subtitle || 'Não deixe para depois a oportunidade de se tornar um especialista com quem realmente entende do assunto.'} />
              </p>
            )}

            {/* Pricing Card */}
            <div className="max-w-xl mx-auto bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-primary/10 relative text-center">
              <div className="space-y-6">
                {/* Original Price (De R$) */}
                {discountedPrice !== null && itemPrice > 0 && (
                  <div 
                    className={`text-sm sm:text-base text-slate-400 line-through font-medium ${lp.price_original_style || 'typo-body-2'}`}
                    style={lp.price_original_color ? { color: lp.price_original_color } : undefined}
                  >
                    {`De R$ ${itemPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  </div>
                )}

                {/* Promo Price (Por R$) */}
                <div 
                  className={`text-3xl sm:text-5xl md:text-6xl font-serif font-extrabold text-white tracking-tight ${lp.price_promo_style || 'typo-title-1'}`}
                  style={lp.price_promo_color ? { color: lp.price_promo_color } : undefined}
                >
                  {isFree ? 'GRÁTIS' : `Por R$ ${finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} à vista`}
                </div>

                {/* Installment Price */}
                {finalPrice > 0 && !isFree && (
                  <div 
                    className={`text-base sm:text-lg text-emerald-400 font-semibold ${lp.price_installment_style || 'typo-body-1'}`}
                    style={lp.price_installment_color ? { color: lp.price_installment_color } : undefined}
                  >
                    {`ou ${(config.pagamento_parcelas_limite || '10')}x de R$ ${(finalPrice / (parseInt(config.pagamento_parcelas_limite || '10') || 10)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sem juros`}
                  </div>
                )}

                {/* CTA Button */}
                <div className="pt-4">
                  <button 
                    onClick={handleEnrollClick}
                    className={`w-full py-4 sm:py-5 px-8 bg-primary text-white font-black text-lg sm:text-xl rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 ${lp.pricing_cta_style || 'typo-btn-1'}`}
                    style={lp.pricing_cta_color ? { backgroundColor: lp.pricing_cta_color } : undefined}
                  >
                    {isEmBreve ? 'Cadastrar-se' : (lp.pricing_cta_text || lp.cta_text || 'GARANTIR MINHA VAGA AGORA')}
                    <ArrowRight className="w-6 h-6" />
                  </button>
                </div>

                {/* Notice / Footer Details */}
                <div 
                  className={`text-xs text-slate-400 pt-2 font-medium ${lp.pricing_notice_style || 'typo-body-3'}`}
                  style={lp.pricing_notice_color ? { color: lp.pricing_notice_color } : undefined}
                >
                  {lp.pricing_notice || `Garantia Incondicional de ${lp.guarantee_days || 7} dias • Pagamento 100% Seguro • Acesso Imediato`}
                </div>
              </div>
            </div>
         </div>
      </section>
    )
  };

  const defaultOrderKeys = ['info', 'about', 'copy', 'features', 'testimonials', 'audience', 'instructor', 'curriculum', 'faq', 'bonuses', 'guarantee', 'pricing'];
  const userOrderKeys = (lp.section_order && lp.section_order.length > 0) ? lp.section_order : defaultOrderKeys;
  const filteredUserOrder = userOrderKeys.filter((k: string) => k !== 'hero' && k !== 'footer');
  const missingKeys = defaultOrderKeys.filter(k => !filteredUserOrder.includes(k));
  const activeSectionOrder = [...filteredUserOrder, ...missingKeys];

  const isSectionVisible = (key: string) => {
    if (!lp.visible_sections) return true;
    return lp.visible_sections.includes(key);
  };

  if (layout === 'escuro') {
    return (
      <div className="min-h-screen bg-slate-900 selection:bg-primary/30 selection:text-white font-sans text-slate-300">
        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300..900;1,300..900&family=Outfit:wght@300..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900&family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900&family=Space+Grotesk:wght@300..700&display=swap');

          :root { 
            --primary: ${lp.primary_color || '#2563eb'};
            --primary-rgb: ${primaryRgb};
          }
          .bg-primary { background-color: var(--primary); }
          .bg-primary\/5 { background-color: rgba(var(--primary-rgb), 0.05); }
          .bg-primary\/10 { background-color: rgba(var(--primary-rgb), 0.1); }
          .bg-primary\/20 { background-color: rgba(var(--primary-rgb), 0.2); }
          .bg-primary\/30 { background-color: rgba(var(--primary-rgb), 0.3); }
          .text-primary { color: var(--primary); }
          .text-primary\/10 { color: rgba(var(--primary-rgb), 0.1); }
          .border-primary { border-color: var(--primary); }
          .border-primary\/20 { border-color: rgba(var(--primary-rgb), 0.2); }
          .border-primary\/30 { border-color: rgba(var(--primary-rgb), 0.3); }
          .border-primary\/50 { border-color: rgba(var(--primary-rgb), 0.5); }
          .ring-primary { --tw-ring-color: var(--primary); }
          .shadow-primary { --tw-shadow-color: var(--primary); }
          .shadow-primary\/20 { --tw-shadow-color: rgba(var(--primary-rgb), 0.2); }
          .shadow-primary\/40 { --tw-shadow-color: rgba(var(--primary-rgb), 0.4); }
          .selection\:bg-primary\/30 *::selection { background-color: rgba(var(--primary-rgb), 0.3); }
          .selection\:bg-primary\/30 ::selection { background-color: rgba(var(--primary-rgb), 0.3); }
          .selection\:text-white *::selection { color: white; }
          .selection\:text-white ::selection { color: white; }

          @media (max-width: 1023px) {
            .hero-no-mobile-transform {
              transform: none !important;
            }
          }

          /* Regras da Tabela de Tipografia */
          .typo-title-1 {
            font-family: ${(lp.typography?.titulo_1?.font_family === 'Times New Roman' ? "'Times New Roman', Times, serif" : lp.typography?.titulo_1?.font_family === 'Playfair Display' ? "'Playfair Display', Georgia, serif" : `'${lp.typography?.titulo_1?.font_family || 'Inter'}', sans-serif`)} !important;
            font-weight: ${lp.typography?.titulo_1?.font_weight || '800'} !important;
            font-size: ${lp.typography?.titulo_1?.font_size || '48px'} !important;
            line-height: ${lp.typography?.titulo_1?.line_height || '1.1'} !important;
            letter-spacing: ${lp.typography?.titulo_1?.letter_spacing || '-0.03em'} !important;
            ${lp.typography?.titulo_1?.color ? `color: ${lp.typography.titulo_1.color} !important;` : ''}
          }
          .typo-title-2 {
            font-family: ${(lp.typography?.titulo_2?.font_family === 'Times New Roman' ? "'Times New Roman', Times, serif" : lp.typography?.titulo_2?.font_family === 'Playfair Display' ? "'Playfair Display', Georgia, serif" : `'${lp.typography?.titulo_2?.font_family || 'Inter'}', sans-serif`)} !important;
            font-weight: ${lp.typography?.titulo_2?.font_weight || '700'} !important;
            font-size: ${lp.typography?.titulo_2?.font_size || '32px'} !important;
            line-height: ${lp.typography?.titulo_2?.line_height || '1.2'} !important;
            letter-spacing: ${lp.typography?.titulo_2?.letter_spacing || '-0.02em'} !important;
            ${lp.typography?.titulo_2?.color ? `color: ${lp.typography.titulo_2.color} !important;` : ''}
          }
          .typo-title-3 {
            font-family: ${(lp.typography?.titulo_3?.font_family === 'Times New Roman' ? "'Times New Roman', Times, serif" : lp.typography?.titulo_3?.font_family === 'Playfair Display' ? "'Playfair Display', Georgia, serif" : `'${lp.typography?.titulo_3?.font_family || 'Inter'}', sans-serif`)} !important;
            font-weight: ${lp.typography?.titulo_3?.font_weight || '600'} !important;
            font-size: ${lp.typography?.titulo_3?.font_size || '22px'} !important;
            line-height: ${lp.typography?.titulo_3?.line_height || '1.3'} !important;
            letter-spacing: ${lp.typography?.titulo_3?.letter_spacing || '0em'} !important;
            ${lp.typography?.titulo_3?.color ? `color: ${lp.typography.titulo_3.color} !important;` : ''}
          }
          .typo-body-1 {
            font-family: ${(lp.typography?.texto_corrido_1?.font_family === 'Times New Roman' ? "'Times New Roman', Times, serif" : lp.typography?.texto_corrido_1?.font_family === 'Playfair Display' ? "'Playfair Display', Georgia, serif" : `'${lp.typography?.texto_corrido_1?.font_family || 'Inter'}', sans-serif`)} !important;
            font-weight: ${lp.typography?.texto_corrido_1?.font_weight || '400'} !important;
            font-size: ${lp.typography?.texto_corrido_1?.font_size || '20px'} !important;
            line-height: ${lp.typography?.texto_corrido_1?.line_height || '1.5'} !important;
            letter-spacing: ${lp.typography?.texto_corrido_1?.letter_spacing || '0em'} !important;
            ${lp.typography?.texto_corrido_1?.color ? `color: ${lp.typography.texto_corrido_1.color} !important;` : ''}
          }
          .typo-body-2 {
            font-family: ${(lp.typography?.texto_corrido_2?.font_family === 'Times New Roman' ? "'Times New Roman', Times, serif" : lp.typography?.texto_corrido_2?.font_family === 'Playfair Display' ? "'Playfair Display', Georgia, serif" : `'${lp.typography?.texto_corrido_2?.font_family || 'Inter'}', sans-serif`)} !important;
            font-weight: ${lp.typography?.texto_corrido_2?.font_weight || '400'} !important;
            font-size: ${lp.typography?.texto_corrido_2?.font_size || '16px'} !important;
            line-height: ${lp.typography?.texto_corrido_2?.line_height || '1.5'} !important;
            letter-spacing: ${lp.typography?.texto_corrido_2?.letter_spacing || '0em'} !important;
            ${lp.typography?.texto_corrido_2?.color ? `color: ${lp.typography.texto_corrido_2.color} !important;` : ''}
          }
          .typo-body-3 {
            font-family: ${(lp.typography?.texto_corrido_3?.font_family === 'Times New Roman' ? "'Times New Roman', Times, serif" : lp.typography?.texto_corrido_3?.font_family === 'Playfair Display' ? "'Playfair Display', Georgia, serif" : `'${lp.typography?.texto_corrido_3?.font_family || 'Inter'}', sans-serif`)} !important;
            font-weight: ${lp.typography?.texto_corrido_3?.font_weight || '400'} !important;
            font-size: ${lp.typography?.texto_corrido_3?.font_size || '14px'} !important;
            line-height: ${lp.typography?.texto_corrido_3?.line_height || '1.4'} !important;
            letter-spacing: ${lp.typography?.texto_corrido_3?.letter_spacing || '0em'} !important;
            ${lp.typography?.texto_corrido_3?.color ? `color: ${lp.typography.texto_corrido_3.color} !important;` : ''}
          }
          .typo-body-4 {
            font-family: ${(lp.typography?.texto_corrido_4?.font_family === 'Times New Roman' ? "'Times New Roman', Times, serif" : lp.typography?.texto_corrido_4?.font_family === 'Playfair Display' ? "'Playfair Display', Georgia, serif" : `'${lp.typography?.texto_corrido_4?.font_family || 'Inter'}', sans-serif`)} !important;
            font-weight: ${lp.typography?.texto_corrido_4?.font_weight || '500'} !important;
            font-size: ${lp.typography?.texto_corrido_4?.font_size || '12px'} !important;
            line-height: ${lp.typography?.texto_corrido_4?.line_height || '1.4'} !important;
            letter-spacing: ${lp.typography?.texto_corrido_4?.letter_spacing || '0.05em'} !important;
            ${lp.typography?.texto_corrido_4?.color ? `color: ${lp.typography.texto_corrido_4.color} !important;` : ''}
          }
          .typo-btn-1 {
            font-family: ${(lp.typography?.texto_botao_1?.font_family === 'Times New Roman' ? "'Times New Roman', Times, serif" : lp.typography?.texto_botao_1?.font_family === 'Playfair Display' ? "'Playfair Display', Georgia, serif" : `'${lp.typography?.texto_botao_1?.font_family || 'Inter'}', sans-serif`)} !important;
            font-weight: ${lp.typography?.texto_botao_1?.font_weight || '800'} !important;
            font-size: ${lp.typography?.texto_botao_1?.font_size || '18px'} !important;
            line-height: ${lp.typography?.texto_botao_1?.line_height || '1.2'} !important;
            letter-spacing: ${lp.typography?.texto_botao_1?.letter_spacing || '0.02em'} !important;
            ${lp.typography?.texto_botao_1?.color ? `color: ${lp.typography.texto_botao_1.color} !important;` : ''}
          }
          .typo-btn-2 {
            font-family: ${(lp.typography?.texto_botao_2?.font_family === 'Times New Roman' ? "'Times New Roman', Times, serif" : lp.typography?.texto_botao_2?.font_family === 'Playfair Display' ? "'Playfair Display', Georgia, serif" : `'${lp.typography?.texto_botao_2?.font_family || 'Inter'}', sans-serif`)} !important;
            font-weight: ${lp.typography?.texto_botao_2?.font_weight || '700'} !important;
            font-size: ${lp.typography?.texto_botao_2?.font_size || '14px'} !important;
            line-height: ${lp.typography?.texto_botao_2?.line_height || '1.2'} !important;
            letter-spacing: ${lp.typography?.texto_botao_2?.letter_spacing || '0em'} !important;
            ${lp.typography?.texto_botao_2?.color ? `color: ${lp.typography.texto_botao_2.color} !important;` : ''}
          }

          /* Classes legadas mantidas para compatibilidade */
          .typo-title { font-family: '${lp.typography?.titulo_1?.font_family || 'Inter'}', sans-serif; }
          .typo-subtitle { font-family: '${lp.typography?.texto_corrido_1?.font_family || 'Inter'}', sans-serif; }
          .typo-text { font-family: '${lp.typography?.texto_corrido_2?.font_family || 'Inter'}', sans-serif; }
          .typo-btn { font-family: '${lp.typography?.texto_botao_1?.font_family || 'Inter'}', sans-serif; }

        ` }} />
        
        <Nav
          layout={layout}
          item={item}
          lp={lp}
          onEnrollClick={handleEnrollClick}
          timeLeft={timeLeft}
        />

        {/* #2 Sticky CTA bar for mobile */}
        {showStickyCTA && (
          <div className="fixed bottom-0 left-0 right-0 z-[80] md:hidden bg-slate-950/95 backdrop-blur-md px-4 py-3 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300">
            <div className="text-left">
              {isEmBreve ? (
                <span className="text-amber-400 font-black text-sm uppercase tracking-wider">Em Breve</span>
              ) : isFree ? (
                <span className="text-emerald-400 font-black text-lg">GRATUITO</span>
              ) : (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-white text-xs font-bold">R$</span>
                    <span className="text-white font-black text-xl">{finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    {paymentModel === 'recorrente' && <span className="text-sm text-slate-300 font-medium">/ {paymentCycle === '30' ? 'mês' : paymentCycle === '365' ? 'ano' : paymentCycle + ' dias'}</span>}
                    {paymentModel === 'parcelado' && <span className="text-sm text-slate-300 font-medium">/ mês (x{paymentInstallmentsLimit})</span>}
                  </div>
                  {paymentModel === 'fixo' && !isFree && finalPrice > 0 && (
                    <div className="text-slate-400 text-[10px] font-medium -mt-1 mb-1">
                      ou 10x R$ {(finalPrice / 10).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </>
              )}
              <div className="text-slate-500 text-[10px] font-medium">{isEmBreve ? 'Lista de Espera VIP' : `${lp.guarantee_days || 7} dias de garantia`}</div>
            </div>
            <button
              onClick={handleEnrollClick}
              className="typo-btn flex-1 max-w-[200px] py-3 bg-primary text-white rounded-2xl font-black text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30"
            >
              {isEmBreve ? 'Cadastrar-se' : (lp.cta_text || 'GARANTIR VAGA')}
            </button>
          </div>
        )}

        {/* Dark Hero Section - Full-bleed background banner layout */}
        {isSectionVisible('hero') && (
          <section ref={heroRef} className="relative min-h-[92vh] flex items-center pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden bg-slate-950 text-left" style={getSectionStyle('hero')}>
            {/* Full Bleed Background Image */}
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
              <img 
                src={lp.hero_image_url || item.capa_url || item.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070'} 
                alt="Banner Principal"
                className="w-full h-full object-cover object-center"
              />
            </div>
            
            <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10 w-full min-h-0 lg:min-h-[85vh] flex flex-col justify-center">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full items-center my-auto">
                {/* Left Column (50% equal width on desktop) */}
                <div className="hidden lg:block col-span-1"></div>

                {/* Right Column (50% equal width on desktop) - Content centered horizontally & vertically */}
                <div className="col-span-1 w-full flex flex-col items-center justify-center text-center space-y-6 sm:space-y-8">
                  {/* Title or Title Image */}
                  <div className="w-full flex flex-col items-center justify-center text-center hero-no-mobile-transform" style={{ transform: (lp.hero_title_offset_x || lp.hero_title_offset_y) ? `translate3d(${lp.hero_title_offset_x || 0}px, ${lp.hero_title_offset_y || 0}px, 0)` : undefined }}>
                    {(lp.hero_title && (lp.hero_title.startsWith('data:image') || lp.hero_title.startsWith('http')) && !lp.hero_title.includes(' ')) ? (
                      <div className="w-full flex items-center justify-center text-center">
                        <img 
                          src={lp.hero_title} 
                          alt={item.nome || "Título"} 
                          className="object-contain w-auto block mx-auto max-w-full" 
                          style={{ 
                            height: lp.hero_title_image_height ? `${lp.hero_title_image_height}px` : '140px',
                            display: 'block',
                            margin: '0 auto'
                          }} 
                        />
                      </div>
                    ) : (
                      <>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-serif font-bold text-white leading-[1.1] tracking-tight uppercase typo-title typo-title-1 mb-6 text-center mx-auto">
                          <FormattedTitle content={lp.hero_title || item.nome} />
                        </h1>

                        {/* Decorative Divider Line with Diamond/Sparkle Accent */}
                        <div className="w-full flex items-center justify-center gap-4 py-2 opacity-80 max-w-lg mb-6 mx-auto">
                          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
                          <span className="text-primary text-sm sm:text-base tracking-widest">✦</span>
                          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
                        </div>

                        {/* Tagline / Subtitle / Secondary Description */}
                        {(lp.hero_subtitle || item.descricao) && (
                          <p className="text-xl sm:text-2xl lg:text-3xl font-serif italic text-slate-200/95 leading-snug max-w-2xl typo-subtitle typo-body-1 text-center mx-auto hero-no-mobile-transform" style={{ transform: (lp.hero_subtitle_offset_x || lp.hero_subtitle_offset_y) ? `translate3d(${lp.hero_subtitle_offset_x || 0}px, ${lp.hero_subtitle_offset_y || 0}px, 0)` : undefined }}>
                            <FormattedTitle content={lp.hero_subtitle || item.descricao} />
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* CTA Button & Instructor By Label */}
                  <div className="w-full flex flex-col items-center justify-center text-center gap-3 pt-4 hero-no-mobile-transform">
                    <div className="w-full flex items-center justify-center text-center">
                      <button 
                        onClick={handleEnrollClick}
                        className="typo-btn typo-btn-1 px-8 sm:px-12 py-4 sm:py-5 bg-primary text-white rounded-2xl font-serif italic text-lg sm:text-xl hover:scale-105 active:scale-95 transition-all shadow-[0_15px_40px_rgba(var(--primary-rgb),0.4)] flex items-center justify-center min-w-[240px] mx-auto text-center"
                      >
                        {isEmBreve ? 'Cadastrar-se' : (lp.cta_text || 'Descubra o segredo')}
                      </button>
                    </div>
                    
                    {(lp.instructor?.name || item.professor_nome) && (
                      <div className="w-full flex items-center justify-center text-center">
                        <span className="text-xs sm:text-sm text-primary font-serif italic tracking-wide font-bold mt-[10px] text-center mx-auto block">
                          By <FormattedTitle content={lp.instructor?.name || item.professor_nome} />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Dynamic Section Ordering */}
        {activeSectionOrder.filter(isSectionVisible).map((key) => sectionMap[key])}

        <Footer layout={layout} item={item} lp={lp} style={getSectionStyle('footer')} />
        
        {/* Modals */}
        <ModalErrorBoundary>
          <EnrollmentModal 
            isOpen={showEnrollModal}
            onClose={() => setShowEnrollModal(false)}
            enrollStep={enrollStep}
            isFree={isFree}
            enrollData={enrollData}
            onEnrollDataChange={setEnrollData}
            isProcessing={isProcessing}
            onRegister={processRegistration}
            isTrilha={!!isTrilha}
            itemName={item.nome}
          />
          <PaymentModal 
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            participantId={participantId!}
            item={{
              id: item.id,
              description: item.nome,
              amount: finalPrice,
              type: isTrilha ? 'trilha' : 'curso',
              paymentModel,
              paymentCycle,
              paymentInstallmentsLimit
            }}
            customer={{
              name: enrollData.nome,
              email: enrollData.email,
              cpf: enrollData.cpf
            }}
            organizacaoId={item.organizacao_id}
            planId={selectedPlanId || undefined}
          />
        </ModalErrorBoundary>
        <LeadModalPortal
          show={showLeadModal}
          onClose={() => setShowLeadModal(false)}
          onSubmit={handleLeadSubmit}
          leadData={leadData}
          setLeadData={setLeadData}
          isSubmitting={isSubmittingLead}
          leadSuccess={leadSuccess}
          itemNome={item?.nome}
        />
      </div>
    );
  }

  // --- BEGIN LIGHT LAYOUT (Original) ---
  return (
    <div className="min-h-screen bg-white selection:bg-primary/20 selection:text-primary font-sans text-left">
      <style dangerouslySetInnerHTML={{ __html: `
        :root { 
          --primary: ${lp.primary_color || '#2563eb'};
          --primary-rgb: ${primaryRgb};
        }
        .bg-primary { background-color: var(--primary); }
        .bg-primary\/5 { background-color: rgba(var(--primary-rgb), 0.05); }
        .bg-primary\/10 { background-color: rgba(var(--primary-rgb), 0.1); }
        .bg-primary\/20 { background-color: rgba(var(--primary-rgb), 0.2); }
        .bg-primary\/30 { background-color: rgba(var(--primary-rgb), 0.3); }
        .text-primary { color: var(--primary); }
        .text-primary\/10 { color: rgba(var(--primary-rgb), 0.1); }
        .border-primary { border-color: var(--primary); }
        .border-primary\/20 { border-color: rgba(var(--primary-rgb), 0.2); }
        .border-primary\/30 { border-color: rgba(var(--primary-rgb), 0.3); }
        .border-primary\/50 { border-color: rgba(var(--primary-rgb), 0.5); }
        .ring-primary { --tw-ring-color: var(--primary); }
        .shadow-primary { --tw-shadow-color: var(--primary); }
        .shadow-primary\/20 { --tw-shadow-color: rgba(var(--primary-rgb), 0.2); }
        .shadow-primary\/40 { --tw-shadow-color: rgba(var(--primary-rgb), 0.4); }
        .selection\:bg-primary\/20 *::selection { background-color: rgba(var(--primary-rgb), 0.2); }
        .selection\:bg-primary\/20 ::selection { background-color: rgba(var(--primary-rgb), 0.2); }
        .selection\:text-primary *::selection { color: var(--primary); }
        .selection\:text-primary ::selection { color: var(--primary); }

        @media (max-width: 1023px) {
          .hero-no-mobile-transform {
            transform: none !important;
          }
        }
      ` }} />
      
      <Nav 
        layout={layout} 
        item={item} 
        lp={lp} 
        onEnrollClick={handleEnrollClick} 
      />

            {/* #2 Sticky CTA bar for mobile (light layout) */}
            {showStickyCTA && (
              <div className="fixed bottom-0 left-0 right-0 z-[80] md:hidden bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300 shadow-2xl">
                <div className="text-left">
                  {isEmBreve ? (
                    <span className="text-amber-600 font-black text-sm uppercase tracking-wider">Em Breve</span>
                  ) : isFree ? (
                    <span className="text-emerald-600 font-black text-lg">GRATUITO</span>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-slate-900 text-xs font-bold">R$</span>
                        <span className="text-slate-900 font-black text-xl">{finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        {paymentModel === 'recorrente' && <span className="text-sm text-slate-500 font-medium">/ {paymentCycle === '30' ? 'mês' : paymentCycle === '365' ? 'ano' : paymentCycle + ' dias'}</span>}
                        {paymentModel === 'parcelado' && <span className="text-sm text-slate-500 font-medium">/ mês (x{paymentInstallmentsLimit})</span>}
                      </div>
                      {paymentModel === 'fixo' && !isFree && finalPrice > 0 && (
                        <div className="text-slate-500 text-[10px] font-medium -mt-1 mb-1">
                          ou 10x R$ {(finalPrice / 10).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                    </>
                  )}
                  <div className="text-slate-400 text-[10px] font-medium">{isEmBreve ? 'Lista de Espera VIP' : `${lp.guarantee_days || 7} dias de garantia`}</div>
                </div>
                <button
                  onClick={handleEnrollClick}
                  className="typo-btn flex-1 max-w-[200px] py-3 bg-primary text-white rounded-2xl font-black text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                >
                  {isEmBreve ? 'Cadastrar-se' : (lp.cta_text || 'GARANTIR VAGA')}
                </button>
              </div>
            )}

            {/* Hero Section - Light Lateral Full Bleed Layout */}
            <section ref={heroRef} className="relative min-h-[90vh] flex items-center pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden bg-white">
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        
        {/* Full Bleed Image (Background) */}
        <div className="absolute inset-0 w-full h-full bg-slate-900 overflow-hidden">
          <img 
            src={lp.hero_image_url || item.capa_url || item.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070'} 
            alt="Banner Principal"
            className="w-full h-full object-cover opacity-90"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full min-h-0 lg:min-h-[90vh] flex flex-col py-16 lg:py-32">
            <div className={`w-full max-w-xl flex flex-col ${
              lp.hero_align_h === 'center' ? 'mx-auto text-center items-center' :
              lp.hero_align_h === 'right' ? 'lg:ml-auto text-left lg:text-right items-start lg:items-end' :
              lp.hero_align_h === 'left' ? 'mr-auto text-left items-start' : 'lg:ml-auto text-left items-start'
            } ${
              lp.hero_align_v === 'top' ? 'mb-auto' :
              lp.hero_align_v === 'bottom' ? 'mt-auto' :
              'my-auto'
            }`}>
              {/* Text Content */}
              <div className="space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 flex flex-col w-full" style={{ alignItems: !isMobileScreen ? (lp.hero_align_h === 'center' ? 'center' : lp.hero_align_h === 'right' ? 'flex-end' : 'flex-start') : 'flex-start' }}>

                {/* 1. Mobile Banner Image (Order 1 on mobile) */}
                <div className="order-1 lg:hidden relative animate-in fade-in zoom-in-95 duration-1000 my-2 w-full">
                  <div className="bg-white/80 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 p-1.5 max-w-md mx-auto">
                    <div className="w-full rounded-2xl overflow-hidden">
                      <img 
                        src={lp.hero_image_url || item.capa_url || item.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070'} 
                        alt="Banner Principal"
                        className="w-full h-auto max-h-[360px] object-cover rounded-2xl"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Título (Order 2 on mobile) */}
                <div className="order-2 lg:order-none hero-no-mobile-transform" style={{ transform: (lp.hero_title_offset_x || lp.hero_title_offset_y) ? `translate(${lp.hero_title_offset_x || 0}px, ${lp.hero_title_offset_y || 0}px)` : undefined }}>
                  {(lp.hero_title && (lp.hero_title.startsWith('data:image') || lp.hero_title.startsWith('http')) && !lp.hero_title.includes(' ')) ? (
                    <img src={lp.hero_title} alt={item.nome || "Título"} className="object-contain w-auto mb-4 max-w-full" style={{ height: lp.hero_title_image_height ? `${lp.hero_title_image_height}px` : '120px' }} />
                  ) : (
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.15] tracking-tight drop-shadow-sm typo-title">
                      {lp.hero_title || item.nome}
                    </h1>
                  )}
                </div>

                {/* 3. Botão de Ação / CTA (Order 3 on mobile - logo abaixo do título) */}
                <div className="order-3 lg:order-none flex flex-col sm:flex-row items-center gap-4 pt-2 sm:pt-4 w-full hero-no-mobile-transform" style={{ transform: (lp.hero_cta_offset_x || lp.hero_cta_offset_y) ? `translate(${lp.hero_cta_offset_x || 0}px, ${lp.hero_cta_offset_y || 0}px)` : undefined, justifyContent: !isMobileScreen ? (lp.hero_align_h === 'center' ? 'center' : lp.hero_align_h === 'right' ? 'flex-end' : 'flex-start') : 'flex-start' }}>
                  <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleEnrollClick}
                      className="typo-btn px-6 sm:px-8 py-3.5 sm:py-4 bg-primary text-white rounded-2xl font-bold text-base sm:text-lg hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-primary/20 flex items-center gap-3"
                    >
                      {isEmBreve ? 'Cadastrar-se' : (lp.cta_text || 'Quero Garantir Minha Vaga')}
                    </button>
                    {(lp.instructor?.name || item.professor_nome) && (
                      <span className="text-sm text-primary font-bold font-serif italic typo-text mt-[10px]">
                        By <FormattedTitle content={lp.instructor?.name || item.professor_nome} />
                      </span>
                    )}
                  </div>
                  {/* Real participant count */}
                  {(participantCount !== null ? participantCount : 0) > 0 && (
                    <div className="flex items-center gap-2 text-slate-600 font-bold bg-white/50 px-3 py-1.5 rounded-full backdrop-blur-md">
                      <div className="flex -space-x-2">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 shadow-sm"></div>
                        ))}
                      </div>
                      <span className="text-sm">+{participantCount} aluno{participantCount !== 1 ? 's' : ''} inscrito{participantCount !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                {/* 4. Subtítulo (Order 4 on mobile) */}
                <p className="order-4 lg:order-none text-base sm:text-xl text-slate-700 leading-relaxed max-w-xl font-medium drop-shadow-sm typo-subtitle hero-no-mobile-transform" style={{ transform: (lp.hero_subtitle_offset_x || lp.hero_subtitle_offset_y) ? `translate(${lp.hero_subtitle_offset_x || 0}px, ${lp.hero_subtitle_offset_y || 0}px)` : undefined }}>
                  {lp.hero_subtitle || item.descricao}
                </p>

              </div>
            </div>
          </div>
        </section>

      {/* Info bar */}
      <section className="bg-slate-900 py-10 shadow-xl relative z-10" style={getSectionStyle('info')}>
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="flex flex-col items-center">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Módulos</span>
            <span className="text-2xl font-extrabold text-white">{totalModulos} Módulos</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 font-medium">Aulas</span>
            <span className="text-2xl font-extrabold text-white">{totalAulas} Aulas</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 font-medium">Duração</span>
            <span className="text-2xl font-extrabold text-white">{formatDuration(totalDuracao)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 font-medium">Acesso</span>
            <span className="text-2xl font-extrabold text-white">Vitalício</span>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="sobre" className="py-24 bg-white" style={getSectionStyle('about')}>
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          {/* #7 Configurable about_title */}
          <h2 className="text-4xl font-bold text-slate-900 mb-6 typo-title typo-title-2">
            <FormattedTitle content={lp.about_title || 'Tudo o que você precisa em um só lugar.'} />
          </h2>
          <div className="h-1.5 w-20 bg-primary rounded-full mx-auto mb-6"></div>

          {/* Vídeo Promocional (incorporado na seção Sobre) */}
          {lp.hero_video_url && (
            <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl border border-slate-200 max-w-3xl mx-auto group bg-white my-6">
              {(lp.hero_video_url.includes('youtube.com') || lp.hero_video_url.includes('youtu.be') || lp.hero_video_url.includes('vimeo.com')) ? (
                <ReactPlayer 
                  url={lp.hero_video_url} 
                  width="100%" 
                  height="100%" 
                  playing={false}
                  controls={true}
                  light={lp.hero_image_url || item.thumbnail_url || item.capa_url || true}
                  playIcon={
                    <div className="absolute inset-0 cursor-pointer flex items-center justify-center z-10 group">
                      <div className="absolute inset-0 bg-slate-900/40 group-hover:bg-slate-900/20 transition-colors" />
                      <div className="relative z-20 w-20 h-20 sm:w-24 sm:h-24 bg-white/95 rounded-full flex items-center justify-center shadow-2xl scale-100 group-hover:scale-110 transition-transform duration-300">
                        <svg 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke={lp.section_about_bg_color || '#0f172a'} 
                          strokeWidth="2.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          className="w-9 h-9 sm:w-11 sm:h-11 ml-1.5"
                        >
                          <polygon points="6 3 20 12 6 21 6 3" />
                        </svg>
                      </div>
                    </div>
                  }
                  config={{
                    youtube: {
                      playerVars: { modestbranding: 1, rel: 0, showinfo: 0 }
                    }
                  }}
                />
              ) : (
                <img src={lp.hero_video_url} alt="Vídeo Promocional" className="w-full h-full object-cover" />
              )}
            </div>
          )}

          <div className="text-lg text-slate-600 leading-relaxed text-left">
            <div className="prose max-w-none text-slate-600 typo-body-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {lp.about || item.descricao}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits & Testimonials Section */}
      {(lp.benefits?.length > 0 || lp.testimonials?.length > 0) && (
        <section id="vantagens-depoimentos-light" className="py-24 bg-slate-50" style={getSectionStyle('features')}>
          <div className="max-w-7xl mx-auto px-6">
            <div className={`grid grid-cols-1 ${(lp.benefits?.length > 0 && lp.testimonials?.length > 0) ? 'lg:grid-cols-2 gap-16' : 'gap-16'}`}>
              
              {/* Vantagens */}
              {lp.benefits?.length > 0 && (
                <div className={(lp.benefits?.length > 0 && lp.testimonials?.length > 0) ? '' : 'max-w-4xl mx-auto w-full'}>
                  <h3 className={`font-bold text-slate-900 mb-8 ${(lp.benefits?.length > 0 && lp.testimonials?.length > 0) ? 'text-3xl text-center lg:text-left' : 'text-4xl text-center'}`}>O que você vai dominar</h3>
                  <div className="space-y-4">
                    {(lp.benefits || []).filter(Boolean).map((benefit: any, idx: number) => {
                      const itemObj = typeof benefit === 'object' && benefit !== null ? benefit : { title: typeof benefit === 'string' ? benefit : '', description: '' };
                      return (
                        <div key={idx} className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm text-left">
                          <div className="w-8 h-8 shrink-0 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mt-0.5">
                            <CheckCircle className="w-5 h-5" />
                          </div>
                          <div className="space-y-1 flex-1">
                            <h4 className="font-bold text-slate-800 leading-snug typo-title-3">{itemObj.title}</h4>
                            {itemObj.description && (
                              <p className="text-slate-500 text-sm leading-relaxed typo-body-3">{itemObj.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Depoimentos */}
              {lp.testimonials?.length > 0 && (
                <div className={(lp.benefits?.length > 0 && lp.testimonials?.length > 0) ? '' : 'max-w-4xl mx-auto w-full'}>
                  <div className="text-center mb-10">
                    <h3 className={`font-bold text-slate-900 mb-4 ${(lp.benefits?.length > 0 && lp.testimonials?.length > 0) ? 'text-3xl' : 'text-4xl md:text-5xl'}`}>O que dizem nossos alunos</h3>
                    <div className="flex items-center justify-center gap-1 text-amber-500">
                      {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-current" />)}
                      <span className="ml-2 text-slate-900 font-bold">4.9/5 de satisfação</span>
                    </div>
                  </div>
                  <TestimonialsCarousel testimonials={lp.testimonials} layout={layout} primaryColor={lp.primary_color} lp={lp} />
                </div>
              )}

            </div>
          </div>
        </section>
      )}

      <TargetAudienceSection targetAudience={lp.target_audience} layout={layout} />

      {/* Additional CTA below Target Audience Section */}
      <section className={`py-16 ${
        layout === 'escuro' ? 'bg-slate-950/40' : 'bg-slate-50'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-center gap-12 md:gap-16">
          {!isFree ? renderPriceBlock(layout === 'escuro') : (
            <div className="text-left">
              <span className="text-emerald-500 font-black text-3xl uppercase">Grátis</span>
              <p className={`text-sm ${layout === 'escuro' ? 'text-slate-400' : 'text-slate-500'} mt-1`}>Garanta sua inscrição gratuita agora mesmo.</p>
            </div>
          )}
          <button 
            onClick={handleEnrollClick}
            className="typo-btn px-8 py-4 bg-primary text-white rounded-2xl font-bold text-lg hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-primary/20 flex items-center gap-3"
          >
            {isEmBreve ? 'Cadastrar-se' : (lp.cta_text || 'COMPRAR AGORA')} <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </section>

      {/* Bonus Section */}
      {lp.bonuses?.length > 0 && (
        <section className="py-24 bg-emerald-900 text-white overflow-hidden relative" style={getSectionStyle('features')}>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center mb-16 space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 rounded-full text-xs font-black uppercase tracking-widest text-emerald-300 border border-emerald-700">
                Oportunidade Única
              </div>
              <h2 className="text-4xl md:text-5xl font-bold typo-title">Bônus Exclusivos Para Você</h2>
              <p className="text-emerald-200/70 text-lg">Inscreva-se hoje e leve gratuitamente estes materiais complementares.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {lp.bonuses.map((bonus: any, idx: number) => (
                <div key={idx} className="bg-emerald-800/50 backdrop-blur-sm p-8 rounded-3xl border border-emerald-700/50 hover:border-emerald-500 transition-all group">
                   <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                     <Gift className="w-7 h-7 text-white" />
                   </div>
                   <h4 className="text-xl font-bold mb-3 typo-title">{bonus.title}</h4>
                   {/* #6 Bonus value field */}
                   {bonus.value && (
                     <div className="mb-3 flex items-center gap-2">
                       <span className="text-emerald-300 text-xs font-bold uppercase tracking-wider">Valor:</span>
                       <span className="text-white/40 line-through text-sm">R$ {bonus.value}</span>
                       <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Grátis</span>
                     </div>
                   )}
                   <p className="text-emerald-100/70 leading-relaxed">{bonus.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Instructor Section */}
      <section id="instrutor" className="py-24 bg-white" style={getSectionStyle('instructor')}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-slate-50 rounded-[40px] p-8 md:p-16 flex flex-col md:flex-row gap-12 items-center">
            <div className="w-48 h-48 md:w-64 md:h-64 rounded-[32px] overflow-hidden rotate-3 shadow-2xl relative group shrink-0">
               <img
                 src={lp.instructor?.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=2070'}
                 alt="Instrutor"
                 className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
               />
               <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            <div className="space-y-6 text-center md:text-left max-w-[672px] w-full">
              <div>
                <span className="text-primary font-bold text-sm uppercase tracking-widest mb-2 block">Conheça seu mentor</span>
                <h2 className="text-4xl font-bold text-slate-900 typo-title"><FormattedTitle content={lp.instructor?.name || 'Professor Especialista'} /></h2>
                {Boolean(lp.instructor?.role?.trim()) && (
                  <p className="text-slate-700 font-medium typo-text">{lp.instructor.role}</p>
                )}
              </div>
              <p className="text-lg text-slate-600 leading-relaxed italic">
                "{lp.instructor?.bio || 'Dedicado a transformar vidas através da educação prática e compartilhamento de experiências reais de mercado.'}"
              </p>
            </div>
          </div>
        </div>
      </section>



      {/* Track Courses Detail */}
      {isTrilha && cursosTrilha.length > 0 && (
        <section className="py-24 bg-white" style={getSectionStyle('curriculum')}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-4xl font-bold text-slate-900 typo-title">{lp.courses_title || 'Cursos inclusos nesta trilha'}</h2>
              <p className="text-slate-700 text-lg max-w-2xl mx-auto typo-text">
                {lp.courses_description || 'Confira os programas que fazem parte desta jornada completa.'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {cursosTrilha.map((c: any, idx: number) => (
                <div key={idx} className="flex flex-col md:flex-row bg-slate-50 rounded-[32px] overflow-hidden border border-slate-100 hover:shadow-xl transition-all group">
                  <div className="w-full md:w-48 h-48 md:h-auto shrink-0 bg-slate-200">
                    <img src={c.capa_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-8 flex flex-col justify-center">
                    <h4 className="text-xl font-bold text-slate-900 mb-2 typo-title">{c.nome}</h4>
                    <p className="text-slate-700 text-sm line-clamp-3 mb-4 typo-text">{c.descricao}</p>
                    <div className="flex items-center gap-4 text-xs font-bold text-primary uppercase">
                       <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {c.carga_horaria}h</span>
                       <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {c.curriculo_json?.length || 0} módulos</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Curriculum Preview / Only for Courses */}
      {!isTrilha && (
        <section className="py-24 bg-white" style={getSectionStyle('curriculum')}>
          <div className="max-w-[768px] mx-auto px-6 text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4 typo-title"><FormattedTitle content={lp.curriculum_title || 'Grade Curricular'} /></h2>
            <p className="text-slate-700 text-lg typo-text">Confira os módulos que preparamos para acelerar seu aprendizado.</p>
          </div>
          
          <div className="max-w-4xl mx-auto px-6 space-y-4">
            {item.curriculo_json?.map((modulo: any, idx: number) => {
              const isExpanded = !!openModules[idx];
              return (
                <div 
                  key={idx} 
                  className="bg-slate-50 rounded-2xl border overflow-hidden shadow-sm text-left transition-all duration-300"
                  style={lp.curriculum_module_color ? { borderColor: lp.curriculum_module_color } : { borderColor: '#f1f5f9' }}
                >
                  {/* Header/Trigger */}
                  <div 
                    onClick={() => toggleModule(idx)}
                    className="p-6 flex items-center gap-6 cursor-pointer hover:bg-slate-100/50 select-none transition-colors"
                  >
                    <div 
                      className={`w-12 h-12 bg-white text-primary rounded-xl flex items-center justify-center font-bold text-xl shrink-0 transition-all shadow-sm ${lp.curriculum_number_style || ''}`}
                      style={lp.curriculum_number_color ? { color: lp.curriculum_number_color } : undefined}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-lg typo-title">{modulo.nome}</h4>
                      <p className="text-sm text-slate-700 typo-text">{modulo.etapas?.length || 0} lições interativas</p>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-300 animate-pulse" />
                    )}
                  </div>

                  {/* Body/Etapas List */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-slate-200/50 bg-white px-8 py-3 divide-y divide-slate-100"
                      >
                        {modulo.etapas && modulo.etapas.length > 0 ? (
                          modulo.etapas.map((etapa: any, sIdx: number) => (
                            <div key={sIdx} className="py-2.5 flex items-center justify-between text-slate-600 hover:text-slate-900 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400 font-mono w-5">{(sIdx + 1).toString().padStart(2, '0')}</span>
                                {etapa.tipo === 'video' ? (
                                  <Play className="w-4 h-4 text-primary fill-primary/5 shrink-0" />
                                ) : etapa.tipo === 'quiz' ? (
                                  <HelpCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                                ) : (
                                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                )}
                                <span className="text-sm font-medium">{etapa.nome}</span>
                              </div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider bg-slate-100 px-2 py-0.5 rounded">
                                {etapa.tipo}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="py-3 text-center text-slate-400 text-xs font-medium">Este módulo não possui etapas cadastradas.</div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* FAQ */}
      {lp.faq?.length > 0 && (
        <section className="py-24 bg-slate-50" style={getSectionStyle('faq')}>
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-4xl font-bold text-slate-900 text-center mb-16 typo-title">Dúvidas Frequentes</h2>
            <div className="space-y-4">
              {lp.faq.map((item: any, idx: number) => {
                const isFaqExpanded = !!openFaqs[idx];
                return item.question && (
                  <div 
                    key={idx} 
                    className="rounded-3xl border border-slate-200 bg-white hover:border-primary/30 transition-colors group overflow-hidden text-left"
                  >
                    {/* Header */}
                    <div 
                      onClick={() => toggleFaq(idx)}
                      className="p-8 flex items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <h4 className="font-bold text-slate-900 text-xl group-hover:text-primary transition-colors typo-title">{item.question}</h4>
                      {isFaqExpanded ? (
                        <ChevronDown className="w-6 h-6 text-primary shrink-0" />
                      ) : (
                        <ChevronRight className="w-6 h-6 text-slate-400 shrink-0" />
                      )}
                    </div>

                    {/* Answer */}
                    <AnimatePresence initial={false}>
                      {isFaqExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-slate-100 bg-slate-50/30 px-8 pb-8 pt-4"
                        >
                          <p className="text-slate-700 leading-relaxed text-lg typo-text">{item.answer}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <TrustAndGuarantee layout={layout} guaranteeDays={lp.guarantee_days || 7} />

      {/* Final CTA */}
      <section className="py-24 bg-white" style={getSectionStyle('pricing')}>
         <div className="max-w-7xl mx-auto px-6">
            <div className="bg-slate-900 rounded-[60px] p-12 md:p-24 text-center text-white relative overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.2)]">
               <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-primary rounded-full blur-[140px] opacity-20"></div>
               <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-indigo-50 rounded-full blur-[100px] opacity-10"></div>
               <div className="relative z-10 max-w-2xl mx-auto space-y-10">
                  <h2 className="text-5xl md:text-7xl font-bold leading-tight tracking-tighter typo-title">Não perca mais tempo. <br/> Comece agora.</h2>
                  <p className="text-xl text-slate-700 font-medium typo-subtitle">Junte-se a centenas de outros alunos e leve seu conhecimento para o próximo nível com suporte total.</p>
                  <div className="flex flex-col items-center gap-8">
                    <button 
                      onClick={handleEnrollClick}
                      className="typo-btn w-full sm:w-auto px-16 py-7 bg-primary text-white rounded-2xl font-black text-2xl hover:opacity-90 shadow-2xl shadow-primary/40 active:scale-95 transition-all"
                    >
                      {lp.cta_text || 'Matricule-se Agora'}
                    </button>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <p className="text-sm text-slate-700 flex items-center gap-2 font-bold uppercase tracking-widest typo-text">
                         <CheckCircle className="w-5 h-5 text-emerald-400" /> Garantia de {lp.guarantee_days || 7} dias
                      </p>
                      <div className="hidden md:block w-px h-4 bg-slate-700"></div>
                      <p className="text-sm text-slate-700 flex items-center gap-2 font-bold uppercase tracking-widest typo-text">
                         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Pago em ambiente seguro
                      </p>
                    </div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      <Footer layout={layout} item={item} lp={lp} />
      <WhatsAppFloatingButton item={item} lp={lp} />
      <ModalErrorBoundary>
        <EnrollmentModal 
          isOpen={showEnrollModal}
          onClose={() => setShowEnrollModal(false)}
          enrollStep={enrollStep}
          isFree={isFree}
          enrollData={enrollData}
          onEnrollDataChange={setEnrollData}
          isProcessing={isProcessing}
          onRegister={processRegistration}
          isTrilha={!!isTrilha}
          itemName={item.nome}
        />
        <PaymentModal 
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          participantId={participantId!}
          item={{
            id: item.id,
            description: item.nome,
            amount: finalPrice,
            type: isTrilha ? 'trilha' : 'curso',
            paymentModel,
            paymentCycle,
            paymentInstallmentsLimit
          }}
          customer={{
            name: enrollData.nome,
            email: enrollData.email,
            cpf: enrollData.cpf
          }}
          organizacaoId={item.organizacao_id}
          planId={selectedPlanId || undefined}
        />
      </ModalErrorBoundary>
      <LeadModalPortal
        show={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        onSubmit={handleLeadSubmit}
        leadData={leadData}
        setLeadData={setLeadData}
        isSubmitting={isSubmittingLead}
        leadSuccess={leadSuccess}
        itemNome={item?.nome}
      />
    </div>
  );
};

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

interface PublicCoursePageProps {
  courseId: string;
  isTrilha?: boolean;
}

interface NavProps {
  layout: string;
  item: any;
  lp: any;
  onEnrollClick: () => void;
}

const Nav = ({ layout, item, lp, onEnrollClick }: NavProps) => {
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [orgSlug, setOrgSlug] = React.useState('');
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setLoggedIn(true);
        // Try to get org slug from item
        setOrgSlug(item?.organizacoes?.slug || '');
      }
    });
  }, [item]);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b transition-all ${
      layout === 'escuro' ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-100'
    }`}>
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {item.organizacoes?.logo_url ? (
            <img src={item.organizacoes.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
          ) : (
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-lg tracking-tighter uppercase">
              {item.organizacoes?.nome?.[0] || 'S'}
            </div>
          )}
          <span className={`font-black text-xl tracking-tight hidden sm:block ${layout === 'escuro' ? 'text-white' : 'text-slate-900'}`}>
            {item.organizacoes?.nome || 'Academia Digital'}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-8">
            <a href="#sobre" className={`font-bold text-sm hover:text-primary transition-colors ${layout === 'escuro' ? 'text-slate-400' : 'text-slate-500'}`}>Sobre</a>
            <a href="#curriculo" className={`font-bold text-sm hover:text-primary transition-colors ${layout === 'escuro' ? 'text-slate-400' : 'text-slate-500'}`}>Conteúdo</a>
            <a href="#instrutor" className={`font-bold text-sm hover:text-primary transition-colors ${layout === 'escuro' ? 'text-slate-400' : 'text-slate-500'}`}>Instrutor</a>
          </div>
          {/* #9 Smart redirect: if logged in go to dashboard, else to login */}
          <a
            href={loggedIn && orgSlug ? `/projeto/${orgSlug}` : '/login'}
            className={`font-bold text-sm transition-all ${layout === 'escuro' ? 'text-white hover:text-primary' : 'text-slate-900 hover:text-primary'}`}
          >
            {loggedIn ? 'Minha Área' : 'Acessar curso'}
          </a>
          <button
            onClick={onEnrollClick}
            className="px-6 py-2.5 bg-primary text-white rounded-full font-bold text-sm hover:opacity-90 shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            {lp.cta_text || 'Inscrever-se Agora'}
          </button>
        </div>
      </div>
    </nav>
  );
};

interface FooterProps {
  layout: string;
  item: any;
}

const Footer = ({ layout, item }: FooterProps) => (
  <footer className={`py-16 border-t ${layout === 'escuro' ? 'bg-slate-950 border-slate-900 text-slate-400' : 'bg-white border-slate-100 text-slate-400'}`}>
    <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
      <div className="flex flex-col items-center md:items-start gap-4">
        <div className="flex items-center gap-3">
          {item.organizacoes?.logo_url ? (
            <img src={item.organizacoes.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
          ) : (
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-lg tracking-tighter uppercase">
              {item.organizacoes?.nome?.[0] || 'S'}
            </div>
          )}
          <span className={`font-black text-xl ${layout === 'escuro' ? 'text-white' : 'text-slate-900'}`}>
            {item.organizacoes?.nome || 'Segunda Gaveta'}
          </span>
        </div>
        <p className="text-sm max-w-xs text-center md:text-left">Excelência em educação digital e desenvolvimento profissional.</p>
      </div>
      <div className="flex flex-col items-center md:items-end gap-6">
         <div className="flex items-center gap-8">
            <a href="#" className="hover:text-primary font-bold text-sm transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-primary font-bold text-sm transition-colors">Privacidade</a>
            <a href="#" className="hover:text-primary font-bold text-sm transition-colors">Suporte</a>
         </div>
         <p className="text-xs font-medium">© 2026 {item.organizacoes?.nome}. Todos os direitos reservados.</p>
      </div>
    </div>
  </footer>
);

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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
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
                <h2 className="text-3xl font-bold text-slate-900">
                  {isFree ? 'Inscrição Gratuita' : 'Área de Inscrição'}
                </h2>
                <p className="text-slate-500">
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
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-primary focus:bg-white transition-all"
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
                    className={`w-full pl-12 pr-4 py-4 bg-slate-50 border rounded-2xl outline-none focus:bg-white transition-all ${
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
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-primary focus:bg-white transition-all"
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
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-primary focus:bg-white transition-all"
                    />
                  </div>
                )}
              </div>

              <button
                disabled={isProcessing || !enrollData.nome.trim() || !enrollData.email || !!emailError}
                onClick={handleSubmit}
                className="w-full py-5 bg-primary text-white rounded-2xl font-bold text-lg hover:opacity-90 shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <h2 className="text-3xl font-bold text-slate-900">Inscrição Confirmada!</h2>
                <p className="text-slate-600 leading-relaxed">
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

const TestimonialsCarousel = ({ testimonials, layout, primaryColor }: { testimonials: any[], layout: string, primaryColor: string }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex(prev => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto px-4 group">
      {/* Testimonials Track */}
      <div className="overflow-hidden py-6">
        <div 
          className="flex transition-transform duration-500 ease-out gap-6"
          style={{ transform: `translateX(calc(-${currentIndex * 100}% - ${currentIndex * 24}px))` }}
        >
          {testimonials.map((t: any, idx: number) => (
            <div 
              key={idx} 
              className={`w-full shrink-0 p-8 md:p-10 rounded-[32px] border relative transition-all duration-500 ${
                layout === 'escuro' 
                  ? 'bg-slate-800/40 border-slate-700 hover:border-primary/50 shadow-[0_0_15px_rgba(0,0,0,0.2)]' 
                  : 'bg-white border-slate-150/60 shadow-[0_15px_35px_rgba(0,0,0,0.02)]'
              }`}
              style={{ 
                width: '100%',
                boxShadow: idx === currentIndex ? `0 0 30px rgba(var(--primary-rgb, 37, 99, 235), 0.2)` : undefined
              }}
            >
              <Quote className={`absolute top-6 right-8 w-16 h-16 ${layout === 'escuro' ? 'text-slate-800/20' : 'text-slate-100'} pointer-events-none`} />
              <div className="relative z-10 space-y-6 text-left">
                <div className="flex items-center gap-1 text-amber-500">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-current" />)}
                </div>
                <p className={`text-lg md:text-xl leading-relaxed font-semibold italic ${layout === 'escuro' ? 'text-slate-200' : 'text-slate-700'}`}>
                  "{t.text}"
                </p>
                <div className="flex items-center gap-4 pt-4 border-t border-slate-500/10">
                  <div className={`w-14 h-14 rounded-full overflow-hidden bg-slate-100 border-2 ${layout === 'escuro' ? 'border-slate-700' : 'border-slate-100'}`}>
                    {t.photo_url ? (
                      <img src={t.photo_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary uppercase font-black text-xl">{t.name?.[0]}</div>
                    )}
                  </div>
                  <div>
                    <h4 className={`font-bold text-lg ${layout === 'escuro' ? 'text-white' : 'text-slate-900'}`}>{t.name}</h4>
                    <span className="text-xs text-primary font-bold uppercase tracking-wider">{t.role || 'Estudante'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      {testimonials.length > 1 && (
        <>
          <button 
            onClick={handlePrev}
            className={`absolute left-0 md:-left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center shadow-lg border transition-all hover:scale-110 active:scale-95 z-20 cursor-pointer ${
              layout === 'escuro' 
                ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:border-primary' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-primary'
            }`}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button 
            onClick={handleNext}
            className={`absolute right-0 md:-right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center shadow-lg border transition-all hover:scale-110 active:scale-95 z-20 cursor-pointer ${
              layout === 'escuro' 
                ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:border-primary' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-primary'
            }`}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Indicators/Dots */}
      {testimonials.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {testimonials.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentIndex 
                  ? 'w-8 bg-primary' 
                  : `w-2.5 ${layout === 'escuro' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-350'}`
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TrustAndGuarantee = ({ layout, guaranteeDays }: { layout: string, guaranteeDays: number }) => {
  return (
    <section className={`py-20 border-t ${
      layout === 'escuro' 
        ? 'bg-slate-950/60 border-slate-850 text-slate-300' 
        : 'bg-slate-50 border-slate-100 text-slate-600'
    }`}>
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

const CountdownTimer = ({ timeLeft, title, layout }: { timeLeft: { hours: number, minutes: number, seconds: number } | null, title?: string, layout: string }) => {
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
      <div className="flex gap-3 text-center">
        {/* Hours */}
        <div className="flex flex-col">
          <div className={`w-14 py-3 rounded-2xl text-2xl font-black ${
            layout === 'escuro' ? 'bg-slate-900 text-white border border-slate-800' : 'bg-slate-50 text-slate-900 border border-slate-100'
          }`}>
            {pad(timeLeft.hours)}
          </div>
          <span className="text-[9px] font-black text-slate-500 mt-1 uppercase tracking-wider">Horas</span>
        </div>
        
        <span className={`text-2xl font-black mt-2 ${layout === 'escuro' ? 'text-slate-700' : 'text-slate-300'}`}>:</span>

        {/* Minutes */}
        <div className="flex flex-col">
          <div className={`w-14 py-3 rounded-2xl text-2xl font-black ${
            layout === 'escuro' ? 'bg-slate-900 text-white border border-slate-800' : 'bg-slate-50 text-slate-900 border border-slate-100'
          }`}>
            {pad(timeLeft.minutes)}
          </div>
          <span className="text-[9px] font-black text-slate-500 mt-1 uppercase tracking-wider">Minutos</span>
        </div>

        <span className={`text-2xl font-black mt-2 ${layout === 'escuro' ? 'text-slate-700' : 'text-slate-300'}`}>:</span>

        {/* Seconds */}
        <div className="flex flex-col">
          <div className={`w-14 py-3 rounded-2xl text-2xl font-black ${
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

const TargetAudienceSection = ({ targetAudience, layout }: { targetAudience: string, layout: string }) => {
  if (!targetAudience) return null;

  const items = targetAudience
    .split(/[,;\n]+/)
    .map(item => item.trim())
    .filter(Boolean);

  if (items.length === 0) return null;

  return (
    <section className={`py-24 border-b ${
      layout === 'escuro' ? 'bg-slate-950/60 border-slate-900' : 'bg-slate-50 border-slate-100'
    }`}>
      <div className="max-w-7xl mx-auto px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-4 mb-16">
          <span className="text-primary font-bold text-xs uppercase tracking-widest block">Público-Alvo</span>
          <h2 className={`text-4xl font-bold tracking-tight ${layout === 'escuro' ? 'text-white' : 'text-slate-900'}`}>
            Para quem é este curso?
          </h2>
          <p className={layout === 'escuro' ? 'text-slate-400 text-lg' : 'text-slate-500 text-lg'}>
            Descubra se este programa de treinamento é a escolha certa para seus objetivos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((item, idx) => (
            <div 
              key={idx} 
              className={`p-8 rounded-[32px] border relative transition-all duration-300 hover:scale-[1.02] text-left group ${
                layout === 'escuro' 
                  ? 'bg-slate-900/30 border-slate-800 hover:border-primary/45 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.15)]' 
                  : 'bg-white/80 border-slate-200/60 shadow-[0_10px_30px_rgba(0,0,0,0.01)] hover:border-primary/25 backdrop-blur-md'
              }`}
            >
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-2xl flex items-center justify-center font-bold text-sm mb-6 group-hover:scale-110 transition-transform">
                {idx + 1}
              </div>
              <p className={`font-bold text-lg leading-relaxed ${
                layout === 'escuro' ? 'text-slate-200' : 'text-slate-800'
              }`}>
                {item}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const WhatsAppFloatingButton = ({ item }: { item: any }) => {
  const org = item?.organizacoes;
  const rawPhone = org?.config_json?.suporte_telefone || org?.config_json?.suporte_whatsapp || '';
  
  if (!rawPhone) return null;

  const cleanPhone = rawPhone.replace(/\D/g, '');
  if (!cleanPhone) return null;

  const waUrl = `https://wa.me/55${cleanPhone}?text=Olá! Estou na página de vendas do curso *${encodeURIComponent(item.nome)}* e gostaria de tirar algumas dúvidas.`;

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
  const [showEnrollModal, setShowEnrollModal] = useState(false);
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

  const [timeLeft, setTimeLeft] = useState<{ hours: number, minutes: number, seconds: number } | null>(null);
  const lpRaw = item?.configuracao_json?.lp;
  const lp = {
    enabled: true,
    hero_title: item?.nome || '',
    hero_subtitle: item?.descricao || '',
    cta_text: 'Matricule-se Agora',
    primary_color: '#2563eb',
    layout_tipo: 'claro',
    benefits: [],
    testimonials: [],
    bonuses: [],
    faq: [],
    guarantee_days: 7,
    instructor: { name: item?.professor_nome || '', bio: '', avatar_url: item?.professor_foto_url || '', role: 'Instrutor(a)' },
    ...(lpRaw || {})
  };

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
        hours: Math.floor(difference / (1000 * 60 * 60)),
        minutes: Math.floor((difference / 1000 / 60) % 65 % 60),
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
    const title = lp.hero_title || item.nome || 'Curso Online';
    const description = lp.hero_subtitle || item.descricao || '';
    const image = item.thumbnail_url || item.capa_url || '';
    document.title = title;
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
  const discountedPrice = !selectedPlan && !isTrilha && config.valor_com_desconto ? parseFloat(config.valor_com_desconto) : null;
  const itemPrice = selectedPlan ? (selectedPlan.valor_cents / 100) : (isTrilha ? (item?.preco || 0) : (parseFloat(item?.valor) || 0));
  const finalPrice = discountedPrice !== null ? discountedPrice : itemPrice;

  const paymentModel = config.pagamento_modelo || 'fixo';
  const paymentCycle = config.pagamento_ciclo || '30';
  const paymentInstallmentsLimit = config.pagamento_parcelas_limite || '12';

  const renderPriceBlock = (isDarkLayout: boolean) => {
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

        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-black ${isDarkLayout ? 'text-white' : 'text-slate-900'}`}>10x</span>
          <span className={`text-xl font-bold ${isDarkLayout ? 'text-white' : 'text-slate-900'}`}>R$</span>
          <span className={`text-6xl font-black ${isDarkLayout ? 'text-white' : 'text-slate-900'}`}>{installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className={`text-xs font-bold ${isDarkLayout ? 'text-emerald-400' : 'text-emerald-600'} uppercase tracking-wider ml-1`}>sem juros</span>
        </div>
        <div className={`text-sm ${isDarkLayout ? 'text-slate-400' : 'text-slate-500'} mt-1 font-semibold`}>
          ou R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} à vista
        </div>
      </div>
    );
  };

  const handleEnrollClick = () => {
    if (isFree) {
      setEnrollMode('free');
      setEnrollStep('data');
    } else {
      setEnrollMode('paid');
      setEnrollStep('data');
    }
    setShowEnrollModal(true);
  };

  const processRegistration = async () => {
    setIsProcessing(true);
    try {
      // 1. Verificar se usuário já existe ou criar novo
      // Simplificado: Usar RPC ou lógica de inserção direta se configurado
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

        // Se o erro for que o usuário já existe, tentar pegar o ID dele se possível (via signIn ou similar)
        // Mas o mais provável é que o perfil na tabela 'usuarios' esteja faltando
        if (authErr) {
          if (authErr.message.includes('already registered')) {
             // Tentar ver se conseguimos o ID de outra forma ou pedir login
             // Por agora, vamos assumir que se chegou aqui e não está na 'usuarios', vamos tentar cadastrá-lo
             // Nota: signUp em usuário existente no Supabase pode retornar sucesso mas sem user.id em algumas configs
             if (!authData.user?.id) {
                throw new Error("Este e-mail já está cadastrado. Por favor, faça login primeiro.");
             }
          } else {
            throw authErr;
          }
        }
        
        userId = authData.user?.id;
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

      // 1.1 Verificar se já está inscrito
      const table = isTrilha ? 'trilha_participantes' : 'curso_participantes';
      const idField = isTrilha ? 'trilha_id' : 'curso_id';

      const { data: existingParticipation } = await supabase
        .from(table)
        .select('id, status')
        .eq(idField, item.id)
        .eq('usuario_id', userId)
        .maybeSingle();

      if (existingParticipation && existingParticipation.status === 'inscrito') {
         setParticipantId(existingParticipation.id);
         setEnrollStep('success');
         setIsProcessing(false);
         return;
      }

      // 2. Criar registro de participante como 'pendente' ou 'inscrito'
      const { data: participant, error: partErr } = await supabase
        .from(table)
        .upsert({
          [idField]: item.id,
          usuario_id: userId,
          status: isFree ? 'inscrito' : 'pendente',
          progresso: 0
        })
        .select()
        .single();

      if (partErr) throw partErr;
      setParticipantId(participant.id);

      if (isFree) {
        setEnrollStep('success');
      } else {
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
        <p className="text-slate-500 font-medium">Preparando sua experiência...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <X className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Ops! Algo deu errado.</h2>
        <p className="text-slate-500 max-w-md">{error || 'Não foi possível encontrar este conteúdo público.'}</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-primary text-white rounded-full font-bold">Tentar novamente</button>
      </div>
    );
  }

  // Only block if the admin has EXPLICITLY set enabled to false (not just absent)
  if (lpRaw && lpRaw.enabled === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Página em manutenção</h1>
          <p className="text-slate-600 mb-6">Esta página de vendas está temporariamente desativada pelo instrutor.</p>
          <a href="/" className="inline-block px-8 py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-all">
            Voltar
          </a>
        </div>
      </div>
    );
  }
  const layout = lp.layout_tipo || 'claro';

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '37, 99, 235';
  };
  const primaryRgb = hexToRgb(lp.primary_color || '#2563eb');

  if (layout === 'escuro') {
    return (
      <div className="min-h-screen bg-slate-900 selection:bg-primary/30 selection:text-white font-sans text-slate-300">
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
          .selection\:bg-primary\/30 *::selection { background-color: rgba(var(--primary-rgb), 0.3); }
          .selection\:bg-primary\/30 ::selection { background-color: rgba(var(--primary-rgb), 0.3); }
          .selection\:text-white *::selection { color: white; }
          .selection\:text-white ::selection { color: white; }
        ` }} />
        
        <Nav
          layout={layout}
          item={item}
          lp={lp}
          onEnrollClick={handleEnrollClick}
        />

        {/* #2 Sticky CTA bar for mobile */}
        {showStickyCTA && (
          <div className="fixed bottom-0 left-0 right-0 z-[80] md:hidden bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-4 py-3 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300">
            <div className="text-left">
              {isFree ? (
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
              <div className="text-slate-500 text-[10px] font-medium">{lp.guarantee_days || 7} dias de garantia</div>
            </div>
            <button
              onClick={handleEnrollClick}
              className="flex-1 max-w-[200px] py-3 bg-primary text-white rounded-2xl font-black text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30"
            >
              {lp.cta_text || 'GARANTIR VAGA'}
            </button>
          </div>
        )}

        {/* Dark Hero Section - Modern arranged layout */}
        <section ref={heroRef} className="relative pt-32 pb-20 md:pt-48 md:pb-40 overflow-hidden bg-slate-900 text-left">
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-10 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] animate-pulse"></div>
          </div>
          
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Image/Video First in Dark Layout */}
              <div className="relative order-2 lg:order-1 animate-in fade-in zoom-in-95 duration-1000">
                <div className="aspect-video bg-slate-950 rounded-[40px] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-slate-800 p-2">
                  <div className="w-full h-full rounded-[32px] overflow-hidden">
                    {lp.hero_video_url ? (
                      <div className="w-full h-full relative group">
                        <ReactPlayer 
                          url={lp.hero_video_url} 
                          width="100%" 
                          height="100%" 
                          playing={true}
                          controls={false}
                          light={item.thumbnail_url || item.capa_url || true}
                          playIcon={
                            <div className="absolute inset-0 cursor-pointer flex items-center justify-center z-10 group">
                              <div className="absolute inset-0 bg-slate-900/40 group-hover:bg-slate-900/20 transition-colors" />
                              <div className="relative z-20 w-24 h-24 bg-primary rounded-full flex items-center justify-center text-white shadow-2xl scale-110 group-hover:scale-125 transition-transform duration-500">
                                <Play className="w-10 h-10 fill-current" />
                              </div>
                            </div>
                          }
                          config={{
                            youtube: {
                              playerVars: {
                                modestbranding: 1,
                                rel: 0,
                                iv_load_policy: 3,
                                showinfo: 0,
                                cc_load_policy: 0,
                                controls: 0,
                                fs: 0,
                              }
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <img 
                        src={item.capa_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070'} 
                        alt="Capa"
                        className="w-full h-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all"
                      />
                    )}
                  </div>
                </div>

              </div>

              <div className="space-y-10 order-1 lg:order-2 animate-in fade-in slide-in-from-right-12 duration-1000 text-left">
                <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-slate-800 border border-slate-700 rounded-full">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Inscrições Abertas</span>
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
                  {lp.hero_title || item.nome}
                </h1>
                
                <p className="text-xl text-slate-400 leading-relaxed max-w-xl">
                  {lp.hero_subtitle || item.descricao}
                </p>

                <CountdownTimer timeLeft={timeLeft} title={lp.countdown_title} layout={layout} />

                <div className="flex flex-col sm:flex-row items-center gap-8 pt-4">
                  <button 
                    onClick={handleEnrollClick}
                    className="w-full sm:w-auto px-12 py-6 bg-primary text-white rounded-3xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(37,99,235,0.3)] flex items-center justify-center gap-3"
                  >
                    {lp.cta_text || 'COMPRAR AGORA'} <ArrowRight className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Modern Dark Info Bar */}
        <section className="bg-slate-950/50 border-y border-slate-800 py-16">
          <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 w-full">
              {/* #3 Conditional stats based on real data */}
              {[
                { icon: BookOpen, label: isTrilha ? 'Cursos' : 'Módulos', value: `${isTrilha ? cursosTrilha.length : (item.curriculo_json?.length || 0)} ${isTrilha ? 'cursos' : 'aulas'}` },
                { icon: Clock, label: 'Duração', value: `${item.carga_horaria || '--'} Horas` },
                { icon: Calendar, label: 'Acesso', value: item.tempo === 'com_limite' ? `${item.duracao || ''} ${item.duracao_tipo || 'meses'}` : 'Vitalício' },
                ...(item.tem_certificado ? [{ icon: Award, label: 'Certificado', value: 'Incluso' }] : [])
              ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center md:items-start text-center md:text-left gap-2 group">
                  <stat.icon className="w-8 h-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{stat.label}</span>
                  <span className="text-xl font-bold text-white tracking-tight">{stat.value}</span>
                </div>
              ))}
            </div>

            {/* Price and CTA Button */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-16 w-full border-t border-slate-850 pt-8 mt-4">
              {renderPriceBlock(true)}
              <button 
                onClick={handleEnrollClick}
                className="w-full sm:w-auto px-12 py-5 bg-primary text-white rounded-3xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(37,99,235,0.3)] flex items-center justify-center gap-3"
              >
                {lp.cta_text || 'COMPRAR AGORA'} <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </section>

        {/* About Section - Dark */}
        <section id="sobre" className="py-32 bg-slate-900 border-b border-slate-800">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="w-16 h-1 bg-primary rounded-full mx-auto mb-8"></div>
            {/* #7 Configurable about_title */}
            <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-8">{lp.about_title || 'Prepare-se para uma experiência de aprendizado sem precedentes.'}</h2>
            <div className="text-lg text-slate-400 leading-relaxed text-left">
              <div className="prose prose-invert max-w-none text-slate-400">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {lp.about || item.descricao}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits & Testimonials Section - Dark */}
        {(lp.benefits?.length > 0 || lp.testimonials?.length > 0) && (
          <section id="vantagens-depoimentos" className="py-32 bg-slate-900/50 border-b border-slate-800">
            <div className="max-w-7xl mx-auto px-6">
              <div className={`grid grid-cols-1 ${(lp.benefits?.length > 0 && lp.testimonials?.length > 0) ? 'lg:grid-cols-2 gap-16' : 'gap-16'}`}>
                
                {/* Vantagens */}
                {lp.benefits?.length > 0 && (
                  <div className={(lp.benefits?.length > 0 && lp.testimonials?.length > 0) ? '' : 'max-w-4xl mx-auto w-full'}>
                    <h3 className={`font-bold text-white mb-10 ${(lp.benefits?.length > 0 && lp.testimonials?.length > 0) ? 'text-3xl text-center lg:text-left' : 'text-4xl text-center'}`}>O que você vai dominar</h3>
                    <div className={`grid grid-cols-1 ${(!lp.testimonials || lp.testimonials.length === 0) ? 'sm:grid-cols-2' : 'sm:grid-cols-1 xl:grid-cols-2'} gap-6`}>
                      {(lp.benefits || []).filter(Boolean).map((benefit: string, idx: number) => (
                        <div key={idx} className="bg-slate-800/40 p-8 rounded-[32px] border border-slate-700 hover:border-primary/50 transition-colors group text-left">
                           <div className="w-10 h-10 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                             <CheckCircle className="w-5 h-5" />
                           </div>
                           <p className="font-bold text-white text-lg leading-tight group-hover:text-primary transition-colors">{benefit}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Depoimentos */}
                {lp.testimonials?.length > 0 && (
                  <div className={(lp.benefits?.length > 0 && lp.testimonials?.length > 0) ? '' : 'max-w-4xl mx-auto w-full'}>
                    <div className="text-center mb-10">
                      <h3 className={`font-bold text-white mb-4 tracking-tight ${(lp.benefits?.length > 0 && lp.testimonials?.length > 0) ? 'text-3xl' : 'text-4xl md:text-5xl'}`}>O que dizem nossos alunos</h3>
                      <div className="flex items-center justify-center gap-1 text-amber-500">
                        {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-current" />)}
                        <span className="ml-2 text-slate-300 font-bold">4.9/5 de satisfação</span>
                      </div>
                    </div>
                    <TestimonialsCarousel testimonials={lp.testimonials} layout={layout} primaryColor={lp.primary_color} />
                  </div>
                )}

              </div>
            </div>
          </section>
        )}

        <TargetAudienceSection targetAudience={lp.target_audience} layout={layout} />

        {/* Additional CTA below Target Audience Section */}
        <section className={`py-16 border-b ${
          layout === 'escuro' ? 'bg-slate-950/40 border-slate-900' : 'bg-slate-50 border-slate-100'
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
              className="w-full sm:w-auto px-12 py-5 bg-primary text-white rounded-3xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(37,99,235,0.3)] flex items-center justify-center gap-3"
            >
              {lp.cta_text || 'COMPRAR AGORA'} <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </section>

        {/* Bonus Section - Dark */}
        {lp.bonuses?.length > 0 && (
          <section className="py-32 bg-emerald-950/40 text-white overflow-hidden relative border-t border-slate-800">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
            <div className="max-w-7xl mx-auto px-6 relative z-10">
              <div className="text-center mb-16 space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full text-xs font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/20">
                  Oportunidade Única
                </div>
                <h2 className="text-4xl md:text-5xl font-bold">Bônus Exclusivos Para Você</h2>
                <p className="text-slate-400 text-lg">Inscreva-se hoje e leve gratuitamente estes materiais complementares.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {lp.bonuses.map((bonus: any, idx: number) => (
                  <div key={idx} className="bg-slate-900/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-800 hover:border-emerald-500/50 transition-all group">
                     <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                       <Gift className="w-7 h-7 text-emerald-400" />
                     </div>
                     <h4 className="text-xl font-bold mb-3">{bonus.title}</h4>
                     {bonus.value && (
                       <div className="mb-3 flex items-center gap-2">
                         <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Valor:</span>
                         <span className="text-slate-500 line-through text-sm">R$ {bonus.value}</span>
                         <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Grátis</span>
                       </div>
                     )}
                     <p className="text-slate-400 leading-relaxed">{bonus.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Instructor - Dark */}
        <section id="instrutor" className="py-32 bg-slate-950">
           <div className="max-w-7xl mx-auto px-6">
              <div className="flex flex-col lg:flex-row gap-20 items-center justify-center">
                 <div className="w-64 h-64 md:w-80 md:h-80 relative shrink-0">
                    <div className="absolute inset-0 bg-primary/20 rounded-[64px] rotate-6 border border-primary/20"></div>
                    <img 
                      src={lp.instructor?.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=2070'} 
                      alt="Instrutor" 
                      className="w-full h-full object-cover rounded-[64px] absolute inset-0 shadow-2xl"
                    />
                 </div>
                 <div className="max-w-xl text-center lg:text-left space-y-8">
                    <div className="text-left">
                       <span className="text-primary font-bold text-sm tracking-widest uppercase block mb-3">Seu instrutor</span>
                       <h2 className="text-4xl md:text-5xl font-bold text-white">{lp.instructor?.name || 'Mestre do Conteúdo'}</h2>
                       <p className="text-lg text-slate-500 font-medium mt-1">{lp.instructor?.role || 'Especialista e Mentor'}</p>
                    </div>
                    <p className="text-xl text-slate-400 italic font-light leading-relaxed text-left">
                      "{lp.instructor?.bio || 'Comprometido em guiar alunos na jornada de transformação profissional através de métodos validados no mercado.'}"
                    </p>
                 </div>
              </div>
           </div>
        </section>


        {/* FAQ - Dark */}
        {lp.faq?.length > 0 && (
          <section className="py-32 bg-slate-900">
             <div className="max-w-4xl mx-auto px-6">
                <h2 className="text-4xl font-bold text-white text-center mb-20 tracking-tight">Perguntas Frequentes</h2>
                <div className="space-y-4">
                   {lp.faq.map((f: any, idx: number) => {
                     const isFaqExpanded = !!openFaqs[idx];
                     return f.question && (
                       <div 
                         key={idx} 
                         className="bg-slate-800/40 rounded-[32px] border border-slate-700/50 hover:bg-slate-800 transition-all text-left overflow-hidden"
                       >
                         {/* Header */}
                         <div 
                           onClick={() => toggleFaq(idx)}
                           className="p-8 flex items-center justify-between gap-4 cursor-pointer select-none"
                         >
                           <h4 className="text-xl font-bold text-white">{f.question}</h4>
                           {isFaqExpanded ? (
                             <ChevronDown className="w-6 h-6 text-primary shrink-0" />
                           ) : (
                             <ChevronRight className="w-6 h-6 text-slate-500 shrink-0" />
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
                               className="border-t border-slate-700/30 bg-slate-850/20 px-8 pb-8 pt-4"
                             >
                               <p className="text-slate-350 leading-relaxed text-lg">{f.answer}</p>
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

      {/* Curriculum Preview / Only for Courses */}
      {!isTrilha && (
        <section id="curriculo" className="py-32 bg-slate-950 border-y border-slate-900">
          <div className="max-w-3xl mx-auto px-6 text-center mb-20">
            <h2 className="text-4xl font-bold text-white mb-4">Grade Curricular</h2>
            <p className="text-slate-400 text-lg">Confira os módulos que preparamos para acelerar seu aprendizado.</p>
          </div>
          
          <div className="max-w-4xl mx-auto px-6 space-y-4">
            {item.curriculo_json?.map((modulo: any, idx: number) => {
              const isExpanded = !!openModules[idx];
              return (
                <div key={idx} className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl text-left transition-all duration-300">
                  {/* Header/Trigger */}
                  <div 
                    onClick={() => toggleModule(idx)}
                    className="p-8 flex items-center gap-6 cursor-pointer hover:bg-slate-800/40 select-none transition-colors"
                  >
                    <div className="w-14 h-14 bg-slate-800 text-primary rounded-2xl flex items-center justify-center font-bold text-2xl shrink-0 transition-all shadow-inner">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-white text-xl">{modulo.nome}</h4>
                      <p className="text-sm text-slate-500 mt-1">{modulo.etapas?.length || 0} lições de alto impacto</p>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-6 h-6 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-6 h-6 text-slate-600 animate-pulse" />
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
                        className="border-t border-slate-800/50 bg-slate-950/20 px-8 py-4 divide-y divide-slate-800/45"
                      >
                        {modulo.etapas && modulo.etapas.length > 0 ? (
                          modulo.etapas.map((etapa: any, sIdx: number) => (
                            <div key={sIdx} className="py-3 flex items-center justify-between text-slate-400 hover:text-white transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-600 font-mono w-5">{(sIdx + 1).toString().padStart(2, '0')}</span>
                                {etapa.tipo === 'video' ? (
                                  <Play className="w-4 h-4 text-primary fill-primary/10 shrink-0" />
                                ) : etapa.tipo === 'quiz' ? (
                                  <HelpCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                                ) : (
                                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                                )}
                                <span className="text-sm font-medium">{etapa.nome}</span>
                              </div>
                              <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider bg-slate-850 px-2.5 py-0.75 rounded border border-slate-800">
                                {etapa.tipo}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="py-4 text-center text-slate-600 text-xs font-medium">Este módulo não possui etapas cadastradas.</div>
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

        <TrustAndGuarantee layout={layout} guaranteeDays={lp.guarantee_days || 7} />

        {/* Final CTA - Space style */}
        <section className="py-40 bg-slate-900 relative overflow-hidden">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[180px]"></div>
           </div>

           <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-12">
              <h2 className="text-5xl md:text-7xl font-bold text-white tracking-tighter leading-tight">Escolha o seu futuro hoje.</h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">Não deixe para depois a oportunidade de se tornar um especialista com quem realmente entende do assunto.</p>
              
              <div className="flex flex-col items-center gap-10">
                <button 
                  onClick={handleEnrollClick}
                  className="w-full sm:w-auto px-20 py-8 bg-white text-slate-900 rounded-[32px] font-black text-2xl hover:scale-110 active:scale-95 transition-all shadow-[0_30px_60px_rgba(255,255,255,0.1)]"
                >
                  {lp.cta_text || 'QUERO MINHA VAGA AGORA'}
                </button>
                <div className="flex flex-col md:flex-row items-center gap-8 text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                   <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Garantia de {lp.guarantee_days || 7} dias</span>
                   <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Pagamento 100% Seguro</span>
                </div>
              </div>
           </div>
        </section>

        <Footer layout={layout} item={item} />
        
        {/* Modals */}
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
            id: courseId,
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
        <WhatsAppFloatingButton item={item} />
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
      ` }} />
      
      <Nav 
        layout={layout} 
        item={item} 
        lp={lp} 
        onEnrollClick={handleEnrollClick} 
      />

            {/* #2 Sticky CTA bar for mobile (light layout) */}
            {showStickyCTA && (
              <div className="fixed bottom-0 left-0 right-0 z-[80] md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300 shadow-2xl">
                <div className="text-left">
                  {isFree ? (
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
                  <div className="text-slate-400 text-[10px] font-medium">{lp.guarantee_days || 7} dias de garantia</div>
                </div>
                <button
                  onClick={handleEnrollClick}
                  className="flex-1 max-w-[200px] py-3 bg-primary text-white rounded-2xl font-black text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                >
                  {lp.cta_text || 'GARANTIR VAGA'}
                </button>
              </div>
            )}

            {/* Hero Section */}
            <section ref={heroRef} className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-bold border border-primary/20">
                <Award className="w-4 h-4" /> Certificação Inclusa
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.15] tracking-tight">
                {lp.hero_title || item.nome}
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed max-w-xl">
                {lp.hero_subtitle || item.descricao}
              </p>
              
              <CountdownTimer timeLeft={timeLeft} title={lp.countdown_title} layout={layout} />
              
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                <button
                  onClick={handleEnrollClick}
                  className="w-full sm:w-auto px-10 py-5 bg-primary text-white rounded-2xl font-bold text-lg hover:opacity-90 shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {lp.cta_text || 'Quero Garantir Minha Vaga'} <ArrowRight className="w-5 h-5" />
                </button>
                {/* #4 Real participant count */}
                {(participantCount !== null ? participantCount : 0) > 0 && (
                  <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <div className="flex -space-x-2">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200"></div>
                      ))}
                    </div>
                    <span className="text-sm">+{participantCount} aluno{participantCount !== 1 ? 's' : ''} inscrito{participantCount !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="relative animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
              <div className="aspect-video bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 relative group">
                {lp.hero_video_url ? (
                  <div className="w-full h-full relative">
                    <ReactPlayer 
                      url={lp.hero_video_url} 
                      width="100%" 
                      height="100%" 
                      playing={true}
                      controls={false}
                      light={item.thumbnail_url || item.capa_url || true}
                      playIcon={
                        <div className="absolute inset-0 cursor-pointer flex items-center justify-center z-10 group">
                          <div className="absolute inset-0 bg-slate-900/40 group-hover:bg-slate-900/20 transition-colors" />
                          <div className="relative z-20 w-24 h-24 bg-primary rounded-full flex items-center justify-center text-white shadow-2xl scale-110 group-hover:scale-125 transition-transform duration-500">
                            <Play className="w-10 h-10 fill-current" />
                          </div>
                        </div>
                      }
                      config={{
                        youtube: {
                          playerVars: {
                            modestbranding: 1,
                            rel: 0,
                            iv_load_policy: 3,
                            showinfo: 0,
                            cc_load_policy: 0,
                            controls: 0,
                            fs: 0,
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <img 
                    src={item.capa_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070'} 
                    alt="Capa"
                    className="w-full h-full object-cover opacity-80"
                  />
                )}
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Info bar */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col items-center gap-8">
          {/* #3 Conditional stats based on real data */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full">
            <div className="flex flex-col items-center text-center">
              <BookOpen className="w-8 h-8 text-primary mb-3" />
              <span className="text-sm font-bold text-slate-400 uppercase">{isTrilha ? 'Cursos' : 'Módulos'}</span>
              <span className="text-lg font-bold text-slate-900">{isTrilha ? cursosTrilha.length : (item.curriculo_json?.length || 0)} {isTrilha ? 'programas' : 'módulos'}</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <Clock className="w-8 h-8 text-primary mb-3" />
              <span className="text-sm font-bold text-slate-400 uppercase">Duração</span>
              <span className="text-lg font-bold text-slate-900">{item.carga_horaria || '--'} h</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <Calendar className="w-8 h-8 text-primary mb-3" />
              <span className="text-sm font-bold text-slate-400 uppercase">Acesso</span>
              <span className="text-lg font-bold text-slate-900 capitalize">
                {item.tempo === 'com_limite' ? `${item.duracao || ''} ${item.duracao_tipo || 'meses'}` : 'Vitalício'}
              </span>
            </div>
            {item.tem_certificado && (
              <div className="flex flex-col items-center text-center">
                <Award className="w-8 h-8 text-primary mb-3" />
                <span className="text-sm font-bold text-slate-400 uppercase">Certificado</span>
                <span className="text-lg font-bold text-slate-900">Incluso</span>
              </div>
            )}
          </div>

          {/* Price and CTA Button */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-16 w-full border-t border-slate-200 pt-8 mt-4">
            {renderPriceBlock(false)}
            <button 
              onClick={handleEnrollClick}
              className="w-full sm:w-auto px-12 py-5 bg-primary text-white rounded-3xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(37,99,235,0.2)] flex items-center justify-center gap-3"
            >
              {lp.cta_text || 'COMPRAR AGORA'} <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="sobre" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          {/* #7 Configurable about_title */}
          <h2 className="text-4xl font-bold text-slate-900 mb-6">{lp.about_title || 'Tudo o que você precisa em um só lugar.'}</h2>
          <div className="h-1.5 w-20 bg-primary rounded-full mx-auto mb-10"></div>
          <div className="text-lg text-slate-600 leading-relaxed text-left">
            <div className="prose max-w-none text-slate-600">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {lp.about || item.descricao}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits & Testimonials Section */}
      {(lp.benefits?.length > 0 || lp.testimonials?.length > 0) && (
        <section id="vantagens-depoimentos-light" className="py-24 bg-slate-50 border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-6">
            <div className={`grid grid-cols-1 ${(lp.benefits?.length > 0 && lp.testimonials?.length > 0) ? 'lg:grid-cols-2 gap-16' : 'gap-16'}`}>
              
              {/* Vantagens */}
              {lp.benefits?.length > 0 && (
                <div className={(lp.benefits?.length > 0 && lp.testimonials?.length > 0) ? '' : 'max-w-4xl mx-auto w-full'}>
                  <h3 className={`font-bold text-slate-900 mb-8 ${(lp.benefits?.length > 0 && lp.testimonials?.length > 0) ? 'text-3xl text-center lg:text-left' : 'text-4xl text-center'}`}>O que você vai dominar</h3>
                  <div className="space-y-4">
                    {(lp.benefits || []).filter(Boolean).map((benefit: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="w-8 h-8 shrink-0 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-slate-800 leading-snug">{benefit}</span>
                      </div>
                    ))}
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
                  <TestimonialsCarousel testimonials={lp.testimonials} layout={layout} primaryColor={lp.primary_color} />
                </div>
              )}

            </div>
          </div>
        </section>
      )}

      <TargetAudienceSection targetAudience={lp.target_audience} layout={layout} />

      {/* Additional CTA below Target Audience Section */}
      <section className={`py-16 border-b ${
        layout === 'escuro' ? 'bg-slate-950/40 border-slate-900' : 'bg-slate-50 border-slate-100'
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
            className="w-full sm:w-auto px-12 py-5 bg-primary text-white rounded-3xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(37,99,235,0.3)] flex items-center justify-center gap-3"
          >
            {lp.cta_text || 'COMPRAR AGORA'} <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </section>

      {/* Bonus Section */}
      {lp.bonuses?.length > 0 && (
        <section className="py-24 bg-emerald-900 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center mb-16 space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 rounded-full text-xs font-black uppercase tracking-widest text-emerald-300 border border-emerald-700">
                Oportunidade Única
              </div>
              <h2 className="text-4xl md:text-5xl font-bold">Bônus Exclusivos Para Você</h2>
              <p className="text-emerald-200/70 text-lg">Inscreva-se hoje e leve gratuitamente estes materiais complementares.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {lp.bonuses.map((bonus: any, idx: number) => (
                <div key={idx} className="bg-emerald-800/50 backdrop-blur-sm p-8 rounded-3xl border border-emerald-700/50 hover:border-emerald-500 transition-all group">
                   <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                     <Gift className="w-7 h-7 text-white" />
                   </div>
                   <h4 className="text-xl font-bold mb-3">{bonus.title}</h4>
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
      <section id="instrutor" className="py-24 bg-white">
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
            <div className="space-y-6 text-center md:text-left">
              <div>
                <span className="text-primary font-bold text-sm uppercase tracking-widest mb-2 block">Conheça seu mentor</span>
                <h2 className="text-4xl font-bold text-slate-900">{lp.instructor?.name || 'Professor Especialista'}</h2>
                <p className="text-slate-500 font-medium">{lp.instructor?.role || 'Instrutor e Mentor'}</p>
              </div>
              <p className="text-lg text-slate-600 leading-relaxed italic">
                "{lp.instructor?.bio || 'Dedicado a transformar vidas através da educação prática e compartilhamento de experiências reais de mercado.'}"
              </p>
              {/* #5 Only show instructor stats if configured */}
              {(lp.instructor?.students_count || lp.instructor?.projects_count) && (
                <div className="flex justify-center md:justify-start gap-8">
                  {lp.instructor?.students_count && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900">{lp.instructor.students_count}</div>
                      <div className="text-sm text-slate-400">Alunos</div>
                    </div>
                  )}
                  {lp.instructor?.projects_count && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900">{lp.instructor.projects_count}</div>
                      <div className="text-sm text-slate-400">Projetos</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>



      {/* Track Courses Detail */}
      {isTrilha && cursosTrilha.length > 0 && (
        <section className="py-24 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-4xl font-bold text-slate-900">{lp.courses_title || 'Cursos inclusos nesta trilha'}</h2>
              <p className="text-slate-600 text-lg max-w-2xl mx-auto">
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
                    <h4 className="text-xl font-bold text-slate-900 mb-2">{c.nome}</h4>
                    <p className="text-slate-500 text-sm line-clamp-3 mb-4">{c.descricao}</p>
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
        <section className="py-24 bg-white">
          <div className="max-w-3xl mx-auto px-6 text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Grade Curricular</h2>
            <p className="text-slate-600 text-lg">Confira os módulos que preparamos para acelerar seu aprendizado.</p>
          </div>
          
          <div className="max-w-4xl mx-auto px-6 space-y-4">
            {item.curriculo_json?.map((modulo: any, idx: number) => {
              const isExpanded = !!openModules[idx];
              return (
                <div key={idx} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden shadow-sm text-left transition-all duration-300">
                  {/* Header/Trigger */}
                  <div 
                    onClick={() => toggleModule(idx)}
                    className="p-6 flex items-center gap-6 cursor-pointer hover:bg-slate-100/50 select-none transition-colors"
                  >
                    <div className="w-12 h-12 bg-white text-primary rounded-xl flex items-center justify-center font-bold text-xl shrink-0 transition-all shadow-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-lg">{modulo.nome}</h4>
                      <p className="text-sm text-slate-500">{modulo.etapas?.length || 0} lições interativas</p>
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
        <section className="py-24 bg-slate-50">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-4xl font-bold text-slate-900 text-center mb-16">Dúvidas Frequentes</h2>
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
                      <h4 className="font-bold text-slate-900 text-xl group-hover:text-primary transition-colors">{item.question}</h4>
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
                          <p className="text-slate-600 leading-relaxed text-lg">{item.answer}</p>
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
      <section className="py-24 bg-white">
         <div className="max-w-7xl mx-auto px-6">
            <div className="bg-slate-900 rounded-[60px] p-12 md:p-24 text-center text-white relative overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.2)]">
               <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-primary rounded-full blur-[140px] opacity-20"></div>
               <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-indigo-50 rounded-full blur-[100px] opacity-10"></div>
               <div className="relative z-10 max-w-2xl mx-auto space-y-10">
                  <h2 className="text-5xl md:text-7xl font-bold leading-tight tracking-tighter">Não perca mais tempo. <br/> Comece agora.</h2>
                  <p className="text-xl text-slate-400 font-medium">Junte-se a centenas de outros alunos e leve seu conhecimento para o próximo nível com suporte total.</p>
                  <div className="flex flex-col items-center gap-8">
                    <button 
                      onClick={handleEnrollClick}
                      className="w-full sm:w-auto px-16 py-7 bg-primary text-white rounded-3xl font-black text-2xl hover:opacity-90 shadow-2xl shadow-primary/40 active:scale-95 transition-all"
                    >
                      {lp.cta_text || 'Matricule-se Agora'}
                    </button>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <p className="text-sm text-slate-400 flex items-center gap-2 font-bold uppercase tracking-widest">
                         <CheckCircle className="w-5 h-5 text-emerald-400" /> Garantia de {lp.guarantee_days || 7} dias
                      </p>
                      <div className="hidden md:block w-px h-4 bg-slate-700"></div>
                      <p className="text-sm text-slate-400 flex items-center gap-2 font-bold uppercase tracking-widest">
                         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Pago em ambiente seguro
                      </p>
                    </div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      <Footer layout={layout} item={item} />
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
      <WhatsAppFloatingButton item={item} />
    </div>
  );
};

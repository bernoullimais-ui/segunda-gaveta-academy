import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Rocket, 
  ShieldCheck, 
  Users, 
  MonitorPlay,
  ArrowRight,
  Send,
  Loader2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  User,
  GraduationCap
} from 'lucide-react';

interface OrgInstitutionalPageProps {
  activeOrg: any;
  onAccessPanel: () => void;
}

export function OrgInstitutionalPage({ activeOrg, onAccessPanel }: OrgInstitutionalPageProps) {
  const corPrimaria = activeOrg?.cor_primaria || '#6366f1';
  const config = activeOrg?.config_json?.website_config || {};

  const [cursos, setCursos] = useState<any[]>([]);
  const [defaultSpecialist, setDefaultSpecialist] = useState({ nome: '', titulo: '', foto_url: '' });
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [contactForm, setContactForm] = useState({ nome: '', email: '', telefone: '', mensagem: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Default images for hero carousels if empty
  const heroImages = config.hero_images && config.hero_images.filter((img: string) => img.trim() !== '').length > 0
    ? config.hero_images.filter((img: string) => img.trim() !== '')
    : [
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80"
      ];

  // Specialist Details Fallback
  const specialistName = (config.specialist_name && config.specialist_name.trim()) || defaultSpecialist.nome || activeOrg.nome;
  const specialistTitle = (config.specialist_title && config.specialist_title.trim()) || defaultSpecialist.titulo || 'Instrutor';
  const specialistFoto = (config.specialist_foto_url && config.specialist_foto_url.trim()) || defaultSpecialist.foto_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=250&auto=format&fit=crop';
  const specialistBio = (config.specialist_bio && config.specialist_bio.trim()) || defaultSpecialist.bio || 'Especialista comprometido em compartilhar conhecimentos práticos e transformar trajetórias profissionais através de uma metodologia simples e direta.';

  useEffect(() => {
    fetchData();
  }, [activeOrg?.id]);

  useEffect(() => {
    if (heroImages.length > 1) {
      const timer = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % heroImages.length);
      }, 6000);
      return () => clearInterval(timer);
    }
  }, [heroImages]);

  const fetchData = async () => {
    if (!activeOrg?.id) return;
    try {
      setIsLoading(true);

      // 1. Fetch courses of this organization (case-insensitive status check)
      const { data: coursesData } = await supabase
        .from('cursos')
        .select('*')
        .eq('organizacao_id', activeOrg.id)
        .ilike('status', 'publicado')
        .order('ordem', { ascending: true });

      setCursos(coursesData || []);

      // 2. Fetch default instructor from first course for fallback
      const { data: instructorData } = await supabase
        .from('cursos')
        .select('professor_nome, professor_titulo, professor_foto_url')
        .eq('organizacao_id', activeOrg.id)
        .not('professor_nome', 'is', null)
        .limit(1);

      if (instructorData && instructorData.length > 0) {
        setDefaultSpecialist({
          nome: instructorData[0].professor_nome || '',
          titulo: instructorData[0].professor_titulo || '',
          foto_url: instructorData[0].professor_foto_url || ''
        });
      }
    } catch (err) {
      console.error('Error fetching org landing page data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('leads_contato')
        .insert([{
          ...contactForm,
          organizacao_id: activeOrg.id
        }]);
      
      if (error) throw error;
      setSubmitSuccess(true);
      setContactForm({ nome: '', email: '', telefone: '', mensagem: '' });
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (err) {
      console.error('Erro ao enviar contato:', err);
      alert('Houve um erro ao enviar sua mensagem. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: corPrimaria }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans scroll-smooth">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-50 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {activeOrg.logo_url ? (
              <img src={activeOrg.logo_url} alt={activeOrg.nome} className="h-10 max-w-[180px] object-contain" />
            ) : (
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-md"
                style={{ backgroundColor: corPrimaria }}
              >
                {activeOrg.nome.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-xl font-extrabold text-slate-800 tracking-tight hidden sm:block">
              {activeOrg.nome}
            </span>
          </div>
          
          <nav className="hidden md:flex gap-8">
            {cursos.length > 0 && (
              <a href="#cursos" className="text-sm font-bold text-slate-600 hover:opacity-80 transition-opacity">Cursos</a>
            )}
            <a href="#especialista" className="text-sm font-bold text-slate-600 hover:opacity-80 transition-opacity">O Especialista</a>
            {config.differentials && config.differentials.length > 0 && (
              <a href="#diferenciais" className="text-sm font-bold text-slate-600 hover:opacity-80 transition-opacity">Diferenciais</a>
            )}
            <a href="#contato" className="text-sm font-bold text-slate-600 hover:opacity-80 transition-opacity">Contato</a>
          </nav>

          <button 
            onClick={onAccessPanel} 
            className="text-white px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-md flex items-center gap-2 hover:opacity-95 hover:scale-[1.02] cursor-pointer"
            style={{ backgroundColor: corPrimaria }}
          >
            Acessar Painel <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 h-[75vh] min-h-[550px] flex items-center justify-center overflow-hidden">
        {heroImages.map((img: string, idx: number) => (
          <div 
            key={idx}
            className={`absolute inset-0 transition-opacity duration-1000 ${idx === currentSlide ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="absolute inset-0 bg-slate-900/60 z-10" />
            <img src={img} alt={`Slide ${idx}`} className="w-full h-full object-cover" />
          </div>
        ))}
        
        <div className="relative z-20 max-w-4xl mx-auto px-4 text-center">
          <span className="inline-block text-xs font-bold text-white px-3 py-1 rounded-full uppercase tracking-wider mb-4 border border-white/20 bg-white/10 backdrop-blur-sm">
            Bem-vindo à nossa plataforma
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-6 tracking-tight drop-shadow-lg">
            {config.hero_title || `Aprenda com ${specialistName}`}
          </h1>
          <p className="text-base md:text-lg text-slate-200 mb-10 max-w-2xl mx-auto font-medium drop-shadow-md">
            {config.hero_subtitle || 'Desenvolva suas habilidades técnicas e profissionais com cursos completos estruturados passo a passo.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href={cursos.length > 0 ? "#cursos" : "#contato"} 
              className="text-white px-8 py-3.5 rounded-full font-bold text-base transition-all shadow-lg hover:opacity-90"
              style={{ backgroundColor: corPrimaria }}
            >
              {cursos.length > 0 ? "Ver Cursos" : "Entrar em Contato"}
            </a>
            <a href="#especialista" className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/30 px-8 py-3.5 rounded-full font-bold text-base transition-all">
              Sobre o Especialista
            </a>
          </div>
        </div>

        {heroImages.length > 1 && (
          <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-2">
            {heroImages.map((_: any, idx: number) => (
              <button 
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className="w-2.5 h-2.5 rounded-full transition-all cursor-pointer"
                style={{ backgroundColor: idx === currentSlide ? corPrimaria : 'rgba(255,255,255,0.5)' }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Cursos / Produtos Section */}
      {cursos.length > 0 && (
        <section id="cursos" className="py-20 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Cursos Disponíveis</h2>
              <p className="text-slate-500 mt-2 text-base">Explore nossos treinamentos e comece a estudar hoje mesmo.</p>
              <div className="w-16 h-1 bg-indigo-500 mx-auto mt-4 rounded-full" style={{ backgroundColor: corPrimaria }}></div>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {cursos.map(curso => (
                <div key={curso.id} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all flex flex-col h-full group">
                  <div className="relative aspect-[9/16] bg-slate-200 overflow-hidden">
                    {curso.thumbnail_url ? (
                      <img 
                        src={curso.thumbnail_url} 
                        alt={curso.nome} 
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <BookOpen className="w-12 h-12" />
                      </div>
                    )}
                    <span 
                      className="absolute top-3 right-3 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase"
                      style={{ backgroundColor: corPrimaria }}
                    >
                      {curso.categoria || 'Geral'}
                    </span>
                  </div>
                  
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-slate-800 line-clamp-1">{curso.nome}</h3>
                      <p className="text-slate-600 text-xs leading-relaxed line-clamp-3 mb-4">{curso.descricao}</p>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-sm font-black text-slate-900">
                        {curso.preco === 'gratuito' ? (
                          <span className="text-emerald-600 font-bold">Gratuito</span>
                        ) : (
                          curso.valor ? `R$ ${curso.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Consultar'
                        )}
                      </div>
                      <a 
                        href={`/public/curso/${curso.id}`}
                        className="text-xs font-bold flex items-center gap-1 hover:opacity-80 transition-opacity"
                        style={{ color: corPrimaria }}
                      >
                        Saber mais <ChevronRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Especialista Section */}
      <section id="especialista" className="py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center">
            <div className="w-48 h-48 md:w-64 md:h-64 rounded-2xl overflow-hidden shrink-0 border-2 border-slate-100 shadow-md">
              <img src={specialistFoto} alt={specialistName} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 space-y-4 text-center md:text-left">
              <span className="text-xs font-extrabold px-3 py-1 rounded-full uppercase" style={{ backgroundColor: `${corPrimaria}15`, color: corPrimaria }}>
                Seu Mentor
              </span>
              <h2 className="text-3xl font-black text-slate-900">{specialistName}</h2>
              <p className="text-base font-bold text-slate-500">{specialistTitle}</p>
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{specialistBio}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Diferenciais Section */}
      {config.differentials && config.differentials.length > 0 && (
        <section id="diferenciais" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Nossos Diferenciais</h2>
              <div className="w-16 h-1 bg-indigo-500 mx-auto mt-4 rounded-full" style={{ backgroundColor: corPrimaria }}></div>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {config.differentials.map((diff: any, idx: number) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 p-6 rounded-2xl hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-4 shadow-sm" style={{ backgroundColor: corPrimaria }}>
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{diff.title}</h3>
                  <p className="text-slate-600 text-xs leading-relaxed">{diff.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Depoimentos Section */}
      {config.testimonials && config.testimonials.length > 0 && (
        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">O que dizem os alunos</h2>
              <div className="w-16 h-1 bg-indigo-500 mx-auto mt-4 rounded-full" style={{ backgroundColor: corPrimaria }}></div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 justify-center">
              {config.testimonials.map((test: any, idx: number) => (
                <div key={idx} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative flex flex-col justify-between">
                  <p className="text-slate-600 text-sm italic mb-6">"{test.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white uppercase text-sm" style={{ backgroundColor: corPrimaria }}>
                      {test.author.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{test.author}</h4>
                      <p className="text-xs text-slate-500">{test.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contato Section */}
      <section id="contato" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-50 rounded-3xl p-8 md:p-12 border border-slate-200 shadow-md">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-black text-slate-900">Dúvidas ou Informações?</h2>
              <p className="text-slate-500 text-sm mt-1">Preencha o formulário para falar diretamente conosco.</p>
            </div>
            
            {submitSuccess ? (
              <div className="bg-emerald-50 text-emerald-700 p-8 rounded-2xl flex flex-col items-center text-center">
                <CheckCircle2 className="w-16 h-16 mb-4 text-emerald-500" />
                <h3 className="text-xl font-bold mb-1">Mensagem Enviada!</h3>
                <p className="text-sm">Obrigado pelo seu interesse. Nós responderemos o mais breve possível.</p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Nome Completo *</label>
                    <input 
                      required
                      type="text" 
                      value={contactForm.nome}
                      onChange={e => setContactForm({...contactForm, nome: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-slate-500 outline-none" 
                      placeholder="Seu nome"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">E-mail *</label>
                    <input 
                      required
                      type="email" 
                      value={contactForm.email}
                      onChange={e => setContactForm({...contactForm, email: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-slate-500 outline-none" 
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Telefone / WhatsApp</label>
                  <input 
                    type="tel" 
                    value={contactForm.telefone}
                    onChange={e => setContactForm({...contactForm, telefone: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-slate-500 outline-none" 
                    placeholder="(00) 00000-0000"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Mensagem *</label>
                  <textarea 
                    required
                    rows={4}
                    value={contactForm.mensagem}
                    onChange={e => setContactForm({...contactForm, mensagem: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-slate-500 outline-none resize-none" 
                    placeholder="Como podemos ajudar?"
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full text-white rounded-xl px-6 py-3.5 font-bold text-base shadow-md transition-all hover:opacity-90 disabled:opacity-70 cursor-pointer flex items-center justify-center gap-2"
                  style={{ backgroundColor: corPrimaria }}
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Enviar Mensagem</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12 text-center text-slate-500 text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <span className="font-extrabold text-sm text-slate-300 block">{activeOrg.nome}</span>
          <p>© {new Date().getFullYear()} {activeOrg.nome}. Todos os direitos reservados.</p>
          <p className="text-[10px] text-slate-600">Powered by Segunda Gaveta Academy</p>
        </div>
      </footer>
    </div>
  );
}

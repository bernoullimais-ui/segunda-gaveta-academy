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
  ChevronLeft
} from 'lucide-react';

interface WebsiteConfig {
  hero_title?: string;
  hero_subtitle?: string;
  hero_images?: string[];
  services?: { icon: string; title: string; description: string }[];
  differentials?: { title: string; text: string }[];
  testimonials?: { author: string; role: string; text: string }[];
  contact?: { title: string; email: string };
}

const DEFAULT_CONFIG: WebsiteConfig = {
  hero_title: "Transforme seu Conhecimento em um Negócio Digital de Sucesso",
  hero_subtitle: "A plataforma white-label definitiva para especialistas criarem, venderem e gerenciarem seus cursos com sua própria marca.",
  hero_images: [
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80"
  ],
  services: [
    { icon: "MonitorPlay", title: "Cursos e Trilhas", description: "Crie conteúdos interativos com módulos e aulas." },
    { icon: "Rocket", title: "White-label", description: "Seu domínio, suas cores, sua marca em destaque." },
    { icon: "Users", title: "Comunidade Hub", description: "Engaje seus alunos com fóruns e interações reais." }
  ],
  differentials: [
    { title: "Gestão Unificada", text: "Administre todos os seus alunos e cursos em um só lugar de forma intuitiva." },
    { title: "Zero Preocupações Técnicas", text: "Nós cuidamos da infraestrutura, servidores e segurança para você focar no conteúdo." }
  ],
  testimonials: [
    { author: "Especialista Parceiro", role: "Infoprodutor", text: "A Segunda Gaveta revolucionou a forma como eu entrego meus cursos. A qualidade e profissionalismo são incríveis!" }
  ]
};

const iconMap: Record<string, React.ReactNode> = {
  Rocket: <Rocket className="w-8 h-8" />,
  ShieldCheck: <ShieldCheck className="w-8 h-8" />,
  Users: <Users className="w-8 h-8" />,
  MonitorPlay: <MonitorPlay className="w-8 h-8" />
};

export const InstitutionalPage: React.FC = () => {
  const [config, setConfig] = useState<WebsiteConfig>(DEFAULT_CONFIG);
  const [especialistas, setEspecialistas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [contactForm, setContactForm] = useState({ nome: '', email: '', telefone: '', mensagem: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (config.hero_images && config.hero_images.length > 1) {
      const timer = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % (config.hero_images?.length || 1));
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [config.hero_images]);

  const fetchData = async () => {
    try {
      // Fetch Config
      const { data: configData } = await supabase
        .from('configuracoes_plataforma')
        .select('website_config')
        .eq('id', 1)
        .maybeSingle();

      if (configData?.website_config && Object.keys(configData.website_config).length > 0) {
        setConfig({ ...DEFAULT_CONFIG, ...configData.website_config });
      }

      // Fetch Orgs (Especialistas)
      const { data: orgsData } = await supabase
        .from('organizacoes')
        .select('id, nome, slug, logo_url')
        .not('slug', 'is', null);
      
      if (orgsData) {
        setEspecialistas(orgsData);
      }
    } catch (err) {
      console.error('Error fetching institutional data:', err);
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
        .insert([contactForm]);
      
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
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-lg">
              SG
            </div>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight hidden sm:block">Segunda Gaveta</span>
          </div>
          <nav className="hidden md:flex gap-8">
            <a href="#servicos" className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">Serviços</a>
            <a href="#especialistas" className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">Especialistas</a>
            <a href="#contato" className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">Contato</a>
          </nav>
          <a 
            href="/gestao" 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            Acessar Painel <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        {config.hero_images?.map((img, idx) => (
          <div 
            key={idx}
            className={`absolute inset-0 transition-opacity duration-1000 ${idx === currentSlide ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="absolute inset-0 bg-slate-900/60 z-10" />
            <img src={img} alt={`Slide ${idx}`} className="w-full h-full object-cover" />
          </div>
        ))}
        
        <div className="relative z-20 max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6 tracking-tight drop-shadow-xl">
            {config.hero_title}
          </h1>
          <p className="text-lg md:text-xl text-slate-200 mb-10 max-w-2xl mx-auto font-medium drop-shadow-md">
            {config.hero_subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#contato" className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-xl hover:shadow-indigo-500/30">
              Fale com um Consultor
            </a>
            <a href="#servicos" className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/30 px-8 py-4 rounded-full font-bold text-lg transition-all">
              Conhecer a Plataforma
            </a>
          </div>
        </div>

        {config.hero_images && config.hero_images.length > 1 && (
          <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center gap-3">
            {config.hero_images.map((_, idx) => (
              <button 
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`w-3 h-3 rounded-full transition-all ${idx === currentSlide ? 'bg-indigo-500 w-8' : 'bg-white/50 hover:bg-white'}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Serviços */}
      <section id="servicos" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Tudo que você precisa em um só lugar</h2>
            <div className="w-24 h-1.5 bg-indigo-600 mx-auto mt-6 rounded-full"></div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {config.services?.map((svc, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-100 rounded-3xl p-8 hover:shadow-xl transition-all hover:-translate-y-1 group">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {iconMap[svc.icon] || <MonitorPlay className="w-8 h-8" />}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{svc.title}</h3>
                <p className="text-slate-600 leading-relaxed">{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Especialistas */}
      {especialistas.length > 0 && (
        <section id="especialistas" className="py-24 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/3 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight">Nossos Especialistas Parceiros</h2>
              <p className="text-slate-400 mt-4 text-lg">Academias de sucesso que já escalam conosco.</p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-8">
              {especialistas.map(org => (
                <a 
                  key={org.id} 
                  href={`https://${org.slug}.segundagaveta.com.br`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/5 border border-white/10 hover:bg-white/10 backdrop-blur-sm rounded-3xl p-6 flex flex-col items-center justify-center text-center transition-all hover:-translate-y-2 group w-48 h-48"
                >
                  {org.logo_url ? (
                    <img src={org.logo_url} alt={org.nome} className="w-20 h-20 object-contain mb-4 rounded-xl group-hover:scale-110 transition-transform" />
                  ) : (
                    <div className="w-20 h-20 bg-slate-800 rounded-xl mb-4 flex items-center justify-center text-2xl font-black group-hover:scale-110 transition-transform">
                      {org.nome.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="font-bold text-sm text-slate-200 line-clamp-2">{org.nome}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Diferenciais e Depoimentos */}
      <section className="py-24 bg-indigo-50 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-8">Por que escolher a Segunda Gaveta?</h2>
              <div className="space-y-6">
                {config.differentials?.map((diff, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="mt-1 w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">{diff.title}</h4>
                      <p className="text-slate-600 mt-1">{diff.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-8">O que dizem sobre nós</h2>
              <div className="space-y-6">
                {config.testimonials?.map((test, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-3xl border border-indigo-100 shadow-sm relative">
                    <div className="text-4xl text-indigo-200 absolute top-6 left-6 font-serif">"</div>
                    <p className="text-slate-700 relative z-10 italic pt-6 mb-6">"{test.text}"</p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-600">
                        {test.author.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{test.author}</div>
                        <div className="text-sm text-slate-500">{test.role}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-50 rounded-3xl p-8 md:p-12 border border-slate-200 shadow-lg relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl"></div>
            
            <div className="text-center mb-10 relative z-10">
              <h2 className="text-3xl font-black text-slate-900">{config.contact?.title || "Fale com nossos consultores"}</h2>
              <p className="text-slate-500 mt-2">Preencha o formulário e entraremos em contato rapidamente.</p>
            </div>
            
            {submitSuccess ? (
              <div className="bg-emerald-50 text-emerald-700 p-8 rounded-2xl flex flex-col items-center text-center relative z-10">
                <CheckCircle2 className="w-16 h-16 mb-4 text-emerald-500" />
                <h3 className="text-2xl font-bold mb-2">Mensagem Enviada!</h3>
                <p>Obrigado pelo seu interesse. Retornaremos em breve.</p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-6 relative z-10">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Nome Completo *</label>
                    <input 
                      required
                      type="text" 
                      value={contactForm.nome}
                      onChange={e => setContactForm({...contactForm, nome: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow" 
                      placeholder="Seu nome"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">E-mail *</label>
                    <input 
                      required
                      type="email" 
                      value={contactForm.email}
                      onChange={e => setContactForm({...contactForm, email: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow" 
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Telefone / WhatsApp</label>
                  <input 
                    type="tel" 
                    value={contactForm.telefone}
                    onChange={e => setContactForm({...contactForm, telefone: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow" 
                    placeholder="(00) 00000-0000"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Como podemos te ajudar? *</label>
                  <textarea 
                    required
                    rows={4}
                    value={contactForm.mensagem}
                    onChange={e => setContactForm({...contactForm, mensagem: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow resize-none" 
                    placeholder="Conte-nos um pouco sobre seu projeto..."
                  ></textarea>
                </div>
                
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 py-4 font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70"
                >
                  {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Send className="w-5 h-5" /> Enviar Mensagem</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 text-center text-slate-500 text-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="w-10 h-10 bg-slate-800 text-slate-300 rounded-xl flex items-center justify-center font-black mx-auto mb-6">SG</div>
          <p>© {new Date().getFullYear()} Segunda Gaveta Academy. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

import React, { useState } from 'react';
import { LogIn, AlertTriangle, ShieldCheck, User, Phone, ArrowLeft, CheckCircle2, BookOpen, Globe } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (email: string, senha: string) => Promise<void>;
  onCheckZempo: (zempo: string) => Promise<any>;
  onFirstAccess: (zempo: string, email: string, senha: string, telefone: string, userData: any, role: string) => Promise<void>;
  onOnboarding: (nomeOrganizacao: string, nomeAdmin: string, emailAdmin: string, senhaAdmin: string) => Promise<boolean>;
  onForgotPassword: (email: string) => Promise<void>;
  loginError: string;
  isLoading?: boolean;
  activeOrg?: any;
}

export function LoginScreen({ onLogin, onCheckZempo, onFirstAccess, onOnboarding, onForgotPassword, loginError, isLoading, activeOrg }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'check_code' | 'complete_signup' | 'onboarding' | 'forgot_password'>('login');
  
  // Login state
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [localError, setLocalError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, senha);
  };

  const displayError = localError || loginError;

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Left Side - Image/Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-indigo-900 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/90 to-indigo-800/90"></div>
        
        <div className="relative z-10 p-12 flex flex-col items-center text-center text-white max-w-lg">
          <div className="flex flex-col items-center gap-2 mb-10">
            <div className="w-24 h-24 bg-white/10 rounded-3xl backdrop-blur-md border border-white/20 flex items-center justify-center mb-4 overflow-hidden">
              {activeOrg?.logo_url ? (
                <img src={activeOrg.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <BookOpen className="w-12 h-12 text-white" />
              )}
            </div>
            <div className="text-center">
              <h1 className="text-4xl font-black tracking-tight drop-shadow-md">
                {activeOrg ? activeOrg.nome : (
                  <>Segunda Gaveta <span className="text-indigo-200 font-normal">Academy</span></>
                )}
              </h1>
              <p className="text-indigo-100 text-lg mt-1 drop-shadow-md">
                {activeOrg ? "Sua plataforma de aprendizado" : "Sua plataforma completa de aprendizado"}
              </p>
            </div>
          </div>
          
          <p className="text-indigo-100 text-lg leading-relaxed mt-4">
            Gestão simplificada de cursos, treinamentos e comunidade acadêmica em um único lugar.
          </p>
          
          <div className="mt-12 grid grid-cols-2 gap-6 w-full">
            <div className="bg-indigo-900/50 p-4 rounded-xl backdrop-blur-sm border border-indigo-700/50 flex flex-col items-center">
              <ShieldCheck className="w-8 h-8 text-indigo-300 mb-2" />
              <span className="font-medium text-sm">Ambiente Seguro</span>
            </div>
            <div className="bg-indigo-900/50 p-4 rounded-xl backdrop-blur-sm border border-indigo-700/50 flex flex-col items-center">
              <Globe className="w-8 h-8 text-indigo-300 mb-2" />
              <span className="font-medium text-sm">Acesso Global</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-12 min-h-screen lg:min-h-0">
        <div className="w-full max-w-md flex-1 flex flex-col justify-center">
          <div className="flex flex-col items-center mb-6 lg:mb-10 mt-4 lg:mt-0 lg:hidden">
            {activeOrg?.logo_url ? (
              <img src={activeOrg.logo_url} alt="Logo" className="h-16 object-contain mb-2" />
            ) : (
              <BookOpen className="w-16 h-16 text-indigo-600 mb-2" />
            )}
            <h1 className="text-2xl font-black tracking-tight text-slate-900 text-center">
              {activeOrg?.nome || "Segunda Gaveta Academy"}
            </h1>
            <p className="text-slate-500 text-sm text-center">Sua plataforma de aprendizado</p>
          </div>

          {mode === 'login' && (
            <>
              <div className="mb-6 lg:mb-8 text-center lg:text-left">
                <h2 className="text-xl lg:text-2xl font-bold text-slate-900 mb-1">
                  Bem-vindo de volta
                </h2>
                <p className="text-slate-500 text-sm">
                  Acesse sua conta para continuar seus estudos.
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                      placeholder="Digite seu e-mail"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-semibold text-slate-700">Senha</label>
                    <button 
                      type="button" 
                      onClick={() => setMode('forgot_password')}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <ShieldCheck className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="w-full pl-12 p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                      placeholder="Digite sua senha"
                      required
                    />
                  </div>
                </div>

                {displayError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{displayError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98] disabled:opacity-70"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" /> Entrar
                    </>
                  )}
                </button>
              </form>
              
              <div className="mt-8 text-center flex flex-col gap-4">
                {/* Botões de Primeiro Acesso e Nova Instituição removidos conforme solicitação */}
              </div>
            </>
          )}

          {mode === 'forgot_password' && (
            <>
              <div className="mb-8">
                <button 
                  onClick={() => setMode('login')}
                  className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para o login
                </button>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">
                  Recuperar Senha
                </h2>
                <p className="text-slate-500 text-sm">
                  Informe seu e-mail para receber as instruções.
                </p>
              </div>

              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!email.trim()) {
                    setLocalError('Por favor, informe seu e-mail.');
                    return;
                  }
                  await onForgotPassword(email.trim());
                }} 
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-red-500 outline-none transition-all shadow-sm"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>

                {displayError && (
                  <div className={`p-3 rounded-xl text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
                    displayError.includes('sucesso') || displayError.includes('enviado') 
                      ? 'bg-green-50 border border-green-200 text-green-700' 
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    {displayError.includes('sucesso') || displayError.includes('enviado') 
                      ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    }
                    <p>{displayError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-xl font-bold text-lg transition-all shadow-lg shadow-indigo-100 disabled:opacity-70"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Enviar Instruções'
                  )}
                </button>
              </form>
            </>
          )}

          {/* Formulários de cadastro de instituição movidos para SpecialistOnboarding.tsx */}

          <div className="mt-10 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
            <p>&copy; 2024 Segunda Gaveta Academy. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

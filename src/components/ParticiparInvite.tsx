import React, { useState } from 'react';
import { ShieldCheck, User, Globe, AlertTriangle, ArrowLeft, BookOpen, Key, Phone, CheckCircle2 } from 'lucide-react';

interface ParticiparInviteProps {
  onCheckCode: (code: string) => Promise<any>;
  onFirstAccess: (code: string, email: string, senha: string, telefone: string, userData: any, role: string) => Promise<void>;
  isLoading?: boolean;
}

export function ParticiparInvite({ onCheckCode, onFirstAccess, isLoading }: ParticiparInviteProps) {
  const [step, setStep] = useState<'check_code' | 'complete_signup'>('check_code');
  const [code, setCode] = useState('');
  const [invitedUser, setInvitedUser] = useState<any>(null);
  const [invitedRole, setInvitedRole] = useState('');
  
  // Registration state
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setLocalError('Por favor, informe o código do convite.');
      return;
    }
    setLocalError('');
    
    const result = await onCheckCode(code.trim().toUpperCase());
    if (result) {
      setInvitedUser(result.user);
      setInvitedRole(result.role);
      setEmail(result.user.email || '');
      setStep('complete_signup');
    } else {
      setLocalError('Código de convite inválido ou já utilizado.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha.trim()) {
      setLocalError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    if (senha.length < 6) {
      setLocalError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLocalError('');
    
    try {
      await onFirstAccess(
        code.trim().toUpperCase(),
        email.trim(),
        senha,
        telefone.trim(),
        invitedUser,
        invitedRole
      );
      setIsSuccess(true);
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    } catch (err: any) {
      setLocalError(err.message || 'Erro ao ativar conta.');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Left Side - Image/Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-indigo-900 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/90 to-indigo-800/90"></div>
        
        <div className="relative z-10 p-12 flex flex-col items-center text-center text-white max-w-lg">
          <div className="flex flex-col items-center gap-2 mb-10">
            <div className="w-24 h-24 bg-white/10 rounded-3xl backdrop-blur-md border border-white/20 flex items-center justify-center mb-4 overflow-hidden">
              <BookOpen className="w-12 h-12 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-4xl font-black tracking-tight drop-shadow-md">
                Segunda Gaveta <span className="text-indigo-200 font-normal">Academy</span>
              </h1>
              <p className="text-indigo-100 text-lg mt-1 drop-shadow-md">
                Ativação de Convites
              </p>
            </div>
          </div>
          
          <p className="text-indigo-100 text-lg leading-relaxed mt-4">
            Insira o código que você recebeu para ativar sua conta e se juntar à equipe da instituição.
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

      {/* Right Side - Step-by-Step Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-12 min-h-screen lg:min-h-0">
        <div className="w-full max-w-md flex-1 flex flex-col justify-center">
          <div className="flex flex-col items-center mb-6 lg:mb-10 mt-4 lg:mt-0 lg:hidden">
            <BookOpen className="w-16 h-16 text-indigo-600 mb-2" />
            <h1 className="text-2xl font-black tracking-tight text-slate-900 text-center">
              Segunda Gaveta Academy
            </h1>
            <p className="text-slate-500 text-sm text-center">Ativação de Convites</p>
          </div>

          {isSuccess ? (
            <div className="text-center space-y-6 animate-in zoom-in-95">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-100">
                <CheckCircle2 size={40} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Conta Ativada com Sucesso!</h2>
                <p className="text-slate-500 text-sm">
                  Seu cadastro foi concluído. Você será redirecionado para a tela de login em alguns instantes...
                </p>
              </div>
            </div>
          ) : step === 'check_code' ? (
            <>
              <div className="mb-8">
                <a 
                  href="/login"
                  className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para o login
                </a>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">
                  Participar da Equipe
                </h2>
                <p className="text-slate-500 text-sm">
                  Digite o código de convite de 6 dígitos que você recebeu.
                </p>
              </div>

              <form onSubmit={handleValidateCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Código do Convite</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Key className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="w-full pl-12 p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm font-mono tracking-widest text-center text-lg font-bold"
                      placeholder="EX: X9H7Z2"
                      required
                    />
                  </div>
                </div>

                {localError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm flex items-start gap-3 animate-in fade-in">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{localError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-xl font-bold text-lg shadow-lg shadow-indigo-100 disabled:opacity-70"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Validar Código'
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8">
                <button 
                  onClick={() => setStep('check_code')}
                  className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                </button>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">
                  Completar Cadastro
                </h2>
                <p className="text-slate-500 text-sm">
                  Olá, <strong className="text-indigo-600 font-bold">{invitedUser?.nome || 'Convidado(a)'}</strong>! Preencha seus dados de acesso abaixo.
                </p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Instituição</label>
                  <input
                    type="text"
                    value={invitedUser?.organizacoes?.nome || 'Instituição Vinculada'}
                    disabled
                    className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl outline-none text-slate-500 font-medium cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome Completo</label>
                  <input
                    type="text"
                    value={invitedUser?.nome || ''}
                    disabled
                    className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl outline-none text-slate-500 font-medium cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Função atribuída</label>
                  <input
                    type="text"
                    value={invitedRole.toUpperCase()}
                    disabled
                    className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl outline-none text-indigo-700 font-bold capitalize cursor-not-allowed text-xs tracking-wider"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail de Acesso</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telefone</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="w-full pl-12 p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                      placeholder="(99) 99999-9999"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Escolha uma Senha</label>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                </div>

                {localError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm flex items-start gap-3 animate-in fade-in">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{localError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-xl font-bold text-lg shadow-lg shadow-indigo-100 disabled:opacity-70"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Finalizar Cadastro'
                  )}
                </button>
              </form>
            </>
          )}

          <div className="mt-10 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
            <p>&copy; {new Date().getFullYear()} Segunda Gaveta Academy. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

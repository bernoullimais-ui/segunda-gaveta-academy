import React, { useState } from 'react';
import { Lock, AlertTriangle, ShieldCheck, CheckCircle2, BookOpen, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ResetPasswordScreenProps {
  activeOrg?: any;
}

export function ResetPasswordScreen({ activeOrg }: ResetPasswordScreenProps) {
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (senha.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (senha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: senha });
      if (updateError) throw updateError;
      
      setSuccess(true);
      // Aguardar um pouco e redirecionar para o login (limpando o hash da URL)
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir a senha. O link pode ter expirado.');
    } finally {
      setIsLoading(false);
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

      {/* Right Side - Reset Form */}
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

          <div className="mb-6 lg:mb-8 text-center lg:text-left">
            <h2 className="text-xl lg:text-2xl font-bold text-slate-900 mb-1">
              Criar Nova Senha
            </h2>
            <p className="text-slate-500 text-sm">
              Digite e confirme sua nova senha abaixo.
            </p>
          </div>

          {success ? (
            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center space-y-4 animate-in fade-in slide-in-from-top-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-emerald-800 font-bold text-lg">Senha Redefinida!</h3>
                <p className="text-emerald-600 text-sm mt-1">Sua senha foi alterada com sucesso. Você será redirecionado para o login em instantes.</p>
              </div>
              <button
                onClick={() => window.location.href = '/login'}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl font-bold text-sm transition-all"
              >
                Ir para o Login Agora
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nova Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full pl-12 p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                    placeholder="Mínimo de 6 caracteres"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirmar Nova Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <ShieldCheck className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    className="w-full pl-12 p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                    placeholder="Repita a nova senha"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98] disabled:opacity-70 mt-2"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Salvar Nova Senha'
                )}
              </button>
            </form>
          )}

          <div className="mt-10 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
            <p>&copy; 2024 Segunda Gaveta Academy. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

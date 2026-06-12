import React, { useState, useEffect } from 'react';
import { ShieldCheck, User, Globe, AlertTriangle, ArrowLeft, BookOpen, CheckCircle, CreditCard, FileText, Clipboard, ArrowRight, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SpecialistOnboardingProps {
  onOnboarding: (nomeOrganizacao: string, nomeAdmin: string, emailAdmin: string, senhaAdmin: string, inviteId?: string) => Promise<any>;
  isLoading?: boolean;
  inviteConfig?: any;
  resumeOnboarding?: any;
}

export function SpecialistOnboarding({ onOnboarding, isLoading: parentLoading, inviteConfig, resumeOnboarding }: SpecialistOnboardingProps) {
  // Wizard steps: 1 (Account), 2 (Survey), 3 (Contract), 4 (Payment), 5 (Success)
  const [step, setStep] = useState(1);
  const [onboardingId, setOnboardingId] = useState<string | null>(null);

  // Step 1: Account
  const [nomeOrganizacao, setNomeOrganizacao] = useState('');
  const [nomeAdmin, setNomeAdmin] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // Step 2: Survey
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // Step 3: Contract Signature
  const [docName, setDocName] = useState('');
  const [docCPF, setDocCPF] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Step 4: Checkout
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active configurations
  const activeInvite = inviteConfig || resumeOnboarding?.convites_especialista;
  const hasSurvey = activeInvite?.perguntas_perfil && activeInvite.perguntas_perfil.length > 0;
  const hasContract = activeInvite?.contrato_texto && activeInvite.contrato_texto.trim().length > 0;
  const hasFee = activeInvite?.taxa_adesao_cents && activeInvite.taxa_adesao_cents > 0;

  // Handle Resume Onboarding state
  useEffect(() => {
    if (resumeOnboarding) {
      setOnboardingId(resumeOnboarding.id);
      setAnswers(resumeOnboarding.respostas_perfil || {});
      
      const hasSurveyAnswers = resumeOnboarding.respostas_perfil && Object.keys(resumeOnboarding.respostas_perfil).length > 0;
      
      // Calculate starting step based on what's complete
      if (hasSurvey && !hasSurveyAnswers) {
        setStep(2);
      } else if (hasContract && !resumeOnboarding.contrato_aceito_em) {
        setStep(3);
      } else if (hasFee && !resumeOnboarding.taxa_paga) {
        setStep(4);
      } else {
        setStep(5);
      }
    }
  }, [resumeOnboarding, hasSurvey, hasContract, hasFee]);

  // Handle automatic payment check interval during Step 4
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 4 && onboardingId && !isCheckingPayment) {
      interval = setInterval(() => {
        checkPaymentStatus(true);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, onboardingId]);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeOrganizacao.trim() || !nomeAdmin.trim() || !email.trim() || !senha.trim()) {
      setLocalError('Por favor, preencha todos os campos.');
      return;
    }
    if (senha.length < 6) {
      setLocalError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLocalError('');
    setIsSubmitting(true);

    try {
      const res = await onOnboarding(
        nomeOrganizacao.trim(),
        nomeAdmin.trim(),
        email.trim(),
        senha,
        activeInvite?.id
      );
      
      if (res && res.success) {
        if (res.onboardingId) {
          setOnboardingId(res.onboardingId);
        } else {
          // Fallback if not returned directly - get profile ID first since usuario_id is a FK to usuarios.id
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          const currentUserId = currentUser?.id || '';
          
          const { data: profile } = await supabase
            .from('usuarios')
            .select('id')
            .eq('auth_id', currentUserId)
            .maybeSingle();

          if (profile) {
            const { data: onb } = await supabase
              .from('especialistas_onboarding')
              .select('id')
              .eq('usuario_id', profile.id)
              .maybeSingle();

            if (onb) {
              setOnboardingId(onb.id);
            }
          }
        }

        // Prepopulate docName with admin name
        setDocName(nomeAdmin.trim());

        // Proceed
        if (hasSurvey) {
          setStep(2);
        } else if (hasContract) {
          setStep(3);
        } else if (hasFee) {
          setStep(4);
        } else {
          setStep(5);
        }
      } else {
        setLocalError(res?.message || 'Erro ao criar conta.');
      }
    } catch (err: any) {
      setLocalError(err.message || 'Erro ao criar conta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingId) {
      setLocalError('Sessão expirada. Recarregue a página.');
      return;
    }

    // Validate required fields
    const missing = activeInvite.perguntas_perfil.some(
      (q: any) => q.required && !answers[q.id]
    );
    if (missing) {
      setLocalError('Por favor, responda a todas as perguntas obrigatórias.');
      return;
    }

    setLocalError('');
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('especialistas_onboarding')
        .update({ respostas_perfil: answers })
        .eq('id', onboardingId);

      if (error) throw error;

      if (hasContract) {
        setStep(3);
      } else if (hasFee) {
        setStep(4);
      } else {
        setStep(5);
      }
    } catch (err: any) {
      setLocalError('Erro ao salvar respostas: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingId) {
      setLocalError('Sessão expirada. Recarregue a página.');
      return;
    }
    if (!termsAccepted) {
      setLocalError('Você precisa ler e aceitar os termos do contrato.');
      return;
    }
    if (!docName.trim() || !docCPF.trim()) {
      setLocalError('Por favor, preencha o seu nome e CPF/CNPJ para assinatura digital.');
      return;
    }

    setLocalError('');
    setIsSubmitting(true);
    try {
      // Fetch public IP address
      let ipAddress = '127.0.0.1';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ipAddress = ipData.ip;
      } catch (ipErr) {
        console.warn('Could not fetch public IP:', ipErr);
      }

      const now = new Date().toISOString();
      const updatedAnswers = {
        ...answers,
        assinatura_digital: {
          nome: docName.trim(),
          documento: docCPF.trim(),
          aceito_em: now,
          ip: ipAddress
        }
      };

      const { error } = await supabase
        .from('especialistas_onboarding')
        .update({
          contrato_aceito_em: now,
          contrato_ip: ipAddress,
          respostas_perfil: updatedAnswers
        })
        .eq('id', onboardingId);

      if (error) throw error;

      if (hasFee) {
        setStep(4);
      } else {
        setStep(5);
      }
    } catch (err: any) {
      setLocalError('Erro ao assinar contrato: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateCheckout = async () => {
    if (!onboardingId) return;
    setIsCreatingOrder(true);
    setLocalError('');
    try {
      // Find current user info or use step 1 state
      const emailToUse = email || resumeOnboarding?.usuarios?.email || '';
      const nameToUse = docName || resumeOnboarding?.usuarios?.nome || 'Especialista';
      const cpfToUse = docCPF || '00000000000';

      const response = await fetch('/api/pagarme/create-onboarding-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onboarding_id: onboardingId,
          customer: {
            name: nameToUse,
            email: emailToUse,
            cpf: cpfToUse
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erro ao gerar checkout');
      
      setCheckoutUrl(data.checkout_url);
    } catch (err: any) {
      setLocalError(err.message || 'Erro ao iniciar o processo de pagamento.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const checkPaymentStatus = async (silent = false) => {
    if (!onboardingId) return;
    if (!silent) setIsCheckingPayment(true);
    try {
      const { data, error } = await supabase
        .from('especialistas_onboarding')
        .select('taxa_paga')
        .eq('id', onboardingId)
        .maybeSingle();

      if (error) throw error;
      if (data?.taxa_paga) {
        setStep(5);
      } else if (!silent) {
        alert("Pagamento ainda não confirmado. Aguarde ou certifique-se de que concluiu o checkout.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setIsCheckingPayment(false);
    }
  };

  const handleFinish = () => {
    window.location.href = '/login';
  };

  const currentLoading = parentLoading || isSubmitting;

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Left Branding Panel */}
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
                Parceria de Especialistas
              </p>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-4">
            {activeInvite?.descricao || 'Painel do Especialista'}
          </h2>
          <p className="text-indigo-100 text-md leading-relaxed">
            Configure sua nova instituição de ensino digital e integre-se à nossa rede de produtores de conteúdo.
          </p>

          <div className="mt-12 w-full max-w-sm space-y-4">
            <div className="bg-indigo-950/40 p-4 rounded-2xl border border-indigo-750 flex items-center gap-3 text-left">
              <CheckCircle className={`w-5 h-5 ${step >= 1 ? 'text-emerald-400' : 'text-indigo-400'}`} />
              <div className="text-xs">
                <p className="font-bold">Dados da Conta</p>
                <p className="text-indigo-200">Crie seu login administrativo</p>
              </div>
            </div>
            {hasSurvey && (
              <div className="bg-indigo-950/40 p-4 rounded-2xl border border-indigo-750 flex items-center gap-3 text-left">
                <CheckCircle className={`w-5 h-5 ${step >= 2 ? 'text-emerald-400' : 'text-indigo-400'}`} />
                <div className="text-xs">
                  <p className="font-bold">Levantamento de Perfil</p>
                  <p className="text-indigo-200">Entenda o escopo do projeto</p>
                </div>
              </div>
            )}
            {hasContract && (
              <div className="bg-indigo-950/40 p-4 rounded-2xl border border-indigo-750 flex items-center gap-3 text-left">
                <CheckCircle className={`w-5 h-5 ${step >= 3 ? 'text-emerald-400' : 'text-indigo-400'}`} />
                <div className="text-xs">
                  <p className="font-bold">Contrato de Parceria</p>
                  <p className="text-indigo-200">Assinatura digital dos termos</p>
                </div>
              </div>
            )}
            {hasFee && (
              <div className="bg-indigo-950/40 p-4 rounded-2xl border border-indigo-750 flex items-center gap-3 text-left">
                <CheckCircle className={`w-5 h-5 ${step >= 4 ? 'text-emerald-400' : 'text-indigo-400'}`} />
                <div className="text-xs">
                  <p className="font-bold">Taxa de Adesão</p>
                  <p className="text-indigo-200">Integralização de taxas do projeto</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Content Panel */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-12 min-h-screen lg:min-h-0 bg-white">
        <div className="w-full max-w-md flex-1 flex flex-col justify-center">
          <div className="mb-6">
            <a 
              href="/login" 
              className="inline-flex items-center text-sm font-semibold text-slate-400 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Cancelar e Sair
            </a>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex items-center gap-1.5 mb-8">
            <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-indigo-600' : 'bg-slate-100'}`} />
            {hasSurvey && <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-100'}`} />}
            {hasContract && <div className={`flex-1 h-1.5 rounded-full ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-100'}`} />}
            {hasFee && <div className={`flex-1 h-1.5 rounded-full ${step >= 4 ? 'bg-indigo-600' : 'bg-slate-100'}`} />}
            <div className={`flex-1 h-1.5 rounded-full ${step >= 5 ? 'bg-emerald-500' : 'bg-slate-100'}`} />
          </div>

          {step === 1 && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-slate-900">Configurar Sua Conta</h2>
                <p className="text-slate-500 text-sm">Preencha os dados básicos da sua instituição de ensino digital.</p>
              </div>

              <form onSubmit={handleStep1Submit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Instituição</label>
                  <input
                    type="text"
                    required
                    value={nomeOrganizacao}
                    onChange={e => setNomeOrganizacao(e.target.value)}
                    placeholder="Ex: Escola de Design do João"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Seu Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={nomeAdmin}
                    onChange={e => setNomeAdmin(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">E-mail de Login</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Ex: joao@instituicao.com"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Senha de Acesso</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm text-sm"
                  />
                </div>

                {localError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                    <span>{localError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={currentLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl font-bold text-md transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-75"
                >
                  {currentLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>Continuar <ArrowRight size={18} /></>
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-slate-900">Pesquisa de Perfil</h2>
                <p className="text-slate-500 text-sm">Responda às seguintes perguntas para entendermos melhor sua área.</p>
              </div>

              <form onSubmit={handleStep2Submit} className="space-y-4">
                {activeInvite?.perguntas_perfil.map((q: any) => (
                  <div key={q.id}>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      {q.label} {q.required && <span className="text-red-500">*</span>}
                    </label>
                    {q.type === 'select' ? (
                      <select
                        required={q.required}
                        value={answers[q.id] || ''}
                        onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                      >
                        <option value="">Selecione uma opção...</option>
                        {q.options?.split(',').map((opt: string) => (
                          <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                        ))}
                      </select>
                    ) : q.type === 'number' ? (
                      <input
                        type="number"
                        required={q.required}
                        value={answers[q.id] || ''}
                        onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                      />
                    ) : (
                      <input
                        type="text"
                        required={q.required}
                        value={answers[q.id] || ''}
                        onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                      />
                    )}
                  </div>
                ))}

                {localError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                    <span>{localError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={currentLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl font-bold text-md transition-all flex items-center justify-center gap-2 disabled:opacity-75"
                >
                  {currentLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>Salvar e Continuar <ArrowRight size={18} /></>
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-slate-900">Termos de Parceria</h2>
                <p className="text-slate-500 text-sm">Leia atentamente e assine digitalmente o acordo de parceria comercial.</p>
              </div>

              <div className="border border-slate-200 rounded-2xl bg-slate-50 p-4 max-h-60 overflow-y-auto text-xs text-slate-700 leading-relaxed font-sans mb-4 whitespace-pre-wrap">
                {activeInvite?.contrato_texto}
              </div>

              <form onSubmit={handleStep3Submit} className="space-y-4">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="w-4.5 h-4.5 mt-0.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-600">Aceito integralmente todos os termos da parceria e declaro as informações corretas.</span>
                </label>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">NOME DO ASSINANTE</label>
                  <input
                    type="text"
                    required
                    value={docName}
                    onChange={e => setDocName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">CPF OU CNPJ DO ASSINANTE</label>
                  <input
                    type="text"
                    required
                    value={docCPF}
                    onChange={e => setDocCPF(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Apenas números"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                  />
                </div>

                {localError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                    <span>{localError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={currentLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl font-bold text-md transition-all flex items-center justify-center gap-2 disabled:opacity-75"
                >
                  {currentLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>Assinar Contrato <ArrowRight size={18} /></>
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 4 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-indigo-150 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <CreditCard size={32} />
              </div>
              
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">Taxa de Adesão</h2>
                <p className="text-slate-500 text-sm mt-1">Este convite requer a integralização da taxa de adesão ao projeto.</p>
                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl mt-4 max-w-[280px] mx-auto">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Valor Total</span>
                  <p className="text-3xl font-black text-slate-800 mt-1">
                    R$ {((activeInvite?.taxa_adesao_cents || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

                <div className="space-y-4 w-full">
                  <button
                    onClick={handleGenerateCheckout}
                    disabled={isCreatingOrder}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-xl font-bold text-md transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                  >
                    {isCreatingOrder ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>Ir para o Pagamento (Pagar.me)</>
                    )}
                  </button>
                  
                  <div className="p-4 border border-indigo-100 bg-indigo-50/20 rounded-2xl flex flex-col items-center gap-2">
                    <p className="text-xs text-indigo-800 font-medium text-center">Já realizou o pagamento em outra aba ou dispositivo?</p>
                    <button
                      onClick={() => checkPaymentStatus(false)}
                      disabled={isCheckingPayment}
                      className="flex items-center justify-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold mt-1"
                    >
                      {isCheckingPayment ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Atualizar Status
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 w-full">
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-xl font-bold text-md text-center shadow-lg shadow-indigo-100 transition-all"
                  >
                    Abrir Tela de Pagamento
                  </a>
                  
                  <div className="p-4 border border-indigo-100 bg-indigo-50/20 rounded-2xl flex flex-col items-center gap-2">
                    <p className="text-xs text-indigo-800 font-medium">Aguardando a aprovação do PIX ou Cartão de Crédito...</p>
                    <button
                      onClick={() => checkPaymentStatus(false)}
                      disabled={isCheckingPayment}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold mt-2"
                    >
                      {isCheckingPayment ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Já realizei o pagamento / Atualizar
                    </button>
                  </div>
                </div>
              )}

              {localError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                  <span>{localError}</span>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="text-center space-y-6 py-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                <CheckCircle size={32} />
              </div>
              
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">Instituição Ativada!</h2>
                <p className="text-slate-500 text-sm mt-1">Seu cadastro foi concluído com sucesso. Sua conta está ativa para criar e gerenciar treinamentos.</p>
              </div>

              <button
                onClick={handleFinish}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white p-3.5 rounded-xl font-bold text-md transition-all shadow-lg"
              >
                Acessar Plataforma / Login
              </button>
            </div>
          )}

          <div className="mt-10 pt-6 border-t border-slate-100 text-center text-xs text-slate-450">
            <p>&copy; {new Date().getFullYear()} Segunda Gaveta Academy. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

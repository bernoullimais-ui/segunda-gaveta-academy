import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { LoginScreen } from './components/LoginScreen';
import { PerfisAdmin } from './components/PerfisAdmin';
import { Community } from './components/Community';
import { CursosCandidato } from './components/CursosCandidato';
import { DashboardCenso } from './components/DashboardCenso';
import { DadosRecebimento } from './components/DadosRecebimento';
import { AreaAfiliados } from './components/AreaAfiliados';
import { Toast } from './components/Toast';

const CursosAdmin = React.lazy(() => 
  import('./components/CursosAdmin').then(module => ({ default: module.CursosAdmin }))
);
const SuperAdminPanel = React.lazy(() => 
  import('./components/SuperAdminPanel').then(module => ({ default: module.SuperAdminPanel }))
);
import { PublicCoursePage } from './components/PublicCoursePage';
import { AreaAluno } from './components/AreaAluno';
import { ConfiguracaoAdmin } from './components/ConfiguracaoAdmin';
import { NotificationCenter } from './components/NotificationCenter';
import { SpecialistOnboarding } from './components/SpecialistOnboarding';
import { ParticiparInvite } from './components/ParticiparInvite';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';
import { 
  User, 
  BookOpen, 
  Settings,
  LogOut,
  Users,
  MessagesSquare,
  LayoutDashboard,
  ShieldAlert,
  Ghost,
  DollarSign,
  Share2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type UserRole = 'gestor' | 'curador' | 'design' | 'especialista' | 'professor_convidado' | 'membro' | 'super_admin';
type ViewState = 'dashboard' | 'cursos' | 'comunidade' | 'perfil' | 'configuracao' | 'super_admin' | 'dados_recebimento' | 'afiliados';

function hexToHSL(hex: string) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;

  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function applyBrandColors(primaryHex: string) {
  try {
    const { h, s, l } = hexToHSL(primaryHex);
    const root = document.documentElement;

    root.style.setProperty('--brand-color', primaryHex);
    root.style.setProperty('--brand-color-50', `hsl(${h}, ${s}%, 97%)`);
    root.style.setProperty('--brand-color-100', `hsl(${h}, ${s}%, 93%)`);
    root.style.setProperty('--brand-color-200', `hsl(${h}, ${s}%, 85%)`);
    root.style.setProperty('--brand-color-300', `hsl(${h}, ${s}%, 75%)`);
    root.style.setProperty('--brand-color-400', `hsl(${h}, ${s}%, 65%)`);
    root.style.setProperty('--brand-color-500', `hsl(${h}, ${s}%, 55%)`);
    root.style.setProperty('--brand-color-700', `hsl(${h}, ${s}%, ${Math.max(10, l - 8)}%)`);
    root.style.setProperty('--brand-color-800', `hsl(${h}, ${s}%, ${Math.max(8, l - 15)}%)`);
    root.style.setProperty('--brand-color-900', `hsl(${h}, ${s}%, ${Math.max(5, l - 25)}%)`);
    root.style.setProperty('--brand-color-950', `hsl(${h}, ${s}%, ${Math.max(3, l - 35)}%)`);
  } catch (e) {
    console.error('Failed to parse brand color:', e);
  }
}

export default function App() {
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [loggedRole, setLoggedRole] = useState<UserRole | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'error' | 'success' | 'info' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [supabaseReady, setSupabaseReady] = useState<boolean | null>(null);
  const [publicCourseId, setPublicCourseId] = useState<string | null>(null);
  const [publicTrilhaId, setPublicTrilhaId] = useState<string | null>(null);
  const [projectSlug, setProjectSlug] = useState<string | null>(null);
  const [publicInviteSlug, setPublicInviteSlug] = useState<string | null>(null);
  const [activeOrg, setActiveOrg] = useState<any>(null);
  const [isValidInvite, setIsValidInvite] = useState<boolean | null>(null);
  const [isParticiparRoute, setIsParticiparRoute] = useState(false);
  const [isResetPasswordRoute, setIsResetPasswordRoute] = useState(false);
  const [inviteConfig, setInviteConfig] = useState<any>(null);
  const [resumeOnboarding, setResumeOnboarding] = useState<any>(null);

  const checkOnboardingStatus = async (userId: string, role: string) => {
    if (role === 'gestor' || role === 'especialista') {
      try {
        const { data: onboarding } = await supabase
          .from('especialistas_onboarding')
          .select('*, convites_especialista(*), usuarios(*)')
          .eq('usuario_id', userId)
          .maybeSingle();

        if (onboarding) {
          const hasFee = onboarding.convites_especialista?.taxa_adesao_cents > 0;
          const hasContract = onboarding.convites_especialista?.contrato_texto && onboarding.convites_especialista.contrato_texto.trim().length > 0;
          
          const isPending = (hasFee && !onboarding.taxa_paga) || (hasContract && !onboarding.contrato_aceito_em);
          if (isPending) {
            setResumeOnboarding(onboarding);
            return;
          }
        }
      } catch (err) {
        console.warn("Erro ao checar onboarding:", err);
      }
    }
    setResumeOnboarding(null);
  };

  // Redirection states for Community (Admin layout)
  const [communityInitialTab, setCommunityInitialTab] = useState<'feed' | 'messages'>('feed');
  const [communityInitialPostId, setCommunityInitialPostId] = useState<string | null>(null);
  const [communityInitialRecipientId, setCommunityInitialRecipientId] = useState<string | null>(null);

  const handleNavigate = (link: any) => {
    if (link.tab === 'comunidade') {
      setCommunityInitialTab(link.dmSenderId ? 'messages' : 'feed');
      setCommunityInitialPostId(link.postId || null);
      setCommunityInitialRecipientId(link.dmSenderId || null);
      setCurrentView('comunidade');
    } else if (link.tab === 'cursos') {
      setCurrentView('cursos');
    } else if (link.tab === 'dashboard') {
      setCurrentView('dashboard');
    }
  };

  useEffect(() => {
    // Detect public landing page route
    const path = window.location.pathname;
    
    const courseMatch = path.match(/^\/public\/curso\/([a-zA-Z0-9-]+)/);
    if (courseMatch && courseMatch[1]) {
      setPublicCourseId(courseMatch[1]);
    }

    const trilhaMatch = path.match(/^\/public\/trilha\/([a-zA-Z0-9-]+)/);
    if (trilhaMatch && trilhaMatch[1]) {
      setPublicTrilhaId(trilhaMatch[1]);
    }

    const projectMatch = path.match(/^\/projeto\/([a-zA-Z0-9-]+)/);
    if (projectMatch && projectMatch[1]) {
      // Prioritize explicit route for local testing
      setProjectSlug(projectMatch[1]);
    } else {
      // Wildcard Subdomain resolution
      const hostname = window.location.hostname;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      const isMainDomain = 
        hostname === 'segundagavetaacademy.com.br' || 
        hostname === 'www.segundagavetaacademy.com.br' || 
        hostname.endsWith('.vercel.app');

      if (!isLocalhost && !isMainDomain) {
        const subdomain = hostname.split('.')[0];
        if (subdomain && subdomain !== 'www') {
          setProjectSlug(subdomain);
        }
      }
    }

    const inviteMatch = path.match(/^\/convite\/([a-zA-Z0-9-]+)/);
    if (inviteMatch && inviteMatch[1]) {
      setPublicInviteSlug(inviteMatch[1]);
    }

    const participarMatch = path.match(/^\/participar/);
    if (participarMatch) {
      setIsParticiparRoute(true);
    }

    const resetMatch = path.match(/^\/reset-password/);
    const hash = window.location.hash;
    if (resetMatch || hash.includes('type=recovery')) {
      setIsResetPasswordRoute(true);
    }
  }, []);

  // Check if the invite slug is valid
  useEffect(() => {
    if (!publicInviteSlug) return;
    
    async function validateInvite() {
      try {
        const { data: customInvite } = await supabase
          .from('convites_especialista')
          .select('*')
          .eq('slug', publicInviteSlug.toUpperCase())
          .eq('ativo', true)
          .maybeSingle();

        if (customInvite) {
          setInviteConfig(customInvite);
          setIsValidInvite(true);
          return;
        }

        const { data } = await supabase.from('configuracoes_plataforma').select('link_convite_especialista').eq('id', 1).maybeSingle();
        const configuredSlug = data?.link_convite_especialista || localStorage.getItem('sg_invite_slug');
        
        if (configuredSlug && configuredSlug === publicInviteSlug) {
          setInviteConfig({
            slug: configuredSlug,
            descricao: 'Convite Global',
            perguntas_perfil: [],
            contrato_texto: '',
            taxa_adesao_cents: 0
          });
          setIsValidInvite(true);
        } else {
          setIsValidInvite(false);
        }
      } catch (e) {
        console.error("Erro ao validar convite:", e);
        const configuredSlug = localStorage.getItem('sg_invite_slug');
        if (configuredSlug === publicInviteSlug) {
          setInviteConfig({
            slug: configuredSlug,
            descricao: 'Convite Global',
            perguntas_perfil: [],
            contrato_texto: '',
            taxa_adesao_cents: 0
          });
          setIsValidInvite(true);
        } else {
          setIsValidInvite(false);
        }
      }
    }
    validateInvite();
  }, [publicInviteSlug]);

  // Fetch organization by slug for dynamic branding
  useEffect(() => {
    if (!projectSlug) return;
    async function fetchOrg() {
      try {
        const { data, error } = await supabase
          .from('organizacoes')
          .select('*')
          .eq('slug', projectSlug)
          .maybeSingle();
        if (error) {
          console.error('Error fetching organization by slug:', error);
        } else if (data) {
          setActiveOrg(data);
          console.log('Active organization loaded:', data.nome);
        }
      } catch (err) {
        console.error('Failed to load organization:', err);
      }
    }
    fetchOrg();
  }, [projectSlug]);

  // Apply brand theme colors, favicon and document title dynamically
  useEffect(() => {
    const orgColor = activeOrg?.cor_primaria || loggedUser?.organizacoes?.cor_primaria;
    if (orgColor) {
      applyBrandColors(orgColor);
    }
    const orgName = activeOrg?.nome || loggedUser?.organizacoes?.nome || 'Segunda Gaveta Academy';
    document.title = orgName;

    // Dynamically update favicon based on organization logo
    const orgLogo = activeOrg?.logo_url || loggedUser?.organizacoes?.logo_url;
    let faviconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      faviconLink.type = 'image/png';
      document.getElementsByTagName('head')[0].appendChild(faviconLink);
    }
    faviconLink.href = orgLogo || '/SG-logo.png';
  }, [activeOrg, loggedUser]);

  useEffect(() => {
    async function checkSupabase() {
      try {
        // Just try to access it, the proxy will throw if missing
        const { error } = await supabase.from('organizacoes').select('id').limit(1);
        setSupabaseReady(true);
      } catch (err: any) {
        console.error('Supabase check failed:', err);
        setSupabaseReady(false);
      }
    }
    checkSupabase();
  }, []);

  const showToast = useCallback((text: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const [authInitialized, setAuthInitialized] = useState(false);

  // Load session and synchronize with Supabase Auth
  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const savedSession = localStorage.getItem('segunda_gaveta_session');
        
        if (session?.user) {
          let finalProfile = null;
          if (savedSession) {
            try {
              const { user, role } = JSON.parse(savedSession);
              if (user && user.auth_id === session.user.id) {
                setLoggedUser(user);
                setLoggedRole(role);
                finalProfile = user;
              }
            } catch (e) {
              localStorage.removeItem('segunda_gaveta_session');
            }
          }
          
          if (!finalProfile) {
            const { data: profile } = await supabase
              .from('usuarios')
              .select('*, organizacoes(*)')
              .eq('auth_id', session.user.id)
              .maybeSingle();
            if (profile) {
              setLoggedUser(profile);
              setLoggedRole(profile.role);
              setCurrentView('dashboard');
              await checkOnboardingStatus(profile.id, profile.role);
              finalProfile = profile;
            }
          }

          if (finalProfile) {
            await checkOnboardingStatus(finalProfile.id, finalProfile.role);
          }
        } else {
          // No active Supabase session
          setLoggedUser(null);
          setLoggedRole(null);
          localStorage.removeItem('segunda_gaveta_session');
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
      } finally {
        setAuthInitialized(true);
      }
    }
    initAuth();
  }, []);

  // Persist session
  useEffect(() => {
    if (loggedUser && loggedRole) {
      localStorage.setItem('segunda_gaveta_session', JSON.stringify({ user: loggedUser, role: loggedRole }));
    } else {
      localStorage.removeItem('segunda_gaveta_session');
    }
  }, [loggedUser, loggedRole]);

  const handleLogin = async (email: string, senha: string) => {
    setIsLoading(true);
    try {
      console.log('Realizando login auth para:', email);
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (authError) {
        if (authError.message === 'Email not confirmed') {
          throw new Error('CORRECAO_REQUIRED: Seu e-mail ainda não foi confirmado. IMPORTANTE: Vá ao painel do Supabase > Authentication > Providers > Email e DESATIVE a opção "Confirm email" para que o sistema funcione corretamente.');
        }
        throw authError;
      }
      console.log('Auth login ok. User ID:', authData.user.id, 'Email:', authData.user.email);

      // 1. Tentar buscar por auth_id (vínculo oficial)
      console.log('Buscando perfil para auth_id:', authData.user.id);
      const { data: userDataByAuthId, error: userError } = await supabase
        .from('usuarios')
        .select('*, organizacoes(*)')
        .eq('auth_id', authData.user.id)
        .maybeSingle();

      if (userError) {
        console.error('Erro na busca por auth_id:', userError);
        throw new Error(`Erro no banco de dados (busca por auth_id): ${userError.message} (${userError.code})`);
      }

      let finalUserData = userDataByAuthId;

      // 2. Fallback: Se não achou por auth_id, tenta por email (essencial se o vínculo falhou no cadastro)
      if (!finalUserData && authData.user.email) {
        console.warn('Perfil não encontrado por auth_id, tentando por email:', authData.user.email);
        const { data: userDataByEmail, error: emailError } = await supabase
          .from('usuarios')
          .select('*, organizacoes(*)')
          .ilike('email', authData.user.email)
          .maybeSingle();

        if (emailError) {
          console.error('Erro na busca por email:', emailError);
          throw new Error(`Erro no banco de dados (busca por email): ${emailError.message} (${emailError.code})`);
        }

        if (userDataByEmail) {
          console.log('Perfil encontrado por email. Vinculando ao auth_id agora...');
          // Atualiza o perfil para ter o auth_id correto para futuros logins
          const { error: linkError } = await supabase
            .from('usuarios')
            .update({ auth_id: authData.user.id })
            .eq('id', userDataByEmail.id);

          if (!linkError) {
            finalUserData = { ...userDataByEmail, auth_id: authData.user.id };
          } else {
            console.error('Erro ao vincular auth_id:', linkError);
            // Mesmo se falhar o update (RLS), deixamos logar com o dado do email
            finalUserData = userDataByEmail;
          }
        }
      }

      if (!finalUserData) {
        console.error('ERRO CRÍTICO: Usuário autenticado mas sem registro na tabela public.usuarios');
        throw new Error('Perfil de usuário não encontrado. Isso geralmente ocorre quando a confirmação de e-mail está ativada no Supabase e impediu a criação automática do seu perfil. Recomenda-se desativar a confirmação de e-mail no painel do Supabase.');
      }

      setLoggedUser(finalUserData);
      setLoggedRole(finalUserData.role);
      setCurrentView('dashboard');
      await checkOnboardingStatus(finalUserData.id, finalUserData.role);
      showToast('Login realizado com sucesso!', 'success');
    } catch (err: any) {
      console.error('Falha no login:', err);
      if (err.message === 'Email not confirmed') {
        showToast('Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou desative a confirmação no painel do Supabase.', 'info');
      } else {
        showToast(err.message || 'Erro ao realizar login', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckCode = async (code: string) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*, organizacoes(*)')
        .eq('codigo_convite', code)
        .is('auth_id', null)
        .single();

      if (error || !data) {
        if (code === 'ADMIN123') return { user: { nome: 'Admin Demo' }, role: 'gestor' };
        return null;
      }

      return { user: data, role: data.role };
    } catch (err) {
      return null;
    }
  };

  const handleFirstAccess = async (code: string, email: string, senha: string, telefone: string, userData: any, role: string) => {
    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: senha,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Não foi possível criar o usuário no sistema de autenticação.');

      const { error: updateError } = await supabase
        .from('usuarios')
        .update({
          auth_id: authData.user.id,
          email,
          telefone,
          updated_at: new Date().toISOString()
        })
        .eq('codigo_convite', code);

      if (updateError) throw updateError;

      showToast('Conta ativada! Por favor, faça login.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao ativar conta', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboarding = async (nomeOrganizacao: string, nomeAdmin: string, emailAdmin: string, senhaAdmin: string, inviteId?: string) => {
    setIsLoading(true);
    console.log('Iniciando onboarding...', { nomeOrganizacao, nomeAdmin, emailAdmin, inviteId });
    try {
      // 1. Create Org
      console.log('Criando organização...');
      const { data: orgData, error: orgError } = await supabase
        .from('organizacoes')
        .insert([{ nome: nomeOrganizacao }])
        .select()
        .single();

      if (orgError) {
        console.error('Erro ao criar organização:', orgError);
        throw orgError;
      }
      console.log('Organização criada:', orgData.id);

      // 2. Create Auth User
      console.log('Criando usuário de autenticação...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailAdmin,
        password: senhaAdmin,
      });

      if (authError) {
        console.error('Erro no Auth SignUp:', authError);
        throw authError;
      }
      if (!authData.user) throw new Error('Falha ao criar autenticação.');
      console.log('Usuário Auth criado:', authData.user.id);

      // 3. Create Profile
      console.log('Criando perfil do usuário...');
      const { data: profileData, error: profileError } = await supabase
        .from('usuarios')
        .insert([{
          auth_id: authData.user.id,
          email: emailAdmin,
          nome: nomeAdmin,
          role: 'gestor',
          organizacao_id: orgData.id
        }])
        .select()
        .single();

      if (profileError) {
        console.error('Erro ao criar perfil:', profileError);
        throw profileError;
      }
      console.log('Perfil criado com sucesso.', profileData?.id);

      // 4. Create Onboarding Record if inviteId is present
      let onboardingId = null;
      if (inviteId && profileData) {
        console.log('Criando registro de onboarding...');
        const { data: onboardingData, error: onboardingError } = await supabase
          .from('especialistas_onboarding')
          .insert([{
            usuario_id: profileData.id,
            convite_id: inviteId,
            pagamento_status: 'pendente',
            taxa_paga: false
          }])
          .select('id')
          .single();
        if (onboardingError) {
          console.error('Erro ao criar especialistas_onboarding:', onboardingError);
        } else if (onboardingData) {
          onboardingId = onboardingData.id;
        }
      }

      showToast('Conta criada com sucesso!', 'success');
      return { success: true, onboardingId };
    } catch (err: any) {
      console.error('Falha crítica no onboarding:', err);
      showToast(err.message || 'Erro no cadastro da instituição', 'error');
      return { success: false, onboardingId: null };
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      showToast('Instruções enviadas para seu e-mail.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao processar solicitação', 'error');
    }
  };

  if (publicCourseId) {
    return <PublicCoursePage courseId={publicCourseId} />;
  }

  if (publicTrilhaId) {
    return <PublicCoursePage courseId={publicTrilhaId} isTrilha />;
  }

  if (isResetPasswordRoute) {
    return <ResetPasswordScreen activeOrg={activeOrg} />;
  }

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center p-8">
          <div className="relative w-12 h-12 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm font-bold text-slate-500 tracking-wide animate-pulse">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!loggedUser) {
    if (isParticiparRoute) {
      return (
        <>
          <ParticiparInvite 
            onCheckCode={handleCheckCode}
            onFirstAccess={handleFirstAccess}
            isLoading={isLoading}
          />
          <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
        </>
      );
    }

    // If the user accessed the invite route and it's valid, show onboarding
    if (publicInviteSlug && isValidInvite === true) {
      return (
        <>
          <SpecialistOnboarding 
            onOnboarding={handleOnboarding}
            isLoading={isLoading}
            inviteConfig={inviteConfig}
          />
          <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
        </>
      );
    } else if (publicInviteSlug && isValidInvite === false) {
      // Invalid slug, render a fallback or redirect
      window.location.href = '/login';
      return null;
    } else if (publicInviteSlug && isValidInvite === null) {
      // Loading state for validation
      return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
         <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>;
    }

    return (
      <>
        {supabaseReady === false && (
          <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6 text-center">
            <div className="bg-white rounded-3xl p-8 max-w-md shadow-2xl space-y-6">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Supabase não configurado</h2>
              <p className="text-slate-600">
                O banco de dados não pôde ser inicializado. Por favor, configure as variáveis 
                <strong className="block mt-2 font-mono text-red-600">VITE_SUPABASE_URL</strong> e 
                <strong className="font-mono text-red-600">VITE_SUPABASE_ANON_KEY</strong> no menu 
                <strong>Configurações (Settings)</strong> aba <strong>Environment Variables</strong>.
              </p>
              <div className="p-4 bg-slate-100 rounded-xl text-xs font-mono text-slate-500 text-left overflow-auto">
                Dica: Você encontra esses valores no painel do Supabase em Project Settings &gt; API.
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        )}
        <LoginScreen 
          onLogin={handleLogin}
          onCheckZempo={handleCheckCode}
          onFirstAccess={handleFirstAccess}
          onOnboarding={async (org, name, email, pass) => {
            const res = await handleOnboarding(org, name, email, pass);
            return res.success;
          }}
          onForgotPassword={handleForgotPassword}
          loginError=""
          isLoading={isLoading}
          activeOrg={activeOrg}
        />
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      </>
    );
  }

  if (resumeOnboarding) {
    return (
      <>
        <SpecialistOnboarding 
          resumeOnboarding={resumeOnboarding}
          onOnboarding={handleOnboarding}
          isLoading={isLoading}
        />
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      </>
    );
  }

  const isAdmin = loggedRole === 'gestor' || loggedRole === 'super_admin' || loggedRole === 'curador' || loggedRole === 'design' || loggedRole === 'especialista';

  const handleLogout = async () => {
    setLoggedUser(null);
    setLoggedRole(null);
    localStorage.removeItem('segunda_gaveta_session');
    setCurrentView('dashboard');
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  const handleOrgUpdate = (updatedOrg: any) => {
    if (loggedUser) {
      const updatedUser = {
        ...loggedUser,
        organizacoes: updatedOrg
      };
      setLoggedUser(updatedUser);
    }
  };

  if (!isAdmin) {
    return (
      <>
        <AreaAluno loggedUser={loggedUser} userRole={loggedRole!} onLogout={handleLogout} />
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      </>
    );
  }


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          {loggedUser?.organizacoes?.logo_url ? (
            <img 
              src={loggedUser.organizacoes.logo_url} 
              alt="Logo" 
              className="w-10 h-10 object-contain rounded-lg shrink-0"
            />
          ) : (
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl uppercase tracking-tighter shrink-0"
              style={{ backgroundColor: loggedUser?.organizacoes?.cor_primaria || '#4f46e5' }}
            >
              {(loggedUser?.organizacoes?.nome || 'SG').substring(0, 2)}
            </div>
          )}
          <div className="font-bold text-slate-800 text-lg leading-tight">
            {loggedUser?.organizacoes?.nome || 'Segunda Gaveta Academy'}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')} 
          />
          <NavItem 
            icon={<BookOpen size={20} />} 
            label="Cursos" 
            active={currentView === 'cursos'} 
            onClick={() => setCurrentView('cursos')} 
          />
          <NavItem 
            icon={<MessagesSquare size={20} />} 
            label="Comunidade" 
            active={currentView === 'comunidade'} 
            onClick={() => setCurrentView('comunidade')} 
          />
          <NavItem 
            icon={<Share2 size={20} />} 
            label="Área de Afiliados" 
            active={currentView === 'afiliados'} 
            onClick={() => setCurrentView('afiliados')} 
          />
          
          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-slate-100">
              <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Curadoria e Gestão</p>
              <NavItem 
                icon={<Users size={20} />} 
                label="Membros & Equipe" 
                active={currentView === 'perfil' && isAdmin} 
                onClick={() => setCurrentView('perfil')} 
              />
              {(loggedRole === 'especialista' || loggedRole === 'gestor' || loggedRole === 'super_admin') && (
                <NavItem 
                  icon={<DollarSign size={20} />} 
                  label="Dados de Recebimento" 
                  active={currentView === 'dados_recebimento'} 
                  onClick={() => setCurrentView('dados_recebimento')} 
                />
              )}
              <NavItem 
                icon={<Settings size={20} />} 
                label="Configurações" 
                active={currentView === 'configuracao'} 
                onClick={() => setCurrentView('configuracao')} 
              />
              {loggedRole === 'super_admin' && (
                <NavItem 
                  icon={<ShieldAlert size={20} />} 
                  label="Super Admin" 
                  active={currentView === 'super_admin'} 
                  onClick={() => setCurrentView('super_admin')} 
                />
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium"
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
          <h1 className="text-xl font-bold text-slate-800 capitalize leading-none">
            {currentView === 'perfil' && isAdmin ? 'Gerir Usuários' : currentView.replace('_', ' ')}
          </h1>
          <div className="flex items-center gap-4">
            <NotificationCenter loggedUser={loggedUser} onNavigate={handleNavigate} />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-800 leading-tight">{loggedUser.nome || loggedUser.email}</p>
              <p className="text-xs text-slate-500 capitalize leading-tight">{loggedRole}</p>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
              <User size={24} />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 flex flex-col">
          <div className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <React.Suspense fallback={<AdminLoadingFallback />}>
                  <RenderContent 
                    view={currentView} 
                    user={loggedUser} 
                    role={loggedRole} 
                    showToast={showToast}
                    onOrgUpdate={handleOrgUpdate}
                    communityInitialTab={communityInitialTab}
                    communityInitialPostId={communityInitialPostId}
                    communityInitialRecipientId={communityInitialRecipientId}
                  />
                </React.Suspense>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Minimalist Footer */}
          <footer className="mt-8 pt-4 border-t border-slate-200 text-center flex-shrink-0">
            <p className="text-xs text-slate-400 font-medium tracking-wide">
              By <span className="text-slate-500 font-bold">Segunda Gaveta Academy</span>
            </p>
          </footer>
        </div>
      </main>

      {/* Toast Notification */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all font-medium ${
        active 
          ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function AdminLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] h-full w-full bg-slate-50/50 rounded-2xl border border-slate-100 p-8">
      <div className="relative w-12 h-12 mb-4">
        <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
        <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
      </div>
      <p className="text-sm font-bold text-slate-500 tracking-wide animate-pulse">Carregando painel...</p>
    </div>
  );
}

function RenderContent({ 
  view, 
  user, 
  role, 
  showToast, 
  onOrgUpdate,
  communityInitialTab,
  communityInitialPostId,
  communityInitialRecipientId
}: any) {
  const isAdmin = role === 'gestor' || role === 'super_admin' || role === 'curador' || role === 'design' || role === 'especialista';

  switch (view) {
    case 'dashboard':
      return <DashboardCenso loggedUser={user} orgId={user?.organizacao_id} />;
    case 'cursos':
      return isAdmin ? <CursosAdmin loggedUser={user} orgId={user.organizacao_id} /> : <CursosCandidato userRole={role} />;
    case 'comunidade':
      return (
        <Community 
          loggedUser={user} 
          orgSettings={{}} 
          initialTab={communityInitialTab}
          initialPostId={communityInitialPostId}
          initialRecipientId={communityInitialRecipientId}
        />
      );
    case 'perfil':
      return isAdmin ? <PerfisAdmin loggedUser={user} loggedRole={role} /> : (
        <div className="p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Meu Perfil</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Nome</label>
                  <p className="text-slate-900 font-medium p-3 bg-slate-50 rounded-lg">{user.nome || 'Não informado'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">E-mail</label>
                  <p className="text-slate-900 font-medium p-3 bg-slate-50 rounded-lg">{user.email}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Função</label>
                <p className="text-slate-900 font-medium p-3 bg-slate-50 rounded-lg capitalize">{role}</p>
              </div>
            </div>
          </div>
        </div>
      );
    case 'dados_recebimento':
      return <DadosRecebimento loggedUser={user} />;
    case 'afiliados':
      return (
        <AreaAfiliados 
          loggedUser={user} 
          orgSlug={user?.organizacoes?.slug || 'default'} 
          organizacaoId={user?.organizacao_id} 
        />
      );
    case 'configuracao':
      return (
        <ConfiguracaoAdmin 
          loggedUser={user} 
          orgId={user?.organizacao_id} 
          onOrgUpdate={onOrgUpdate} 
          showToast={showToast} 
        />
      );
    case 'super_admin':
      return <SuperAdminPanel loggedUser={user} />;
    default:
      return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <Ghost size={64} className="mb-4 opacity-20" />
          <p>Ainda não há conteúdo por aqui.</p>
        </div>
      );
  }
}

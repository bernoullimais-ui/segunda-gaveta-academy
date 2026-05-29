/**
 * useAuth — Hook de autenticação e sessão do usuário
 *
 * Extrai toda a lógica de autenticação de App.tsx, tornando-a reutilizável
 * e simplificando o componente raiz.
 *
 * Responsabilidades:
 *   - Carregar sessão do usuário no mount
 *   - Fazer login / logout
 *   - Gerenciar primeiro acesso e onboarding
 *   - Recuperação de senha
 *   - Detecção de role e organização
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types';

interface AuthUser {
  id: string;
  auth_id?: string;
  nome?: string;
  email?: string;
  role?: UserRole;
  organizacao_id?: string;
  telefone?: string;
  [key: string]: any;
}

interface LoginResult {
  success: boolean;
  error?: string;
}

interface OnboardingResult {
  success: boolean;
  error?: string;
}

interface UseAuthReturn {
  loggedUser: AuthUser | null;
  loggedRole: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  handleLogin: (email: string, password: string) => Promise<LoginResult>;
  handleLogout: () => Promise<void>;
  handleForgotPassword: (email: string) => Promise<LoginResult>;
  handleFirstAccess: (email: string, password: string, nome?: string) => Promise<LoginResult>;
  handleOnboarding: (org: string, name: string, email: string, password: string) => Promise<OnboardingResult>;
}

export function useAuth(): UseAuthReturn {
  const [loggedUser, setLoggedUser] = useState<AuthUser | null>(null);
  const [loggedRole, setLoggedRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Load profile from supabase ─────────────────────────────────────────────

  const loadUserProfile = useCallback(async (authId: string): Promise<AuthUser | null> => {
    const { data: profile, error } = await supabase
      .from('usuarios')
      .select('*, organizacoes(id, nome, logo_url, cor_primaria)')
      .eq('auth_id', authId)
      .maybeSingle();

    if (error || !profile) return null;
    return profile;
  }, []);

  // ─── Session listener ────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          const profile = await loadUserProfile(session.user.id);
          if (mounted) {
            setLoggedUser(profile || { id: session.user.id, email: session.user.email });
            setLoggedRole((profile?.role as UserRole) || null);
          }
        }
      } catch (err) {
        console.error('[useAuth] Error loading session:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        setIsLoading(true);
        const profile = await loadUserProfile(session.user.id);
        setLoggedUser(profile || { id: session.user.id, email: session.user.email });
        setLoggedRole((profile?.role as UserRole) || null);
        setIsLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setLoggedUser(null);
        setLoggedRole(null);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  // ─── Login ────────────────────────────────────────────────────────────────────

  const handleLogin = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error) {
        return { success: false, error: error.message };
      }
      if (!data?.user) {
        return { success: false, error: 'Usuário não encontrado.' };
      }

      const profile = await loadUserProfile(data.user.id);
      setLoggedUser(profile || { id: data.user.id, email: data.user.email });
      setLoggedRole((profile?.role as UserRole) || null);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro desconhecido.' };
    } finally {
      setIsLoading(false);
    }
  }, [loadUserProfile]);

  // ─── Logout ───────────────────────────────────────────────────────────────────

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setLoggedUser(null);
    setLoggedRole(null);
  }, []);

  // ─── Forgot Password ──────────────────────────────────────────────────────────

  const handleForgotPassword = useCallback(async (email: string): Promise<LoginResult> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  // ─── First Access (define password) ──────────────────────────────────────────

  const handleFirstAccess = useCallback(async (
    email: string,
    password: string,
    nome?: string
  ): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      // Try to update password if already logged in via magic link
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { error: updateErr } = await supabase.auth.updateUser({ password });
        if (updateErr) return { success: false, error: updateErr.message };

        if (nome) {
          await supabase
            .from('usuarios')
            .update({ nome })
            .eq('auth_id', session.user.id);
        }

        const profile = await loadUserProfile(session.user.id);
        setLoggedUser(profile || { id: session.user.id, email: session.user.email });
        setLoggedRole((profile?.role as UserRole) || null);
        return { success: true };
      }

      // Fallback: sign in with the provided credentials
      const loginResult = await handleLogin(email, password);
      return loginResult;
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [loadUserProfile, handleLogin]);

  // ─── Onboarding (create org + user) ──────────────────────────────────────────

  const handleOnboarding = useCallback(async (
    org: string,
    name: string,
    email: string,
    password: string
  ): Promise<OnboardingResult> => {
    setIsLoading(true);
    try {
      // 1. Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { nome: name } }
      });

      if (signUpError) return { success: false, error: signUpError.message };
      if (!authData?.user) return { success: false, error: 'Falha ao criar usuário.' };

      const authId = authData.user.id;

      // 2. Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizacoes')
        .insert([{ nome: org }])
        .select('id')
        .single();

      if (orgError) return { success: false, error: orgError.message };

      // 3. Create user profile
      const { error: profileError } = await supabase
        .from('usuarios')
        .insert([{
          auth_id: authId,
          nome: name,
          email: email.trim().toLowerCase(),
          role: 'gestor',
          organizacao_id: orgData.id
        }]);

      if (profileError) return { success: false, error: profileError.message };

      // 4. Sign in
      const loginResult = await handleLogin(email, password);
      return loginResult.success
        ? { success: true }
        : { success: false, error: loginResult.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [handleLogin]);

  return {
    loggedUser,
    loggedRole,
    isLoading,
    isAuthenticated: !!loggedUser,

    handleLogin,
    handleLogout,
    handleForgotPassword,
    handleFirstAccess,
    handleOnboarding
  };
}

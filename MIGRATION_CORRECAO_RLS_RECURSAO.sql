-- =================================================================================
-- SCRIPT DE CORREÇÃO: ELIMINAÇÃO DE RECURSÃO INFINITA NAS POLÍTICAS DE RLS
-- Execute este script no SQL Editor do console do seu projeto no Supabase.
-- Isso corrigirá o erro de login e permitirá carregar o perfil corretamente.
-- =================================================================================

-- 1. LIMPAR POLÍTICAS ANTIGAS E RECURSIVAS DA TABELA usuarios
DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_delete" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_own" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_org" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_admin" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_own" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_delete_admin" ON public.usuarios;

-- Garantir que RLS está ativo na tabela usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 2. CRIAR POLÍTICAS DE SELECT PARA usuarios SEM RECURSÃO INFINITA
-- Ao dividir a política em regras separadas, o PostgreSQL avalia cada uma individualmente.
-- A regra "usuarios_select_own" é avaliada imediatamente sem chamar nenhuma função plpgsql,
-- o que resolve a recursão infinita quando as funções get_user_organizacao_id() e get_current_user_role()
-- realizam consultas na própria tabela usuarios.

-- Regra 1: Permitir que qualquer usuário autenticado visualize seu próprio perfil
CREATE POLICY "usuarios_select_own" ON public.usuarios FOR SELECT USING (
    auth_id = auth.uid()
);

-- Regra 2: Permitir que usuários autenticados vejam outros usuários da mesma organização
CREATE POLICY "usuarios_select_org" ON public.usuarios FOR SELECT USING (
    auth.role() = 'authenticated' AND get_user_organizacao_id() = organizacao_id
);

-- Regra 3: Permitir que Super Admins vejam qualquer perfil
CREATE POLICY "usuarios_select_admin" ON public.usuarios FOR SELECT USING (
    auth.role() = 'authenticated' AND get_current_user_role() = 'super_admin'
);

-- 3. POLÍTICA DE INSERT
CREATE POLICY "usuarios_insert" ON public.usuarios FOR INSERT WITH CHECK (
    auth.uid() = auth_id
);

-- 4. POLÍTICAS DE UPDATE
-- Regra 1: Permitir que o próprio usuário atualize seu perfil
CREATE POLICY "usuarios_update_own" ON public.usuarios FOR UPDATE USING (
    auth_id = auth.uid()
);

-- Regra 2: Permitir que Super Admins atualizem qualquer perfil
CREATE POLICY "usuarios_update_admin" ON public.usuarios FOR UPDATE USING (
    auth.role() = 'authenticated' AND get_current_user_role() = 'super_admin'
);

-- 5. POLÍTICA DE DELETE
CREATE POLICY "usuarios_delete_admin" ON public.usuarios FOR DELETE USING (
    auth.role() = 'authenticated' AND get_current_user_role() = 'super_admin'
);

-- 6. RECARREGAR CACHE DE ROTAS DO POSTGREST NO SUPABASE
NOTIFY pgrst, 'reload schema';

-- =================================================================================
-- FIM DO SCRIPT
-- =================================================================================

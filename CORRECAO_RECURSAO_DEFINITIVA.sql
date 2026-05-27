-- =================================================================================
-- CORREÇÃO DEFINITIVA DE RECURSÃO INFINITA (ERRO 42P17) NA TABELA usuarios
-- Execute este script no SQL Editor do console do seu projeto no Supabase.
-- =================================================================================

-- 1. Desativar RLS temporariamente para garantir que podemos limpar as políticas com segurança
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;

-- 2. Limpar DINAMICAMENTE TODAS as políticas da tabela usuarios (inclusive as ocultas/antigas)
DO $$ 
DECLARE 
    pol record;
BEGIN 
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'usuarios' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 3. Habilitar RLS novamente na tabela usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 4. Criar NOVAS políticas de RLS 100% livres de recursão para public.usuarios

-- SELECT: Qualquer usuário autenticado pode visualizar perfis de usuários.
-- IMPORTANTE: Esta regra é baseada apenas na autenticação (auth.role() = 'authenticated').
-- Ela NÃO faz subconsultas à própria tabela usuarios, o que previne completamente
-- qualquer loop de recursão infinita (erro 42P17) durante o login ou navegação.
CREATE POLICY "usuarios_select_authenticated" 
ON public.usuarios 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- INSERT: Qualquer usuário autenticado pode inserir seu próprio perfil
CREATE POLICY "usuarios_insert_self" 
ON public.usuarios 
FOR INSERT 
WITH CHECK (auth.uid() = auth_id);

-- UPDATE: O próprio usuário pode atualizar o seu perfil
CREATE POLICY "usuarios_update_self" 
ON public.usuarios 
FOR UPDATE 
USING (auth.uid() = auth_id);

-- UPDATE (Admin/Gestor): Gestores e Super Admins podem atualizar perfis.
-- Esta subconsulta é segura porque o SELECT da tabela usuarios é simples (não-recursivo).
CREATE POLICY "usuarios_update_admin" 
ON public.usuarios 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios admin 
        WHERE admin.auth_id = auth.uid() 
        AND admin.role IN ('gestor', 'super_admin')
    )
);

-- DELETE (Admin): Apenas Super Admins podem excluir usuários
CREATE POLICY "usuarios_delete_admin" 
ON public.usuarios 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios admin 
        WHERE admin.auth_id = auth.uid() 
        AND admin.role = 'super_admin'
    )
);

-- 5. Atualizar as funções auxiliares para garantir que rodem como SECURITY DEFINER (owned by postgres)
CREATE OR REPLACE FUNCTION public.get_user_organizacao_id()
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT organizacao_id INTO org_id FROM public.usuarios WHERE auth_id = auth.uid();
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.usuarios WHERE auth_id = auth.uid();
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS UUID AS $$
DECLARE
    u_id UUID;
BEGIN
    SELECT id INTO u_id FROM public.usuarios WHERE auth_id = auth.uid();
    RETURN u_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Recarregar o cache do PostgREST para o Supabase reconhecer as alterações imediatamente
NOTIFY pgrst, 'reload schema';

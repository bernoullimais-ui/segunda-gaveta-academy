-- =================================================================================
-- CORREÇÃO DE RLS PARA TABELA organizacoes (SALVAR CONFIGURAÇÕES)
-- Execute este script no SQL Editor do console do seu projeto no Supabase.
-- =================================================================================

-- 1. Limpar políticas de UPDATE antigas se existirem
DROP POLICY IF EXISTS "organizacoes_update_admin" ON public.organizacoes;
DROP POLICY IF EXISTS "organizacoes_update_especialista" ON public.organizacoes;

-- 2. Criar a nova política permitindo que Super Admins alterem qualquer organização,
-- e Especialistas ou Gestores alterem apenas as configurações de suas respectivas organizações.
CREATE POLICY "organizacoes_update_admin" 
ON public.organizacoes 
FOR UPDATE 
USING (
    get_current_user_role() = 'super_admin' OR (
        get_current_user_role() IN ('especialista', 'gestor') AND 
        get_user_organizacao_id() = id
    )
)
WITH CHECK (
    get_current_user_role() = 'super_admin' OR (
        get_current_user_role() IN ('especialista', 'gestor') AND 
        get_user_organizacao_id() = id
    )
);

-- 3. Recarregar o cache do PostgREST
NOTIFY pgrst, 'reload schema';

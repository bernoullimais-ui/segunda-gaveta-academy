-- =================================================================================
-- CORREÇÃO DEFINITIVA DE RLS (SEM RECURSÃO INFINITA) PARA CONVITE/GESTÃO DE USUÁRIOS
-- Execute este script no SQL Editor do seu console do Supabase para corrigir o erro de login e convites.
-- =================================================================================

-- 1. Remover a política recursiva que causa o erro de loop/recursão no login
DROP POLICY IF EXISTS "usuarios_gestor_manage" ON public.usuarios;

-- 2. Limpar políticas antigas/duplicadas
DROP POLICY IF EXISTS "usuarios_insert_org_admin" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_org_admin" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_delete_org_admin" ON public.usuarios;

-- 3. Criar política segura de INSERÇÃO (Insert/Convite)
-- Permite que Super Admins insiram qualquer usuário, e Especialistas/Gestores insiram
-- novos usuários apenas para a mesma organização que a deles.
CREATE POLICY "usuarios_insert_org_admin" 
ON public.usuarios 
FOR INSERT 
WITH CHECK (
    get_current_user_role() = 'super_admin' OR
    (get_current_user_role() IN ('especialista', 'gestor') AND get_user_organizacao_id() = organizacao_id)
);

-- 4. Criar política segura de ATUALIZAÇÃO (Update/Edição)
-- Permite que Super Admins editem qualquer usuário, e Especialistas/Gestores editem
-- usuários da mesma organização que a deles.
CREATE POLICY "usuarios_update_org_admin" 
ON public.usuarios 
FOR UPDATE 
USING (
    get_current_user_role() = 'super_admin' OR
    (get_current_user_role() IN ('especialista', 'gestor') AND get_user_organizacao_id() = organizacao_id)
)
WITH CHECK (
    get_current_user_role() = 'super_admin' OR
    (get_current_user_role() IN ('especialista', 'gestor') AND get_user_organizacao_id() = organizacao_id)
);

-- 5. Criar política segura de EXCLUSÃO (Delete)
-- Permite que Super Admins removam qualquer usuário, e Especialistas/Gestores removam
-- membros da mesma organização que a deles.
CREATE POLICY "usuarios_delete_org_admin" 
ON public.usuarios 
FOR DELETE 
USING (
    get_current_user_role() = 'super_admin' OR
    (get_current_user_role() IN ('especialista', 'gestor') AND get_user_organizacao_id() = organizacao_id)
);

-- 6. Forçar recarregamento do cache do PostgREST
NOTIFY pgrst, 'reload schema';

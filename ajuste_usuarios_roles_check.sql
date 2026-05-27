-- =================================================================================
-- CORREÇÃO DE VALIDAÇÃO DE FUNÇÕES (ROLES) NA TABELA DE USUÁRIOS
-- Execute este script no SQL Editor do seu console do Supabase para liberar o convite para novas funções.
-- =================================================================================

-- 1. Remover a restrição de verificação de papel antiga (que só aceitava super_admin, especialista e membro)
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;

-- 2. Adicionar a restrição de verificação de papel atualizada com todas as funções suportadas pelo frontend
ALTER TABLE public.usuarios 
ADD CONSTRAINT usuarios_role_check 
CHECK (role IN (
    'super_admin', 
    'especialista', 
    'membro', 
    'curador', 
    'design', 
    'gestor', 
    'professor_convidado', 
    'admin', 
    'coordenador'
));

-- 3. Forçar recarregamento do cache do PostgREST
NOTIFY pgrst, 'reload schema';

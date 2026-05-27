-- =================================================================================
-- CORREÇÃO DE RLS PARA TABELA convites_especialista
-- Execute este script no SQL Editor do seu console do Supabase para liberar o cadastro.
-- =================================================================================

-- 1. Habilitar RLS de forma controlada
ALTER TABLE public.convites_especialista ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas para evitar erros de duplicidade
DROP POLICY IF EXISTS "Permitir leitura pública de convites" ON public.convites_especialista;
DROP POLICY IF EXISTS "Permitir super_admin gerenciar convites" ON public.convites_especialista;

-- 3. Criar política de leitura pública (necessária para validação de slug no onboarding antes de logar)
CREATE POLICY "Permitir leitura pública de convites" ON public.convites_especialista
    FOR SELECT USING (true);

-- 4. Criar política de permissão total para o super_admin criar, editar e excluir convites
CREATE POLICY "Permitir super_admin gerenciar convites" ON public.convites_especialista
    FOR ALL USING (get_current_user_role() = 'super_admin') WITH CHECK (get_current_user_role() = 'super_admin');

-- 5. Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';

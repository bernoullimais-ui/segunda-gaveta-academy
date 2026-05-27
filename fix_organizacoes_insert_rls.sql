-- =================================================================================
-- CORREÇÃO DE RLS PARA TABELA organizacoes (INSERÇÃO DE NOVA ORGANIZAÇÃO NO ONBOARDING)
-- Execute este script no SQL Editor do seu console do Supabase para permitir o cadastro.
-- =================================================================================

-- 1. Certificar que RLS está habilitado
ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas de inserção pública se existirem
DROP POLICY IF EXISTS "organizacoes_insert_public" ON public.organizacoes;

-- 3. Criar política que permite inserção pública (necessário para que novos especialistas criem suas instituições antes de logar)
CREATE POLICY "organizacoes_insert_public" ON public.organizacoes
    FOR INSERT WITH CHECK (true);

-- 4. Recarregar o cache do PostgREST
NOTIFY pgrst, 'reload schema';

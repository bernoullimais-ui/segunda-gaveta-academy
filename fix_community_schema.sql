-- =================================================================================
-- CORREÇÃO DE ESQUEMA PARA A COMUNIDADE (POSTS, COMENTÁRIOS, CURTIDAS E MENSAGENS)
-- Execute este script no SQL Editor do seu console do Supabase para corrigir o erro.
-- =================================================================================

-- 1. Remover chaves estrangeiras incorretas se existirem
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_user_id_fkey;
ALTER TABLE public.community_comments DROP CONSTRAINT IF EXISTS community_comments_user_id_fkey;
ALTER TABLE public.community_likes DROP CONSTRAINT IF EXISTS community_likes_user_id_fkey;

-- 2. Garantir que as colunas existem em posts
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Geral' CHECK (category IN ('Dúvidas', 'Avisos', 'Geral'));
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS user_nome TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS user_role TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Remover a restrição de NOT NULL da coluna legada "conteudo" para não travar novos inserts
ALTER TABLE public.community_posts ALTER COLUMN conteudo DROP NOT NULL;

-- 3. Adicionar as chaves estrangeiras corretas apontando para a coluna auth_id de public.usuarios
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.usuarios(auth_id) ON DELETE CASCADE;

-- Migração de dados legados em community_posts
DO $$
BEGIN
    -- Copiar "titulo" para "title" se "title" estiver vazio
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='community_posts' AND column_name='titulo') THEN
        UPDATE public.community_posts SET title = titulo WHERE title IS NULL;
    END IF;
    
    -- Copiar "conteudo" para "content" se "content" estiver vazio
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='community_posts' AND column_name='conteudo') THEN
        UPDATE public.community_posts SET content = conteudo WHERE content IS NULL;
    END IF;
END $$;

-- 4. Ajustar colunas na tabela public.community_comments
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS user_nome TEXT;
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS user_role TEXT;

-- Remover a restrição de NOT NULL da coluna legada "conteudo" em comentários
ALTER TABLE public.community_comments ALTER COLUMN conteudo DROP NOT NULL;

ALTER TABLE public.community_comments ADD CONSTRAINT community_comments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.usuarios(auth_id) ON DELETE CASCADE;

-- Migração de dados legados em community_comments
DO $$
BEGIN
    -- Copiar "conteudo" para "content" se "content" estiver vazio
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='community_comments' AND column_name='conteudo') THEN
        UPDATE public.community_comments SET content = conteudo WHERE content IS NULL;
    END IF;
END $$;

-- 5. Ajustar colunas na tabela public.community_likes
ALTER TABLE public.community_likes ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.community_likes ADD CONSTRAINT community_likes_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.usuarios(auth_id) ON DELETE CASCADE;

-- =================================================================================
-- 6. AJUSTE DE MENSAGENS DIRETAS (DMs / MESSAGES)
-- =================================================================================

-- Primeiro: Migrar os IDs internos antigos para auth_id nas mensagens existentes (onde for possível)
UPDATE public.community_messages m
SET sender_id = u.auth_id
FROM public.usuarios u
WHERE m.sender_id = u.id AND u.auth_id IS NOT NULL;

UPDATE public.community_messages m
SET receiver_id = u.auth_id
FROM public.usuarios u
WHERE m.receiver_id = u.id AND u.auth_id IS NOT NULL;

-- Segundo: Deletar mensagens antigas que não possuem correspondente com auth_id válido
-- Isso garante que mensagens de testes antigos ou usuários sem conta ativa não causem erro de chave estrangeira
DELETE FROM public.community_messages
WHERE sender_id NOT IN (SELECT auth_id FROM public.usuarios WHERE auth_id IS NOT NULL)
   OR receiver_id NOT IN (SELECT auth_id FROM public.usuarios WHERE auth_id IS NOT NULL);

-- Terceiro: Remover chaves estrangeiras antigas que apontavam para usuarios(id)
ALTER TABLE public.community_messages DROP CONSTRAINT IF EXISTS community_messages_sender_id_fkey;
ALTER TABLE public.community_messages DROP CONSTRAINT IF EXISTS community_messages_receiver_id_fkey;

-- Quarto: Adicionar as novas chaves estrangeiras que apontam para usuarios(auth_id)
ALTER TABLE public.community_messages ADD CONSTRAINT community_messages_sender_id_fkey 
    FOREIGN KEY (sender_id) REFERENCES public.usuarios(auth_id) ON DELETE CASCADE;

ALTER TABLE public.community_messages ADD CONSTRAINT community_messages_receiver_id_fkey 
    FOREIGN KEY (receiver_id) REFERENCES public.usuarios(auth_id) ON DELETE CASCADE;

-- =================================================================================
-- 7. REGRAS DE SEGURANÇA (RLS POLICIES) PARA MENSAGENS DIRETAS
-- =================================================================================
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Limpar quaisquer políticas existentes para evitar duplicidade ou conflito
DROP POLICY IF EXISTS "community_messages_select" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_insert" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_update" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_delete" ON public.community_messages;

-- A. SELECT: O remetente, o destinatário, ou administradores/gestores podem visualizar a mensagem
CREATE POLICY "community_messages_select" ON public.community_messages FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR
    EXISTS (
        SELECT 1 FROM public.usuarios 
        WHERE auth_id = auth.uid() 
        AND (role = 'super_admin' OR role = 'gestor')
    )
);

-- B. INSERT: O próprio usuário autenticado pode enviar mensagens em seu nome
CREATE POLICY "community_messages_insert" ON public.community_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id
);

-- C. UPDATE: O destinatário pode atualizar a mensagem (necessário para marcar como lida - "read")
CREATE POLICY "community_messages_update" ON public.community_messages FOR UPDATE USING (
    auth.uid() = receiver_id
) WITH CHECK (
    auth.uid() = receiver_id
);

-- D. DELETE: O remetente ou administradores podem excluir a mensagem
CREATE POLICY "community_messages_delete" ON public.community_messages FOR DELETE USING (
    auth.uid() = sender_id OR
    EXISTS (
        SELECT 1 FROM public.usuarios 
        WHERE auth_id = auth.uid() 
        AND (role = 'super_admin' OR role = 'gestor')
    )
);

-- =================================================================================
-- 8. DIAGNÓSTICO DE POLÍTICAS (RPC HELPER)
-- =================================================================================
DROP FUNCTION IF EXISTS public.get_table_policies();

CREATE OR REPLACE FUNCTION public.get_table_policies()
RETURNS TABLE(p_name text, p_cmd text, p_qual text, p_with_check text) AS $$
BEGIN
    RETURN QUERY
    SELECT policyname::text, cmd::text, qual::text, with_check::text
    FROM pg_policies
    WHERE tablename = 'community_messages';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Recarregar o cache do PostgREST para o Supabase reconhecer as novas colunas e chaves
NOTIFY pgrst, 'reload schema';

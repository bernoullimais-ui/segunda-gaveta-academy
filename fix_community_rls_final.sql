-- =================================================================================
-- CORREÇÃO FINAL DAS POLÍTICAS DE RLS PARA A COMUNIDADE
-- Execute este script no SQL Editor do console do seu projeto no Supabase.
-- =================================================================================

-- 1. LIMPAR POLÍTICAS ANTIGAS NAS QUATRO TABELAS
DROP POLICY IF EXISTS "community_messages_select" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_insert" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_update" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_delete" ON public.community_messages;

DROP POLICY IF EXISTS "community_posts_select" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_insert" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_update" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_delete" ON public.community_posts;

DROP POLICY IF EXISTS "community_comments_select" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_insert" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_update" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_delete" ON public.community_comments;

DROP POLICY IF EXISTS "community_likes_select" ON public.community_likes;
DROP POLICY IF EXISTS "community_likes_insert" ON public.community_likes;
DROP POLICY IF EXISTS "community_likes_delete" ON public.community_likes;


-- 2. NOVAS POLÍTICAS PARA: community_messages (Mensagens Diretas)
-- sender_id e receiver_id armazenam o UUID de autenticação (auth.uid())
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_messages_select" ON public.community_messages 
    FOR SELECT USING (
        auth.uid() = sender_id OR 
        auth.uid() = receiver_id OR 
        get_current_user_role() = 'super_admin' OR
        get_current_user_role() = 'gestor'
    );

CREATE POLICY "community_messages_insert" ON public.community_messages 
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
    );

CREATE POLICY "community_messages_update" ON public.community_messages 
    FOR UPDATE USING (
        auth.uid() = receiver_id
    );

CREATE POLICY "community_messages_delete" ON public.community_messages 
    FOR DELETE USING (
        auth.uid() = sender_id OR 
        auth.uid() = receiver_id OR 
        get_current_user_role() = 'super_admin' OR
        get_current_user_role() = 'gestor'
    );


-- 3. NOVAS POLÍTICAS PARA: community_posts (Feed)
-- user_id armazena o UUID de autenticação (auth.uid())
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_posts_select" ON public.community_posts 
    FOR SELECT USING (
        get_current_user_role() = 'super_admin' OR 
        get_user_organizacao_id() = organizacao_id
    );

CREATE POLICY "community_posts_insert" ON public.community_posts 
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND (
            get_current_user_role() = 'super_admin' OR
            get_user_organizacao_id() = organizacao_id
        )
    );

CREATE POLICY "community_posts_update" ON public.community_posts 
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        get_current_user_role() = 'super_admin' OR (
            get_current_user_role() = 'especialista' AND 
            get_user_organizacao_id() = organizacao_id
        )
    );

CREATE POLICY "community_posts_delete" ON public.community_posts 
    FOR DELETE USING (
        auth.uid() = user_id OR 
        get_current_user_role() = 'super_admin' OR (
            get_current_user_role() = 'especialista' AND 
            get_user_organizacao_id() = organizacao_id
        )
    );


-- 4. NOVAS POLÍTICAS PARA: community_comments (Comentários)
-- user_id armazena o UUID de autenticação (auth.uid())
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_comments_select" ON public.community_comments 
    FOR SELECT USING (
        get_current_user_role() = 'super_admin' OR 
        get_user_organizacao_id() = get_post_organizacao_id(post_id)
    );

CREATE POLICY "community_comments_insert" ON public.community_comments 
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND (
            get_current_user_role() = 'super_admin' OR
            get_user_organizacao_id() = get_post_organizacao_id(post_id)
        )
    );

CREATE POLICY "community_comments_update" ON public.community_comments 
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        get_current_user_role() = 'super_admin'
    );

CREATE POLICY "community_comments_delete" ON public.community_comments 
    FOR DELETE USING (
        auth.uid() = user_id OR 
        get_current_user_role() = 'super_admin' OR (
            get_current_user_role() = 'especialista' AND 
            get_user_organizacao_id() = get_post_organizacao_id(post_id)
        )
    );


-- 5. NOVAS POLÍTICAS PARA: community_likes (Curtidas)
-- user_id armazena o UUID de autenticação (auth.uid())
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_likes_select" ON public.community_likes 
    FOR SELECT USING (
        get_current_user_role() = 'super_admin' OR 
        get_user_organizacao_id() = get_post_organizacao_id(post_id)
    );

CREATE POLICY "community_likes_insert" ON public.community_likes 
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND (
            get_current_user_role() = 'super_admin' OR
            get_user_organizacao_id() = get_post_organizacao_id(post_id)
        )
    );

CREATE POLICY "community_likes_delete" ON public.community_likes 
    FOR DELETE USING (
        auth.uid() = user_id
    );


-- 6. RECARREGAR O SCHEMA CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';

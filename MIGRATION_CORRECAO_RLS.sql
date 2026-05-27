
-- =================================================================================
-- MIGRATION: CORREÇÃO DE RLS E CONTADORES DA COMUNIDADE
-- EXECUTE ESTE SQL NO SQL EDITOR DO SUPABASE DASHBOARD
-- =================================================================================

-- 1. Triggers com SECURITY DEFINER para ignorar RLS ao atualizar contadores de posts
-- Isso garante que as curtidas e comentários de qualquer usuário atualizem o contador no post.
CREATE OR REPLACE FUNCTION public.handle_community_comment_count() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.community_posts SET comments_count = (SELECT count(*) FROM community_comments WHERE post_id = NEW.post_id) WHERE id = NEW.post_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.community_posts SET comments_count = (SELECT count(*) FROM community_comments WHERE post_id = OLD.post_id) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_community_like_count() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.community_posts SET likes_count = (SELECT count(*) FROM community_likes WHERE post_id = NEW.post_id) WHERE id = NEW.post_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.community_posts SET likes_count = (SELECT count(*) FROM community_likes WHERE post_id = OLD.post_id) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atualizar políticas de community_posts para incluir gestores e coordenadores (via reference_id)
DROP POLICY IF EXISTS "community_posts_update" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_delete" ON public.community_posts;

CREATE POLICY "community_posts_update" ON public.community_posts FOR UPDATE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM usuarios u 
        WHERE u.id = auth.uid() 
        AND (u.role = 'admin' OR u.is_super_admin = TRUE)
    ) OR
    EXISTS (
        SELECT 1 FROM avaliadores a
        WHERE a.id = (SELECT reference_id FROM usuarios WHERE id = auth.uid())
        AND a.funcao IN ('gestor', 'coordenador')
    )
);

CREATE POLICY "community_posts_delete" ON public.community_posts FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM usuarios u 
        WHERE u.id = auth.uid() 
        AND (u.role = 'admin' OR u.is_super_admin = TRUE)
    ) OR
    EXISTS (
        SELECT 1 FROM avaliadores a
        WHERE a.id = (SELECT reference_id FROM usuarios WHERE id = auth.uid())
        AND a.funcao IN ('gestor', 'coordenador')
    )
);

-- 3. Garantir que as mensagens possam ser inseridas se o sender_id for o usuário logado
DROP POLICY IF EXISTS "community_messages_insert" ON public.community_messages;
CREATE POLICY "community_messages_insert" ON public.community_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 4. Permitir leitura de curtidas por todos
DROP POLICY IF EXISTS "community_likes_select" ON public.community_likes;
CREATE POLICY "community_likes_select" ON public.community_likes FOR SELECT USING (true);

-- 1. Triggers com SECURITY DEFINER para atualizar contadores de posts
-- Isso permite que usuários comuns "disparem" atualizações de contagem no post sem precisar de permissão de escrita direta no post.
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

-- 2. Políticas de Posts corrigidas (verificando funcao em avaliadores através do reference_id)
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

-- 3. Política de inserção de mensagens (sender_id deve ser o cara logado)
DROP POLICY IF EXISTS "community_messages_insert" ON public.community_messages;
CREATE POLICY "community_messages_insert" ON public.community_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 4. Criar política de SELECT para curtidas (estava faltando ou restrita)
DROP POLICY IF EXISTS "community_likes_select" ON public.community_likes;
CREATE POLICY "community_likes_select" ON public.community_likes FOR SELECT USING (true);

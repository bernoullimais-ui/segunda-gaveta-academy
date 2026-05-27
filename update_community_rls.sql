
-- 1. Tornar funções de trigger SECURITY DEFINER para ignorar RLS ao atualizar contadores
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

-- 2. Atualizar políticas de community_posts para incluir gestores e coordenadores
-- Primeiro remover as antigas para evitar erros de duplicidade ou sobreposição
DROP POLICY IF EXISTS "community_posts_update" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_delete" ON public.community_posts;

CREATE POLICY "community_posts_update" ON public.community_posts FOR UPDATE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_super_admin = TRUE OR funcao IN ('gestor', 'coordenador'))
    )
);

CREATE POLICY "community_posts_delete" ON public.community_posts FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_super_admin = TRUE OR funcao IN ('gestor', 'coordenador'))
    )
);

-- 3. Garantir que as mensagens possam ser inseridas se o sender_id for o usuário logado
-- Remover e recriar para garantir
DROP POLICY IF EXISTS "community_messages_insert" ON public.community_messages;
CREATE POLICY "community_messages_insert" ON public.community_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 4. Permitir que o trigger de likes_count funcione corretamente
-- O trigger já foi atualizado para SECURITY DEFINER acima.

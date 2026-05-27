-- =================================================================================
-- CORREÇÃO DE CONTADORES E TRIGGERS PARA A COMUNIDADE (POSTS, COMENTÁRIOS E CURTIDAS)
-- Execute este script no SQL Editor do seu console do Supabase para corrigir os contadores.
-- =================================================================================

-- 1. Recalcular e atualizar todos os contadores de comentários e curtidas existentes
UPDATE public.community_posts p
SET 
  comments_count = (SELECT COALESCE(count(*), 0) FROM public.community_comments WHERE post_id = p.id),
  likes_count = (SELECT COALESCE(count(*), 0) FROM public.community_likes WHERE post_id = p.id);

-- 2. Garantir que a função do trigger de comentários existe com SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_community_comment_count() 
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.community_posts 
        SET comments_count = (SELECT COALESCE(count(*), 0) FROM public.community_comments WHERE post_id = NEW.post_id) 
        WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.community_posts 
        SET comments_count = (SELECT COALESCE(count(*), 0) FROM public.community_comments WHERE post_id = OLD.post_id) 
        WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar o trigger de comentários
DROP TRIGGER IF EXISTS on_comment_added_or_removed ON public.community_comments;
DROP TRIGGER IF EXISTS tr_update_comments_count ON public.community_comments;

CREATE TRIGGER on_comment_added_or_removed 
AFTER INSERT OR DELETE ON public.community_comments 
FOR EACH ROW 
EXECUTE FUNCTION public.handle_community_comment_count();


-- 3. Garantir que a função do trigger de curtidas (likes) existe com SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_community_like_count() 
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.community_posts 
        SET likes_count = (SELECT COALESCE(count(*), 0) FROM public.community_likes WHERE post_id = NEW.post_id) 
        WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.community_posts 
        SET likes_count = (SELECT COALESCE(count(*), 0) FROM public.community_likes WHERE post_id = OLD.post_id) 
        WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar o trigger de curtidas
DROP TRIGGER IF EXISTS on_like_added_or_removed ON public.community_likes;
DROP TRIGGER IF EXISTS tr_update_likes_count ON public.community_likes;

CREATE TRIGGER on_like_added_or_removed 
AFTER INSERT OR DELETE ON public.community_likes 
FOR EACH ROW 
EXECUTE FUNCTION public.handle_community_like_count();

-- 4. Notificar PostgREST para atualizar cache
NOTIFY pgrst, 'reload schema';

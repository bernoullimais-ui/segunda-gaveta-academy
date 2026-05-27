
-- =================================================================================
-- CONFIGURAÇÃO DA ÁREA DE COMUNIDADE (POSTS, COMENTÁRIOS, CURTIDAS E MENSAGENS)
-- =================================================================================

-- 1. Criar tabelas se não existirem
-- Removendo para garantir que o esquema novo (autor_id) seja aplicado corretamente
DROP TABLE IF EXISTS public.community_likes CASCADE;
DROP TABLE IF EXISTS public.community_comments CASCADE;
DROP TABLE IF EXISTS public.community_messages CASCADE;
DROP TABLE IF EXISTS public.community_posts CASCADE;

CREATE TABLE public.community_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    autor_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    user_nome TEXT NOT NULL,
    user_role TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Dúvidas', 'Avisos', 'Geral')),
    organizacao_id UUID REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0
);

CREATE TABLE public.community_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
    autor_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    user_nome TEXT NOT NULL,
    user_role TEXT NOT NULL,
    content TEXT NOT NULL
);

-- Tabela de Curtidas (para evitar curtidas duplicadas e permitir descurtir)
CREATE TABLE public.community_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    UNIQUE(post_id, usuario_id)
);

-- Tabela de Mensagens Diretas (DMs)
CREATE TABLE public.community_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sender_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    sender_nome TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    receiver_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    receiver_nome TEXT NOT NULL,
    content TEXT NOT NULL,
    organizacao_id UUID REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    read BOOLEAN DEFAULT FALSE
);

-- 2. Habilitar RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- 3. Limpar políticas antigas
DROP POLICY IF EXISTS "community_posts_select" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_insert" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_update" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_delete" ON public.community_posts;

DROP POLICY IF EXISTS "community_comments_select" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_insert" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_all" ON public.community_comments;

DROP POLICY IF EXISTS "community_likes_select" ON public.community_likes;
DROP POLICY IF EXISTS "community_likes_insert" ON public.community_likes;
DROP POLICY IF EXISTS "community_likes_delete" ON public.community_likes;

DROP POLICY IF EXISTS "community_messages_select" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_insert" ON public.community_messages;

-- 4. Políticas para community_posts
CREATE POLICY "community_posts_select" ON public.community_posts FOR SELECT USING (organizacao_id IN (SELECT organizacao_id FROM usuarios WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "community_posts_insert" ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = autor_id);
CREATE POLICY "community_posts_update" ON public.community_posts FOR UPDATE USING (auth.uid() = autor_id OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND (role IN ('gestor', 'curador', 'super_admin'))));
CREATE POLICY "community_posts_delete" ON public.community_posts FOR DELETE USING (auth.uid() = autor_id OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND (role IN ('gestor', 'curador', 'super_admin'))));

-- 5. Políticas para community_comments
CREATE POLICY "community_comments_select" ON public.community_comments FOR SELECT USING (EXISTS (SELECT 1 FROM community_posts WHERE id = post_id AND (organizacao_id IN (SELECT organizacao_id FROM usuarios WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'super_admin'))));
CREATE POLICY "community_comments_insert" ON public.community_comments FOR INSERT WITH CHECK (auth.uid() = autor_id);
CREATE POLICY "community_comments_all" ON public.community_comments FOR ALL USING (auth.uid() = autor_id OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND (role IN ('gestor', 'curador', 'super_admin'))));

-- 6. Políticas para community_likes
CREATE POLICY "community_likes_select" ON public.community_likes FOR SELECT USING (TRUE);
CREATE POLICY "community_likes_insert" ON public.community_likes FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "community_likes_delete" ON public.community_likes FOR DELETE USING (auth.uid() = usuario_id);

-- 7. Políticas para community_messages (Privacidade Total)
CREATE POLICY "community_messages_select" ON public.community_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "community_messages_insert" ON public.community_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 8. Gatilhos (Triggers)
-- Contador de Comentários
CREATE OR REPLACE FUNCTION public.handle_community_comment_count() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.community_posts SET comments_count = (SELECT count(*) FROM community_comments WHERE post_id = NEW.post_id) WHERE id = NEW.post_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.community_posts SET comments_count = (SELECT count(*) FROM community_comments WHERE post_id = OLD.post_id) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_comment_added_or_removed ON public.community_comments;
CREATE TRIGGER on_comment_added_or_removed AFTER INSERT OR DELETE ON public.community_comments FOR EACH ROW EXECUTE FUNCTION public.handle_community_comment_count();

-- Contador de Curtidas
CREATE OR REPLACE FUNCTION public.handle_community_like_count() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.community_posts SET likes_count = (SELECT count(*) FROM community_likes WHERE post_id = NEW.post_id) WHERE id = NEW.post_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.community_posts SET likes_count = (SELECT count(*) FROM community_likes WHERE post_id = OLD.post_id) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_like_added_or_removed ON public.community_likes;
CREATE TRIGGER on_like_added_or_removed AFTER INSERT OR DELETE ON public.community_likes FOR EACH ROW EXECUTE FUNCTION public.handle_community_like_count();

-- 9. Ativar Realtime
DO $$
BEGIN
    -- Check if tables exist before adding to publication
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'community_posts') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_posts') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'community_comments') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_comments') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'community_likes') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_likes') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.community_likes;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'community_messages') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_messages') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
        END IF;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

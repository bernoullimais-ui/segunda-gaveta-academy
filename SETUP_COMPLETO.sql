-- ==========================================
-- SCRIPT DE CONFIGURAÇÃO COMPLETA (SUPABASE)
-- ==========================================
-- Este script limpa e recria todas as tabelas necessárias.
-- ATENÇÃO: Isso apagará dados existentes se você já tiver algum.

-- 1. Limpeza de Publicações (Realtime)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Remove individualmente apenas se a tabela estiver na publicação
        IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'community_posts') THEN
            ALTER PUBLICATION supabase_realtime DROP TABLE community_posts;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'community_comments') THEN
            ALTER PUBLICATION supabase_realtime DROP TABLE community_comments;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'community_likes') THEN
            ALTER PUBLICATION supabase_realtime DROP TABLE community_likes;
        END IF;
    END IF;
END $$;

-- 2. Limpeza de Tabelas (Ordem correta para evitar erros de FK)
DROP TABLE IF EXISTS public.community_likes CASCADE;
DROP TABLE IF EXISTS public.community_comments CASCADE;
DROP TABLE IF EXISTS public.community_posts CASCADE;
DROP TABLE IF EXISTS public.curso_participantes CASCADE;
DROP TABLE IF EXISTS public.trilha_cursos CASCADE;
DROP TABLE IF EXISTS public.trilhas CASCADE;
DROP TABLE IF EXISTS public.cursos CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.organizacoes CASCADE;
DROP TABLE IF EXISTS public.questoes_teoricas CASCADE;

-- 3. Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 4. Criar Tabela de Organizações
CREATE TABLE public.organizacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    logo_url TEXT,
    cor_primaria TEXT DEFAULT '#6366f1',
    config_json JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Criar Tabela de Usuários
CREATE TABLE public.usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    nome TEXT,
    role TEXT NOT NULL CHECK (role IN ('gestor', 'curador', 'design', 'especialista', 'professor_convidado', 'membro', 'super_admin')),
    organizacao_id UUID REFERENCES public.organizacoes(id) ON DELETE SET NULL,
    telefone TEXT,
    avatar_url TEXT,
    codigo_convite TEXT UNIQUE,
    auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    bio TEXT,
    curriculo_json JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Criar Tabela de Cursos
CREATE TABLE public.cursos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacao_id UUID REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    thumbnail_url TEXT,
    categoria TEXT,
    status TEXT DEFAULT 'rascunho',
    especialista_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    professor_nome TEXT,
    professor_titulo TEXT,
    professor_foto_url TEXT,
    preco TEXT DEFAULT 'gratuito',
    valor DECIMAL(10,2),
    ritmo TEXT DEFAULT 'proprio',
    duracao INTEGER,
    duracao_tipo TEXT DEFAULT 'Dias',
    carga_horaria TEXT,
    em_breve BOOLEAN DEFAULT FALSE,
    curriculo_json JSONB DEFAULT '[]'::JSONB,
    configuracao_json JSONB DEFAULT '{}'::JSONB,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Criar Tabelas de Comunidade
CREATE TABLE public.community_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacao_id UUID REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    autor_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    titulo TEXT,
    conteudo TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.community_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
    autor_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    conteudo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.community_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, usuario_id)
);

-- 8. Habilitar Segurança (RLS)
ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

-- 9. Políticas de Acesso (Liberação total por enquanto para facilitar o setup)
CREATE POLICY "Acesso Total" ON public.organizacoes FOR ALL USING (true);
CREATE POLICY "Acesso Total" ON public.usuarios FOR ALL USING (true);
CREATE POLICY "Acesso Total" ON public.cursos FOR ALL USING (true);
CREATE POLICY "Acesso Total" ON public.community_posts FOR ALL USING (true);
CREATE POLICY "Acesso Total" ON public.community_comments FOR ALL USING (true);
CREATE POLICY "Acesso Total" ON public.community_likes FOR ALL USING (true);

-- 10. Funções Úteis (RPC para deletar organização com segurança)
CREATE OR REPLACE FUNCTION delete_organization(org_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.organizacoes WHERE id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Habilitar Realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    
    ALTER PUBLICATION supabase_realtime ADD TABLE community_posts;
    ALTER PUBLICATION supabase_realtime ADD TABLE community_comments;
    ALTER PUBLICATION supabase_realtime ADD TABLE community_likes;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

NOTIFY pgrst, 'reload schema';

-- migration_notificacoes.sql
-- 1. Criar tabela de notificacoes
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  organizacao_id UUID REFERENCES public.organizacoes(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('like', 'reply', 'dm', 'curso', 'aula', 'medalha')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link JSONB DEFAULT '{}'::jsonb, -- metadata containing link path/options (e.g. {"tab": "comunidade", "postId": "uuid"} or {"tab": "cursos", "courseId": "uuid"})
  lida BOOLEAN DEFAULT false NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users view own notifications" ON public.notificacoes;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notificacoes;
DROP POLICY IF EXISTS "Users delete own notifications" ON public.notificacoes;

-- Criar políticas RLS
CREATE POLICY "Users view own notifications" ON public.notificacoes
  FOR SELECT USING (auth.uid() = (SELECT auth_id FROM public.usuarios WHERE id = usuario_id));

CREATE POLICY "Users update own notifications" ON public.notificacoes
  FOR UPDATE USING (auth.uid() = (SELECT auth_id FROM public.usuarios WHERE id = usuario_id));

CREATE POLICY "Users delete own notifications" ON public.notificacoes
  FOR DELETE USING (auth.uid() = (SELECT auth_id FROM public.usuarios WHERE id = usuario_id));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_id_lida ON public.notificacoes(usuario_id, lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_organizacao_id ON public.notificacoes(organizacao_id);

-- 2. Trigger para novos Likes
CREATE OR REPLACE FUNCTION public.trg_notify_like()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_auth_id UUID;
  v_post_author_profile_id UUID;
  v_post_title TEXT;
  v_liker_name TEXT;
  v_org_id UUID;
BEGIN
  -- Obter autor do post, título e organizacao_id
  SELECT user_id, title, organizacao_id INTO v_post_author_auth_id, v_post_title, v_org_id
  FROM public.community_posts
  WHERE id = NEW.post_id;
  
  -- Obter nome de quem deu like
  SELECT nome INTO v_liker_name
  FROM public.usuarios
  WHERE auth_id = NEW.user_id;

  -- Obter ID interno (profile_id) do autor do post
  SELECT id INTO v_post_author_profile_id
  FROM public.usuarios
  WHERE auth_id = v_post_author_auth_id;

  -- Inserir notificação se não for o próprio autor do post
  IF v_post_author_profile_id IS NOT NULL AND NEW.user_id <> v_post_author_auth_id THEN
    INSERT INTO public.notificacoes (usuario_id, organizacao_id, tipo, titulo, message, link) -- Note: columns inside trigger should match target table
    VALUES (
      v_post_author_profile_id,
      v_org_id,
      'like',
      'Novo like no seu post! ❤️',
      coalesce(v_liker_name, 'Alguém') || ' curtiu seu post: "' || substring(v_post_title from 1 for 40) || '"',
      jsonb_build_object('tab', 'comunidade', 'postId', NEW.post_id)
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Evitar travar a ação principal (like) se houver erro ao criar notificação
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajustar a query de INSERT no trigger trg_notify_like para usar a coluna correta 'mensagem'
CREATE OR REPLACE FUNCTION public.trg_notify_like()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_auth_id UUID;
  v_post_author_profile_id UUID;
  v_post_title TEXT;
  v_liker_name TEXT;
  v_org_id UUID;
BEGIN
  SELECT user_id, title, organizacao_id INTO v_post_author_auth_id, v_post_title, v_org_id
  FROM public.community_posts
  WHERE id = NEW.post_id;
  
  SELECT nome INTO v_liker_name
  FROM public.usuarios
  WHERE auth_id = NEW.user_id;

  SELECT id INTO v_post_author_profile_id
  FROM public.usuarios
  WHERE auth_id = v_post_author_auth_id;

  IF v_post_author_profile_id IS NOT NULL AND NEW.user_id <> v_post_author_auth_id THEN
    INSERT INTO public.notificacoes (usuario_id, organizacao_id, tipo, titulo, mensagem, link)
    VALUES (
      v_post_author_profile_id,
      v_org_id,
      'like',
      'Novo like no seu post! ❤️',
      coalesce(v_liker_name, 'Alguém') || ' curtiu seu post: "' || substring(v_post_title from 1 for 40) || '"',
      jsonb_build_object('tab', 'comunidade', 'postId', NEW.post_id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_community_like ON public.community_likes;
CREATE TRIGGER on_community_like
  AFTER INSERT ON public.community_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_like();

-- 3. Trigger para novos Comentários
CREATE OR REPLACE FUNCTION public.trg_notify_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_auth_id UUID;
  v_post_author_profile_id UUID;
  v_post_title TEXT;
  v_commenter_name TEXT;
  v_org_id UUID;
BEGIN
  SELECT user_id, title, organizacao_id INTO v_post_author_auth_id, v_post_title, v_org_id
  FROM public.community_posts
  WHERE id = NEW.post_id;
  
  SELECT nome INTO v_commenter_name
  FROM public.usuarios
  WHERE auth_id = NEW.user_id;

  SELECT id INTO v_post_author_profile_id
  FROM public.usuarios
  WHERE auth_id = v_post_author_auth_id;

  IF v_post_author_profile_id IS NOT NULL AND NEW.user_id <> v_post_author_auth_id THEN
    INSERT INTO public.notificacoes (usuario_id, organizacao_id, tipo, titulo, mensagem, link)
    VALUES (
      v_post_author_profile_id,
      v_org_id,
      'reply',
      'Novo comentário no seu post! 💬',
      coalesce(v_commenter_name, 'Alguém') || ' comentou no seu post: "' || substring(v_post_title from 1 for 40) || '"',
      jsonb_build_object('tab', 'comunidade', 'postId', NEW.post_id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_community_comment ON public.community_comments;
CREATE TRIGGER on_community_comment
  AFTER INSERT ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_comment();

-- 4. Trigger para Mensagens Diretas (DMs)
CREATE OR REPLACE FUNCTION public.trg_notify_dm()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_name TEXT;
  v_org_id UUID;
  v_receiver_profile_id UUID;
BEGIN
  SELECT nome, organizacao_id INTO v_sender_name, v_org_id
  FROM public.usuarios
  WHERE auth_id = NEW.sender_id;

  SELECT id INTO v_receiver_profile_id
  FROM public.usuarios
  WHERE auth_id = NEW.receiver_id;

  IF v_receiver_profile_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (usuario_id, organizacao_id, tipo, titulo, mensagem, link)
    VALUES (
      v_receiver_profile_id,
      coalesce(v_org_id, NEW.organizacao_id),
      'dm',
      'Nova mensagem direta! ✉️',
      coalesce(v_sender_name, 'Alguém') || ' te enviou uma mensagem.',
      jsonb_build_object('tab', 'comunidade', 'dmSenderId', NEW.sender_id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_community_message ON public.community_messages;
CREATE TRIGGER on_community_message
  AFTER INSERT ON public.community_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_dm();

-- 5. Trigger para Curso Publicado
CREATE OR REPLACE FUNCTION public.trg_notify_new_course()
RETURNS TRIGGER AS $$
DECLARE
  v_user RECORD;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'ativo') OR (TG_OP = 'UPDATE' AND OLD.status <> 'ativo' AND NEW.status = 'ativo') THEN
    FOR v_user IN 
      SELECT id FROM public.usuarios 
      WHERE organizacao_id = NEW.organizacao_id 
      AND role = 'membro'
    LOOP
      INSERT INTO public.notificacoes (usuario_id, organizacao_id, tipo, titulo, mensagem, link)
      VALUES (
        v_user.id,
        NEW.organizacao_id,
        'curso',
        'Novo curso disponível! 🎓',
        'O curso "' || NEW.nome || '" foi publicado. Comece a estudar agora!',
        jsonb_build_object('tab', 'cursos', 'courseId', NEW.id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_course_published ON public.cursos;
CREATE TRIGGER on_course_published
  AFTER INSERT OR UPDATE ON public.cursos
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_course();

-- 6. Habilitar Supabase Realtime para a tabela notificacoes de forma segura
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notificacoes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
    END IF;
  END IF;
END $$;

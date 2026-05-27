-- MIGRATION: Adicionar coluna is_pinned à tabela community_posts
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Atualizar RLS para garantir que admins possam editar posts (incluindo fixar)
DROP POLICY IF EXISTS "community_posts_update" ON public.community_posts;
CREATE POLICY "community_posts_update" ON public.community_posts FOR UPDATE USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND (role = 'admin' OR role = 'coordenador'))
);

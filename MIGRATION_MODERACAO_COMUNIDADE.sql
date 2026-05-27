-- =================================================================================
-- MIGRATION: MODERAÇÃO DE COMUNIDADE (POSTS, COMENTÁRIOS E MENSAGENS)
-- Execute este script no SQL Editor do console do Supabase.
-- =================================================================================

-- 1. Habilitar Segurança de Linha (RLS)
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- =================================================================================
-- 2. POLÍTICAS DE RLS PARA POSTAGENS (COMMUNITY_POSTS)
-- =================================================================================

-- SELECT: Super Admins veem tudo. Especialistas e Membros veem apenas posts de sua organização.
DROP POLICY IF EXISTS "community_posts_select" ON public.community_posts;
CREATE POLICY "community_posts_select" ON public.community_posts FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.auth_id = auth.uid()
        AND (u.role = 'super_admin' OR u.organizacao_id = public.community_posts.organizacao_id)
    )
);

-- INSERT: Qualquer usuário autenticado pode criar posts como si mesmo
DROP POLICY IF EXISTS "community_posts_insert" ON public.community_posts;
CREATE POLICY "community_posts_insert" ON public.community_posts FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- UPDATE: O autor pode atualizar, OU o Super Admin (global), OU o especialista daquela organização (moderador)
DROP POLICY IF EXISTS "community_posts_update" ON public.community_posts;
CREATE POLICY "community_posts_update" ON public.community_posts FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.auth_id = auth.uid()
        AND (
            u.role = 'super_admin' 
            OR (u.role = 'especialista' AND u.organizacao_id = public.community_posts.organizacao_id)
        )
    )
);

-- DELETE: O autor pode deletar, OU o Super Admin (global), OU o especialista daquela organização (moderador)
DROP POLICY IF EXISTS "community_posts_delete" ON public.community_posts;
CREATE POLICY "community_posts_delete" ON public.community_posts FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.auth_id = auth.uid()
        AND (
            u.role = 'super_admin' 
            OR (u.role = 'especialista' AND u.organizacao_id = public.community_posts.organizacao_id)
        )
    )
);


-- =================================================================================
-- 3. POLÍTICAS DE RLS PARA COMENTÁRIOS (COMMUNITY_COMMENTS)
-- =================================================================================

-- SELECT: Todos os usuários autenticados podem ver os comentários
DROP POLICY IF EXISTS "community_comments_select" ON public.community_comments;
CREATE POLICY "community_comments_select" ON public.community_comments FOR SELECT USING (true);

-- INSERT: Qualquer usuário autenticado pode criar comentários como si mesmo
DROP POLICY IF EXISTS "community_comments_insert" ON public.community_comments;
CREATE POLICY "community_comments_insert" ON public.community_comments FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- DELETE: O autor pode deletar, OU o Super Admin (global), OU o especialista daquela organização (moderador)
DROP POLICY IF EXISTS "community_comments_delete" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_all" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_all_v2" ON public.community_comments;

CREATE POLICY "community_comments_delete" ON public.community_comments FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.auth_id = auth.uid()
        AND (
            u.role = 'super_admin' 
            OR (
                u.role = 'especialista' 
                AND u.organizacao_id = (
                    SELECT organizacao_id FROM public.community_posts p 
                    WHERE p.id = public.community_comments.post_id
                )
            )
        )
    )
);


-- =================================================================================
-- 4. POLÍTICAS DE RLS PARA MENSAGENS DIRETAS (COMMUNITY_MESSAGES)
-- =================================================================================

-- SELECT: O remetente, o destinatário ou o Super Admin (global)
DROP POLICY IF EXISTS "community_messages_select" ON public.community_messages;
CREATE POLICY "community_messages_select" ON public.community_messages FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.auth_id = auth.uid()
        AND u.role = 'super_admin'
    )
);

-- INSERT: O remetente deve ser o usuário autenticado
DROP POLICY IF EXISTS "community_messages_insert" ON public.community_messages;
CREATE POLICY "community_messages_insert" ON public.community_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id
);

-- UPDATE: O destinatário pode atualizar (ex: marcar como lida)
DROP POLICY IF EXISTS "community_messages_update" ON public.community_messages;
CREATE POLICY "community_messages_update" ON public.community_messages FOR UPDATE USING (
    auth.uid() = receiver_id
);

-- DELETE: O remetente ou o Super Admin (global)
DROP POLICY IF EXISTS "community_messages_delete" ON public.community_messages;
CREATE POLICY "community_messages_delete" ON public.community_messages FOR DELETE USING (
    auth.uid() = sender_id OR
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.auth_id = auth.uid()
        AND u.role = 'super_admin'
    )
);

-- 5. Recarregar o cache do PostgREST
NOTIFY pgrst, 'reload schema';


-- =================================================================================
-- CONSOLIDATED RLS FOR COMMUNITY (POSTS, COMMENTS, LIKES, MESSAGES)
-- =================================================================================

-- 1. Permissões para community_posts
DROP POLICY IF EXISTS "community_posts_delete" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_update" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_insert" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_select" ON public.community_posts;

CREATE POLICY "community_posts_select" ON public.community_posts FOR SELECT USING (
    organizacao_id IN (SELECT organizacao_id FROM usuarios WHERE id = auth.uid()) OR 
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND COALESCE(is_super_admin, FALSE) = TRUE)
);

CREATE POLICY "community_posts_insert" ON public.community_posts FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

CREATE POLICY "community_posts_update" ON public.community_posts FOR UPDATE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM usuarios u 
        WHERE u.id = auth.uid() 
        AND (LOWER(u.role) = 'admin' OR COALESCE(u.is_super_admin, FALSE) = TRUE)
    ) OR
    EXISTS (
        SELECT 1 FROM avaliadores a
        WHERE a.id = (SELECT reference_id FROM usuarios WHERE id = auth.uid())
        AND LOWER(a.funcao) IN ('gestor', 'coordenador')
    )
);

CREATE POLICY "community_posts_delete" ON public.community_posts FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM usuarios u 
        WHERE u.id = auth.uid() 
        AND (LOWER(u.role) = 'admin' OR COALESCE(u.is_super_admin, FALSE) = TRUE)
    ) OR
    EXISTS (
        SELECT 1 FROM avaliadores a
        WHERE a.id = (SELECT reference_id FROM usuarios WHERE id = auth.uid())
        AND LOWER(a.funcao) IN ('gestor', 'coordenador')
    )
);

-- 2. Permissões para community_messages
DROP POLICY IF EXISTS "community_messages_delete" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_insert" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_select" ON public.community_messages;

CREATE POLICY "community_messages_select" ON public.community_messages FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR 
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND COALESCE(is_super_admin, FALSE) = TRUE)
);

CREATE POLICY "community_messages_insert" ON public.community_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id
);

CREATE POLICY "community_messages_delete" ON public.community_messages FOR DELETE USING (
    auth.uid() = sender_id OR 
    EXISTS (
        SELECT 1 FROM usuarios u 
        WHERE u.id = auth.uid() 
        AND (LOWER(u.role) = 'admin' OR COALESCE(u.is_super_admin, FALSE) = TRUE)
    ) OR
    EXISTS (
        SELECT 1 FROM avaliadores a
        WHERE a.id = (SELECT reference_id FROM usuarios WHERE id = auth.uid())
        AND LOWER(a.funcao) IN ('gestor', 'coordenador')
    )
);

-- 3. Permissões para community_comments
DROP POLICY IF EXISTS "community_comments_all" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_delete" ON public.community_comments;

CREATE POLICY "community_comments_delete" ON public.community_comments FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM usuarios u 
        WHERE u.id = auth.uid() 
        AND (LOWER(u.role) = 'admin' OR COALESCE(u.is_super_admin, FALSE) = TRUE)
    ) OR
    EXISTS (
        SELECT 1 FROM avaliadores a
        WHERE a.id = (SELECT reference_id FROM usuarios WHERE id = auth.uid())
        AND LOWER(a.funcao) IN ('gestor', 'coordenador')
    )
);

NOTIFY pgrst, 'reload schema';

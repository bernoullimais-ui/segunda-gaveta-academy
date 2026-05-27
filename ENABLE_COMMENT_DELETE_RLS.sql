
-- Atualizar políticas de community_comments para permitir que gestores e o autor apaguem comentários
DROP POLICY IF EXISTS "community_comments_all" ON public.community_comments;

CREATE POLICY "community_comments_all" ON public.community_comments FOR ALL USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_super_admin = TRUE OR funcao IN ('gestor', 'coordenador'))
    )
);

-- Caso a coluna funcao não esteja em usuarios mas sim em avaliadores, adicionamos essa verificação também
DROP POLICY IF EXISTS "community_comments_all_v2" ON public.community_comments;
CREATE POLICY "community_comments_all_v2" ON public.community_comments FOR ALL USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_super_admin = TRUE)
    ) OR
    EXISTS (
        SELECT 1 FROM public.avaliadores 
        WHERE id = auth.uid() 
        AND funcao IN ('gestor', 'coordenador')
    )
);

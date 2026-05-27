
-- 1. Permitir excluir mensagens (Direct Messages)
-- O autor da mensagem ou um administrador/super_admin/gestor pode excluir.
DROP POLICY IF EXISTS "community_messages_delete" ON public.community_messages;

CREATE POLICY "community_messages_delete" ON public.community_messages FOR DELETE USING (
    auth.uid() = sender_id OR 
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


-- =================================================================================
-- RECOLOCAÇÃO COMPLETA DE POLÍTICAS E REALTIME (SOLUÇÃO DE VISIBILIDADE)
-- =================================================================================

-- 1. Tabelas de Usuários: Permitir ver outros usuários (essencial para Joins/Nomes)
-- Sem isso, as mensagens aparecem mas o destinatário/remetente vem vazio (null)
DROP POLICY IF EXISTS "usuarios_select_all" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_self" ON public.usuarios;
DROP POLICY IF EXISTS "Ver próprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Admins podem ver usuários da sua organização" ON public.usuarios;

-- Política Generosa: Qualquer usuário autenticado pode ver o perfil básico de outros
-- (Necessário para que remetente/destinatário apareçam na lista de conversas)
CREATE POLICY "usuarios_select_all" ON public.usuarios FOR SELECT USING (auth.uid() IS NOT NULL);

-- 2. Garantir Políticas de Mensagens Comunitárias
DROP POLICY IF EXISTS "community_messages_select" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_insert" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_update" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_delete" ON public.community_messages;

-- Seleção: Eu vejo se sou o remetente OU o destinatário
CREATE POLICY "community_messages_select" ON public.community_messages FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Inserção: Eu posso enviar se eu for o remetente
CREATE POLICY "community_messages_insert" ON public.community_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id
);

-- Update: Eu posso marcar como lida se eu for o destinatário
CREATE POLICY "community_messages_update" ON public.community_messages FOR UPDATE USING (
    auth.uid() = receiver_id
) WITH CHECK (
    auth.uid() = receiver_id
);

-- Delete: Eu posso apagar se eu for o remetente OU se eu for Admin/Gestor
CREATE POLICY "community_messages_delete" ON public.community_messages FOR DELETE USING (
    auth.uid() = sender_id OR 
    EXISTS (
        SELECT 1 FROM public.usuarios 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR COALESCE(is_super_admin, FALSE) = TRUE)
    )
);

-- 3. Certificar Realtime (IMPORTANTÍSSIMO para Mensagens Instantâneas)
-- Primeiro removemos da publicação e depois adicionamos para garantir
DO $$
BEGIN
    -- Limpa para resetar
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS community_posts;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS community_comments;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS community_likes;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS community_messages;
    
    -- Adiciona novamente
    ALTER PUBLICATION supabase_realtime ADD TABLE community_posts;
    ALTER PUBLICATION supabase_realtime ADD TABLE community_comments;
    ALTER PUBLICATION supabase_realtime ADD TABLE community_likes;
    ALTER PUBLICATION supabase_realtime ADD TABLE community_messages;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao configurar Realtime: %', SQLERRM;
END $$;

-- 4. Forçar recarregamento do cache do PostgREST
NOTIFY pgrst, 'reload schema';

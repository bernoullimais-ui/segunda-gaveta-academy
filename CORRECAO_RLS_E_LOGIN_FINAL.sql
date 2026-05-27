-- =================================================================================
-- SCRIPT DEFINITIVO DE CORREÇÃO DE RLS E LOGIN (GAVETA K / SEGUNDA GAVETA ACADEMY)
-- Execute este script no SQL Editor do console do seu projeto no Supabase.
-- =================================================================================

-- 1. CRIAR OU ATUALIZAR AS FUNÇÕES AUXILIARES COM PRIVILÉGIOS SECURITY DEFINER
-- Nota: SECURITY DEFINER faz com que a função execute com os privilégios do criador (bypassing RLS),
-- o que é essencial para evitar loops infinitos de recursão nas checagens.

-- Retorna o organizacao_id do usuário atualmente logado (mapeado pelo auth_id)
CREATE OR REPLACE FUNCTION public.get_user_organizacao_id()
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT organizacao_id INTO org_id FROM public.usuarios WHERE auth_id = auth.uid();
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna a role (papel) do usuário atualmente logado (mapeado pelo auth_id)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.usuarios WHERE auth_id = auth.uid();
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna o ID interno (usuarios.id) do usuário logado (mapeado pelo auth_id)
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS UUID AS $$
DECLARE
    u_id UUID;
BEGIN
    SELECT id INTO u_id FROM public.usuarios WHERE auth_id = auth.uid();
    RETURN u_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna o organizacao_id de um curso específico
CREATE OR REPLACE FUNCTION public.get_curso_organizacao_id(c_id UUID)
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT organizacao_id INTO org_id FROM public.cursos WHERE id = c_id;
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna o organizacao_id de uma postagem de comunidade específica
CREATE OR REPLACE FUNCTION public.get_post_organizacao_id(p_id UUID)
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT organizacao_id INTO org_id FROM public.community_posts WHERE id = p_id;
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna o organizacao_id de uma trilha específica
CREATE OR REPLACE FUNCTION public.get_trilha_organizacao_id(t_id UUID)
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT organizacao_id INTO org_id FROM public.trilhas WHERE id = t_id;
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. LIMPAR TODAS AS POLÍTICAS DE RLS EXISTENTES PARA EVITAR CONFLITOS

DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_delete" ON public.usuarios;
DROP POLICY IF EXISTS "Acesso Total" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir insert no próprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir update no próprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Admins podem gerenciar usuários" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_all" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_self" ON public.usuarios;
DROP POLICY IF EXISTS "Ver próprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Admins podem ver usuários da sua organização" ON public.usuarios;
DROP POLICY IF EXISTS "Super admins podem ver todos os usuários" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_authenticated" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert_self" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_self" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_gestor_manage" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_super_admin_all" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_own" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_org" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_admin" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_own" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_delete_admin" ON public.usuarios;

-- Tabela: organizacoes
DROP POLICY IF EXISTS "organizacoes_select" ON public.organizacoes;
DROP POLICY IF EXISTS "organizacoes_all_super_admin" ON public.organizacoes;
DROP POLICY IF EXISTS "organizacoes_update_admin" ON public.organizacoes;
DROP POLICY IF EXISTS "Acesso Total" ON public.organizacoes;
DROP POLICY IF EXISTS "Super admins podem ver todas as organizações" ON public.organizacoes;
DROP POLICY IF EXISTS "Ver própria organização" ON public.organizacoes;
DROP POLICY IF EXISTS "organizacoes_select_authenticated" ON public.organizacoes;
DROP POLICY IF EXISTS "organizacoes_admin_all" ON public.organizacoes;

-- Tabela: cursos
DROP POLICY IF EXISTS "cursos_select" ON public.cursos;
DROP POLICY IF EXISTS "cursos_modify" ON public.cursos;
DROP POLICY IF EXISTS "Acesso Total" ON public.cursos;
DROP POLICY IF EXISTS "Isolamento Cursos" ON public.cursos;
DROP POLICY IF EXISTS "cursos_isolation" ON public.cursos;

-- Tabela: curso_participantes
DROP POLICY IF EXISTS "curso_participantes_select" ON public.curso_participantes;
DROP POLICY IF EXISTS "curso_participantes_insert" ON public.curso_participantes;
DROP POLICY IF EXISTS "curso_participantes_update" ON public.curso_participantes;
DROP POLICY IF EXISTS "curso_participantes_delete" ON public.curso_participantes;
DROP POLICY IF EXISTS "permit_all_participantes" ON public.curso_participantes;
DROP POLICY IF EXISTS "Isolamento Participantes" ON public.curso_participantes;

-- Tabela: trilhas
DROP POLICY IF EXISTS "trilhas_select" ON public.trilhas;
DROP POLICY IF EXISTS "trilhas_modify" ON public.trilhas;
DROP POLICY IF EXISTS "permit_all_trilhas" ON public.trilhas;
DROP POLICY IF EXISTS "Isolamento Trilhas" ON public.trilhas;

-- Tabela: trilha_cursos
DROP POLICY IF EXISTS "trilha_cursos_select" ON public.trilha_cursos;
DROP POLICY IF EXISTS "trilha_cursos_modify" ON public.trilha_cursos;
DROP POLICY IF EXISTS "permit_all_trilha_cursos" ON public.trilha_cursos;
DROP POLICY IF EXISTS "Isolamento Trilha Cursos" ON public.trilha_cursos;

-- Tabela: questoes_teoricas
DROP POLICY IF EXISTS "questoes_teoricas_select" ON public.questoes_teoricas;
DROP POLICY IF EXISTS "questoes_teoricas_modify" ON public.questoes_teoricas;
DROP POLICY IF EXISTS "permit_all_questoes" ON public.questoes_teoricas;
DROP POLICY IF EXISTS "Isolamento Questoes Teoricas" ON public.questoes_teoricas;

-- Tabela: community_posts
DROP POLICY IF EXISTS "community_posts_select" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_insert" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_update" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_delete" ON public.community_posts;
DROP POLICY IF EXISTS "Acesso Total" ON public.community_posts;

-- Tabela: community_comments
DROP POLICY IF EXISTS "community_comments_select" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_insert" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_update" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_delete" ON public.community_comments;
DROP POLICY IF EXISTS "Acesso Total" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_all" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_all_v2" ON public.community_comments;

-- Tabela: community_likes
DROP POLICY IF EXISTS "community_likes_select" ON public.community_likes;
DROP POLICY IF EXISTS "community_likes_insert" ON public.community_likes;
DROP POLICY IF EXISTS "community_likes_delete" ON public.community_likes;
DROP POLICY IF EXISTS "Acesso Total" ON public.community_likes;

-- Tabela: community_messages
DROP POLICY IF EXISTS "community_messages_select" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_insert" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_update" ON public.community_messages;
DROP POLICY IF EXISTS "community_messages_delete" ON public.community_messages;
DROP POLICY IF EXISTS "Acesso Total" ON public.community_messages;


-- 3. HABILITAR ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS CHAVE
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curso_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trilhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trilha_cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questoes_teoricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;


-- 4. CRIAR NOVAS POLÍTICAS DE RLS SEGURAS E LIVRES DE RECURSÃO
-- TABELA: usuarios
CREATE POLICY "usuarios_select_own" ON public.usuarios FOR SELECT USING (
    auth_id = auth.uid()
);

CREATE POLICY "usuarios_select_org" ON public.usuarios FOR SELECT USING (
    auth.role() = 'authenticated' AND get_user_organizacao_id() = organizacao_id
);

CREATE POLICY "usuarios_select_admin" ON public.usuarios FOR SELECT USING (
    auth.role() = 'authenticated' AND get_current_user_role() = 'super_admin'
);

CREATE POLICY "usuarios_insert" ON public.usuarios FOR INSERT WITH CHECK (
    auth.uid() = auth_id
);

CREATE POLICY "usuarios_update_own" ON public.usuarios FOR UPDATE USING (
    auth_id = auth.uid()
);

CREATE POLICY "usuarios_update_admin" ON public.usuarios FOR UPDATE USING (
    auth.role() = 'authenticated' AND get_current_user_role() = 'super_admin'
);

CREATE POLICY "usuarios_delete_admin" ON public.usuarios FOR DELETE USING (
    auth.role() = 'authenticated' AND get_current_user_role() = 'super_admin'
);

-- TABELA: organizacoes
CREATE POLICY "organizacoes_select" ON public.organizacoes FOR SELECT USING (
    auth.role() = 'authenticated'
);

CREATE POLICY "organizacoes_all_super_admin" ON public.organizacoes FOR ALL USING (
    get_current_user_role() = 'super_admin'
);

CREATE POLICY "organizacoes_update_admin" ON public.organizacoes FOR UPDATE USING (
    get_current_user_role() = 'super_admin' OR (
        get_current_user_role() IN ('especialista', 'gestor') AND 
        get_user_organizacao_id() = id
    )
) WITH CHECK (
    get_current_user_role() = 'super_admin' OR (
        get_current_user_role() IN ('especialista', 'gestor') AND 
        get_user_organizacao_id() = id
    )
);

-- TABELA: cursos
CREATE POLICY "cursos_select" ON public.cursos FOR SELECT USING (
    get_current_user_role() = 'super_admin' OR 
    get_user_organizacao_id() = organizacao_id
);

CREATE POLICY "cursos_modify" ON public.cursos FOR ALL USING (
    get_current_user_role() = 'super_admin' OR (
        get_current_user_role() = 'especialista' AND 
        get_user_organizacao_id() = organizacao_id
    )
);

-- TABELA: curso_participantes (Matrículas)
CREATE POLICY "curso_participantes_select" ON public.curso_participantes FOR SELECT USING (
    get_current_user_role() = 'super_admin' OR 
    (get_current_user_role() = 'especialista' AND get_user_organizacao_id() = get_curso_organizacao_id(curso_id)) OR
    get_user_id() = usuario_id
);

CREATE POLICY "curso_participantes_insert" ON public.curso_participantes FOR INSERT WITH CHECK (
    get_current_user_role() = 'super_admin' OR 
    (get_current_user_role() = 'especialista' AND get_user_organizacao_id() = get_curso_organizacao_id(curso_id)) OR
    get_user_id() = usuario_id
);

CREATE POLICY "curso_participantes_update" ON public.curso_participantes FOR UPDATE USING (
    get_current_user_role() = 'super_admin' OR 
    (get_current_user_role() = 'especialista' AND get_user_organizacao_id() = get_curso_organizacao_id(curso_id)) OR
    get_user_id() = usuario_id
);

CREATE POLICY "curso_participantes_delete" ON public.curso_participantes FOR DELETE USING (
    get_current_user_role() = 'super_admin' OR 
    (get_current_user_role() = 'especialista' AND get_user_organizacao_id() = get_curso_organizacao_id(curso_id))
);

-- TABELA: trilhas
CREATE POLICY "trilhas_select" ON public.trilhas FOR SELECT USING (
    get_current_user_role() = 'super_admin' OR 
    get_user_organizacao_id() = organizacao_id
);

CREATE POLICY "trilhas_modify" ON public.trilhas FOR ALL USING (
    get_current_user_role() = 'super_admin' OR (
        get_current_user_role() = 'especialista' AND 
        get_user_organizacao_id() = organizacao_id
    )
);

-- TABELA: trilha_cursos
CREATE POLICY "trilha_cursos_select" ON public.trilha_cursos FOR SELECT USING (
    get_current_user_role() = 'super_admin' OR 
    get_user_organizacao_id() = get_trilha_organizacao_id(trilha_id)
);

CREATE POLICY "trilha_cursos_modify" ON public.trilha_cursos FOR ALL USING (
    get_current_user_role() = 'super_admin' OR (
        get_current_user_role() = 'especialista' AND 
        get_user_organizacao_id() = get_trilha_organizacao_id(trilha_id)
    )
);

-- TABELA: questoes_teoricas
CREATE POLICY "questoes_teoricas_select" ON public.questoes_teoricas FOR SELECT USING (
    get_current_user_role() = 'super_admin' OR 
    get_user_organizacao_id() = organizacao_id
);

CREATE POLICY "questoes_teoricas_modify" ON public.questoes_teoricas FOR ALL USING (
    get_current_user_role() = 'super_admin' OR (
        get_current_user_role() = 'especialista' AND 
        get_user_organizacao_id() = organizacao_id
    )
);

-- TABELA: community_posts
CREATE POLICY "community_posts_select" ON public.community_posts FOR SELECT USING (
    get_current_user_role() = 'super_admin' OR 
    get_user_organizacao_id() = organizacao_id
);

CREATE POLICY "community_posts_insert" ON public.community_posts FOR INSERT WITH CHECK (
    get_user_id() = autor_id AND (
        get_current_user_role() = 'super_admin' OR
        get_user_organizacao_id() = organizacao_id
    )
);

CREATE POLICY "community_posts_update" ON public.community_posts FOR UPDATE USING (
    get_user_id() = autor_id OR 
    get_current_user_role() = 'super_admin' OR (
        get_current_user_role() = 'especialista' AND 
        get_user_organizacao_id() = organizacao_id
    )
);

CREATE POLICY "community_posts_delete" ON public.community_posts FOR DELETE USING (
    get_user_id() = autor_id OR 
    get_current_user_role() = 'super_admin' OR (
        get_current_user_role() = 'especialista' AND 
        get_user_organizacao_id() = organizacao_id
    )
);

-- TABELA: community_comments
CREATE POLICY "community_comments_select" ON public.community_comments FOR SELECT USING (
    get_current_user_role() = 'super_admin' OR 
    get_user_organizacao_id() = get_post_organizacao_id(post_id)
);

CREATE POLICY "community_comments_insert" ON public.community_comments FOR INSERT WITH CHECK (
    get_user_id() = autor_id AND (
        get_current_user_role() = 'super_admin' OR
        get_user_organizacao_id() = get_post_organizacao_id(post_id)
    )
);

CREATE POLICY "community_comments_update" ON public.community_comments FOR UPDATE USING (
    get_user_id() = autor_id OR
    get_current_user_role() = 'super_admin'
);

CREATE POLICY "community_comments_delete" ON public.community_comments FOR DELETE USING (
    get_user_id() = autor_id OR 
    get_current_user_role() = 'super_admin' OR (
        get_current_user_role() = 'especialista' AND 
        get_user_organizacao_id() = get_post_organizacao_id(post_id)
    )
);

-- TABELA: community_likes
CREATE POLICY "community_likes_select" ON public.community_likes FOR SELECT USING (
    get_current_user_role() = 'super_admin' OR 
    get_user_organizacao_id() = get_post_organizacao_id(post_id)
);

CREATE POLICY "community_likes_insert" ON public.community_likes FOR INSERT WITH CHECK (
    get_user_id() = usuario_id AND (
        get_current_user_role() = 'super_admin' OR
        get_user_organizacao_id() = get_post_organizacao_id(post_id)
    )
);

CREATE POLICY "community_likes_delete" ON public.community_likes FOR DELETE USING (
    get_user_id() = usuario_id
);

-- TABELA: community_messages (Mensagens Diretas / Chat)
CREATE POLICY "community_messages_select" ON public.community_messages FOR SELECT USING (
    get_user_id() = sender_id OR 
    get_user_id() = receiver_id OR 
    get_current_user_role() = 'super_admin'
);

CREATE POLICY "community_messages_insert" ON public.community_messages FOR INSERT WITH CHECK (
    get_user_id() = sender_id
);

CREATE POLICY "community_messages_update" ON public.community_messages FOR UPDATE USING (
    get_user_id() = receiver_id
);

CREATE POLICY "community_messages_delete" ON public.community_messages FOR DELETE USING (
    get_user_id() = sender_id OR 
    get_user_id() = receiver_id OR 
    get_current_user_role() = 'super_admin'
);


-- 5. RECARREGAR CACHE DE ROTAS DO POSTGREST NO SUPABASE
NOTIFY pgrst, 'reload schema';

-- =================================================================================
-- FIM DO SCRIPT DE CORREÇÃO
-- =================================================================================

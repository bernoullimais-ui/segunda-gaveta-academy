-- =================================================================================
-- MIGRATION SCRIPT FOR GAVETA K (SEGUNDA GAVETA ACADEMY)
-- Execute este script no SQL Editor do seu console do Supabase.
-- =================================================================================

-- 1. ADICIONAR COLUNAS DE BRANDING E URL À TABELA DE ORGANIZAÇÕES
ALTER TABLE public.organizacoes ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.organizacoes ADD COLUMN IF NOT EXISTS cor_primaria TEXT DEFAULT '#6366f1';
ALTER TABLE public.organizacoes ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 1.5. ADICIONAR COLUNA E TRIGGER DE ATUALIZAÇÃO À TABELA DE CURSOS
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cursos_updated_at ON public.cursos;
CREATE TRIGGER trigger_update_cursos_updated_at
    BEFORE UPDATE ON public.cursos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Gerar slugs únicos para quaisquer organizações existentes que não possuam slug
UPDATE public.organizacoes 
SET slug = LOWER(REGEXP_REPLACE(nome, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Tornar a coluna slug UNIQUE
ALTER TABLE public.organizacoes ADD CONSTRAINT organizacoes_slug_unique UNIQUE (slug);


-- 2. AJUSTAR E MAPEAR AS ROLES DE USUÁRIOS EXISTENTES
-- Mapeia roles legadas para a estrutura simplificada antes de aplicar a nova restrição Check
UPDATE public.usuarios SET role = 'super_admin' WHERE role = 'super_admin';
UPDATE public.usuarios SET role = 'especialista' WHERE role IN ('gestor', 'admin', 'curador', 'design', 'coordenador');
UPDATE public.usuarios SET role = 'membro' WHERE role IN ('candidato', 'ouvinte', 'professor_convidado', 'membro');

-- Remover restrições antigas de role se existirem
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check1;
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check2;

-- Adicionar a nova restrição de papel (role) simplificada
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_role_check CHECK (role IN ('super_admin', 'especialista', 'membro'));


-- 3. POLÍTICAS DE LINHA (RLS) PARA PROJETOS (ORGANIZAÇÕES) E CURSOS
ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curso_participantes ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas nas tabelas principais para evitar conflitos
DROP POLICY IF EXISTS "organizacoes_select_authenticated" ON public.organizacoes;
DROP POLICY IF EXISTS "organizacoes_admin_all" ON public.organizacoes;
DROP POLICY IF EXISTS "Enable all access for now" ON public.organizacoes;
DROP POLICY IF EXISTS "Acesso Total" ON public.organizacoes;

DROP POLICY IF EXISTS "usuarios_select_policy" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_all_policy" ON public.usuarios;
DROP POLICY IF EXISTS "Acesso completo de leitura para membros da mesma org" ON public.usuarios;

DROP POLICY IF EXISTS "cursos_select_policy" ON public.cursos;
DROP POLICY IF EXISTS "cursos_write_policy" ON public.cursos;

DROP POLICY IF EXISTS "participantes_select_policy" ON public.curso_participantes;
DROP POLICY IF EXISTS "participantes_write_policy" ON public.curso_participantes;


-- A. POLÍTICAS PARA ORGANIZAÇÕES (PROJETOS)
-- Qualquer usuário pode consultar para fins de carregar as configurações de branding (cores e logo)
CREATE POLICY "organizacoes_select_policy" ON public.organizacoes 
    FOR SELECT 
    USING (true);

CREATE POLICY "organizacoes_write_policy" ON public.organizacoes 
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );


-- B. POLÍTICAS PARA USUÁRIOS (PERFIS)
-- Super Admins podem fazer tudo. Especialistas veem apenas sua própria org. Membros veem perfis da sua própria org (para a comunidade).
CREATE POLICY "usuarios_select_policy" ON public.usuarios 
    FOR SELECT 
    USING (
        auth_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.usuarios currentUser
            WHERE currentUser.auth_id = auth.uid()
            AND (currentUser.role = 'super_admin' OR currentUser.organizacao_id = public.usuarios.organizacao_id)
        )
    );

CREATE POLICY "usuarios_write_policy" ON public.usuarios 
    FOR ALL 
    USING (
        auth_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.usuarios currentUser
            WHERE currentUser.auth_id = auth.uid()
            AND currentUser.role = 'super_admin'
        )
    );


-- C. POLÍTICAS PARA CURSOS
-- Super Admins podem tudo. Especialistas gerenciam cursos da sua própria org. Membros leem cursos da sua org.
CREATE POLICY "cursos_select_policy" ON public.cursos 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios 
            WHERE auth_id = auth.uid() 
            AND (role = 'super_admin' OR organizacao_id = public.cursos.organizacao_id)
        )
    );

CREATE POLICY "cursos_write_policy" ON public.cursos 
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios 
            WHERE auth_id = auth.uid() 
            AND (role = 'super_admin' OR (role = 'especialista' AND organizacao_id = public.cursos.organizacao_id))
        )
    );


-- D. POLÍTICAS PARA MATRÍCULAS (CURSO_PARTICIPANTES)
-- Super Admins e Especialistas podem visualizar e alterar matrículas de sua org. Alunos podem ver e atualizar seu próprio progresso.
CREATE POLICY "curso_participantes_select_policy" ON public.curso_participantes 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios currentUser
            WHERE currentUser.auth_id = auth.uid() 
            AND (
                currentUser.role = 'super_admin' 
                OR currentUser.id = public.curso_participantes.usuario_id 
                OR (currentUser.role = 'especialista' AND currentUser.organizacao_id = (SELECT organizacao_id FROM public.cursos WHERE id = public.curso_participantes.curso_id))
            )
        )
    );

CREATE POLICY "curso_participantes_write_policy" ON public.curso_participantes 
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios currentUser
            WHERE currentUser.auth_id = auth.uid() 
            AND (
                currentUser.role = 'super_admin' 
                OR currentUser.id = public.curso_participantes.usuario_id 
                OR (currentUser.role = 'especialista' AND currentUser.organizacao_id = (SELECT organizacao_id FROM public.cursos WHERE id = public.curso_participantes.curso_id))
            )
        )
    );

-- 4. ATUALIZAR FUNÇÕES DE BANCO DE DADOS (USANDO ROLE EM VEZ DE IS_SUPER_ADMIN)

CREATE OR REPLACE FUNCTION delete_organization(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
    is_admin BOOLEAN;
BEGIN
    -- Verificar se o usuário atual é super admin baseado na role
    SELECT (role = 'super_admin') INTO is_admin FROM public.usuarios WHERE auth_id = auth.uid();
    
    IF is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Apenas super admins podem excluir organizações.';
    END IF;

    -- Não permitir excluir a organização padrão
    IF org_id = '00000000-0000-0000-0000-000000000000' THEN
        RAISE EXCEPTION 'Não é possível excluir a organização padrão.';
    END IF;

    -- Deletar usuários da organização do auth.users (cascade cuidará de limpar a public.usuarios)
    FOR user_record IN SELECT id FROM public.usuarios WHERE organizacao_id = org_id LOOP
        DELETE FROM auth.users WHERE id = user_record.id;
    END LOOP;

    -- Deletar dados de outras tabelas vinculadas
    DELETE FROM public.curso_participantes WHERE curso_id IN (SELECT id FROM public.cursos WHERE organizacao_id = org_id);
    DELETE FROM public.cursos WHERE organizacao_id = org_id;
    DELETE FROM public.community_comments WHERE post_id IN (SELECT id FROM public.community_posts WHERE organizacao_id = org_id);
    DELETE FROM public.community_posts WHERE organizacao_id = org_id;

    -- Finalmente, deletar a organização
    DELETE FROM public.organizacoes WHERE id = org_id;
END;
$$;


CREATE OR REPLACE FUNCTION toggle_super_admin(user_id UUID, make_super_admin BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    -- Verificar se o usuário atual é super admin baseado na role
    SELECT (role = 'super_admin') INTO is_admin FROM public.usuarios WHERE auth_id = auth.uid();
    
    IF is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Apenas super admins podem alterar privilégios de super admin.';
    END IF;

    -- Não permitir que o usuário remova seu próprio privilégio de super admin
    IF user_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid()) AND make_super_admin = FALSE THEN
        RAISE EXCEPTION 'Você não pode remover seu próprio privilégio de super admin.';
    END IF;

    UPDATE public.usuarios 
    SET role = CASE WHEN make_super_admin THEN 'super_admin' ELSE 'especialista' END 
    WHERE id = user_id;
END;
$$;


-- 5. Notificar PostgREST para atualizar o cache
NOTIFY pgrst, 'reload schema';


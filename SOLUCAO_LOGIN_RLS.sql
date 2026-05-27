-- =================================================================================
-- SOLUÇÃO DEFINITIVA PARA LOGIN E RLS DE USUÁRIOS
-- =================================================================================

-- 1. Garantir que a coluna is_super_admin exista
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- 2. Limpar políticas antigas e conflitantes na tabela de usuários
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

-- 3. Criar NOVAS políticas baseadas no auth_id (não no id)

-- QUALQUER UM AUTENTICADO PODE VER:
-- Necessário para Joins em comentários, posts, etc.
CREATE POLICY "usuarios_select_authenticated" 
ON public.usuarios 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- O USUÁRIO PODE INSERIR SEU PRÓPRIO PERFIL:
-- Importante: Isso assume que o usuário está autenticado ao fazer o insert.
-- Se a confirmação de e-mail estiver ativada, o Supabase não autentica o usuário imediatamente.
-- RECOMENDAÇÃO: Desative a confirmação de e-mail no painel do Supabase.
CREATE POLICY "usuarios_insert_self" 
ON public.usuarios 
FOR INSERT 
WITH CHECK (auth.uid() = auth_id);

-- O USUÁRIO PODE ATUALIZAR SEU PRÓPRIO PERFIL:
CREATE POLICY "usuarios_update_self" 
ON public.usuarios 
FOR UPDATE 
USING (auth.uid() = auth_id);

-- GESTORES PODEM GERENCIAR USUÁRIOS DA MESMA ORGANIZAÇÃO:
CREATE POLICY "usuarios_gestor_manage" 
ON public.usuarios 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios admin 
        WHERE admin.auth_id = auth.uid() 
        AND admin.role IN ('gestor', 'super_admin')
        AND admin.organizacao_id = public.usuarios.organizacao_id
    )
);

-- SUPER ADMINS TÊM ACESSO TOTAL:
CREATE POLICY "usuarios_super_admin_all" 
ON public.usuarios 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios admin 
        WHERE admin.auth_id = auth.uid() 
        AND admin.is_super_admin = TRUE
    )
);

-- 4. Corrigir políticas de Organizações (também usavam ID incorreto)
DROP POLICY IF EXISTS "Acesso Total" ON public.organizacoes;
DROP POLICY IF EXISTS "Super admins podem ver todas as organizações" ON public.organizacoes;

CREATE POLICY "organizacoes_select_authenticated" 
ON public.organizacoes 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "organizacoes_admin_all" 
ON public.organizacoes 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios admin 
        WHERE admin.auth_id = auth.uid() 
        AND (admin.role IN ('gestor', 'super_admin') OR admin.is_super_admin = TRUE)
        AND admin.organizacao_id = public.organizacoes.id
    )
);

-- 5. Aviso sobre Confirmação de E-mail
-- Se você receber o erro "Email not confirmed", faça o seguinte:
-- 1. Vá ao painel do Supabase -> Authentication -> Providers -> Email
-- 2. Desmarque a opção "Confirm email"
-- 3. Salve as alterações.

NOTIFY pgrst, 'reload schema';

-- =================================================================================
-- CORREÇÃO DE RECURSÃO INFINITA NA TABELA USUARIOS
-- =================================================================================

-- 1. Remover TODAS as políticas da tabela usuarios para limpar o estado
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Admins podem ver usuários da sua organização" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir insert no próprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir update no próprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Admins podem gerenciar usuários" ON public.usuarios;

-- 2. Recriar as políticas de forma segura (sem recursão)

-- SELECT: O usuário pode ver a si mesmo
CREATE POLICY "Ver próprio perfil" 
ON public.usuarios 
FOR SELECT 
USING (auth.uid() = id);

-- SELECT: Admins podem ver todos da sua organização
-- Para evitar recursão, não fazemos JOIN com a própria tabela usuarios na política.
-- Em vez disso, verificamos se existe um registro de admin para o auth.uid() atual
-- que tenha o mesmo organizacao_id da linha sendo consultada.
CREATE POLICY "Admins veem org" 
ON public.usuarios 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 
        FROM public.usuarios admin_user 
        WHERE admin_user.id = auth.uid() 
        AND admin_user.role = 'admin' 
        AND admin_user.organizacao_id = usuarios.organizacao_id
    )
);

-- INSERT: Qualquer usuário autenticado pode inserir seu próprio registro inicial
CREATE POLICY "Inserir próprio perfil" 
ON public.usuarios 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- UPDATE: O usuário pode atualizar a si mesmo
CREATE POLICY "Atualizar próprio perfil" 
ON public.usuarios 
FOR UPDATE 
USING (auth.uid() = id);

-- UPDATE/DELETE: Admins podem gerenciar usuários da sua organização
CREATE POLICY "Admins gerenciam org" 
ON public.usuarios 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 
        FROM public.usuarios admin_user 
        WHERE admin_user.id = auth.uid() 
        AND admin_user.role = 'admin' 
        AND admin_user.organizacao_id = usuarios.organizacao_id
    )
);

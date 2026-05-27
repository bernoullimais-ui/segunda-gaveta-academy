-- =================================================================================
-- SOLUÇÃO DEFINITIVA PARA RECURSÃO NA TABELA USUARIOS (VIA JWT)
-- =================================================================================

-- 1. Remover TODAS as políticas da tabela usuarios para limpar o estado
DROP POLICY IF EXISTS "Ver próprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Admins veem org" ON public.usuarios;
DROP POLICY IF EXISTS "Inserir próprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Atualizar próprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Admins gerenciam org" ON public.usuarios;

-- 2. Criar políticas simples e diretas que não fazem JOIN com a própria tabela

-- SELECT: O usuário pode ver a si mesmo
CREATE POLICY "Ver próprio perfil" 
ON public.usuarios 
FOR SELECT 
USING (auth.uid() = id);

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

-- NOTA: Para evitar completamente a recursão, a lógica de "Admins veem todos da org"
-- foi removida do RLS da tabela `usuarios`. 
-- Como a tabela `usuarios` é usada apenas para o perfil do próprio usuário no login,
-- e o gerenciamento de avaliadores/candidatos é feito nas tabelas `avaliadores` e `candidatos`,
-- não precisamos que um admin faça SELECT em todos os `usuarios` via frontend.
-- Se no futuro precisarmos de uma tela de "Gestão de Usuários do Sistema", 
-- usaremos uma Security Definer Function para contornar o RLS.

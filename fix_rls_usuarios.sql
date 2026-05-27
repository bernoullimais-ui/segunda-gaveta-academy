-- =================================================================================
-- CORREÇÃO DE RLS PARA CADASTRO DE USUÁRIOS
-- =================================================================================

-- 1. Permitir que o usuário recém-autenticado insira seu próprio perfil
CREATE POLICY "Permitir insert no próprio perfil" 
ON public.usuarios 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- 2. Permitir que o usuário atualize seu próprio perfil
CREATE POLICY "Permitir update no próprio perfil" 
ON public.usuarios 
FOR UPDATE 
USING (auth.uid() = id);

-- 3. (Opcional) Permitir que admins insiram/atualizem usuários na sua organização
CREATE POLICY "Admins podem gerenciar usuários" 
ON public.usuarios 
FOR ALL 
USING (
    auth.uid() IN (SELECT u.id FROM public.usuarios u WHERE u.role = 'admin' AND u.organizacao_id = usuarios.organizacao_id)
);

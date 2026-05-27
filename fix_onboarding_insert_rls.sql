-- Remover políticas antigas de especialistas_onboarding
DROP POLICY IF EXISTS "Leitura própria ou por admin" ON public.especialistas_onboarding;
DROP POLICY IF EXISTS "Inserção pelo próprio especialista no cadastro" ON public.especialistas_onboarding;
DROP POLICY IF EXISTS "Atualização própria no onboarding" ON public.especialistas_onboarding;

-- Criar novas políticas corretas baseadas no usuarios.id vs auth_id
CREATE POLICY "Leitura própria ou por admin" ON public.especialistas_onboarding
    FOR SELECT USING (
        usuario_id IN (SELECT id FROM public.usuarios WHERE auth_id = auth.uid()) 
        OR get_current_user_role() = 'super_admin'
    );

-- Permite inserção pública para evitar condições de corrida do token de auth recém-criado
CREATE POLICY "Inserção pelo próprio especialista no cadastro" ON public.especialistas_onboarding
    FOR INSERT WITH CHECK (true);

-- Permite atualização própria do onboarding se o auth_id do perfil do usuário for o atual
CREATE POLICY "Atualização própria no onboarding" ON public.especialistas_onboarding
    FOR UPDATE USING (
        usuario_id IN (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    )
    WITH CHECK (
        usuario_id IN (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );

-- Recarregar o cache do PostgREST
NOTIFY pgrst, 'reload schema';

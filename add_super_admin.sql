-- Adicionar coluna is_super_admin na tabela usuarios
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Definir o usuário atual (bernoullimais@gmail.com) como super admin (se ele existir)
UPDATE public.usuarios SET is_super_admin = TRUE WHERE email = 'bernoullimais@gmail.com';

-- Criar política para super admins verem todas as organizações
CREATE POLICY "Super admins podem ver todas as organizações" 
ON public.organizacoes 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios 
        WHERE id = auth.uid() AND is_super_admin = TRUE
    )
);

-- Criar política para super admins verem todos os usuários
CREATE POLICY "Super admins podem ver todos os usuários" 
ON public.usuarios 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios 
        WHERE id = auth.uid() AND is_super_admin = TRUE
    )
);

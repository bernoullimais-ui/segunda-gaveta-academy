-- Permitir que administradores atualizem as configurações da sua própria organização
CREATE POLICY "Admins atualizam própria organização" 
ON public.organizacoes 
FOR UPDATE 
USING (
    id = public.get_user_organizacao_id() 
    AND 
    EXISTS (
        SELECT 1 FROM public.usuarios 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

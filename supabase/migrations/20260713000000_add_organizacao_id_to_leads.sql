-- Adiciona a coluna organizacao_id se não existir
ALTER TABLE public.leads_contato ADD COLUMN IF NOT EXISTS organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE;

-- Habilita RLS se ainda não estiver habilitado
ALTER TABLE public.leads_contato ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas para evitar duplicidade ou conflito
DROP POLICY IF EXISTS "Permitir insercao publica de leads" ON public.leads_contato;
DROP POLICY IF EXISTS "Permitir leitura de leads por organizacao" ON public.leads_contato;
DROP POLICY IF EXISTS "Permitir atualizacao de leads por organizacao" ON public.leads_contato;
DROP POLICY IF EXISTS "Permitir exclusao de leads por organizacao" ON public.leads_contato;
DROP POLICY IF EXISTS "Permitir tudo para super_admin" ON public.leads_contato;

-- Políticas de RLS para leads_contato:
-- 1. Qualquer pessoa (anon ou autenticada) pode inserir contatos
CREATE POLICY "Permitir insercao publica de leads" 
ON public.leads_contato 
FOR INSERT 
TO public 
WITH CHECK (true);

-- 2. Usuários autenticados de uma organização podem ler leads da sua organização
CREATE POLICY "Permitir leitura de leads por organizacao" 
ON public.leads_contato 
FOR SELECT 
TO authenticated 
USING (
  organizacao_id = (SELECT organizacao_id FROM public.usuarios WHERE auth_id = auth.uid())
);

-- 3. Usuários autenticados de uma organização podem atualizar (ex: marcar como lido) leads da sua organização
CREATE POLICY "Permitir atualizacao de leads por organizacao" 
ON public.leads_contato 
FOR UPDATE 
TO authenticated 
USING (
  organizacao_id = (SELECT organizacao_id FROM public.usuarios WHERE auth_id = auth.uid())
)
WITH CHECK (
  organizacao_id = (SELECT organizacao_id FROM public.usuarios WHERE auth_id = auth.uid())
);

-- 4. Usuários autenticados de uma organização podem deletar leads da sua organização
CREATE POLICY "Permitir exclusao de leads por organizacao" 
ON public.leads_contato 
FOR DELETE 
TO authenticated 
USING (
  organizacao_id = (SELECT organizacao_id FROM public.usuarios WHERE auth_id = auth.uid())
);

-- 5. Super admins podem fazer tudo
CREATE POLICY "Permitir tudo para super_admin" 
ON public.leads_contato 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios 
    WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
);

-- migration_financeiro.sql
-- 1. Adicionar colunas fk na tabela public.compras se não existirem
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS curso_id UUID REFERENCES public.cursos(id) ON DELETE SET NULL;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS trilha_id UUID REFERENCES public.trilhas(id) ON DELETE SET NULL;

-- 2. Migrar dados históricos
UPDATE public.compras SET curso_id = item_id WHERE tipo = 'curso' AND curso_id IS NULL;
UPDATE public.compras SET trilha_id = item_id WHERE tipo = 'trilha' AND trilha_id IS NULL;

-- 3. Atualizar/Recriar Políticas RLS na tabela compras
DROP POLICY IF EXISTS "Users view own purchases" ON public.compras;
DROP POLICY IF EXISTS "Specialists and admins view purchases" ON public.compras;
DROP POLICY IF EXISTS "compras_select_policy" ON public.compras;

CREATE POLICY "compras_select_policy" ON public.compras
FOR SELECT
USING (
  -- O próprio aluno
  (auth.uid() = usuario_id)
  OR
  -- Especialistas/Admins da organização dona do curso
  (
    EXISTS (
      SELECT 1 FROM public.cursos c 
      WHERE c.id = compras.curso_id 
      AND c.organizacao_id = public.get_user_organizacao_id()
    )
  )
  OR
  -- Especialistas/Admins da organização dona da trilha
  (
    EXISTS (
      SELECT 1 FROM public.trilhas t 
      WHERE t.id = compras.trilha_id 
      AND t.organizacao_id = public.get_user_organizacao_id()
    )
  )
  OR
  -- Super admin (role = 'super_admin')
  (public.get_current_user_role() = 'super_admin')
);

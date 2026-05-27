-- Add organization to trilhas
ALTER TABLE public.trilhas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';

-- Update RLS policies
DROP POLICY IF EXISTS "Public read trilhas" ON public.trilhas;
CREATE POLICY "Isolamento Trilhas" ON public.trilhas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Admins podem inserir" ON public.trilhas FOR INSERT WITH CHECK (public.is_admin());

-- Add organization to trilha_cursos
ALTER TABLE public.trilha_cursos ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';

-- Update RLS policies
DROP POLICY IF EXISTS "Public read trilha_cursos" ON public.trilha_cursos;
CREATE POLICY "Isolamento Trilha Cursos" ON public.trilha_cursos FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Admins podem inserir trilha_cursos" ON public.trilha_cursos FOR INSERT WITH CHECK (public.is_admin());

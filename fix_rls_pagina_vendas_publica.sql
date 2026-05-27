-- ============================================================
-- CORREÇÃO: Permitir leitura pública na página de vendas
-- Problema: Usuários anônimos não conseguem ler cursos/trilhas
-- Erro: "Cannot coerce the result to a single JSON object"
-- ============================================================

-- 1. Cursos — permitir leitura pública
DROP POLICY IF EXISTS "Leitura publica de cursos" ON public.cursos;
CREATE POLICY "Leitura publica de cursos"
ON public.cursos
FOR SELECT
USING (true);

-- 2. Trilhas — permitir leitura pública
DROP POLICY IF EXISTS "Leitura publica de trilhas" ON public.trilhas;
CREATE POLICY "Leitura publica de trilhas"
ON public.trilhas
FOR SELECT
USING (true);

-- 3. Organizações — necessário para logo e nome na página de vendas
DROP POLICY IF EXISTS "Leitura publica de organizacoes" ON public.organizacoes;
CREATE POLICY "Leitura publica de organizacoes"
ON public.organizacoes
FOR SELECT
USING (true);

-- 4. Trilha-cursos — listar cursos dentro de uma trilha
DROP POLICY IF EXISTS "Leitura publica de trilha_cursos" ON public.trilha_cursos;
CREATE POLICY "Leitura publica de trilha_cursos"
ON public.trilha_cursos
FOR SELECT
USING (true);

-- 5. Participantes de cursos — contagem de alunos inscritos
DROP POLICY IF EXISTS "Leitura publica de curso_participantes" ON public.curso_participantes;
CREATE POLICY "Leitura publica de curso_participantes"
ON public.curso_participantes
FOR SELECT
USING (true);

-- 6. Participantes de trilhas — contagem de alunos inscritos
DROP POLICY IF EXISTS "Leitura publica de trilha_participantes" ON public.trilha_participantes;
CREATE POLICY "Leitura publica de trilha_participantes"
ON public.trilha_participantes
FOR SELECT
USING (true);

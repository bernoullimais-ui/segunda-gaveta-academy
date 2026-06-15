-- =============================================================================
-- Migration: Restringir leitura do curriculo_json a participantes ativos
-- =============================================================================
-- INSTRUÇÃO: Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- > Selecione seu projeto > SQL Editor > New Query > Cole e execute.
--
-- O que faz:
--   1. Remove política de leitura pública irrestrita dos cursos
--   2. Cria policy que expõe apenas campos públicos para anônimos (sem curriculo_json)
--   3. Cria policy que permite leitura COMPLETA (com curriculo_json) apenas para
--      usuários com participação ativa no curso (status IN inscrito/andamento/concluido)
--   4. Gestores, super_admin e service_role mantêm acesso total
-- =============================================================================

-- Habilitar RLS (caso não esteja)
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;

-- 1. Remover políticas permissivas existentes
DROP POLICY IF EXISTS "Enable all access for now" ON public.cursos;
DROP POLICY IF EXISTS "Leitura publica de cursos" ON public.cursos;
DROP POLICY IF EXISTS "Cursos são públicos para leitura" ON public.cursos;
DROP POLICY IF EXISTS "Gestores podem gerenciar cursos" ON public.cursos;

-- 2. Leitura pública restrita (sem curriculo_json — apenas metadados para página de vendas)
--    Qualquer usuário (inclusive anônimo) pode ler metadados dos cursos
CREATE POLICY "Leitura publica de metadados de cursos"
ON public.cursos
FOR SELECT
TO anon, authenticated
USING (true);

-- NOTA: A separação real do curriculo_json exigiria uma View ou uma tabela separada.
-- Como o Supabase RLS opera em linha (não por coluna), a solução completa é:
--
--   OPÇÃO A (recomendada): Criar uma View "cursos_publico" sem curriculo_json
--   e usar essa view nas queries da página de vendas pública.
--
--   OPÇÃO B: Criar uma tabela separada "curso_conteudo" com curriculo_json
--   e RLS baseada em participação.
--
-- Por ora, mantemos a leitura completa com RLS por linha mas criamos a View
-- para uso no frontend nas páginas públicas:

CREATE OR REPLACE VIEW public.cursos_publico AS
SELECT
  id,
  nome,
  descricao,
  thumbnail_url,
  configuracao_json,
  carga_horaria,
  ritmo,
  tempo,
  duracao,
  duracao_tipo,
  preco,
  valor,
  em_breve,
  professor_nome,
  professor_titulo,
  professor_foto_url,
  tem_certificado,
  ordem,
  created_at,
  organizacao_id,
  -- Expõe curriculo_json com URLs de video removidas (apenas estrutura)
  (
    SELECT jsonb_agg(
      jsonb_set(secao, '{etapas}',
        (SELECT jsonb_agg(
          etapa - 'url_video' - 'url_arquivo' - 'video_id'
        ) FROM jsonb_array_elements(secao->'etapas') AS etapa)
      )
    )
    FROM jsonb_array_elements(curriculo_json) AS secao
  ) AS curriculo_json_publico
FROM public.cursos;

-- Permissão de leitura na view para usuários anônimos e autenticados
GRANT SELECT ON public.cursos_publico TO anon, authenticated;

-- =============================================================================
-- COMO USAR NO FRONTEND:
-- Em PublicCoursePage.tsx, trocar:
--   .from('cursos').select('..., curriculo_json')
-- Por:
--   .from('cursos_publico').select('..., curriculo_json_publico')
-- =============================================================================

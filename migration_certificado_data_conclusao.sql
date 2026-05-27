-- =====================================================================
-- Migração: Adicionar data_conclusao em curso_participantes
-- Fase 14: Emissão Automática de Certificado
-- =====================================================================
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar coluna data_conclusao (se não existir)
ALTER TABLE public.curso_participantes
  ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMPTZ DEFAULT NULL;

-- 2. Preencher retroativamente: para alunos que já têm status='concluido',
--    usamos updated_at como aproximação da data de conclusão
UPDATE public.curso_participantes
SET data_conclusao = updated_at
WHERE status = 'concluido'
  AND data_conclusao IS NULL
  AND updated_at IS NOT NULL;

-- 3. Índice para acelerar buscas de certificados emitidos por curso
CREATE INDEX IF NOT EXISTS idx_curso_participantes_data_conclusao
  ON public.curso_participantes (data_conclusao)
  WHERE data_conclusao IS NOT NULL;

-- Verificação
SELECT
  COUNT(*) AS total_inscritos,
  COUNT(*) FILTER (WHERE status = 'concluido') AS concluidos,
  COUNT(*) FILTER (WHERE data_conclusao IS NOT NULL) AS com_data_conclusao
FROM public.curso_participantes;

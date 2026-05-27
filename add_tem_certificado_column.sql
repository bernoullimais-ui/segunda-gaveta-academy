-- Migration to add "tem_certificado" column to the "cursos" table
-- Fase 14: Emissão Automática de Certificado (Ajuste)
-- Execute este script no SQL Editor do Supabase para corrigir o erro "column cursos.tem_certificado does not exist"

-- 1. Adiciona a coluna tem_certificado (se não existir)
ALTER TABLE public.cursos 
  ADD COLUMN IF NOT EXISTS tem_certificado BOOLEAN DEFAULT false;

-- 2. Atualiza registros existentes que já possuem template de certificado configurado
UPDATE public.cursos
SET tem_certificado = true
WHERE certificado_template IS NOT NULL 
  AND certificado_template::text <> '{}'
  AND certificado_template::text <> 'null';

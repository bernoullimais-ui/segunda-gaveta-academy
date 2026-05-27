-- Adicionar coluna curriculo_json na tabela de avaliadores
ALTER TABLE public.avaliadores ADD COLUMN IF NOT EXISTS curriculo_json JSONB DEFAULT NULL;

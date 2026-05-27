-- Adicionar coluna telefone às tabelas se não existirem
ALTER TABLE public.avaliadores ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS telefone TEXT;

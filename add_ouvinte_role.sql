-- Migration to add registration type to users and allow 'ouvinte' role
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS tipo_inscricao TEXT;
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_role_check CHECK (role IN ('admin', 'avaliador', 'candidato', 'coordenador', 'ouvinte'));

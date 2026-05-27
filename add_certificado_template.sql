-- Adiciona coluna de template de certificado
ALTER TABLE treinamentos ADD COLUMN IF NOT EXISTS certificado_template JSONB DEFAULT NULL;
ALTER TABLE modulos_avaliacao ADD COLUMN IF NOT EXISTS certificado_template JSONB DEFAULT NULL;

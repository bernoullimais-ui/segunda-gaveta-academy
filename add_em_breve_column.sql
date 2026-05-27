-- Migration para adicionar funcionalidade "Em Breve"
-- Adiciona a coluna em_breve na tabela cursos
ALTER TABLE cursos ADD COLUMN em_breve BOOLEAN DEFAULT false;
-- Marca os registros existentes como verdadeiro conforme solicitado
UPDATE cursos SET em_breve = true;

-- Adiciona a coluna em_breve na tabela trilhas
ALTER TABLE trilhas ADD COLUMN em_breve BOOLEAN DEFAULT false;
-- Marca os registros existentes como verdadeiro conforme solicitado
UPDATE trilhas SET em_breve = true;

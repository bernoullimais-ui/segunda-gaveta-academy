-- Adicionar colunas Tema e Nivel de Dificuldade ao Banco de Questões
ALTER TABLE questoes_teoricas ADD COLUMN IF NOT EXISTS tema TEXT;
ALTER TABLE questoes_teoricas ADD COLUMN IF NOT EXISTS dificuldade TEXT;

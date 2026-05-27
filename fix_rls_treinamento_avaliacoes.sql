-- Permitir acesso público para a tabela treinamento_avaliacoes
-- Isso é necessário porque os participantes do treinamento fazem login localmente (via ZEMPO)
-- e não possuem uma sessão do Supabase Auth durante a execução do treinamento.

-- Permitir SELECT (para carregar gabaritos e avaliações anteriores)
CREATE POLICY "Leitura pública de avaliações de treinamento" 
ON public.treinamento_avaliacoes 
FOR SELECT 
USING (true);

-- Permitir INSERT (para salvar novas avaliações)
CREATE POLICY "Inserção pública de avaliações de treinamento" 
ON public.treinamento_avaliacoes 
FOR INSERT 
WITH CHECK (true);

-- Permitir UPDATE (para atualizar avaliações existentes)
CREATE POLICY "Atualização pública de avaliações de treinamento" 
ON public.treinamento_avaliacoes 
FOR UPDATE 
USING (true);

-- Permitir UPDATE em treinamento_participantes (para salvar a senha no primeiro acesso)
CREATE POLICY "Atualização pública de participantes de treinamento" 
ON public.treinamento_participantes 
FOR UPDATE 
USING (true);

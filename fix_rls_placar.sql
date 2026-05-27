-- Permitir leitura pública para tabelas relacionadas ao placar
-- Isso é necessário para que qualquer pessoa com o link possa ver o placar

-- Modulos de Avaliacao
CREATE POLICY "Leitura pública de modulos_avaliacao para placar" 
ON public.modulos_avaliacao 
FOR SELECT 
USING (true);

-- Avaliacoes
CREATE POLICY "Leitura pública de avaliacoes para placar" 
ON public.avaliacoes 
FOR SELECT 
USING (true);

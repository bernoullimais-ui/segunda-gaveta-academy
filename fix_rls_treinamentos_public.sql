-- Permitir leitura pública para tabelas relacionadas a treinamentos
-- Isso é necessário para que os participantes possam acessar a tela de login do treinamento via link
-- antes de estarem autenticados no sistema.

-- Treinamentos
CREATE POLICY "Leitura pública de treinamentos" 
ON public.treinamentos 
FOR SELECT 
USING (true);

-- Participantes do Treinamento
CREATE POLICY "Leitura pública de participantes do treinamento" 
ON public.treinamento_participantes 
FOR SELECT 
USING (true);

-- Técnicas do Treinamento
CREATE POLICY "Leitura pública de técnicas do treinamento" 
ON public.treinamento_tecnicas 
FOR SELECT 
USING (true);

-- Avaliadores (Necessário para o fluxo de Primeiro Acesso via ZEMPO)
CREATE POLICY "Leitura pública de avaliadores para login" 
ON public.avaliadores 
FOR SELECT 
USING (true);

-- Candidatos (Necessário para o fluxo de Primeiro Acesso via ZEMPO)
CREATE POLICY "Leitura pública de candidatos para login" 
ON public.candidatos 
FOR SELECT 
USING (true);

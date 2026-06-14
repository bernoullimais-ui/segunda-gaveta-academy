-- Criação da tabela de anotações do aluno
CREATE TABLE IF NOT EXISTS public.curso_anotacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
    etapa_id TEXT NOT NULL,
    conteudo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(usuario_id, curso_id, etapa_id)
);

-- Habilitar RLS
ALTER TABLE public.curso_anotacoes ENABLE ROW LEVEL SECURITY;

-- Índice para melhorar a performance das buscas
CREATE INDEX IF NOT EXISTS idx_curso_anotacoes_busca 
ON public.curso_anotacoes(usuario_id, curso_id, etapa_id);

-- Trigger para atualizar o updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_curso_anotacoes_updated_at ON public.curso_anotacoes;

CREATE TRIGGER update_curso_anotacoes_updated_at
BEFORE UPDATE ON public.curso_anotacoes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Políticas de Segurança (Policies)

-- Somente o dono da anotação pode ver
CREATE POLICY "Anotações são visíveis apenas para o dono" 
ON public.curso_anotacoes FOR SELECT 
USING (auth.uid() = usuario_id);

-- Somente o dono pode inserir
CREATE POLICY "Anotações podem ser criadas apenas pelo dono" 
ON public.curso_anotacoes FOR INSERT 
WITH CHECK (auth.uid() = usuario_id);

-- Somente o dono pode atualizar
CREATE POLICY "Anotações podem ser atualizadas apenas pelo dono" 
ON public.curso_anotacoes FOR UPDATE 
USING (auth.uid() = usuario_id) 
WITH CHECK (auth.uid() = usuario_id);

-- Somente o dono pode deletar
CREATE POLICY "Anotações podem ser deletadas apenas pelo dono" 
ON public.curso_anotacoes FOR DELETE 
USING (auth.uid() = usuario_id);

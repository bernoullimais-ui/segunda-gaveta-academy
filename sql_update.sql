-- Adicionar coluna de template de certificado às tabelas principais
ALTER TABLE modulos_avaliacao ADD COLUMN IF NOT EXISTS certificado_template JSONB DEFAULT NULL;
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS certificado_template JSONB DEFAULT NULL;

-- Habilitar RLS (exemplo genérico, ajuste conforme necessário)
ALTER TABLE modulos_avaliacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo para todos" ON modulos_avaliacao;
CREATE POLICY "Permitir tudo para todos" ON modulos_avaliacao FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo para todos" ON cursos;
CREATE POLICY "Permitir tudo para todos" ON cursos FOR ALL USING (true) WITH CHECK (true);

-- Outros ajustes
ALTER TABLE avaliadores ADD COLUMN IF NOT EXISTS senha TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS senha TEXT;

-- (Caso a tabela já exista)
ALTER TABLE treinamento_participantes ADD COLUMN IF NOT EXISTS zempo TEXT;
ALTER TABLE treinamento_participantes ADD COLUMN IF NOT EXISTS dojo TEXT;
ALTER TABLE treinamento_participantes ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE treinamento_participantes ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE treinamento_participantes ADD COLUMN IF NOT EXISTS senha TEXT;

-- Criação das tabelas caso não existam
CREATE TABLE IF NOT EXISTS treinamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    data DATE NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treinamento_participantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    treinamento_id UUID REFERENCES treinamentos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    is_coordenador BOOLEAN DEFAULT FALSE,
    zempo TEXT,
    dojo TEXT,
    email TEXT,
    whatsapp TEXT,
    senha TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treinamento_tecnicas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    treinamento_id UUID REFERENCES treinamentos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    fase INTEGER NOT NULL,
    ordem INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treinamento_avaliacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    treinamento_id UUID REFERENCES treinamentos(id) ON DELETE CASCADE,
    tecnica_id UUID REFERENCES treinamento_tecnicas(id) ON DELETE CASCADE,
    participante_id UUID REFERENCES treinamento_participantes(id) ON DELETE CASCADE,
    is_gabarito BOOLEAN DEFAULT FALSE,
    desequilibrio TEXT,
    preparacao TEXT,
    execucao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

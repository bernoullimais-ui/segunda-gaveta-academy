-- Atualização da tabela avaliadores para incluir a função
ALTER TABLE avaliadores ADD COLUMN IF NOT EXISTS funcao TEXT DEFAULT 'avaliador' CHECK (funcao IN ('gestor', 'coordenador', 'avaliador'));

-- Tabela para Avaliações Teóricas
CREATE TABLE IF NOT EXISTS avaliacoes_teoricas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data DATE NOT NULL,
    candidato_id UUID REFERENCES candidatos(id) ON DELETE SET NULL,
    candidato_nome TEXT NOT NULL,
    grau_pretendido TEXT NOT NULL,
    modulo TEXT NOT NULL,
    media NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS modulos_avaliacao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data DATE NOT NULL,
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    regiao TEXT NOT NULL,
    local TEXT NOT NULL,
    tema TEXT NOT NULL,
    quantidade_tecnicas INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Atualiza tabela existente caso já tenha sido criada
ALTER TABLE modulos_avaliacao ADD COLUMN IF NOT EXISTS quantidade_tecnicas INTEGER DEFAULT 1;
ALTER TABLE modulos_avaliacao ADD COLUMN IF NOT EXISTS avaliadores_ids UUID[] DEFAULT '{}';
ALTER TABLE modulos_avaliacao ADD COLUMN IF NOT EXISTS coordenadores_ids UUID[] DEFAULT '{}';

-- Tabela Principal de Avaliações
CREATE TABLE IF NOT EXISTS avaliacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    modulo_id UUID REFERENCES modulos_avaliacao(id) ON DELETE SET NULL,
    candidato_id UUID REFERENCES candidatos(id) ON DELETE SET NULL,
    candidato_nome TEXT NOT NULL,
    avaliador_id UUID REFERENCES avaliadores(id) ON DELETE SET NULL,
    avaliador_nome TEXT NOT NULL,
    grau_pretendido TEXT NOT NULL,
    veredito TEXT NOT NULL,
    percentual_waza NUMERIC,
    nota_kata NUMERIC,
    sugestao_estudo TEXT,
    motivos_pendencia JSONB,
    observacoes_pedagogicas TEXT,
    erros_kata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para Avaliação de Waza
CREATE TABLE IF NOT EXISTS avaliacao_waza (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avaliacao_id UUID REFERENCES avaliacoes(id) ON DELETE CASCADE,
    tecnica_nome TEXT NOT NULL,
    kuzushi TEXT NOT NULL,
    tsukuri TEXT NOT NULL,
    kake TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para Avaliação de Kihon
CREATE TABLE IF NOT EXISTS avaliacao_kihon (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avaliacao_id UUID REFERENCES avaliacoes(id) ON DELETE CASCADE,
    kihon_nome TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para Avaliação de Kata
CREATE TABLE IF NOT EXISTS avaliacao_kata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avaliacao_id UUID REFERENCES avaliacoes(id) ON DELETE CASCADE,
    kata_nome TEXT NOT NULL,
    omitted BOOLEAN DEFAULT FALSE,
    small_errors INTEGER DEFAULT 0,
    medium_errors INTEGER DEFAULT 0,
    grave_errors INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para Avaliação de Alta Graduação
CREATE TABLE IF NOT EXISTS avaliacao_alta_graduacao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avaliacao_id UUID REFERENCES avaliacoes(id) ON DELETE CASCADE,
    criatividade TEXT NOT NULL,
    inovacao TEXT NOT NULL,
    eficiencia TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

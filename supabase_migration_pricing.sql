-- 1. Add Price to Cursos
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS preco NUMERIC(10, 2) DEFAULT 0.00;

-- 2. Trilhas Table
CREATE TABLE IF NOT EXISTS trilhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    preco NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Trilha_Cursos Relationship (M:N)
CREATE TABLE IF NOT EXISTS trilha_cursos (
    trilha_id UUID REFERENCES trilhas(id) ON DELETE CASCADE,
    curso_id UUID REFERENCES cursos(id) ON DELETE CASCADE,
    PRIMARY KEY (trilha_id, curso_id)
);

-- 4. Purchases Tracking
CREATE TABLE IF NOT EXISTS compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('curso', 'trilha', 'full')),
    item_id UUID, -- NULL if type is 'full'
    valor_pago NUMERIC(10, 2) NOT NULL,
    metodo_pagamento TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE trilhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE trilha_cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified, to be hardened later)
DROP POLICY IF EXISTS "Public read trilhas" ON trilhas;
CREATE POLICY "Public read trilhas" ON trilhas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read trilha_cursos" ON trilha_cursos;
CREATE POLICY "Public read trilha_cursos" ON trilha_cursos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users view own purchases" ON compras;
CREATE POLICY "Users view own purchases" ON compras FOR SELECT USING (auth.uid() = usuario_id);

-- Migration to add modulo_participantes table for frequency tracking
CREATE TABLE IF NOT EXISTS modulo_participantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    modulo_id UUID REFERENCES modulos_avaliacao(id) ON DELETE CASCADE,
    candidato_id UUID REFERENCES candidatos(id) ON DELETE CASCADE,
    presente BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(modulo_id, candidato_id)
);

-- For existing candidates, we might want to auto-enroll them in their organization's modules or just let them be added manually.
-- But the user said "inscritos", so let's ensure subscription works.

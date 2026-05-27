-- =================================================================================
-- SCRIPT DE CORREÇÃO COMPLETA DE ESQUEMA (DATABASE FIX)
-- =================================================================================

-- 1. Garantir extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Corrigir tabela de CURSOS (Adicionar colunas faltantes)
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS professor_nome TEXT;
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS professor_titulo TEXT;
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS professor_foto_url TEXT;
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS carga_horaria TEXT;
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS ritmo TEXT DEFAULT 'proprio';
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS tempo TEXT DEFAULT 'sem_limite';
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS duracao INTEGER;
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS duracao_tipo TEXT DEFAULT 'Dias';
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS em_breve BOOLEAN DEFAULT FALSE;
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0;
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS curriculo_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS configuracao_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS certificado_template JSONB DEFAULT '{}'::jsonb;

-- 3. Criar tabela de TRILHAS (caso não exista)
CREATE TABLE IF NOT EXISTS public.trilhas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacao_id UUID REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    capa_url TEXT,
    preco DECIMAL(10,2) DEFAULT 0.00,
    em_breve BOOLEAN DEFAULT FALSE,
    ativo BOOLEAN DEFAULT TRUE,
    ordem INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Rascunho',
    coordenador_nome TEXT,
    coordenador_titulo TEXT,
    coordenador_foto_url TEXT,
    professores_convidados TEXT,
    professores_titulos TEXT,
    professores_extra_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Criar tabela de JUNÇÃO TRILHA_CURSOS
CREATE TABLE IF NOT EXISTS public.trilha_cursos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trilha_id UUID REFERENCES public.trilhas(id) ON DELETE CASCADE,
    curso_id UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
    ordem INTEGER DEFAULT 0,
    UNIQUE(trilha_id, curso_id)
);

-- 5. Criar tabela de QUESTÕES TEÓRICAS (para Quizzes)
CREATE TABLE IF NOT EXISTS public.questoes_teoricas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo TEXT,
    tema TEXT,
    dificuldade TEXT,
    enunciado TEXT,
    opcoes JSONB DEFAULT '[]'::jsonb, -- Array de strings ou objetos {text, isCorrect}
    correta TEXT, -- índice ou referência à opção correta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Garantir tabela de PARTICIPANTES
CREATE TABLE IF NOT EXISTS public.curso_participantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    curso_id UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'andamento',
    progresso NUMERIC DEFAULT 0,
    completed_steps JSONB DEFAULT '[]'::jsonb,
    quiz_scores JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(curso_id, usuario_id)
);

-- 7. Ativar RLS e permissões básicas (Acesso total para simplificar desenvolvimento)
ALTER TABLE public.trilhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trilha_cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questoes_teoricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curso_participantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permit_all_trilhas" ON public.trilhas;
CREATE POLICY "permit_all_trilhas" ON public.trilhas FOR ALL USING (true);

DROP POLICY IF EXISTS "permit_all_trilha_cursos" ON public.trilha_cursos;
CREATE POLICY "permit_all_trilha_cursos" ON public.trilha_cursos FOR ALL USING (true);

DROP POLICY IF EXISTS "permit_all_questoes" ON public.questoes_teoricas;
CREATE POLICY "permit_all_questoes" ON public.questoes_teoricas FOR ALL USING (true);

DROP POLICY IF EXISTS "permit_all_participantes" ON public.curso_participantes;
CREATE POLICY "permit_all_participantes" ON public.curso_participantes FOR ALL USING (true);

-- 8. RECARREGAR CACHE DO POSTGREST (CRUCIAL PARA SUPABASE RECONHECER MUDANÇAS)
NOTIFY pgrst, 'reload schema';

-- FIM DO SCRIPT

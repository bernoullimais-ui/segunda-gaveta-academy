-- =================================================================================
-- MIGRAÇÃO PARA SAAS (MULTI-TENANCY) - SESSÃO 1
-- =================================================================================
-- Este script cria a estrutura base para transformar o sistema em um SaaS,
-- permitindo que múltiplas organizações (clubes/federações) usem o mesmo banco
-- de dados de forma isolada.
-- =================================================================================

-- 1. Criar a tabela de Organizações
CREATE TABLE IF NOT EXISTS public.organizacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    logo_url TEXT,
    cor_primaria TEXT DEFAULT '#b91c1c', -- Vermelho padrão (red-700)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Inserir a organização padrão (FEBAJU) para não quebrar os dados atuais
INSERT INTO public.organizacoes (id, nome, cor_primaria)
VALUES ('00000000-0000-0000-0000-000000000000', 'FEBAJU', '#b91c1c')
ON CONFLICT (id) DO NOTHING;

-- 3. Adicionar a coluna organizacao_id em TODAS as tabelas existentes
-- Usando a organização padrão (FEBAJU) como valor inicial para os dados já existentes

-- Candidatos
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
-- Avaliadores
ALTER TABLE public.avaliadores ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
-- Tecnicas
ALTER TABLE public.tecnicas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
-- Katas
ALTER TABLE public.katas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
-- Modulos de Avaliacao
ALTER TABLE public.modulos_avaliacao ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
-- Avaliacoes (Práticas)
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
-- Avaliacoes Teoricas
ALTER TABLE public.avaliacoes_teoricas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
-- Prova Resultados
ALTER TABLE public.prova_resultados ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
-- Provas e Questões
ALTER TABLE public.questoes_teoricas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.provas_teoricas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.prova_questoes ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.prova_respostas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';

-- Treinamentos
ALTER TABLE public.treinamentos ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.treinamento_participantes ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.treinamento_tecnicas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.treinamento_avaliacoes ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';

-- Nota: As tabelas filhas de avaliacoes (avaliacao_waza, avaliacao_kihon, etc.) 
-- não precisam estritamente do organizacao_id pois já são filtradas através do avaliacao_id,
-- mas é uma boa prática adicionar para facilitar consultas futuras.
ALTER TABLE public.avaliacao_waza ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.avaliacao_kihon ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.avaliacao_alta_graduacao ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.avaliacao_kata ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';

-- 4. Habilitar RLS (Row Level Security) em todas as tabelas
ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecnicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.katas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modulos_avaliacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes_teoricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prova_resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questoes_teoricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provas_teoricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prova_questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prova_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamento_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamento_tecnicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamento_avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_waza ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_kihon ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_alta_graduacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_kata ENABLE ROW LEVEL SECURITY;

-- 5. Criar Políticas de Segurança (Policies)
-- IMPORTANTE: Como a autenticação atual é feita "manualmente" (sem Supabase Auth JWT),
-- as políticas RLS padrão do Supabase (auth.uid()) não funcionarão diretamente.
-- Para esta fase de transição, vamos criar políticas permissivas (permitir tudo) 
-- até migrarmos a autenticação para o Supabase Auth na Sessão 2.
-- Se já tivéssemos o Supabase Auth, a política seria algo como:
-- CREATE POLICY "Isolamento por Organização" ON public.candidatos FOR ALL USING (organizacao_id = auth.jwt()->>'user_org_id');

-- Políticas Temporárias (Permitir tudo para não quebrar o app atual)
-- Na Sessão 2, substituiremos estas políticas pelas políticas de isolamento real.

CREATE POLICY "Permitir tudo organizacoes" ON public.organizacoes FOR ALL USING (true);
CREATE POLICY "Permitir tudo candidatos" ON public.candidatos FOR ALL USING (true);
CREATE POLICY "Permitir tudo avaliadores" ON public.avaliadores FOR ALL USING (true);
CREATE POLICY "Permitir tudo tecnicas" ON public.tecnicas FOR ALL USING (true);
CREATE POLICY "Permitir tudo katas" ON public.katas FOR ALL USING (true);
CREATE POLICY "Permitir tudo modulos_avaliacao" ON public.modulos_avaliacao FOR ALL USING (true);
CREATE POLICY "Permitir tudo avaliacoes" ON public.avaliacoes FOR ALL USING (true);
CREATE POLICY "Permitir tudo avaliacoes_teoricas" ON public.avaliacoes_teoricas FOR ALL USING (true);
CREATE POLICY "Permitir tudo prova_resultados" ON public.prova_resultados FOR ALL USING (true);
CREATE POLICY "Permitir tudo questoes_teoricas" ON public.questoes_teoricas FOR ALL USING (true);
CREATE POLICY "Permitir tudo provas_teoricas" ON public.provas_teoricas FOR ALL USING (true);
CREATE POLICY "Permitir tudo prova_questoes" ON public.prova_questoes FOR ALL USING (true);
CREATE POLICY "Permitir tudo prova_respostas" ON public.prova_respostas FOR ALL USING (true);
CREATE POLICY "Permitir tudo treinamentos" ON public.treinamentos FOR ALL USING (true);
CREATE POLICY "Permitir tudo treinamento_participantes" ON public.treinamento_participantes FOR ALL USING (true);
CREATE POLICY "Permitir tudo treinamento_tecnicas" ON public.treinamento_tecnicas FOR ALL USING (true);
CREATE POLICY "Permitir tudo treinamento_avaliacoes" ON public.treinamento_avaliacoes FOR ALL USING (true);
CREATE POLICY "Permitir tudo avaliacao_waza" ON public.avaliacao_waza FOR ALL USING (true);
CREATE POLICY "Permitir tudo avaliacao_kihon" ON public.avaliacao_kihon FOR ALL USING (true);
CREATE POLICY "Permitir tudo avaliacao_alta_graduacao" ON public.avaliacao_alta_graduacao FOR ALL USING (true);
CREATE POLICY "Permitir tudo avaliacao_kata" ON public.avaliacao_kata FOR ALL USING (true);

-- FIM DO SCRIPT

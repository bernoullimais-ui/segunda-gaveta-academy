-- =================================================================================
-- MIGRAÇÃO PARA SAAS (MULTI-TENANCY) - SCRIPT COMPLETO (SESSÃO 1 + 2)
-- =================================================================================
-- Este script unifica a criação das colunas e das políticas de segurança.
-- Execute este script no SQL Editor do Supabase.

-- 1. Criar a tabela de Organizações
CREATE TABLE IF NOT EXISTS public.organizacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    logo_url TEXT,
    cor_primaria TEXT DEFAULT '#b91c1c',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Inserir a organização padrão (FEBAJU)
INSERT INTO public.organizacoes (id, nome, cor_primaria)
VALUES ('00000000-0000-0000-0000-000000000000', 'FEBAJU', '#b91c1c')
ON CONFLICT (id) DO NOTHING;

-- 2. Adicionar a coluna organizacao_id em TODAS as tabelas existentes
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.avaliadores ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.tecnicas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.katas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.modulos_avaliacao ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.avaliacoes_teoricas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.prova_resultados ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.questoes_teoricas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.provas_teoricas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.prova_questoes ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.prova_respostas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.treinamentos ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.treinamento_participantes ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.treinamento_tecnicas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.treinamento_avaliacoes ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.avaliacao_waza ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.avaliacao_kihon ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.avaliacao_alta_graduacao ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.avaliacao_kata ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES public.organizacoes(id) DEFAULT '00000000-0000-0000-0000-000000000000';

-- 3. Criar tabela de perfis de usuário (vinculada ao auth.users)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    nome TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'avaliador', 'candidato', 'coordenador')),
    organizacao_id UUID REFERENCES public.organizacoes(id),
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Habilitar RLS em todas as tabelas
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
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 5. Funções auxiliares
CREATE OR REPLACE FUNCTION public.get_user_organizacao_id()
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT organizacao_id INTO org_id FROM public.usuarios WHERE id = auth.uid();
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.usuarios WHERE id = auth.uid();
    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Limpar políticas antigas (se existirem) para evitar conflitos
DO $$ 
DECLARE 
    pol record;
BEGIN 
    FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 7. Criar novas políticas baseadas na organização do usuário logado

-- Usuarios
CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.usuarios FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins podem ver usuários da sua organização" ON public.usuarios FOR SELECT USING (
    auth.uid() IN (SELECT u.id FROM public.usuarios u WHERE u.role = 'admin' AND u.organizacao_id = usuarios.organizacao_id)
);

-- Organizacoes
CREATE POLICY "Ver própria organização" ON public.organizacoes FOR SELECT USING (id = public.get_user_organizacao_id());

-- Demais tabelas
CREATE POLICY "Isolamento Candidatos" ON public.candidatos FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Avaliadores" ON public.avaliadores FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Tecnicas" ON public.tecnicas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Katas" ON public.katas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Modulos" ON public.modulos_avaliacao FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Avaliacoes" ON public.avaliacoes FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Avaliacoes Teoricas" ON public.avaliacoes_teoricas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Prova Resultados" ON public.prova_resultados FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Questoes Teoricas" ON public.questoes_teoricas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Provas Teoricas" ON public.provas_teoricas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Prova Questoes" ON public.prova_questoes FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Prova Respostas" ON public.prova_respostas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Treinamentos" ON public.treinamentos FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Treinamento Participantes" ON public.treinamento_participantes FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Treinamento Tecnicas" ON public.treinamento_tecnicas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Treinamento Avaliacoes" ON public.treinamento_avaliacoes FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Avaliacao Waza" ON public.avaliacao_waza FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Avaliacao Kihon" ON public.avaliacao_kihon FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Avaliacao Alta Graduacao" ON public.avaliacao_alta_graduacao FOR ALL USING (organizacao_id = public.get_user_organizacao_id());
CREATE POLICY "Isolamento Avaliacao Kata" ON public.avaliacao_kata FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

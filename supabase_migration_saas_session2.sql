-- =================================================================================
-- MIGRAÇÃO PARA SAAS (MULTI-TENANCY) - SESSÃO 2
-- =================================================================================

-- 1. Criar tabela de perfis de usuário (vinculada ao auth.users)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    nome TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'avaliador', 'candidato', 'coordenador')),
    organizacao_id UUID REFERENCES public.organizacoes(id),
    reference_id UUID, -- ID do avaliador ou candidato correspondente (opcional)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS na tabela usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios
CREATE POLICY "Usuários podem ver seu próprio perfil" 
ON public.usuarios FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Admins podem ver usuários da sua organização" 
ON public.usuarios FOR SELECT 
USING (
    auth.uid() IN (
        SELECT id FROM public.usuarios WHERE role = 'admin' AND organizacao_id = usuarios.organizacao_id
    )
);

-- 2. Atualizar as políticas RLS de todas as tabelas para usar auth.uid() e organizacao_id
-- Primeiro, removemos as políticas temporárias da Sessão 1
DROP POLICY IF EXISTS "Permitir tudo organizacoes" ON public.organizacoes;
DROP POLICY IF EXISTS "Permitir tudo candidatos" ON public.candidatos;
DROP POLICY IF EXISTS "Permitir tudo avaliadores" ON public.avaliadores;
DROP POLICY IF EXISTS "Permitir tudo tecnicas" ON public.tecnicas;
DROP POLICY IF EXISTS "Permitir tudo katas" ON public.katas;
DROP POLICY IF EXISTS "Permitir tudo modulos_avaliacao" ON public.modulos_avaliacao;
DROP POLICY IF EXISTS "Permitir tudo avaliacoes" ON public.avaliacoes;
DROP POLICY IF EXISTS "Permitir tudo avaliacoes_teoricas" ON public.avaliacoes_teoricas;
DROP POLICY IF EXISTS "Permitir tudo prova_resultados" ON public.prova_resultados;
DROP POLICY IF EXISTS "Permitir tudo questoes_teoricas" ON public.questoes_teoricas;
DROP POLICY IF EXISTS "Permitir tudo provas_teoricas" ON public.provas_teoricas;
DROP POLICY IF EXISTS "Permitir tudo prova_questoes" ON public.prova_questoes;
DROP POLICY IF EXISTS "Permitir tudo prova_respostas" ON public.prova_respostas;
DROP POLICY IF EXISTS "Permitir tudo treinamentos" ON public.treinamentos;
DROP POLICY IF EXISTS "Permitir tudo treinamento_participantes" ON public.treinamento_participantes;
DROP POLICY IF EXISTS "Permitir tudo treinamento_tecnicas" ON public.treinamento_tecnicas;
DROP POLICY IF EXISTS "Permitir tudo treinamento_avaliacoes" ON public.treinamento_avaliacoes;
DROP POLICY IF EXISTS "Permitir tudo avaliacao_waza" ON public.avaliacao_waza;
DROP POLICY IF EXISTS "Permitir tudo avaliacao_kihon" ON public.avaliacao_kihon;
DROP POLICY IF EXISTS "Permitir tudo avaliacao_alta_graduacao" ON public.avaliacao_alta_graduacao;
DROP POLICY IF EXISTS "Permitir tudo avaliacao_kata" ON public.avaliacao_kata;

-- Função auxiliar para obter o organizacao_id do usuário logado
CREATE OR REPLACE FUNCTION public.get_user_organizacao_id()
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT organizacao_id INTO org_id FROM public.usuarios WHERE id = auth.uid();
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar para verificar se é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.usuarios WHERE id = auth.uid();
    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar novas políticas baseadas na organização do usuário logado

-- Organizacoes: Usuários só podem ver a sua própria organização
CREATE POLICY "Ver própria organização" ON public.organizacoes FOR SELECT USING (id = public.get_user_organizacao_id());

-- Candidatos
CREATE POLICY "Isolamento Candidatos" ON public.candidatos FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Avaliadores
CREATE POLICY "Isolamento Avaliadores" ON public.avaliadores FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Tecnicas
CREATE POLICY "Isolamento Tecnicas" ON public.tecnicas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Katas
CREATE POLICY "Isolamento Katas" ON public.katas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Modulos de Avaliacao
CREATE POLICY "Isolamento Modulos" ON public.modulos_avaliacao FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Avaliacoes
CREATE POLICY "Isolamento Avaliacoes" ON public.avaliacoes FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Avaliacoes Teoricas
CREATE POLICY "Isolamento Avaliacoes Teoricas" ON public.avaliacoes_teoricas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Prova Resultados
CREATE POLICY "Isolamento Prova Resultados" ON public.prova_resultados FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Questoes Teoricas
CREATE POLICY "Isolamento Questoes Teoricas" ON public.questoes_teoricas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Provas Teoricas
CREATE POLICY "Isolamento Provas Teoricas" ON public.provas_teoricas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Prova Questoes
CREATE POLICY "Isolamento Prova Questoes" ON public.prova_questoes FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Prova Respostas
CREATE POLICY "Isolamento Prova Respostas" ON public.prova_respostas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Treinamentos
CREATE POLICY "Isolamento Treinamentos" ON public.treinamentos FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Treinamento Participantes
CREATE POLICY "Isolamento Treinamento Participantes" ON public.treinamento_participantes FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Treinamento Tecnicas
CREATE POLICY "Isolamento Treinamento Tecnicas" ON public.treinamento_tecnicas FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Treinamento Avaliacoes
CREATE POLICY "Isolamento Treinamento Avaliacoes" ON public.treinamento_avaliacoes FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Avaliacao Waza
CREATE POLICY "Isolamento Avaliacao Waza" ON public.avaliacao_waza FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Avaliacao Kihon
CREATE POLICY "Isolamento Avaliacao Kihon" ON public.avaliacao_kihon FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Avaliacao Alta Graduacao
CREATE POLICY "Isolamento Avaliacao Alta Graduacao" ON public.avaliacao_alta_graduacao FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- Avaliacao Kata
CREATE POLICY "Isolamento Avaliacao Kata" ON public.avaliacao_kata FOR ALL USING (organizacao_id = public.get_user_organizacao_id());

-- 4. Inserir um usuário Admin padrão para a FEBAJU (para testes)
-- Nota: A senha deve ser configurada via interface do Supabase ou signUp.
-- Como não podemos inserir em auth.users diretamente com senha hashada facilmente aqui,
-- o ideal é que o primeiro usuário faça signUp pela interface e ganhe a role 'admin'.

-- FIM DO SCRIPT SESSÃO 2

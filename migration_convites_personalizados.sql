-- =================================================================================
-- MIGRATION: CONVITES PERSONALIZADOS DE ESPECIALISTAS COM PERFIL, CONTRATO E TAXA
-- Execute este script no SQL Editor do seu console do Supabase.
-- =================================================================================

-- 1. Criar tabela de configurações de convites de especialistas
CREATE TABLE IF NOT EXISTS public.convites_especialista (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    descricao TEXT,
    -- Levantamento de Perfil (perguntas em JSON)
    perguntas_perfil JSONB DEFAULT '[]'::jsonb,
    -- Contrato (Texto em Markdown/Texto)
    contrato_texto TEXT,
    -- Taxa de Adesão em centavos (ex: 150000 = R$ 1.500,00)
    taxa_adesao_cents INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Desabilitar RLS para permitir que qualquer visitante consulte o slug do convite antes do cadastro
ALTER TABLE public.convites_especialista DISABLE ROW LEVEL SECURITY;

-- 2. Criar tabela de registro de respostas, contratos assinados e pagamentos
CREATE TABLE IF NOT EXISTS public.especialistas_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    convite_id UUID REFERENCES public.convites_especialista(id) ON DELETE SET NULL,
    respostas_perfil JSONB DEFAULT '{}'::jsonb,
    contrato_aceito_em TIMESTAMP WITH TIME ZONE,
    contrato_ip TEXT,
    taxa_paga BOOLEAN DEFAULT FALSE,
    pagamento_status TEXT DEFAULT 'pendente', -- 'pendente', 'pago', 'falhou'
    pagamento_order_id TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para especialistas_onboarding
ALTER TABLE public.especialistas_onboarding ENABLE ROW LEVEL SECURITY;

-- Remover políticas se existirem para evitar erros de duplicidade
DROP POLICY IF EXISTS "Leitura própria ou por admin" ON public.especialistas_onboarding;
DROP POLICY IF EXISTS "Inserção pelo próprio especialista no cadastro" ON public.especialistas_onboarding;
DROP POLICY IF EXISTS "Atualização própria no onboarding" ON public.especialistas_onboarding;

-- Criar políticas seguras
CREATE POLICY "Leitura própria ou por admin" ON public.especialistas_onboarding
    FOR SELECT USING (auth.uid() = usuario_id OR get_current_user_role() = 'super_admin');

CREATE POLICY "Inserção pelo próprio especialista no cadastro" ON public.especialistas_onboarding
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Atualização própria no onboarding" ON public.especialistas_onboarding
    FOR UPDATE USING (auth.uid() = usuario_id)
    WITH CHECK (auth.uid() = usuario_id);

-- 3. Recarregar o cache do PostgREST para reconhecer as novas tabelas
NOTIFY pgrst, 'reload schema';

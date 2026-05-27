-- =================================================================================
-- MIGRATION SCRIPT FOR COUPON AND DISCOUNT MODULE
-- Execute este script no SQL Editor do seu console do Supabase.
-- =================================================================================

-- 0. GARANTIR TABELAS DEPENDENTES (trilha_participantes e compras)
CREATE TABLE IF NOT EXISTS public.trilha_participantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trilha_id UUID REFERENCES public.trilhas(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'andamento' CHECK (status IN ('andamento', 'inscrito', 'pendente', 'concluido', 'suspenso')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT trilha_participantes_trilha_usuario_unique UNIQUE(trilha_id, usuario_id)
);

ALTER TABLE public.trilha_participantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for now" ON public.trilha_participantes;
CREATE POLICY "Enable all access for now" ON public.trilha_participantes FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('curso', 'trilha', 'full')),
    item_id UUID, -- NULL if type is 'full'
    valor_pago NUMERIC(10, 2) NOT NULL,
    metodo_pagamento TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own purchases" ON public.compras;
CREATE POLICY "Users view own purchases" ON public.compras FOR SELECT USING (auth.uid() = usuario_id);

-- 1. CRIAR TABELA DE CUPONS
CREATE TABLE IF NOT EXISTS public.cupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacao_id UUID REFERENCES public.organizacoes(id) ON DELETE CASCADE NOT NULL,
    codigo TEXT NOT NULL,
    tipo_desconto TEXT NOT NULL CHECK (tipo_desconto IN ('percentual', 'fixo')),
    valor DECIMAL(10, 2) NOT NULL CHECK (valor > 0),
    limite_usos_total INTEGER DEFAULT NULL CHECK (limite_usos_total IS NULL OR limite_usos_total > 0),
    usos_atual INTEGER DEFAULT 0 CHECK (usos_atual >= 0),
    data_expiracao TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    curso_id UUID REFERENCES public.cursos(id) ON DELETE SET NULL DEFAULT NULL,
    trilha_id UUID REFERENCES public.trilhas(id) ON DELETE SET NULL DEFAULT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT cupons_codigo_org_unique UNIQUE (organizacao_id, codigo)
);

-- 2. CRIAR TABELA DE REGISTRO DE USOS DE CUPONS
CREATE TABLE IF NOT EXISTS public.cupom_usos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cupom_id UUID REFERENCES public.cupons(id) ON DELETE CASCADE NOT NULL,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL DEFAULT NULL,
    email TEXT NOT NULL,
    curso_id UUID REFERENCES public.cursos(id) ON DELETE SET NULL DEFAULT NULL,
    trilha_id UUID REFERENCES public.trilhas(id) ON DELETE SET NULL DEFAULT NULL,
    valor_desconto DECIMAL(10, 2) NOT NULL CHECK (valor_desconto >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ADICIONAR COLUNAS NAS TABELAS DE PARTICIPANTES E COMPRAS
ALTER TABLE public.curso_participantes ADD COLUMN IF NOT EXISTS cupom_codigo TEXT DEFAULT NULL;
ALTER TABLE public.curso_participantes ADD COLUMN IF NOT EXISTS valor_pago DECIMAL(10, 2) DEFAULT NULL;

ALTER TABLE public.trilha_participantes ADD COLUMN IF NOT EXISTS cupom_codigo TEXT DEFAULT NULL;
ALTER TABLE public.trilha_participantes ADD COLUMN IF NOT EXISTS valor_pago DECIMAL(10, 2) DEFAULT NULL;

ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS cupom_codigo TEXT DEFAULT NULL;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS desconto_aplicado DECIMAL(10, 2) DEFAULT 0.00;

-- 4. HABILITAR E CONFIGURAR SEGURANÇA RLS
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupom_usos ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas se existirem
DROP POLICY IF EXISTS cupons_select_admin ON public.cupons;
DROP POLICY IF EXISTS cupons_insert_admin ON public.cupons;
DROP POLICY IF EXISTS cupons_update_admin ON public.cupons;
DROP POLICY IF EXISTS cupons_delete_admin ON public.cupons;
DROP POLICY IF EXISTS cupom_usos_select_admin ON public.cupom_usos;

-- Políticas para public.cupons
CREATE POLICY cupons_select_admin ON public.cupons
    FOR SELECT
    USING (
        get_current_user_role() = 'super_admin'
        OR get_user_organizacao_id() = organizacao_id
    );

CREATE POLICY cupons_insert_admin ON public.cupons
    FOR INSERT
    WITH CHECK (
        get_current_user_role() = 'super_admin'
        OR get_user_organizacao_id() = organizacao_id
    );

CREATE POLICY cupons_update_admin ON public.cupons
    FOR UPDATE
    USING (
        get_current_user_role() = 'super_admin'
        OR get_user_organizacao_id() = organizacao_id
    );

CREATE POLICY cupons_delete_admin ON public.cupons
    FOR DELETE
    USING (
        get_current_user_role() = 'super_admin'
        OR get_user_organizacao_id() = organizacao_id
    );

-- Políticas para public.cupom_usos
CREATE POLICY cupom_usos_select_admin ON public.cupom_usos
    FOR SELECT
    USING (
        get_current_user_role() = 'super_admin'
        OR EXISTS (
            SELECT 1 FROM public.cupons c
            WHERE c.id = cupom_id
            AND c.organizacao_id = get_user_organizacao_id()
        )
    );

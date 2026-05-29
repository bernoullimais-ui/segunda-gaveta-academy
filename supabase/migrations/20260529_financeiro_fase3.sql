-- ============================================================
-- Migration: Melhorias Financeiras Fase 3
-- Data: 2026-05-29
-- Descrição: 
--   - M7: Tabela clicks_afiliados para rastreamento de funil
--   - M6: Tabelas planos_assinatura e assinaturas para recorrência
-- ============================================================

-- 1. Tabela clicks_afiliados
CREATE TABLE IF NOT EXISTS public.clicks_afiliados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    curso_id UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
    trilha_id UUID REFERENCES public.trilhas(id) ON DELETE CASCADE,
    ip_hash TEXT,
    checkout_iniciado BOOLEAN DEFAULT false,
    converteu BOOLEAN DEFAULT false,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS: Affiliate can read their own clicks
ALTER TABLE public.clicks_afiliados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Afiliados podem ver seus clicks" ON public.clicks_afiliados
    FOR SELECT USING (auth.uid() = affiliate_id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_clicks_afiliados_affiliate ON public.clicks_afiliados(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_clicks_afiliados_ip_hash ON public.clicks_afiliados(ip_hash);
CREATE INDEX IF NOT EXISTS idx_clicks_afiliados_converteu ON public.clicks_afiliados(converteu);

-- 2. Tabela planos_assinatura
CREATE TABLE IF NOT EXISTS public.planos_assinatura (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacao_id UUID REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    curso_id UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
    trilha_id UUID REFERENCES public.trilhas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    valor_cents INTEGER NOT NULL,
    intervalo TEXT NOT NULL CHECK (intervalo IN ('month', 'year')),
    pagarme_plan_id TEXT,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS: Public can read active plans, Admins can manage
ALTER TABLE public.planos_assinatura ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de planos ativos" ON public.planos_assinatura
    FOR SELECT USING (ativo = true);

-- 3. Tabela assinaturas
CREATE TABLE IF NOT EXISTS public.assinaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    plano_id UUID REFERENCES public.planos_assinatura(id) ON DELETE CASCADE,
    pagarme_subscription_id TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled')),
    proxima_cobranca TIMESTAMPTZ,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS: User can see their own subscriptions
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario pode ver proprias assinaturas" ON public.assinaturas
    FOR SELECT USING (auth.uid() = usuario_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assinaturas_usuario ON public.assinaturas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_pagarme ON public.assinaturas(pagarme_subscription_id);

-- 4. Adicionar pagarme_subscription_id em compras
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS pagarme_subscription_id TEXT;
CREATE INDEX IF NOT EXISTS idx_compras_pagarme_subscription ON public.compras(pagarme_subscription_id);

DO $$
BEGIN
  RAISE NOTICE 'Migration financeiro_fase3 applied successfully.';
END $$;

-- Adicional: RLS para gestores visualizarem cliques
CREATE POLICY "Gestores podem ver os cliques de seus cursos"
    ON public.clicks_afiliados
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.cursos c WHERE c.id = clicks_afiliados.curso_id AND c.organizacao_id IN (
                SELECT organizacao_id FROM public.usuarios WHERE id = auth.uid() AND (role = 'gestor' OR role = 'super_admin')
            )
        )
        OR
        EXISTS (
            SELECT 1 FROM public.trilhas t WHERE t.id = clicks_afiliados.trilha_id AND t.organizacao_id IN (
                SELECT organizacao_id FROM public.usuarios WHERE id = auth.uid() AND (role = 'gestor' OR role = 'super_admin')
            )
        )
    );

-- ============================================================
-- Migration: Sistema de Notas Fiscais (NFS-e) com Focus NF
-- Data: 2026-07-25
-- Descrição: Cria as tabelas para suportar emissão automática
--   de NFS-e via Focus NF, com split de pagamentos entre
--   produtor, especialista e outros recebedores do Pagar.me.
-- ============================================================

-- 1. Configurações fiscais por usuário (e da plataforma como fallback)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiscal_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- NULL = config global da plataforma (fallback quando recebedor não tem config)

  -- Credenciais Focus NF
  focus_nf_token      TEXT NOT NULL,
  ambiente            TEXT NOT NULL DEFAULT 'producao' CHECK (ambiente IN ('sandbox', 'producao')),

  -- Dados do Prestador de Serviço
  cnpj                TEXT,
  cpf                 TEXT,
  razao_social        TEXT NOT NULL,
  nome_fantasia       TEXT,

  -- Dados do Município do Prestador
  codigo_municipio    TEXT NOT NULL,  -- Código IBGE (ex: '3550308' para São Paulo)
  uf                  TEXT,

  -- Dados do Serviço
  item_lista_servico  TEXT NOT NULL,  -- Código do serviço (ex: '01.01')
  cnae                TEXT,           -- Código CNAE (opcional, depende do município)
  discriminacao       TEXT,           -- Descrição padrão do serviço na nota

  -- Tributação
  regime_tributario   INTEGER NOT NULL DEFAULT 1
    CHECK (regime_tributario IN (1, 2, 3)),
    -- 1 = Simples Nacional
    -- 2 = Simples Nacional - excesso de sublimite
    -- 3 = Regime Normal

  aliquota_iss        NUMERIC(5, 2),  -- Alíquota ISS (%), ex: 2.00 para 2%
  iss_retido          BOOLEAN DEFAULT FALSE,  -- ISS retido na fonte pelo tomador

  ativo               BOOLEAN NOT NULL DEFAULT TRUE,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Apenas um registro de config por usuário
  CONSTRAINT uq_fiscal_config_user UNIQUE (user_id)
);

COMMENT ON TABLE public.fiscal_configs IS 'Configurações fiscais de cada recebedor. user_id = NULL representa a plataforma (fallback global).';
COMMENT ON COLUMN public.fiscal_configs.user_id IS 'UUID do usuário no auth.users. NULL = config da plataforma (fallback).';
COMMENT ON COLUMN public.fiscal_configs.focus_nf_token IS 'Token de API da Focus NF do emissor. Cada recebedor usa o seu próprio.';
COMMENT ON COLUMN public.fiscal_configs.codigo_municipio IS 'Código IBGE do município do prestador. Necessário para roteamento na Focus NF.';
COMMENT ON COLUMN public.fiscal_configs.item_lista_servico IS 'Código do serviço conforme lista do município (LC 116/2003).';
COMMENT ON COLUMN public.fiscal_configs.regime_tributario IS '1=Simples Nacional, 2=Simples Nacional excesso, 3=Regime Normal.';


-- 2. Notas fiscais geradas (uma por recebedor por transação)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referência à transação
  transaction_id       TEXT NOT NULL,  -- ID do order no Pagar.me (ex: 'or_xxxxxxxxxxxxxxxx')
  compra_id            UUID REFERENCES public.compras(id) ON DELETE SET NULL,

  -- Emissor da nota
  fiscal_config_id     UUID REFERENCES public.fiscal_configs(id) ON DELETE RESTRICT,
  emissor_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_platform_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  -- TRUE quando emitido pelo CNPJ da plataforma pois o recebedor não tinha config

  -- Dados do Tomador (Comprador/Aluno)
  buyer_document       TEXT NOT NULL,       -- CPF ou CNPJ do aluno
  buyer_document_type  TEXT NOT NULL DEFAULT 'cpf' CHECK (buyer_document_type IN ('cpf', 'cnpj')),
  buyer_name           TEXT NOT NULL,
  buyer_email          TEXT NOT NULL,

  -- Dados do Serviço / Valor
  amount               NUMERIC(10, 2) NOT NULL,  -- Valor da nota em reais (proporcional ao split)
  description          TEXT NOT NULL,             -- Descrição do serviço

  -- Integração Focus NF
  focus_nf_reference   TEXT UNIQUE NOT NULL,  -- UUID gerado por nós, enviado à Focus NF como referência
  focus_nf_status      TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (focus_nf_status IN ('PENDING', 'PROCESSING', 'AUTHORIZED', 'ERROR', 'CANCELLED')),
  focus_nf_numero      TEXT,   -- Número da NFS-e emitida pela prefeitura
  focus_nf_codigo_verificacao TEXT,  -- Código de verificação da NFS-e

  -- URLs dos documentos
  xml_url              TEXT,
  pdf_url              TEXT,

  -- Controle
  emitted_at           TIMESTAMPTZ,
  error_message        TEXT,
  retry_count          INTEGER NOT NULL DEFAULT 0,
  last_retry_at        TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.invoices IS 'Registro de cada NFS-e gerada. Uma por recebedor por transação do Pagar.me.';
COMMENT ON COLUMN public.invoices.transaction_id IS 'ID do pedido no Pagar.me (order.id).';
COMMENT ON COLUMN public.invoices.focus_nf_reference IS 'UUID gerado internamente, enviado como referência única para a Focus NF.';
COMMENT ON COLUMN public.invoices.is_platform_fallback IS 'TRUE quando a nota foi emitida pelo CNPJ da plataforma (recebedor sem fiscal_config).';
COMMENT ON COLUMN public.invoices.amount IS 'Valor em reais, proporcional à fatia do split deste recebedor.';

CREATE INDEX IF NOT EXISTS idx_invoices_transaction_id  ON public.invoices(transaction_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status          ON public.invoices(focus_nf_status);
CREATE INDEX IF NOT EXISTS idx_invoices_buyer_email     ON public.invoices(buyer_email);
CREATE INDEX IF NOT EXISTS idx_invoices_emissor         ON public.invoices(emissor_user_id);


-- 3. Jobs de emissão agendados (pós-período de garantia)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  TEXT NOT NULL UNIQUE,   -- ID do order no Pagar.me
  compra_id       UUID REFERENCES public.compras(id) ON DELETE SET NULL,
  scheduled_for   TIMESTAMPTZ NOT NULL,   -- paid_at + 7 dias
  status          TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  last_error      TEXT,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.invoice_jobs IS 'Fila de jobs de emissão de NFS-e, agendados para 7 dias após aprovação do pagamento.';
COMMENT ON COLUMN public.invoice_jobs.scheduled_for IS 'Timestamp a partir do qual o job pode ser processado (approved_at + 7 dias).';
COMMENT ON COLUMN public.invoice_jobs.attempts IS 'Número de tentativas já realizadas. Após max_attempts, o status vai para FAILED.';

CREATE INDEX IF NOT EXISTS idx_invoice_jobs_scheduled ON public.invoice_jobs(scheduled_for, status)
  WHERE status IN ('PENDING', 'FAILED');


-- 4. Configurações gerais da plataforma (chave/valor)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_settings IS 'Configurações gerais da plataforma em formato chave/valor.';

-- Seeds de configuração padrão
INSERT INTO public.platform_settings (key, value) VALUES
  ('admin_alert_email', ''),          -- E-mail do admin para alertas de erro de emissão
  ('invoice_guarantee_days', '7'),    -- Período de garantia em dias (fixo: 7)
  ('invoice_service_description', 'Serviço de educação digital - acesso a plataforma de cursos e mentorias')
ON CONFLICT (key) DO NOTHING;


-- 5. Trigger para atualizar updated_at automaticamente
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fiscal_configs_updated_at
  BEFORE UPDATE ON public.fiscal_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_invoice_jobs_updated_at
  BEFORE UPDATE ON public.invoice_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 6. Row Level Security
-- ------------------------------------------------------------
ALTER TABLE public.fiscal_configs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- fiscal_configs: usuário vê/edita somente a própria config
CREATE POLICY "fiscal_configs_select_own" ON public.fiscal_configs
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.get_current_user_role() IN ('admin', 'super_admin')
  );

CREATE POLICY "fiscal_configs_insert_own" ON public.fiscal_configs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR public.get_current_user_role() IN ('admin', 'super_admin')
  );

CREATE POLICY "fiscal_configs_update_own" ON public.fiscal_configs
  FOR UPDATE USING (
    auth.uid() = user_id
    OR public.get_current_user_role() IN ('admin', 'super_admin')
  );

-- invoices: usuário vê as notas emitidas por ele; admins veem todas
CREATE POLICY "invoices_select_policy" ON public.invoices
  FOR SELECT USING (
    auth.uid() = emissor_user_id
    OR buyer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR public.get_current_user_role() IN ('admin', 'super_admin')
  );

-- invoice_jobs e platform_settings: somente admins
CREATE POLICY "invoice_jobs_admin_only" ON public.invoice_jobs
  FOR ALL USING (public.get_current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "platform_settings_admin_only" ON public.platform_settings
  FOR ALL USING (public.get_current_user_role() IN ('admin', 'super_admin'));


-- ============================================================
-- Confirmação
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260725000000_fiscal_invoices applied successfully.';
  RAISE NOTICE '  Tables: fiscal_configs, invoices, invoice_jobs, platform_settings';
  RAISE NOTICE '  Indexes: idx_invoices_transaction_id, idx_invoices_status, idx_invoice_jobs_scheduled';
  RAISE NOTICE '  RLS: enabled on all tables';
END $$;

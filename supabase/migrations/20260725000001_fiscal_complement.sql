-- ============================================================
-- Migration: Colunas complementares para integração de NF
-- Data: 2026-07-25
-- Descrição: Adiciona colunas que faltavam nas tabelas compras
--   e usuarios, necessárias para emissão de NFS-e.
--   (Aplicada via Supabase MCP + este arquivo para rastreabilidade)
-- ============================================================

-- 1. Tabela compras — colunas Pagar.me e financeiras
-- (equivale à migration 20260529_financeiro_v2.sql que não havia sido aplicada)
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS valor_liquido        NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS pagarme_order_id     TEXT,
  ADD COLUMN IF NOT EXISTS pagarme_charge_id    TEXT,
  ADD COLUMN IF NOT EXISTS estorno_motivo       TEXT,
  ADD COLUMN IF NOT EXISTS estorno_em           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS installments         INTEGER DEFAULT 1;

COMMENT ON COLUMN public.compras.valor_liquido    IS 'Valor líquido após dedução das taxas do Pagar.me (~4.99% CC, ~1.99% PIX)';
COMMENT ON COLUMN public.compras.pagarme_order_id IS 'ID do pedido no Pagar.me — usado para lookup de estorno e emissão de NFS-e';
COMMENT ON COLUMN public.compras.pagarme_charge_id IS 'ID da charge no Pagar.me — usado para cancelamento direto';
COMMENT ON COLUMN public.compras.installments     IS 'Número de parcelas do pagamento com cartão de crédito';

-- 2. Tabela usuarios — documentos fiscais do comprador
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS cpf  TEXT,
  ADD COLUMN IF NOT EXISTS cnpj TEXT;

COMMENT ON COLUMN public.usuarios.cpf  IS 'CPF do usuário — obrigatório como tomador na emissão de NFS-e';
COMMENT ON COLUMN public.usuarios.cnpj IS 'CNPJ do usuário (quando empresa) — alternativo ao CPF na emissão de NFS-e';

-- 3. Tabela curso_participantes — controle de expiração de acesso
ALTER TABLE public.curso_participantes
  ADD COLUMN IF NOT EXISTS expirado_em TIMESTAMPTZ;

COMMENT ON COLUMN public.curso_participantes.expirado_em IS 'Data em que o acesso ao curso foi expirado automaticamente pelo cron expire-access';

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_compras_pagarme_order_id
  ON public.compras (pagarme_order_id)
  WHERE pagarme_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compras_status_created
  ON public.compras (status, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_usuarios_cpf
  ON public.usuarios (cpf)
  WHERE cpf IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_curso_participantes_status_created
  ON public.curso_participantes (status, created_at)
  WHERE status IN ('inscrito', 'pago', 'ativo');

-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260725000001_fiscal_complement applied successfully.';
  RAISE NOTICE '  compras: valor_liquido, pagarme_order_id, pagarme_charge_id, estorno_*, installments';
  RAISE NOTICE '  usuarios: cpf, cnpj';
  RAISE NOTICE '  curso_participantes: expirado_em';
END $$;

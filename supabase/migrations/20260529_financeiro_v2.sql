-- ============================================================
-- Migration: Melhorias Financeiras v2.0
-- Data: 2026-05-29
-- Descrição: Adiciona colunas para suportar:
--   - M5: valor_liquido (receita após taxa do Pagar.me)
--   - M11: pagarme_order_id e pagarme_charge_id para estornos
--   - M10: expirado_em em curso_participantes
--   - Estorno: campos estorno_motivo e estorno_em em compras
--   - M1: installments (número de parcelas)
-- ============================================================

-- 1. Tabela compras — novas colunas
ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS valor_liquido        NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS pagarme_order_id     TEXT,
  ADD COLUMN IF NOT EXISTS pagarme_charge_id    TEXT,
  ADD COLUMN IF NOT EXISTS estorno_motivo       TEXT,
  ADD COLUMN IF NOT EXISTS estorno_em           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS installments         INTEGER DEFAULT 1;

-- Comentários de documentação
COMMENT ON COLUMN compras.valor_liquido     IS 'Valor líquido após dedução das taxas do Pagar.me (~4.99% CC, ~1.99% PIX)';
COMMENT ON COLUMN compras.pagarme_order_id  IS 'ID do pedido no Pagar.me para lookup de estorno';
COMMENT ON COLUMN compras.pagarme_charge_id IS 'ID da charge no Pagar.me para cancelamento direto';
COMMENT ON COLUMN compras.estorno_motivo    IS 'Motivo do estorno, preenchido via endpoint /api/pagarme/refund';
COMMENT ON COLUMN compras.estorno_em        IS 'Data e hora do estorno processado';
COMMENT ON COLUMN compras.installments      IS 'Número de parcelas do pagamento com cartão de crédito';

-- 2. Tabela curso_participantes — campo de expiração
--    NOTA: a coluna de data de inscrição é 'created_at' (não 'inscrito_em')
ALTER TABLE curso_participantes
  ADD COLUMN IF NOT EXISTS expirado_em TIMESTAMPTZ;

COMMENT ON COLUMN curso_participantes.expirado_em IS 'Data em que o acesso ao curso foi expirado automaticamente pelo cron expire-access';

-- 3. Índice para performance da query do cron de expiração
--    usa created_at (coluna real da tabela)
CREATE INDEX IF NOT EXISTS idx_curso_participantes_status_created
  ON curso_participantes (status, created_at)
  WHERE status IN ('inscrito', 'pago', 'ativo');

-- 4. Índice para lookup rápido de compras por order_id do Pagar.me
CREATE INDEX IF NOT EXISTS idx_compras_pagarme_order_id
  ON compras (pagarme_order_id)
  WHERE pagarme_order_id IS NOT NULL;

-- 5. Índice para relatório financeiro por status + criado_em
CREATE INDEX IF NOT EXISTS idx_compras_status_created
  ON compras (status, criado_em DESC);

-- ============================================================
-- Confirmar a migração
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration financeiro_v2 applied successfully.';
  RAISE NOTICE '  compras: valor_liquido, pagarme_order_id, pagarme_charge_id, estorno_*, installments';
  RAISE NOTICE '  curso_participantes: expirado_em';
  RAISE NOTICE '  Indexes: idx_curso_participantes_status_created, idx_compras_pagarme_order_id, idx_compras_status_created';
END $$;

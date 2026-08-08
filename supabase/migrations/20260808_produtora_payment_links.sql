-- Migration: produtora_payment_links
-- Description: Payment links for Produtora services (Pagar.me integration)

CREATE TABLE IF NOT EXISTS produtora_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico text NOT NULL CHECK (servico IN (
    'gestao_redes_sociais', 'gestao_trafego_pago', 'criacao_landing_page',
    'consultoria', 'setup_onboarding', 'gestao_atendimento_comercial', 'outro'
  )),
  descricao text NOT NULL,
  organizacao_id uuid REFERENCES organizacoes(id) ON DELETE SET NULL,
  cliente_nome text,
  cliente_email text,
  valor numeric(10,2) NOT NULL,
  recorrente boolean DEFAULT false,
  periodicidade text CHECK (periodicidade IN ('mensal', 'trimestral', 'anual')),
  pagarme_link_id text,
  pagarme_link_url text,
  pagarme_order_id text,
  valor_liquido numeric(10,2),
  aceita_cartao boolean DEFAULT true,
  aceita_pix boolean DEFAULT true,
  aceita_boleto boolean DEFAULT true,
  max_parcelas int DEFAULT 1,
  status text DEFAULT 'ativo' CHECK (status IN ('ativo', 'pago', 'expirado', 'cancelado')),
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  pago_em timestamptz
);

ALTER TABLE produtora_payment_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_all_links' AND tablename = 'produtora_payment_links') THEN
    CREATE POLICY super_admin_all_links ON produtora_payment_links FOR ALL USING (true);
  END IF;
END $$;

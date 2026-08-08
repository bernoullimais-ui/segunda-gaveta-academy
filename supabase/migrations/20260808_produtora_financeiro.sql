-- Migration: produtora_financeiro
-- Description: Creates tables for Produtora Segunda Gaveta financial management (Receitas e Despesas)

CREATE TABLE IF NOT EXISTS produtora_receitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN (
    'percentual_curso', 'landing_page', 'producao_video',
    'mentoria_consultoria', 'setup_onboarding', 'gestao_mensal', 'outro'
  )),
  descricao text,
  organizacao_id uuid REFERENCES organizacoes(id) ON DELETE SET NULL,
  compra_id uuid REFERENCES compras(id) ON DELETE SET NULL,
  valor numeric(10,2) NOT NULL,
  percentual_aplicado numeric(5,2),
  data_referencia date NOT NULL,
  status text DEFAULT 'recebido' CHECK (status IN ('recebido', 'a_receber', 'cancelado')),
  observacoes text,
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS produtora_despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL CHECK (categoria IN (
    'aplicativo_saas', 'contabilidade', 'equipe_interna',
    'prestador_servico', 'imposto_taxa', 'marketing_anuncio',
    'infraestrutura', 'outro'
  )),
  descricao text NOT NULL,
  fornecedor text,
  valor numeric(10,2) NOT NULL,
  recorrente boolean DEFAULT false,
  periodicidade text CHECK (periodicidade IN ('mensal', 'trimestral', 'anual', 'unico')),
  data_vencimento date,
  data_pagamento date,
  status text DEFAULT 'pago' CHECK (status IN ('pago', 'pendente', 'cancelado')),
  observacoes text,
  recorrencia_origem_id uuid REFERENCES produtora_despesas(id) ON DELETE SET NULL,
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE produtora_receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtora_despesas ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_all_receitas') THEN
    CREATE POLICY super_admin_all_receitas ON produtora_receitas FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_all_despesas') THEN
    CREATE POLICY super_admin_all_despesas ON produtora_despesas FOR ALL USING (true);
  END IF;
END $$;

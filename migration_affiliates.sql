-- Add affiliate columns to compras table
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS comissao_afiliado NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS comissao_coprodutores JSONB DEFAULT '[]'::jsonb;

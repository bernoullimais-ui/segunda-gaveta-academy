-- 1. Criar a tabela de checkouts abandonados
CREATE TABLE IF NOT EXISTS public.checkouts_abandonados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT,
    item_tipo TEXT NOT NULL, -- 'curso' | 'trilha'
    item_id UUID NOT NULL,
    item_nome TEXT NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    checkout_url TEXT NOT NULL,
    recuperado BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    organizacao_id UUID
);

-- 2. Desabilitar RLS para que o backend Express (que usa chaves de API) possa gerenciar os checkouts sem restrições
ALTER TABLE public.checkouts_abandonados DISABLE ROW LEVEL SECURITY;

-- 3. Notificar o PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';

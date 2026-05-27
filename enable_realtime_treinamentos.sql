-- Habilitar o Realtime para a tabela treinamentos
-- Isso é necessário para que as mudanças de fase (status) sejam refletidas
-- em tempo real na tela dos participantes.

-- Adicionar a tabela à publicação supabase_realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.treinamentos;

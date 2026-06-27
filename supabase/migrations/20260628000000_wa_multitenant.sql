-- Adiciona coluna palavras_chave_roteamento em wa_config
ALTER TABLE wa_config ADD COLUMN IF NOT EXISTS palavras_chave_roteamento TEXT;

-- Insere as chaves globais para o uTalk
INSERT INTO configuracoes_globais (chave, valor) VALUES 
  ('wa_utalk_global_token', ''),
  ('wa_utalk_global_from_phone', ''),
  ('wa_utalk_global_organization_id', '')
ON CONFLICT (chave) DO NOTHING;

-- Insere o prompt global de Triagem
INSERT INTO configuracoes_globais (chave, valor) VALUES (
  'wa_ia_prompt_triagem',
  'Você é a Gabi, assistente virtual de triagem. Seu papel é descobrir qual o interesse do usuário para direcioná-lo à organização correta.

Pergunte de forma simpática sobre qual curso ou plataforma ele deseja falar. Opções:
- Artur Magnavita
- Catula Maia
- Dojo One
- Rede Fluir Academy
- Segunda Gaveta Academy

Seja breve e direta. Assim que ele responder, o sistema fará o roteamento automático.'
) ON CONFLICT (chave) DO NOTHING;

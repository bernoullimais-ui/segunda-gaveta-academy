-- ============================================================
-- Migration: Módulo Atendimento IA WhatsApp
-- Projeto: Segunda Gaveta Academy
-- Tabelas: wa_conversas, wa_mensagens, wa_config
-- ============================================================

-- 1. Tabela de Conversas WhatsApp
CREATE TABLE IF NOT EXISTS wa_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID REFERENCES organizacoes(id) ON DELETE CASCADE,
  contato_telefone TEXT NOT NULL,
  contato_nome TEXT,
  contato_email TEXT,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  is_aluno BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'ia_ativa'
    CHECK (status IN ('ia_ativa', 'aguardando_humano', 'em_atendimento', 'encerrada')),
  atendente_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT now(),
  ultima_mensagem_em TIMESTAMPTZ DEFAULT now(),
  encerrado_em TIMESTAMPTZ
);

ALTER TABLE wa_conversas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_publico_wa_conversas" ON wa_conversas;
CREATE POLICY "acesso_publico_wa_conversas" ON wa_conversas FOR ALL USING (true);

-- 2. Tabela de Mensagens WhatsApp
CREATE TABLE IF NOT EXISTS wa_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID REFERENCES wa_conversas(id) ON DELETE CASCADE,
  direcao TEXT NOT NULL CHECK (direcao IN ('entrada', 'saida')),
  conteudo TEXT NOT NULL,
  enviado_por TEXT DEFAULT 'ia' CHECK (enviado_por IN ('ia', 'humano', 'contato')),
  criado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_publico_wa_mensagens" ON wa_mensagens;
CREATE POLICY "acesso_publico_wa_mensagens" ON wa_mensagens FOR ALL USING (true);

-- 3. Tabela de Configuração WhatsApp (por organização)
CREATE TABLE IF NOT EXISTS wa_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID UNIQUE REFERENCES organizacoes(id) ON DELETE CASCADE,
  utalk_token TEXT,
  utalk_from_phone TEXT,
  utalk_organization_id TEXT,
  ia_ativa BOOLEAN DEFAULT true,
  ia_prompt_override TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_publico_wa_config" ON wa_config;
CREATE POLICY "acesso_publico_wa_config" ON wa_config FOR ALL USING (true);

-- 4. Tabela de Configurações Globais (genérica, se não existir)
CREATE TABLE IF NOT EXISTS configuracoes_globais (
  chave TEXT PRIMARY KEY,
  valor TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE configuracoes_globais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_publico_configuracoes_globais" ON configuracoes_globais;
CREATE POLICY "acesso_publico_configuracoes_globais" ON configuracoes_globais FOR ALL USING (true);

-- 5. Seed: Prompt global padrão da IA
INSERT INTO configuracoes_globais (chave, valor) VALUES (
  'wa_ia_prompt_global',
  'Você é a Gabi, assistente virtual da Segunda Gaveta Academy — uma plataforma de educação digital especializada em produção de conteúdo, podcasts, marketing digital e criação de cursos online.

Seu papel é:
1. Responder dúvidas sobre cursos disponíveis, preços e formas de pagamento
2. Identificar se o contato já é aluno ou está interessado em comprar
3. Resolver problemas simples de acesso à plataforma (login, senha)
4. Qualificar leads e direcionar para a página de compra quando houver interesse
5. Quando o assunto for complexo ou o contato pedir, transferir para um especialista humano

Regras:
- Responda SEMPRE em português do Brasil, com tom amigável, profissional e inspirador
- Use o nome da pessoa sempre que possível
- Nunca invente preços, datas ou informações sobre cursos que não foram fornecidas
- Quando precisar transferir para humano, inclua a palavra TRANSBORDO em algum lugar da sua resposta interna
- Seja breve e objetivo — estamos no WhatsApp, não em um e-mail
- Se o aluno já for cadastrado na plataforma, mencione isso com simpatia'
) ON CONFLICT (chave) DO NOTHING;

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_wa_conversas_status ON wa_conversas(status);
CREATE INDEX IF NOT EXISTS idx_wa_conversas_org ON wa_conversas(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_wa_conversas_telefone ON wa_conversas(contato_telefone);
CREATE INDEX IF NOT EXISTS idx_wa_mensagens_conversa ON wa_mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_wa_mensagens_criado ON wa_mensagens(criado_em DESC);

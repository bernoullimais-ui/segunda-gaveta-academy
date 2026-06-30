-- 20260630_wa_mensagens_midia.sql
-- Adiciona suporte a mídias e reações no Atendimento IA

ALTER TABLE wa_mensagens
  ADD COLUMN IF NOT EXISTS tipo_mensagem TEXT DEFAULT 'texto' CHECK (tipo_mensagem IN ('texto', 'imagem', 'video', 'audio', 'documento', 'reacao')),
  ADD COLUMN IF NOT EXISTS midia_url TEXT,
  ADD COLUMN IF NOT EXISTS midia_mimetype TEXT,
  ADD COLUMN IF NOT EXISTS midia_filename TEXT,
  ADD COLUMN IF NOT EXISTS reacao_emoji TEXT,
  ADD COLUMN IF NOT EXISTS utalk_message_id TEXT,
  ADD COLUMN IF NOT EXISTS reacao_para_id UUID REFERENCES wa_mensagens(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_wa_mensagens_utalk_id ON wa_mensagens(utalk_message_id);

-- Criação do Bucket para mídias
INSERT INTO storage.buckets (id, name, public) 
VALUES ('whatsapp_midias', 'whatsapp_midias', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas do Storage para o bucket whatsapp_midias
CREATE POLICY "Permitir leitura pública whatsapp_midias"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'whatsapp_midias' );

CREATE POLICY "Permitir insert autenticado whatsapp_midias"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'whatsapp_midias' );

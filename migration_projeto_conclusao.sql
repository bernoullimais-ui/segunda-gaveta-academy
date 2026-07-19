-- ============================================================
-- MIGRATION: Projeto de Conclusão por Aula
-- Academia Digital
-- ============================================================

-- 1. Template do projeto (um por curso)
CREATE TABLE IF NOT EXISTS projeto_conclusao_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id         UUID REFERENCES cursos(id) ON DELETE CASCADE NOT NULL,
  organizacao_id   UUID REFERENCES organizacoes(id) ON DELETE CASCADE,
  titulo           TEXT NOT NULL DEFAULT 'Projeto de Conclusão',
  descricao        TEXT,
  bloqueio_estrito BOOLEAN DEFAULT true,
  ativo            BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(curso_id)
);

-- 2. Missões (cada uma vinculada a uma aula gatilho do curriculo_json)
CREATE TABLE IF NOT EXISTS projeto_conclusao_missoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID REFERENCES projeto_conclusao_templates(id) ON DELETE CASCADE NOT NULL,
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  campos_json     JSONB DEFAULT '[]'::jsonb,
  gatilho_etapa_id TEXT,
  gatilho_tipo    TEXT DEFAULT 'concluir_etapa'
                  CHECK (gatilho_tipo IN ('concluir_etapa', 'assistir_70', 'concluir_secao')),
  ordem           INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 3. Delegações de acesso ao projeto por curso
CREATE TABLE IF NOT EXISTS projeto_conclusao_delegacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES projeto_conclusao_templates(id) ON DELETE CASCADE NOT NULL,
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_id, usuario_id)
);

-- 4. Respostas dos alunos por missão
CREATE TABLE IF NOT EXISTS projeto_conclusao_respostas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  missao_id             UUID REFERENCES projeto_conclusao_missoes(id) ON DELETE CASCADE NOT NULL,
  usuario_id            UUID REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  curso_id              UUID REFERENCES cursos(id) ON DELETE CASCADE NOT NULL,
  respostas_json        JSONB DEFAULT '{}'::jsonb,
  feedback_geral        TEXT,
  feedbacks_campos_json JSONB DEFAULT '{}'::jsonb,
  feedback_publicado    BOOLEAN DEFAULT false,
  status                TEXT DEFAULT 'rascunho'
                        CHECK (status IN ('rascunho', 'submetido', 'com_feedback')),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(missao_id, usuario_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pct_curso ON projeto_conclusao_templates(curso_id);
CREATE INDEX IF NOT EXISTS idx_pct_org ON projeto_conclusao_templates(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_pcm_template ON projeto_conclusao_missoes(template_id);
CREATE INDEX IF NOT EXISTS idx_pcm_ordem ON projeto_conclusao_missoes(template_id, ordem);
CREATE INDEX IF NOT EXISTS idx_pcd_template ON projeto_conclusao_delegacoes(template_id);
CREATE INDEX IF NOT EXISTS idx_pcd_usuario ON projeto_conclusao_delegacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pcr_missao ON projeto_conclusao_respostas(missao_id);
CREATE INDEX IF NOT EXISTS idx_pcr_usuario ON projeto_conclusao_respostas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pcr_curso ON projeto_conclusao_respostas(curso_id);
CREATE INDEX IF NOT EXISTS idx_pcr_status ON projeto_conclusao_respostas(status);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE projeto_conclusao_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_conclusao_missoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_conclusao_delegacoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_conclusao_respostas   ENABLE ROW LEVEL SECURITY;

-- Helper: retorna o usuario.id a partir do auth.uid()
CREATE OR REPLACE FUNCTION get_usuario_id_from_auth()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- Helper: retorna a org_id do usuário logado
CREATE OR REPLACE FUNCTION get_usuario_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT organizacao_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- Helper: retorna o role do usuário logado
CREATE OR REPLACE FUNCTION get_usuario_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ── Templates ──────────────────────────────────────────────
CREATE POLICY "projeto_templates_gestor_crud" ON projeto_conclusao_templates
  FOR ALL USING (
    organizacao_id = get_usuario_org_id()
    AND get_usuario_role() IN ('gestor','super_admin','curador')
  );

CREATE POLICY "projeto_templates_delegado_read" ON projeto_conclusao_templates
  FOR SELECT USING (
    id IN (
      SELECT template_id FROM projeto_conclusao_delegacoes
      WHERE usuario_id = get_usuario_id_from_auth()
    )
  );

CREATE POLICY "projeto_templates_aluno_read" ON projeto_conclusao_templates
  FOR SELECT USING (
    ativo = true
    AND curso_id IN (
      SELECT curso_id FROM curso_participantes
      WHERE usuario_id = get_usuario_id_from_auth()
      AND status IN ('andamento','inscrito','concluido')
    )
  );

-- ── Missões ────────────────────────────────────────────────
CREATE POLICY "projeto_missoes_gestor_crud" ON projeto_conclusao_missoes
  FOR ALL USING (
    template_id IN (
      SELECT id FROM projeto_conclusao_templates
      WHERE organizacao_id = get_usuario_org_id()
      AND get_usuario_role() IN ('gestor','super_admin','curador')
    )
  );

CREATE POLICY "projeto_missoes_read" ON projeto_conclusao_missoes
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM projeto_conclusao_templates
      WHERE (
        id IN (SELECT template_id FROM projeto_conclusao_delegacoes WHERE usuario_id = get_usuario_id_from_auth())
        OR
        (ativo = true AND curso_id IN (
          SELECT curso_id FROM curso_participantes
          WHERE usuario_id = get_usuario_id_from_auth()
          AND status IN ('andamento','inscrito','concluido')
        ))
      )
    )
  );

-- ── Delegações ─────────────────────────────────────────────
CREATE POLICY "projeto_delegacoes_gestor_crud" ON projeto_conclusao_delegacoes
  FOR ALL USING (
    template_id IN (
      SELECT id FROM projeto_conclusao_templates
      WHERE organizacao_id = get_usuario_org_id()
      AND get_usuario_role() IN ('gestor','super_admin','curador')
    )
  );

CREATE POLICY "projeto_delegacoes_self_read" ON projeto_conclusao_delegacoes
  FOR SELECT USING (usuario_id = get_usuario_id_from_auth());

-- ── Respostas ──────────────────────────────────────────────
CREATE POLICY "projeto_respostas_aluno_crud" ON projeto_conclusao_respostas
  FOR ALL USING (usuario_id = get_usuario_id_from_auth());

CREATE POLICY "projeto_respostas_gestor_rw" ON projeto_conclusao_respostas
  FOR ALL USING (
    get_usuario_role() IN ('gestor','super_admin','curador')
    AND curso_id IN (
      SELECT id FROM cursos WHERE organizacao_id = get_usuario_org_id()
    )
  );

CREATE POLICY "projeto_respostas_delegado_rw" ON projeto_conclusao_respostas
  FOR ALL USING (
    missao_id IN (
      SELECT pcm.id FROM projeto_conclusao_missoes pcm
      JOIN projeto_conclusao_delegacoes pcd ON pcd.template_id = pcm.template_id
      WHERE pcd.usuario_id = get_usuario_id_from_auth()
    )
  );

-- ============================================================
-- REALTIME (descomente para feedback em tempo real)
-- ============================================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE projeto_conclusao_respostas;

-- ============================================================
-- NOTA: Criar bucket 'projeto-uploads' no Supabase Storage
-- Dashboard: Storage > New Bucket
-- Nome: projeto-uploads | Public: false | Max file size: 10MB
-- Allowed MIME types: image/*, application/pdf
-- ============================================================

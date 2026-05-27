CREATE TABLE IF NOT EXISTS curso_participantes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  curso_id UUID REFERENCES cursos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'andamento',
  progresso NUMERIC DEFAULT 0,
  completed_steps JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(curso_id, usuario_id)
);
ALTER TABLE curso_participantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Todos podem ver participantes" ON curso_participantes;
CREATE POLICY "Todos podem ver participantes" ON curso_participantes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Usuarios gerenciam sua participacao" ON curso_participantes;
CREATE POLICY "Usuarios gerenciam sua participacao" ON curso_participantes FOR ALL USING (auth.uid() = usuario_id);
NOTIFY pgrst, 'reload schema';

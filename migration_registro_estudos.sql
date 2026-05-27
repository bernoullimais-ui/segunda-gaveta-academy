-- =====================================================================
-- Migração: Criar Tabela public.registro_estudos
-- Fase 16: Dashboard de Progresso e Gamificação do Aluno
-- =====================================================================
-- Execute este script no SQL Editor do console do Supabase.

-- 1. Criar a tabela de registros de estudos diários
CREATE TABLE IF NOT EXISTS public.registro_estudos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    minutos_estudados INTEGER NOT NULL DEFAULT 1 CHECK (minutos_estudados > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Garantir que cada usuário tenha no máximo uma entrada por curso por dia
--    Isso nos permite fazer um UPSERT limpo com ON CONFLICT (usuario_id, curso_id, data)
CREATE UNIQUE INDEX IF NOT EXISTS idx_registro_estudos_unique_day
    ON public.registro_estudos (usuario_id, curso_id, data);

-- 3. Habilitar segurança de nível de linha (RLS)
ALTER TABLE public.registro_estudos ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas de RLS
-- A. Leitura (SELECT): 
--    - Usuário pode ler seus próprios registros.
--    - Especialista pode ler registros de cursos de sua própria organização.
--    - Super Admin lê tudo.
DROP POLICY IF EXISTS "registro_estudos_select_policy" ON public.registro_estudos;
CREATE POLICY "registro_estudos_select_policy" ON public.registro_estudos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios currentUser
            WHERE currentUser.auth_id = auth.uid()
            AND (
                currentUser.id = public.registro_estudos.usuario_id
                OR currentUser.role = 'super_admin'
                OR (
                    currentUser.role = 'especialista'
                    AND currentUser.organizacao_id = (
                        SELECT organizacao_id FROM public.cursos 
                        WHERE id = public.registro_estudos.curso_id
                    )
                )
            )
        )
    );

-- B. Escrita (INSERT/UPDATE):
--    - Aluno pode inserir e atualizar seus próprios logs de estudo.
--    - Super Admins também podem gerenciar.
DROP POLICY IF EXISTS "registro_estudos_insert_update_policy" ON public.registro_estudos;
CREATE POLICY "registro_estudos_insert_update_policy" ON public.registro_estudos
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios currentUser
            WHERE currentUser.auth_id = auth.uid()
            AND (
                currentUser.id = public.registro_estudos.usuario_id
                OR currentUser.role = 'super_admin'
            )
        )
    );

-- 5. Atualizar esquema e recarregar cache
NOTIFY pgrst, 'reload schema';

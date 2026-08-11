-- =============================================================================
-- SOLUÇÃO DEFINITIVA PARA RASTREAMENTO DE CLIQUES NA BIO PAGE
-- Execute este script completo no SQL Editor do Supabase Dashboard
-- =============================================================================

-- 1. Cria a tabela de cliques SE NÃO EXISTIR
CREATE TABLE IF NOT EXISTS bio_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid,
  link_id text NOT NULL,
  link_url text DEFAULT '',
  user_agent text,
  referrer text,
  created_at timestamptz DEFAULT now()
);

-- 2. Habilita RLS
ALTER TABLE bio_link_clicks ENABLE ROW LEVEL SECURITY;

-- 3. Remove políticas antigas se existirem
DROP POLICY IF EXISTS public_insert_bio_link_clicks ON bio_link_clicks;
DROP POLICY IF EXISTS public_select_bio_link_clicks ON bio_link_clicks;

-- 4. Cria políticas abertas para qualquer usuário (público e anônimo)
CREATE POLICY public_insert_bio_link_clicks ON bio_link_clicks
  FOR INSERT WITH CHECK (true);

CREATE POLICY public_select_bio_link_clicks ON bio_link_clicks
  FOR SELECT USING (true);

-- 5. Concede permissão explícita para anon e authenticated
GRANT INSERT ON bio_link_clicks TO anon;
GRANT INSERT ON bio_link_clicks TO authenticated;
GRANT SELECT ON bio_link_clicks TO anon;
GRANT SELECT ON bio_link_clicks TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 6. Cria a função RPC SECURITY DEFINER que bypassa RLS completamente
DROP FUNCTION IF EXISTS track_bio_link_click(uuid, text, text);
CREATE OR REPLACE FUNCTION track_bio_link_click(
  p_org_id uuid,
  p_link_id text,
  p_link_url text DEFAULT ''
) RETURNS jsonb AS $$
DECLARE
  v_config jsonb;
  v_bio jsonb;
  v_counts jsonb;
  v_new_count int;
BEGIN
  -- Insere na tabela de log
  INSERT INTO bio_link_clicks (organizacao_id, link_id, link_url)
  VALUES (p_org_id, p_link_id, p_link_url);

  -- Atualiza o contador em config_json.bio_links_config.click_counts
  SELECT config_json INTO v_config
  FROM organizacoes
  WHERE id = p_org_id;

  IF v_config IS NOT NULL THEN
    v_bio := COALESCE(v_config->'bio_links_config', '{}'::jsonb);
    v_counts := COALESCE(v_bio->'click_counts', '{}'::jsonb);
    v_new_count := COALESCE((v_counts->>p_link_id)::int, 0) + 1;
    v_counts := jsonb_set(v_counts, ARRAY[p_link_id], to_jsonb(v_new_count));
    v_bio := jsonb_set(v_bio, '{click_counts}', v_counts);
    v_config := jsonb_set(v_config, '{bio_links_config}', v_bio);

    UPDATE organizacoes SET config_json = v_config WHERE id = p_org_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'link_id', p_link_id,
    'count', v_new_count
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Concede execução para anon e authenticated
GRANT EXECUTE ON FUNCTION track_bio_link_click(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION track_bio_link_click(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION track_bio_link_click(uuid, text, text) TO service_role;

-- Confirma
SELECT 'OK - Script executado com sucesso!' as resultado;

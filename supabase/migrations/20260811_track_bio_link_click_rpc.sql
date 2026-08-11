-- Migration: track_bio_link_click RPC function
-- Allows public anonymous visitors to record bio link clicks safely without RLS issues

-- 1. Ensure table bio_link_clicks exists and has open RLS policies for anon/authenticated
CREATE TABLE IF NOT EXISTS bio_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid REFERENCES organizacoes(id) ON DELETE CASCADE,
  link_id text NOT NULL,
  link_url text NOT NULL,
  user_agent text,
  referrer text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bio_link_clicks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_insert_bio_link_clicks' AND tablename = 'bio_link_clicks') THEN
    CREATE POLICY public_insert_bio_link_clicks ON bio_link_clicks FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_select_bio_link_clicks' AND tablename = 'bio_link_clicks') THEN
    CREATE POLICY public_select_bio_link_clicks ON bio_link_clicks FOR SELECT USING (true);
  END IF;
END $$;

-- 2. Create SECURITY DEFINER RPC function for bulletproof click tracking
CREATE OR REPLACE FUNCTION track_bio_link_click(
  p_org_id uuid,
  p_link_id text,
  p_link_url text DEFAULT ''
) RETURNS void AS $$
DECLARE
  v_config jsonb;
  v_bio jsonb;
  v_counts jsonb;
  v_new_count int;
BEGIN
  -- Insert click log
  INSERT INTO bio_link_clicks (organizacao_id, link_id, link_url)
  VALUES (p_org_id, p_link_id, p_link_url);

  -- Update config_json.bio_links_config.click_counts
  SELECT config_json INTO v_config FROM organizacoes WHERE id = p_org_id;
  IF v_config IS NOT NULL THEN
    v_bio := COALESCE(v_config->'bio_links_config', '{}'::jsonb);
    v_counts := COALESCE(v_bio->'click_counts', '{}'::jsonb);
    v_new_count := COALESCE((v_counts->>p_link_id)::int, 0) + 1;
    v_counts := jsonb_set(v_counts, ARRAY[p_link_id], to_jsonb(v_new_count));
    v_bio := jsonb_set(v_bio, '{click_counts}', v_counts);
    v_config := jsonb_set(v_config, '{bio_links_config}', v_bio);

    UPDATE organizacoes SET config_json = v_config WHERE id = p_org_id;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- non-fatal
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION track_bio_link_click(uuid, text, text) TO anon, authenticated, service_role;

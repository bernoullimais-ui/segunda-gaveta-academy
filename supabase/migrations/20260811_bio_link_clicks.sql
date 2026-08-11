-- Migration: bio_link_clicks
-- Description: Table for tracking click analytics on Link na Bio (Linktree) pages

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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_all_bio_clicks' AND tablename = 'bio_link_clicks') THEN
    CREATE POLICY super_admin_all_bio_clicks ON bio_link_clicks FOR ALL USING (true);
  END IF;
END $$;

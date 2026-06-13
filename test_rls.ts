import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let supabaseUrl = process.env.VITE_SUPABASE_URL!;
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseService = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: org } = await supabaseService.from('organizacoes').select('id').limit(1).single();
  if (!org) {
     console.log("No org"); return;
  }
  
  // We'll create a temporary RPC to run the insert as the user
  const rpcQuery = `
    CREATE OR REPLACE FUNCTION public.test_insert_as_user(user_uid UUID, target_org_id UUID)
    RETURNS JSONB AS $$
    DECLARE
      res JSONB;
    BEGIN
      -- Simulate RLS
      PERFORM set_config('request.jwt.claims', json_build_object('sub', user_uid)::text, true);
      
      -- Try to insert
      INSERT INTO public.cursos (nome, organizacao_id, status, curriculo_json, configuracao_json)
      VALUES ('Teste RLS Course', target_org_id, 'Rascunho', '[]'::jsonb, '{"preco": "gratuito"}'::jsonb)
      RETURNING to_jsonb(cursos.*) INTO res;
      
      -- Rollback? No need, we can delete it later.
      RETURN res;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('error', SQLERRM, 'state', SQLSTATE);
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  // Wait, I can't execute raw SQL from Supabase JS client unless I have an exec function.
  // I don't have exec function. I will use psql if possible.
}
run();

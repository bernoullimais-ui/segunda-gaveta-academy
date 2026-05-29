import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const sql = fs.readFileSync('supabase/migrations/20260529_financeiro_fase3_afiliados.sql', 'utf-8');
  // Hack to run raw SQL
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    console.error('Error running SQL:', error);
  } else {
    console.log('Migration applied successfully.');
  }
}
run();

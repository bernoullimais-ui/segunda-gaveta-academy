import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const res = await fetch(process.env.VITE_SUPABASE_URL, {
    headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY }
  });
  const data = await res.json();
  const tables = Object.keys(data.definitions);
  console.log('Tables:', tables.join(', '));
}
run();

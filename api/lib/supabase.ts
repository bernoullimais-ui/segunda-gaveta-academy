/**
 * api/lib/supabase.ts — Singleton do cliente Supabase para o backend
 *
 * Centraliza a criação do cliente em vez de replicar o código de inicialização
 * em cada router. Usa a SERVICE_ROLE_KEY para operações administrativas.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function buildSupabaseUrl(): string {
  let url = process.env.VITE_SUPABASE_URL || '';
  if (!url) return '';
  url = url.trim().replace(/\/$/, '');
  if (url.endsWith('/rest/v1')) {
    url = url.replace(/\/rest\/v1$/, '');
  }
  return url;
}

/**
 * Returns the Supabase admin client, initializing it lazily.
 * Throws if VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set.
 */
export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const url = buildSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !key) {
    throw new Error(
      'Supabase not configured. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  _supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return _supabase;
}

/**
 * Convenience re-export for destructured usage.
 * Example: const { from, auth } = supabase();
 */
export const supabase = {
  get client() {
    return getSupabase();
  }
};

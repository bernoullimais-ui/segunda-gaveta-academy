import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnv = (name: string) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
    return import.meta.env[name];
  }
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  return undefined;
};

let supabaseInstance: SupabaseClient | null = null;

const createSupabaseProxy = () => {
  return new Proxy({} as SupabaseClient, {
    get: (_target, prop) => {
      if (!supabaseInstance) {
        let url = getEnv('VITE_SUPABASE_URL');
        const key = getEnv('VITE_SUPABASE_ANON_KEY');

        if (!url || !url.startsWith('http')) {
          const msg = 'VITE_SUPABASE_URL is missing or invalid. Please check your Environment Variables.';
          console.error(msg);
          throw new Error(msg);
        }

        // Remover barra final ou sufixos que o SDK adiciona automaticamente
        url = url.trim().replace(/\/$/, '');
        if (url.endsWith('/rest/v1')) {
          url = url.replace(/\/rest\/v1$/, '');
        }

        if (!key) {
          const msg = 'VITE_SUPABASE_ANON_KEY is missing.';
          console.error(msg);
          throw new Error(msg);
        }

        console.log('Initializing Supabase with URL:', url);
        supabaseInstance = createClient(url, key);
      }
      
      const value = (supabaseInstance as any)[prop];
      if (typeof value === 'function') {
        return value.bind(supabaseInstance);
      }
      return value;
    }
  });
};

export const supabase = createSupabaseProxy();

export const testSupabaseConnection = async () => {
  try {
    const { error } = await supabase.from('organizacoes').select('id').limit(1);
    if (error) {
      if (error.message.includes('fetch')) return { ok: false, error: 'Network Error' };
      return { ok: true, error: null };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: 'Connection Failed' };
  }
};

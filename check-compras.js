import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL.replace('/rest/v1/', ''), process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: compra, error } = await supabase.from('compras').insert([{
    usuario_id: 'dfa87f75-a908-42d1-8969-e6662ed6ff85',
    tipo: 'curso',
    item_id: 'a196fda2-3f75-43ff-a44b-2b1b3f07e947',
    valor_pago: 6.7,
    metodo_pagamento: 'credit_card',
    status: 'pago'
  }]);
  console.log(error || 'Inserted duplicate!');
}
run();

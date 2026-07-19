import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

function getValidCPF() {
  const rnd = (n) => Math.round(Math.random() * n);
  const mod = (base, div) => Math.round(base - Math.floor(base / div) * div);
  const n = Array(9).fill(0).map(() => rnd(9));
  let d1 = n.reduce((total, number, index) => total + (number * (10 - index)), 0);
  d1 = 11 - mod(d1, 11);
  if (d1 >= 10) d1 = 0;
  let d2 = d1 * 2 + n.reduce((total, number, index) => total + (number * (11 - index)), 0);
  d2 = 11 - mod(d2, 11);
  if (d2 >= 10) d2 = 0;
  return `${n.join('')}${d1}${d2}`;
}

async function run() {
  const key = process.env.PAGAR_ME_SECRET_KEY || process.env.PAGARME_SECRET_KEY;
  const auth = `Basic ${Buffer.from(key + ':').toString('base64')}`;
  
  const payload = {
    customer: {
      name: 'Test PIX',
      email: 'testpix@example.com',
      document: getValidCPF(),
      document_type: 'CPF',
      type: 'individual',
      phones: {
        mobile_phone: {
          country_code: '55',
          area_code: '11',
          number: '999999999'
        }
      }
    },
    items: [{
      amount: 1000,
      description: 'Test Item',
      quantity: 1,
      code: 'test'
    }],
    payments: [{
      payment_method: 'pix',
      pix: {
        expires_in: 3600
      }
    }]
  };
  
  const res = await fetch('https://api.pagar.me/core/v5/orders', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.charges && data.charges.length > 0) {
    console.log(JSON.stringify(data.charges[0].last_transaction, null, 2));
  }
}
run();

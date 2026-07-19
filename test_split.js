import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function run() {
  const key = process.env.PAGAR_ME_SECRET_KEY || process.env.PAGARME_SECRET_KEY;
  const auth = `Basic ${Buffer.from(key + ':').toString('base64')}`;
  
  const payload = {
    customer: {
      name: 'Test Split',
      email: 'test@example.com',
      document: '47622956086',
      document_type: 'CPF',
      type: 'individual'
    },
    items: [{
      amount: 1000,
      description: 'Test Item',
      quantity: 1,
      code: 'test'
    }],
    payments: [{
      payment_method: 'checkout',
      checkout: {
        expires_in: 1440,
        accepted_payment_methods: ['pix'],
        pix: { expires_in: 3600 },
        success_url: 'https://example.com'
      },
      split: [
        {
          recipient_id: 're_cmqgwhfdc1hp60l9t950siqs7', // default
          type: 'flat',
          amount: 800,
          options: { liable: true, charge_processing_fee: true, charge_remainder_fee: true }
        },
        {
          recipient_id: 're_cmqzdju442lzv0l9tmscp6lw7', // artur
          type: 'flat',
          amount: 200,
          options: { liable: false, charge_processing_fee: false, charge_remainder_fee: false }
        }
      ]
    }]
  };
  
  const res = await fetch('https://api.pagar.me/core/v5/orders', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log("Status:", res.status);
  if (data.id) {
    console.log("Order created! Split in response:", JSON.stringify(data.payments[0].split, null, 2) || "No split in response!");
    console.log("Checkout URL:", data.checkouts[0].payment_url);
  } else {
    console.log("Error:", JSON.stringify(data, null, 2));
  }
}
run();

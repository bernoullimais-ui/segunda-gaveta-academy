const fs = require('fs');

// Carregar .env
const envText = fs.readFileSync('.env.local', 'utf8') + '\n' + fs.readFileSync('.env', 'utf8');
const envLines = envText.split('\n');
const env = {};
envLines.forEach(line => {
  const match = line.match(/^([^#\s=]+)=(.+)$/);
  if (match) {
    let val = match[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const apiKey = env['BREVO_API_KEY'];
const senderEmail = env['BREVO_SENDER_EMAIL'] || 'noreply@segundagaveta.com.br';
const senderName = env['BREVO_SENDER_NAME'] || 'Segunda Gaveta Academy';

async function run() {
  const email = 'barbara_estefanne@hotmail.com';
  const name = 'Bárbara Oliveira';
  const itemName = 'Mentoria em Aceleração Comercial';
  const checkoutLink = 'https://arturmagnavita.segundagaveta.com.br/public/curso/mentoria-em-aceleracao-comercial';
  const subject = `Falta pouco para começar seu curso de ${itemName}!`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #4F46E5;">Olá, ${name}!</h2>
      <p>Notamos que você iniciou o processo de inscrição para <strong>${itemName}</strong>, mas não concluiu o pagamento.</p>
      <p>Guardamos a sua vaga por tempo limitado! Você pode finalizar sua inscrição de forma rápida e segura no link abaixo:</p>
      <p style="margin: 20px 0;">
        <a href="${checkoutLink}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Concluir minha Inscrição</a>
      </p>
      <p>Se você teve qualquer problema ou dúvida na hora de pagar, fale conosco!</p>
      <br />
      <p>Atenciosamente,<br /><strong>Equipe Segunda Gaveta</strong></p>
    </div>
  `;

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: email, name: name }],
    subject,
    htmlContent,
  };

  console.log(`Sending email to ${email}...`);
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const text = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${text}`);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

run();

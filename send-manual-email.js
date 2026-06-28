import { sendEmail } from './api/lib/notification.js';

async function run() {
  try {
    const success = await sendEmail({
      to: 'teste1@gmail.com',
      name: 'Teste Novo Pagar.me 2',
      subject: 'Seja bem-vindo ao Processos Comerciais que Lucram!',
      senderNameOverride: 'Artur Magnavita',
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 520px; margin: auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
          <h2 style="color: #1e293b; margin-bottom: 8px;">Olá, Teste Novo Pagar.me 2! 🎉</h2>
          <p style="color: #475569;">Seu pagamento foi confirmado e sua conta foi criada automaticamente.</p>
          <p style="color: #475569;">Para acessar a plataforma, clique no botão abaixo para definir sua senha:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="https://arturmagnavita.segundagaveta.com.br/login" style="background-color: #4f46e5; color: white; padding: 14px 28px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">
              Acessar Plataforma
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">Seu e-mail de acesso é: <strong>teste1@gmail.com</strong></p>
          <p style="color: #94a3b8; font-size: 12px;">Sua senha é aquela mesma que você definiu ao se cadastrar na página de vendas.</p>
          <br />
          <p style="color: #475569;">Atenciosamente,<br /><strong>Artur Magnavita</strong></p>
        </div>
      `
    });
    console.log('Email sent successfully?', success);
  } catch(e) {
    console.error(e);
  }
}
run();

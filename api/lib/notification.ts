import 'dotenv/config';


// Formata o número de telefone para o padrão do WhatsApp (apenas dígitos, com DDI 55 se for brasileiro)
function formatPhoneForWhatsApp(phone: string | undefined): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return '';

  // Se não começar com 55 e tiver tamanho de celular brasileiro (10 ou 11 dígitos, ex: 71999999999)
  if (!cleaned.startsWith('55') && (cleaned.length === 10 || cleaned.length === 11)) {
    cleaned = '55' + cleaned;
  }

  return cleaned;
}

// 1. Envio de E-mail via Brevo (SMTP Transacional)
export async function sendEmail({
  to,
  name,
  subject,
  htmlContent,
  senderNameOverride,
}: {
  to: string;
  name: string;
  subject: string;
  htmlContent: string;
  senderNameOverride?: string;
}): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@segundagaveta.com.br';
  const senderName = senderNameOverride || process.env.BREVO_SENDER_NAME || 'Segunda Gaveta Academy';

  if (!apiKey) {
    console.warn('[Notification Warning] BREVO_API_KEY não configurado no ambiente. E-mail não enviado.');
    return false;
  }

  try {
    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to.trim().toLowerCase(), name: name }],
      subject,
      htmlContent,
    };

    console.log(`[Notification] Enviando e-mail para ${to} via Brevo...`);
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const resBody = await response.text();
    if (!response.ok) {
      console.error(`[Notification Error] Brevo respondeu com erro (Status ${response.status}):`, resBody);
      return false;
    }

    console.log(`[Notification Success] E-mail enviado com sucesso para ${to}. Resposta:`, resBody);
    return true;
  } catch (err) {
    console.error('[Notification Exception] Falha ao enviar e-mail via Brevo:', err);
    return false;
  }
}

// 2. Envio de WhatsApp via Umbler Talk (Mensagem de Texto Simplificada)
export async function sendWhatsApp({
  to,
  message,
}: {
  to: string;
  message: string;
}): Promise<boolean> {
  const apiToken = process.env.UTALK_API_TOKEN;
  const orgId = process.env.UTALK_ORG_ID;
  const fromPhone = process.env.UTALK_FROM_PHONE;

  if (!apiToken || !orgId || !fromPhone) {
    console.warn('[Notification Warning] Credenciais do Umbler Talk incompletas no ambiente. WhatsApp não enviado.');
    return false;
  }

  const formattedTo = formatPhoneForWhatsApp(to);
  if (!formattedTo) {
    console.warn('[Notification Warning] Telefone destinatário inválido:', to);
    return false;
  }

  try {
    const payload = {
      ToPhone: formattedTo,
      FromPhone: fromPhone.replace(/\+/g, ''), // remove o símbolo + se houver
      OrganizationId: orgId,
      Message: message,
    };

    console.log(`[Notification] Enviando WhatsApp para ${formattedTo} via Umbler Talk...`);
    const response = await fetch('https://app-utalk.umbler.com/api/v1/messages/simplified/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const resBody = await response.text();
    if (!response.ok) {
      console.error(`[Notification Error] Umbler Talk respondeu com erro (Status ${response.status}):`, resBody);
      return false;
    }

    console.log(`[Notification Success] WhatsApp enviado com sucesso para ${formattedTo}. Resposta:`, resBody);
    return true;
  } catch (err) {
    console.error('[Notification Exception] Falha ao enviar WhatsApp via Umbler Talk:', err);
    return false;
  }
}

// ==========================================
// 3. FLUXOS DE NEGÓCIO E MENSAGENS ESPECÍFICAS
// ==========================================

// A. Boas-vindas ao Membro/Aluno
export async function notifyWelcome({
  email,
  name,
  phone,
  courseName,
  specialistName,
  orgSlug,
  actionLink
}: {
  email: string;
  name: string;
  phone?: string;
  courseName: string;
  specialistName?: string;
  orgSlug?: string;
  actionLink?: string;
}) {
  const subject = `Seja bem-vindo ao ${courseName}!`;
  
  const senderNameOverride = specialistName;
  const signatureName = specialistName || 'Equipe Segunda Gaveta';
  const baseUrl = orgSlug ? `https://${orgSlug}.segundagaveta.com.br` : 'https://segunda-gaveta-academy.vercel.app';
  const platformUrl = actionLink || `${baseUrl}/login`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #4F46E5;">Olá, ${name}!</h2>
      <p>Parabéns por sua inscrição no curso <strong>${courseName}</strong>! Seu acesso foi liberado com sucesso.</p>
      <p>Para começar a assistir às aulas e interagir com o conteúdo, acesse nossa plataforma de estudos:</p>
      <p style="margin: 20px 0;">
        <a href="${platformUrl}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Entrar na Plataforma</a>
      </p>
      <p>Caso tenha alguma dúvida, responda a este e-mail ou entre em contato com nosso suporte.</p>
      <br />
      <p>Atenciosamente,<br /><strong>${signatureName}</strong></p>
    </div>
  `;

  // Envia E-mail
  await sendEmail({ to: email, name, subject, htmlContent, senderNameOverride });

  // Envia WhatsApp (se o telefone estiver disponível)
  if (phone) {
    const waMessage = `Olá, ${name}! Seja bem-vindo ao curso ${courseName} 🚀\nSeu acesso foi liberado com sucesso. Acesse a plataforma clicando aqui: ${platformUrl} para fazer login. Bons estudos!`;
    await sendWhatsApp({ to: phone, message: waMessage });
  }
}

// B. Onboarding de Especialista/Instituição
export async function notifyOnboarding({
  email,
  name,
  phone,
  orgName,
}: {
  email: string;
  name: string;
  phone?: string;
  orgName: string;
}) {
  const subject = `Sua instituição ${orgName} foi criada com sucesso!`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #059669;">Olá, ${name}!</h2>
      <p>Sua instituição <strong>${orgName}</strong> foi cadastrada com sucesso na plataforma Academia Digital (Sport for Kids).</p>
      <p>Você já pode acessar o painel administrativo para criar seus cursos, configurar páginas de vendas e gerenciar membros:</p>
      <p style="margin: 20px 0;">
        <a href="https://segunda-gaveta-academy.vercel.app" style="background-color: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Acessar Painel Administrativo</a>
      </p>
      <p>Vamos criar grandes conteúdos juntos!</p>
      <br />
      <p>Atenciosamente,<br /><strong>Equipe Sport for Kids</strong></p>
    </div>
  `;

  await sendEmail({ to: email, name, subject, htmlContent });

  if (phone) {
    const waMessage = `Olá, ${name}! Sua instituição "${orgName}" foi criada com sucesso na Academia Digital 🏫✨\nVocê já pode começar a criar seus cursos e trilhas acessando o painel de especialista em: https://segunda-gaveta-academy.vercel.app. Sucesso em sua jornada!`;
    await sendWhatsApp({ to: phone, message: waMessage });
  }
}

// C. Convite a Afiliação
export async function notifyAffiliateInvite({
  email,
  name,
  phone,
  courseName,
  inviteLink,
  commission,
}: {
  email: string;
  name: string;
  phone?: string;
  courseName: string;
  inviteLink: string;
  commission: number;
}) {
  const subject = `Convite de Afiliação: Promova o curso ${courseName}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #D97706;">Olá, ${name}!</h2>
      <p>Você foi convidado a se tornar um parceiro afiliado do curso <strong>${courseName}</strong>.</p>
      <p>Como afiliado, você receberá <strong>${commission}%</strong> de comissão por cada venda indicada através do seu link exclusivo.</p>
      <p>Para aceitar o convite e gerar seus links de divulgação, clique no link abaixo:</p>
      <p style="margin: 20px 0;">
        <a href="${inviteLink}" style="background-color: #D97706; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Aceitar Afiliação</a>
      </p>
      <p>Boas vendas!</p>
      <br />
      <p>Atenciosamente,<br /><strong>Equipe Sport for Kids</strong></p>
    </div>
  `;

  await sendEmail({ to: email, name, subject, htmlContent });

  if (phone) {
    const waMessage = `Olá, ${name}! Você foi convidado para ser afiliado do curso ${courseName} 💰\nGanhe ${commission}% de comissão por cada venda recomendada. Aceite o convite e resgate seus links de vendas clicando aqui: ${inviteLink}`;
    await sendWhatsApp({ to: phone, message: waMessage });
  }
}

// D. Recuperação de Compra não Finalizada (Carrinho Abandonado)
export async function notifyAbandonedCart({
  email,
  name,
  phone,
  itemName,
  checkoutLink,
}: {
  email: string;
  name: string;
  phone?: string;
  itemName: string;
  checkoutLink: string;
}) {
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
      <p>Atenciosamente,<br /><strong>Equipe Sport for Kids</strong></p>
    </div>
  `;

  await sendEmail({ to: email, name, subject, htmlContent });

  if (phone) {
    const waMessage = `Olá, ${name}! Notamos que você tentou se inscrever em "${itemName}" mas a compra não foi concluída 🛒\nNão perca essa oportunidade de evoluir seu conhecimento. Finalize agora sua inscrição com facilidade no link: ${checkoutLink}`;
    await sendWhatsApp({ to: phone, message: waMessage });
  }
}

// E. Aviso de Falha de Pagamento
export async function notifyPaymentFailed({
  email,
  name,
  phone,
  itemName,
  checkoutLink,
}: {
  email: string;
  name: string;
  phone?: string;
  itemName: string;
  checkoutLink: string;
}) {
  const subject = `Falha no pagamento: Inscrição em ${itemName}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #DC2626;">Olá, ${name}!</h2>
      <p>Ocorreu uma falha no processamento do pagamento da sua inscrição para o curso <strong>${itemName}</strong>.</p>
      <p>Geralmente isso ocorre por limites do cartão, dados incorretos ou problemas de comunicação com a bandeira. Mas não se preocupe! Sua vaga ainda está guardada.</p>
      <p>Você pode tentar novamente utilizando o mesmo link ou escolher outra forma de pagamento (como PIX ou outro cartão):</p>
      <p style="margin: 20px 0;">
        <a href="${checkoutLink}" style="background-color: #DC2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Tentar Novamente</a>
      </p>
      <p>Se precisar de suporte com o seu pagamento, estamos à disposição para ajudar.</p>
      <br />
      <p>Atenciosamente,<br /><strong>Equipe Sport for Kids</strong></p>
    </div>
  `;

  await sendEmail({ to: email, name, subject, htmlContent });

  if (phone) {
    const waMessage = `Olá, ${name}. Identificamos que o pagamento do seu pedido para "${itemName}" falhou ❌\nMas não se preocupe, sua vaga está garantida. Tente pagar novamente (por PIX ou outro cartão) acessando: ${checkoutLink}`;
    await sendWhatsApp({ to: phone, message: waMessage });
  }
}

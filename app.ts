import express from "express";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

let supabaseUrl = process.env.VITE_SUPABASE_URL!;
supabaseUrl = supabaseUrl.trim().replace(/\/$/, '');
if (supabaseUrl.endsWith('/rest/v1')) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1$/, '');
}

const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Necessário para atualizar status via server sem bypassar RLS
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || ''
});


const app = express();
const PORT = 3000;

app.use(express.json());

// Synchronous API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/diag", (req, res) => {
  res.json({
    url_set: !!process.env.VITE_SUPABASE_URL,
    key_set: !!process.env.VITE_SUPABASE_ANON_KEY,
    pagarme_secret_set: !!(process.env.PAGAR_ME_SECRET_KEY || process.env.PAGARME_SECRET_KEY),
    pagarme_public_set: !!(process.env.VITE_PAGAR_ME_PUBLIC_KEY || process.env.VITE_PAGARME_PUBLIC_KEY),
    node_version: process.version,
    vite_vars: Object.keys(process.env).filter(k => k.startsWith('VITE_'))
  });
});

app.post("/api/ai/generate-course-outline", async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Título é obrigatório." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Chave do Gemini (GEMINI_API_KEY) não configurada no servidor." });
    }

    const prompt = `Você é um especialista em design instrucional e engenharia pedagógica. 
Com base no título "${title}" e na descrição "${description || ''}", gere uma proposta de grade curricular estruturada em módulos e aulas para a plataforma de cursos Academia Digital.
Cada módulo deve conter um título descritivo e uma lista de etapas/aulas. Cada aula deve ter um nome de conteúdo e um tipo (vídeo, artigo ou quiz).`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: "OBJECT",
          properties: {
            modules: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING", description: "Nome do módulo, por exemplo: 'Módulo 1: Fundamentos Básicos'" },
                  steps: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        nome: { type: "STRING", description: "Nome da aula ou etapa, por exemplo: 'Aula 1: Introdução ao tema'" },
                        tipo: { type: "STRING", enum: ["video", "artigo", "quiz"], description: "Tipo de etapa" }
                      },
                      required: ["nome", "tipo"]
                    }
                  }
                },
                required: ["name", "steps"]
              }
            }
          },
          required: ["modules"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Resposta vazia da IA.");
    }
    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error("AI Course Outline Generation Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/generate-quiz", async (req, res) => {
  try {
    const { topic, content, count } = req.body;
    if (!topic && !content) {
      return res.status(400).json({ error: "Assunto (topic) ou conteúdo (content) é obrigatório." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Chave do Gemini (GEMINI_API_KEY) não configurada no servidor." });
    }

    const questionCount = count ? Math.min(10, Math.max(1, Number(count))) : 3;

    const prompt = `Você é um professor criando avaliações educacionais.
Crie um conjunto de ${questionCount} questões de múltipla escolha baseadas nas seguintes informações:
Assunto: "${topic || ''}"
Conteúdo base: "${content || ''}"

Cada questão deve ser focada e clara, contendo 4 opções e indicando qual é o índice correto (de '0' a '3').`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: "OBJECT",
          properties: {
            questions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  titulo: { type: "STRING", description: "Título descritivo curto, ex: 'Conceito Primário'" },
                  tema: { type: "STRING", description: "O tema da questão, ex: 'História do Judô'" },
                  dificuldade: { type: "STRING", enum: ["fácil", "médio", "difícil"] },
                  enunciado: { type: "STRING", description: "A pergunta a ser feita" },
                  opcoes: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "Exatamente 4 opções de resposta"
                  },
                  correta: { type: "STRING", description: "Índice correspondente à resposta correta: '0', '1', '2' ou '3'" }
                },
                required: ["titulo", "tema", "dificuldade", "enunciado", "opcoes", "correta"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Resposta vazia da IA.");
    }
    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error("AI Quiz Generation Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/tutor-chat", async (req, res) => {
  try {
    const { message_history, user_message, lesson_context } = req.body;
    if (!user_message) {
      return res.status(400).json({ error: "Mensagem do usuário é obrigatória." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Chave do Gemini (GEMINI_API_KEY) não configurada no servidor." });
    }

    const historyPrompt = (message_history || [])
      .map((m: any) => `${m.role === 'user' ? 'Aluno' : 'Tutor'}: ${m.content}`)
      .join('\n');

    const prompt = `Você é um Tutor Virtual amigável e didático na plataforma Academia Digital.
Seu objetivo é auxiliar os alunos em suas dúvidas sobre o conteúdo das aulas de forma atenciosa, didática e clara, respondendo sempre em português.

Use como base estrita para sua resposta o contexto da aula atual descrito abaixo:
[INÍCIO DO CONTEXTO DA AULA]
${lesson_context || 'Nenhum contexto textual fornecido para esta aula.'}
[FIM DO CONTEXTO DA AULA]

Histórico da Conversa:
${historyPrompt}
Aluno: ${user_message}

Tutor:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    const text = response.text;
    res.json({ response: text || "Desculpe, não consegui processar a resposta no momento." });
  } catch (error: any) {
    console.error("AI Tutor Chat Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/explain-quiz-answer", async (req, res) => {
  try {
    const { courseName, curriculumOutline, questionText, options, correctAnswer, selectedAnswer } = req.body;
    if (!questionText || !correctAnswer || !selectedAnswer) {
      return res.status(400).json({ error: "Parâmetros obrigatórios ausentes." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Chave do Gemini (GEMINI_API_KEY) não configurada no servidor." });
    }

    const prompt = `Você é um tutor acadêmico de inteligência artificial da plataforma de cursos "${courseName || 'Academia Digital'}".
Um aluno fez um quiz sobre a matéria e respondeu incorretamente a uma questão. 
Sua tarefa é explicar de forma extremamente clara, empática, didática e direta por que a alternativa correta é a correta, por que a resposta escolhida pelo aluno está incorreta, e sugerir qual das aulas da grade curricular ele deve assistir novamente para fixar o conceito.

---
GRADE CURRICULAR DO CURSO (Aulas disponíveis para recomendar):
${JSON.stringify(curriculumOutline || [])}

QUESTÃO:
"${questionText}"

ALTERNATIVAS:
${JSON.stringify(options || {})}

ALTERNATIVA CORRETA:
"${correctAnswer}"

ALTERNATIVA SELECIONADA PELO ALUNO (INCORRETA):
"${selectedAnswer}"
---

Responda em formato JSON com a seguinte estrutura:
{
  "explicacao": "Sua explicação didática e encorajadora do conteúdo (máximo de 3 parágrafos em markdown).",
  "aulaRecomendada": "Nome exato de uma das aulas listadas na grade curricular acima para o aluno revisar (opcional, apenas se houver uma aula fortemente relacionada no currículo)."
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: "OBJECT",
          properties: {
            explicacao: { type: "STRING", description: "Explicação em markdown." },
            aulaRecomendada: { type: "STRING", description: "Nome da aula para revisar." }
          },
          required: ["explicacao"]
        }
      }
    });

    const result = JSON.parse(response.text);
    res.json(result);
  } catch (error: any) {
    console.error("AI Quiz Explanation Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/traffic/track", async (req, res) => {
  try {
    const { organizacao_id, curso_id, trilha_id, event_type, utm_source, utm_medium, utm_campaign, visitor_id } = req.body;
    if (!organizacao_id || !event_type) {
      return res.status(400).json({ error: "organizacao_id e event_type são obrigatórios." });
    }

    const { error } = await supabase
      .from('traffic_events')
      .insert([{
        organizacao_id,
        curso_id: curso_id || null,
        trilha_id: trilha_id || null,
        event_type,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        visitor_id: visitor_id || null
      }]);

    if (error) {
      console.error("Failed to insert traffic_event:", error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Traffic tracking error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/generate-copy", async (req, res) => {
  try {
    const { courseName, description, targetAudience, benefits, framework } = req.body;
    if (!courseName || !description) {
      return res.status(400).json({ error: "Nome do curso e descrição são obrigatórios." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Chave do Gemini (GEMINI_API_KEY) não configurada no servidor." });
    }

    const frameworkName = framework === 'PAS' ? 'PAS (Problema, Agitação, Solução)' : 'AIDA (Atenção, Interesse, Desejo, Ação)';

    const prompt = `Você é um copywriter profissional especialista em lançamentos de infoprodutos de alta conversão.
Sua tarefa é gerar uma cópia de vendas excelente para o curso "${courseName}".

DESCRIÇÃO DO CURSO:
"${description}"

PÚBLICO-ALVO:
"${targetAudience || 'Geral'}"

PRINCIPAIS BENEFÍCIOS DO CURSO:
"${benefits || 'Aprender técnicas e obter certificado.'}"

FRAMEWORK DE COPYWRITING:
"${frameworkName}"

Por favor, gere a copy de vendas estruturada com base no framework selecionado. Retorne as informações estruturadas em JSON com o seguinte formato:
{
  "headline": "Uma headline (título principal) magnética, focada no principal benefício ou dor do cliente.",
  "subheadline": "Um subtítulo complementar focado na promessa ou quebra de objeções.",
  "intro": "Uma introdução engajante que conecta com o leitor.",
  "frameworkSections": [
    {
      "title": "Título da seção (ex: Problema, Atenção, etc.)",
      "content": "Conteúdo persuasivo em markdown (1 ou 2 parágrafos)."
    }
  ],
  "callToAction": "Um texto persuasivo de chamada para ação para fechar a compra."
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: "OBJECT",
          properties: {
            headline: { type: "STRING" },
            subheadline: { type: "STRING" },
            intro: { type: "STRING" },
            frameworkSections: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  content: { type: "STRING" }
                },
                required: ["title", "content"]
              }
            },
            callToAction: { type: "STRING" }
          },
          required: ["headline", "subheadline", "intro", "frameworkSections", "callToAction"]
        }
      }
    });

    const result = JSON.parse(response.text);
    res.json(result);
  } catch (error: any) {
    console.error("AI Copy generation error:", error);
    res.status(500).json({ error: error.message });
  }
});


// Helper function to validate coupon and return discounted price server-side
async function getDiscountedPrice(
  itemId: string,
  itemType: 'curso' | 'trilha' | 'modulo',
  customerEmail: string,
  couponCode?: string
): Promise<{
  originalPrice: number;
  discount: number;
  finalPrice: number;
  couponId?: string;
  couponCode?: string;
  error?: string;
}> {
  let originalPrice = 0;
  let orgId = '';

  if (itemType === 'curso') {
    const { data: curso, error: cursoErr } = await supabase
      .from('cursos')
      .select('preco, valor, organizacao_id')
      .eq('id', itemId)
      .maybeSingle();

    if (cursoErr || !curso) {
      return { originalPrice: 0, discount: 0, finalPrice: 0, error: "Curso não encontrado ou erro na busca." };
    }
    originalPrice = curso.preco === 'gratuito' ? 0 : Number(curso.valor || 0);
    orgId = curso.organizacao_id;
  } else if (itemType === 'trilha') {
    const { data: trilha, error: trilhaErr } = await supabase
      .from('trilhas')
      .select('preco, organizacao_id')
      .eq('id', itemId)
      .maybeSingle();

    if (trilhaErr || !trilha) {
      return { originalPrice: 0, discount: 0, finalPrice: 0, error: "Trilha não encontrada ou erro na busca." };
    }
    originalPrice = Number(trilha.preco || 0);
    orgId = trilha.organizacao_id;
  } else {
    return { originalPrice: 0, discount: 0, finalPrice: 0, error: "Tipo de item inválido para desconto." };
  }

  if (!couponCode) {
    return { originalPrice, discount: 0, finalPrice: originalPrice };
  }

  const cleanCode = String(couponCode).trim().toUpperCase();
  const cleanEmail = String(customerEmail).trim().toLowerCase();

  // Search active coupon
  const { data: coupon, error: couponError } = await supabase
    .from('cupons')
    .select('*')
    .eq('organizacao_id', orgId)
    .eq('codigo', cleanCode)
    .maybeSingle();

  if (couponError || !coupon) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: "Cupom inválido ou não encontrado para esta organização." };
  }

  if (!coupon.ativo) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: "Este cupom não está ativo." };
  }

  if (coupon.data_expiracao && new Date(coupon.data_expiracao) < new Date()) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: "Este cupom expirou." };
  }

  if (coupon.limite_usos_total !== null && coupon.usos_atual >= coupon.limite_usos_total) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: "Limite total de utilizações deste cupom esgotado." };
  }

  if (coupon.curso_id && (itemType !== 'curso' || itemId !== coupon.curso_id)) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: "Este cupom não é válido para este curso." };
  }

  if (coupon.trilha_id && (itemType !== 'trilha' || itemId !== coupon.trilha_id)) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: "Este cupom não é válido para esta trilha." };
  }

  // Check unique use per email
  const { data: usage, error: usageErr } = await supabase
    .from('cupom_usos')
    .select('id')
    .eq('cupom_id', coupon.id)
    .eq('email', cleanEmail)
    .maybeSingle();

  if (usage) {
    return { originalPrice, discount: 0, finalPrice: originalPrice, error: "Este cupom já foi utilizado por este e-mail." };
  }

  // Calculate discount
  let discount = 0;
  if (coupon.tipo_desconto === 'percentual') {
    discount = originalPrice * (Number(coupon.valor) / 100);
  } else if (coupon.tipo_desconto === 'fixo') {
    discount = Number(coupon.valor);
  }

  discount = Math.min(discount, originalPrice);
  const finalPrice = originalPrice - discount;

  return {
    originalPrice,
    discount,
    finalPrice,
    couponId: coupon.id,
    couponCode: coupon.codigo
  };
}

// Endpoint to validate coupon from the frontend
app.post("/api/coupons/validate", async (req, res) => {
  try {
    const { codigo, email, item_id, item_type, org_id } = req.body;

    if (!codigo || !email || !item_id || !item_type || !org_id) {
      return res.status(400).json({ valid: false, message: "Parâmetros obrigatórios ausentes." });
    }

    const result = await getDiscountedPrice(item_id, item_type, email, codigo);

    if (result.error) {
      return res.status(400).json({ valid: false, message: result.error });
    }

    res.json({
      valid: true,
      coupon: {
        id: result.couponId,
        codigo: result.couponCode,
        tipo_desconto: result.discount > 0 ? 'percentual' : 'fixo',
        valor: result.discount
      },
      originalPrice: result.originalPrice,
      discount: result.discount,
      finalPrice: result.finalPrice
    });
  } catch (error: any) {
    console.error("Coupon Validation Endpoint Error:", error);
    res.status(500).json({ valid: false, error: error.message });
  }
});

app.post("/api/pagarme/create-order", async (req, res) => {
  try {
    const { amount, customer, items, metadata, coupon_code } = req.body;
    const secretKey = process.env.PAGAR_ME_SECRET_KEY || process.env.PAGARME_SECRET_KEY;

    if (!secretKey) {
      console.error("CRITICAL: Pagar.me Secret Key is not configured in environment variables.");
      return res.status(500).json({ error: "Pagar.me secret key not configured. Please set PAGAR_ME_SECRET_KEY in settings." });
    }

    const targetId = metadata?.id;
    const targetType = metadata?.type;
    let finalAmountCents = amount;
    let discountBrl = 0;
    let actualCouponCode = undefined;

    if (targetId && (targetType === 'curso' || targetType === 'trilha')) {
      const calculation = await getDiscountedPrice(
        targetId,
        targetType,
        customer.email,
        coupon_code
      );

      if (calculation.error && coupon_code) {
        return res.status(400).json({ message: calculation.error });
      }

      if (!calculation.error) {
        finalAmountCents = Math.round(calculation.finalPrice * 100);
        discountBrl = calculation.discount;
        actualCouponCode = calculation.couponCode;
      }
    }

    const pagarmeAmount = Math.max(100, finalAmountCents);
    const authHeader = `Basic ${Buffer.from(secretKey + ":").toString("base64")}`;

    const payload = {
      items: [{
        amount: pagarmeAmount,
        description: String(items[0]?.description || "Inscrição").substring(0, 250),
        quantity: 1,
        code: String(items[0]?.code || "REGISTRO").substring(0, 50)
      }],
      customer: {
        name: (customer.name || "Participante").substring(0, 64),
        email: customer.email,
        type: "individual",
        document: String(customer.cpf || "").replace(/\D/g, '') || "00000000000",
        document_type: "CPF",
        phones: {
          mobile_phone: {
            country_code: "55",
            area_code: "11",
            number: "999999999"
          }
        }
      },
      payments: [
        {
          payment_method: "checkout",
          checkout: {
            expires_in: 120,
            billing_address_editable: true,
            customer_editable: true,
            accepted_payment_methods: ["credit_card", "pix"],
            pix: {
              expires_in: 3600
            },
            success_url: metadata.success_url,
            skip_checkout_success_page: false
          }
        }
      ],
      metadata: {
        ...metadata,
        coupon_code: actualCouponCode || null,
        discount_applied: discountBrl.toFixed(2),
        original_amount: (amount / 100).toFixed(2),
        server_version: "1.5"
      }
    };

    const response = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader
      },
      body: JSON.stringify(payload)
    });

    const order = await response.json();
    
    if (!response.ok) {
      console.error("Pagar.me API Error RAW:", JSON.stringify(order, null, 2));
      return res.status(response.status).json({ message: order.message || "Erro de validação", details: order });
    }

    res.json({
      order_id: order.id,
      checkout_url: order.checkouts?.[0]?.payment_url
    });
  } catch (error: any) {
    console.error("Create Order Runtime Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pagarme/tokenize", async (req, res) => {
  try {
    const { card } = req.body;
    const secretKey = process.env.PAGAR_ME_SECRET_KEY || process.env.PAGARME_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ error: "Secret key missing" });
    
    const authHeader = `Basic ${Buffer.from(secretKey + ":").toString("base64")}`;
    
    const response = await fetch("https://api.pagar.me/core/v5/tokens?appId=v5", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader
      },
      body: JSON.stringify({ type: "card", card })
    });
    
    const result = await response.json();
    if (!response.ok) return res.status(response.status).json(result);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/pagarme/create-cc-order", async (req, res) => {
  try {
    const { amount, customer, items, metadata, card_token, coupon_code } = req.body;
    const secretKey = process.env.PAGAR_ME_SECRET_KEY || process.env.PAGARME_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ error: "Secret key missing" });
    
    const targetId = metadata?.id;
    const targetType = metadata?.type;
    let finalAmountCents = amount;
    let discountBrl = 0;
    let actualCouponCode = undefined;

    if (targetId && (targetType === 'curso' || targetType === 'trilha')) {
      const calculation = await getDiscountedPrice(
        targetId,
        targetType,
        customer.email,
        coupon_code
      );

      if (calculation.error && coupon_code) {
        return res.status(400).json({ message: calculation.error });
      }

      if (!calculation.error) {
        finalAmountCents = Math.round(calculation.finalPrice * 100);
        discountBrl = calculation.discount;
        actualCouponCode = calculation.couponCode;
      }
    }

    const pagarmeAmount = Math.max(100, finalAmountCents);
    const authHeader = `Basic ${Buffer.from(secretKey + ":").toString("base64")}`;
    
    const payload = {
      items: [{
        amount: pagarmeAmount,
        description: String(items[0]?.description || "Inscrição").substring(0, 250),
        quantity: 1,
        code: String(items[0]?.code || "REGISTRO").substring(0, 50)
      }],
      customer: {
        name: (customer.name || "Participante").substring(0, 64),
        email: customer.email,
        type: "individual",
        document: String(customer.cpf || "").replace(/\D/g, '') || "00000000000",
        document_type: "CPF"
      },
      payments: [{
        payment_method: "credit_card",
        credit_card: {
          installments: 1,
          card: {
            token: card_token
          }
        }
      }],
      metadata: {
        ...metadata,
        coupon_code: actualCouponCode || null,
        discount_applied: discountBrl.toFixed(2),
        original_amount: (amount / 100).toFixed(2),
        server_version: "1.5"
      }
    };
    
    const response = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (!response.ok) return res.status(response.status).json(result);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/pagarme/create-onboarding-order", async (req, res) => {
  try {
    const { onboarding_id, customer } = req.body;
    const secretKey = process.env.PAGAR_ME_SECRET_KEY || process.env.PAGARME_SECRET_KEY;

    if (!secretKey) {
      console.error("CRITICAL: Pagar.me Secret Key is not configured in environment variables.");
      return res.status(500).json({ error: "Pagar.me secret key not configured." });
    }

    const { data: onboarding, error: onboardingErr } = await supabase
      .from('especialistas_onboarding')
      .select('*, convites_especialista(*)')
      .eq('id', onboarding_id)
      .maybeSingle();

    if (onboardingErr || !onboarding || !onboarding.convites_especialista) {
      return res.status(404).json({ error: "Onboarding record not found." });
    }

    const invite = onboarding.convites_especialista;
    const taxaCents = invite.taxa_adesao_cents;

    if (taxaCents <= 0) {
      return res.status(400).json({ error: "Este convite é gratuito, não requer taxa de adesão." });
    }

    const authHeader = `Basic ${Buffer.from(secretKey + ":").toString("base64")}`;

    const payload = {
      items: [{
        amount: taxaCents,
        description: `Taxa de Adesão - Especialista - Convite ${invite.slug}`,
        quantity: 1,
        code: `ONB-${onboarding_id.substring(0, 8)}`
      }],
      customer: {
        name: String(customer?.name || "Especialista").substring(0, 64),
        email: customer?.email || "especialista@test.com",
        type: "individual",
        document: String(customer?.cpf || "").replace(/\D/g, '') || "00000000000",
        document_type: "CPF",
        phones: {
          mobile_phone: {
            country_code: "55",
            area_code: "11",
            number: "999999999"
          }
        }
      },
      payments: [
        {
          payment_method: "checkout",
          checkout: {
            expires_in: 120,
            billing_address_editable: true,
            customer_editable: true,
            accepted_payment_methods: ["credit_card", "pix"],
            pix: {
              expires_in: 3600
            },
            success_url: `${req.headers.origin}/convite/${invite.slug}?onboarding_status=confirmacao&onboarding_id=${onboarding_id}`,
            skip_checkout_success_page: false
          }
        }
      ],
      metadata: {
        type: "adesao_especialista",
        onboarding_id: onboarding_id,
        invite_slug: invite.slug
      }
    };

    const response = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader
      },
      body: JSON.stringify(payload)
    });

    const order = await response.json();
    
    if (!response.ok) {
      console.error("Pagar.me Onboarding API Error:", JSON.stringify(order, null, 2));
      return res.status(response.status).json({ message: order.message || "Erro de validação", details: order });
    }

    await supabase
      .from('especialistas_onboarding')
      .update({
        pagamento_order_id: order.id,
        pagamento_status: 'pendente'
      })
      .eq('id', onboarding_id);

    res.json({
      order_id: order.id,
      checkout_url: order.checkouts?.[0]?.payment_url
    });
  } catch (error: any) {
    console.error("Create Onboarding Order Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pagarme/webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("Webhook received:", event.type);

    if (event.type === "order.paid") {
      const order = event.data;
      const { type, onboarding_id, participant_id, curso_id, course_id, id, coupon_code, discount_applied, utm_source, utm_medium, utm_campaign, affiliate_id } = order.metadata || {};
      
      if (type === "adesao_especialista" && onboarding_id) {
        console.log(`Processing onboarding payment for onboarding_id: ${onboarding_id}`);
        const { error: updErr } = await supabase
          .from('especialistas_onboarding')
          .update({
            taxa_paga: true,
            pagamento_status: 'pago',
            pagamento_order_id: order.id
          })
          .eq('id', onboarding_id);

        if (updErr) {
          console.error(`Failed to update onboarding payment for ${onboarding_id}:`, updErr);
          return res.status(500).send("Database onboarding status update failed");
        }
        console.log(`Successfully updated onboarding payment for ${onboarding_id}`);
        return res.json({ success: true });
      }
      
      let targetItemId = id || curso_id || course_id;
      const targetType = type || 'curso';
      const customerEmail = order.customer?.email?.toLowerCase()?.trim();
      const customerName = order.customer?.name || "Aluno";
      const totalPaidCents = order.amount || 0;
      const totalPaidBrl = totalPaidCents / 100;
      const paymentMethod = order.charges?.[0]?.payment_method || 'checkout';

      let finalUserId: string | null = null;
      let finalOrgId: string | null = null;
      const table = targetType === 'trilha' ? 'trilha_participantes' : 'curso_participantes';
      const idField = targetType === 'trilha' ? 'trilha_id' : 'curso_id';

      // 1. Resolve usuario_id, item_id, and organizacao_id
      if (participant_id) {
        console.log(`Processing update using participant_id: ${participant_id}`);
        
        if (targetType === 'trilha') {
          const { data: part } = await supabase
            .from('trilha_participantes')
            .select('usuario_id, trilha_id, trilhas(organizacao_id)')
            .eq('id', participant_id)
            .maybeSingle();

          if (part) {
            finalUserId = part.usuario_id;
            if (!targetItemId) targetItemId = part.trilha_id;
            finalOrgId = (part.trilhas as any)?.organizacao_id || null;
          }
        } else {
          const { data: part } = await supabase
            .from('curso_participantes')
            .select('usuario_id, curso_id, cursos(organizacao_id)')
            .eq('id', participant_id)
            .maybeSingle();

          if (part) {
            finalUserId = part.usuario_id;
            if (!targetItemId) targetItemId = part.curso_id;
            finalOrgId = (part.cursos as any)?.organizacao_id || null;
          }
        }

        // Update existing participant status
        const { error: updErr } = await supabase
          .from(table)
          .update({ 
            status: targetType === 'trilha' ? 'pago' : 'inscrito',
            cupom_codigo: coupon_code || null,
            valor_pago: totalPaidBrl
          })
          .eq('id', participant_id);

        if (updErr) {
          console.error(`Failed to update status for participant ${participant_id}:`, updErr);
          return res.status(500).send("Database enrollment status update failed");
        }
      } else if (targetItemId && customerEmail) {
        console.log(`Processing direct checkout for email: ${customerEmail} - Item: ${targetItemId} (${targetType})`);
        
        // Find org_id
        if (targetType === 'trilha') {
          const { data: trilha } = await supabase
            .from('trilhas')
            .select('organizacao_id')
            .eq('id', targetItemId)
            .maybeSingle();
          if (trilha) finalOrgId = trilha.organizacao_id;
        } else {
          const { data: curso } = await supabase
            .from('cursos')
            .select('organizacao_id')
            .eq('id', targetItemId)
            .maybeSingle();
          if (curso) finalOrgId = curso.organizacao_id;
        }

        // Find or create profile
        let { data: existingUser, error: userErr } = await supabase
          .from('usuarios')
          .select('id, auth_id, email')
          .eq('email', customerEmail)
          .maybeSingle();

        if (userErr) {
          console.error(`Error querying user: ${customerEmail}`, userErr);
          return res.status(500).send("Database check failed");
        }

        if (existingUser) {
          finalUserId = existingUser.auth_id || existingUser.id;
        } else {
          const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
          console.log(`Creating new auth user for direct checkout: ${customerEmail}`);
          
          const { data: newAuth, error: authErr } = await supabase.auth.admin.createUser({
            email: customerEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { nome: customerName }
          });

          if (authErr || !newAuth.user) {
            console.error(`Supabase Auth creation failed for: ${customerEmail}`, authErr);
            return res.status(500).send("Auth user creation failed");
          }

          finalUserId = newAuth.user.id;

          const { error: profileErr } = await supabase
            .from('usuarios')
            .insert([{
              id: finalUserId,
              auth_id: finalUserId,
              email: customerEmail,
              nome: customerName,
              role: 'membro',
              organizacao_id: finalOrgId
            }]);

          if (profileErr) {
            console.error(`Profile creation failed for: ${customerEmail}`, profileErr);
            return res.status(500).send("User profile creation failed");
          }
        }

        // Update/Insert enrollment
        const { data: existingEnrollment } = await supabase
          .from(table)
          .select('id')
          .eq(idField, targetItemId)
          .eq('usuario_id', finalUserId)
          .maybeSingle();

        if (existingEnrollment) {
          const { error: updateEnrollErr } = await supabase
            .from(table)
            .update({ 
              status: targetType === 'trilha' ? 'pago' : 'inscrito',
              cupom_codigo: coupon_code || null,
              valor_pago: totalPaidBrl
            })
            .eq('id', existingEnrollment.id);

          if (updateEnrollErr) {
            console.error(`Failed to update enrollment for: ${customerEmail}`, updateEnrollErr);
            return res.status(500).send("Enrollment update failed");
          }
        } else {
          const { error: insertEnrollErr } = await supabase
            .from(table)
            .insert([{
              [idField]: targetItemId,
              usuario_id: finalUserId,
              status: targetType === 'trilha' ? 'pago' : 'inscrito',
              progresso: 0,
              cupom_codigo: coupon_code || null,
              valor_pago: totalPaidBrl
            }]);

          if (insertEnrollErr) {
            console.error(`Failed to insert enrollment for: ${customerEmail}`, insertEnrollErr);
            return res.status(500).send("Enrollment insertion failed");
          }
        }
      }

      // 2. Handle Coupon Stats & Usages
      if (coupon_code && finalOrgId) {
        console.log(`Logging coupon usage: ${coupon_code} for Org: ${finalOrgId}`);
        const cleanCouponCode = String(coupon_code).trim().toUpperCase();

        const { data: coupon } = await supabase
          .from('cupons')
          .select('id, usos_atual')
          .eq('organizacao_id', finalOrgId)
          .eq('codigo', cleanCouponCode)
          .maybeSingle();

        if (coupon) {
          // Increment usos_atual
          await supabase
            .from('cupons')
            .update({ usos_atual: (coupon.usos_atual || 0) + 1 })
            .eq('id', coupon.id);

          // Register in cupom_usos
          const { error: usageInsertErr } = await supabase
            .from('cupom_usos')
            .insert([{
              cupom_id: coupon.id,
              usuario_id: finalUserId,
              email: customerEmail,
              curso_id: targetType === 'curso' ? targetItemId : null,
              trilha_id: targetType === 'trilha' ? targetItemId : null,
              valor_desconto: discount_applied ? Number(discount_applied) : 0.00
            }]);

          if (usageInsertErr) {
            console.error("Failed to insert cupom_usos entry:", usageInsertErr);
          }
        }
      }

      // 3. Register purchase in compras table
      if (finalUserId) {
        console.log(`Registering purchase in compras for user: ${finalUserId}`);
        
        let affiliateCommissionPct = 0;
        let splitsConfig: { usuario_id: string, porcentagem: number }[] = [];

        if (targetType === 'curso' && targetItemId) {
          const { data: curso } = await supabase
            .from('cursos')
            .select('configuracao_json')
            .eq('id', targetItemId)
            .maybeSingle();

          if (curso && curso.configuracao_json) {
            affiliateCommissionPct = Number((curso.configuracao_json as any).comissao_afiliado) || 0;
            splitsConfig = (curso.configuracao_json as any).splits || [];
          }
        }

        const affiliateShare = affiliate_id ? (totalPaidBrl * affiliateCommissionPct) / 100 : 0.00;
        const afterAffiliateBrl = totalPaidBrl - affiliateShare;
        
        const calculatedCoproducersList = splitsConfig.map(split => ({
          usuario_id: split.usuario_id,
          valor: Number(((afterAffiliateBrl * split.porcentagem) / 100).toFixed(2))
        }));

        const { error: purchaseErr } = await supabase
          .from('compras')
          .insert([{
            usuario_id: finalUserId,
            tipo: targetType,
            item_id: targetItemId || null,
            curso_id: targetType === 'curso' ? targetItemId : null,
            trilha_id: targetType === 'trilha' ? targetItemId : null,
            valor_pago: totalPaidBrl,
            metodo_pagamento: paymentMethod,
            status: 'pago',
            cupom_codigo: coupon_code || null,
            desconto_aplicado: discount_applied ? Number(discount_applied) : 0.00,
            utm_source: utm_source || null,
            utm_medium: utm_medium || null,
            utm_campaign: utm_campaign || null,
            affiliate_id: affiliate_id || null,
            comissao_afiliado: Number(affiliateShare.toFixed(2)),
            comissao_coprodutores: calculatedCoproducersList
          }]);

        if (purchaseErr) {
          console.error("Failed to insert into compras table:", purchaseErr);
        }
      }
    }

    res.status(200).send("Webhook received");
  } catch (error: any) {
    console.error("Webhook Error:", error);
    res.status(500).send(error.message);
  }
});

export default app;


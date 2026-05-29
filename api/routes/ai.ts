/**
 * Rotas de IA — /api/ai/*
 * Extraído de api/_app.ts para modularizar o servidor Express.
 *
 * Rotas incluídas:
 *   POST /api/ai/generate-course-outline
 *   POST /api/ai/generate-quiz
 *   POST /api/ai/tutor-chat
 *   POST /api/ai/explain-quiz-answer
 *   POST /api/ai/generate-copy
 */
import { Router } from 'express';
import { generateContentWithRetry, requireGeminiKey } from '../lib/gemini.js';

const router = Router();

// ─── POST /api/ai/generate-course-outline ────────────────────────────────────
router.post('/generate-course-outline', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório.' });
    }
    if (!requireGeminiKey(res)) return;

    const prompt = `Você é um especialista em design instrucional e engenharia pedagógica. 
Com base no título "${title}" e na descrição "${description || ''}", gere uma proposta de grade curricular estruturada em módulos e aulas para a plataforma de cursos Academia Digital.
Cada módulo deve conter um título descritivo e uma lista de etapas/aulas. Cada aula deve ter um nome de conteúdo e um tipo (vídeo, artigo ou quiz).`;

    const response = await generateContentWithRetry({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            modules: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING', description: "Nome do módulo, por exemplo: 'Módulo 1: Fundamentos Básicos'" },
                  steps: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        nome: { type: 'STRING', description: "Nome da aula ou etapa, por exemplo: 'Aula 1: Introdução ao tema'" },
                        tipo: { type: 'STRING', enum: ['video', 'artigo', 'quiz'], description: 'Tipo de etapa' }
                      },
                      required: ['nome', 'tipo']
                    }
                  }
                },
                required: ['name', 'steps']
              }
            }
          },
          required: ['modules']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error('Resposta vazia da IA.');
    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error('AI Course Outline Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/ai/generate-quiz ──────────────────────────────────────────────
router.post('/generate-quiz', async (req, res) => {
  try {
    const { topic, content, count } = req.body;
    if (!topic && !content) {
      return res.status(400).json({ error: 'Assunto (topic) ou conteúdo (content) é obrigatório.' });
    }
    if (!requireGeminiKey(res)) return;

    const questionCount = count ? Math.min(10, Math.max(1, Number(count))) : 3;

    const prompt = `Você é um professor criando avaliações educacionais.
Crie um conjunto de ${questionCount} questões de múltipla escolha baseadas nas seguintes informações:
Assunto: "${topic || ''}"
Conteúdo base: "${content || ''}"

Cada questão deve ser focada e clara, contendo 4 opções e indicando qual é o índice correto (de '0' a '3').`;

    const response = await generateContentWithRetry({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            questions: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  titulo: { type: 'STRING', description: "Título descritivo curto, ex: 'Conceito Primário'" },
                  tema: { type: 'STRING', description: "O tema da questão, ex: 'História do Judô'" },
                  dificuldade: { type: 'STRING', enum: ['fácil', 'médio', 'difícil'] },
                  enunciado: { type: 'STRING', description: 'A pergunta a ser feita' },
                  opcoes: {
                    type: 'ARRAY',
                    items: { type: 'STRING' },
                    description: 'Exatamente 4 opções de resposta'
                  },
                  correta: { type: 'STRING', description: "Índice correspondente à resposta correta: '0', '1', '2' ou '3'" }
                },
                required: ['titulo', 'tema', 'dificuldade', 'enunciado', 'opcoes', 'correta']
              }
            }
          },
          required: ['questions']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error('Resposta vazia da IA.');
    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error('AI Quiz Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/ai/tutor-chat ──────────────────────────────────────────────────
router.post('/tutor-chat', async (req, res) => {
  try {
    const { message_history, user_message, lesson_context } = req.body;
    if (!user_message) {
      return res.status(400).json({ error: 'Mensagem do usuário é obrigatória.' });
    }
    if (!requireGeminiKey(res)) return;

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

    const response = await generateContentWithRetry({ contents: prompt });
    res.json({ response: response.text || 'Desculpe, não consegui processar a resposta no momento.' });
  } catch (error: any) {
    console.error('AI Tutor Chat Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/ai/explain-quiz-answer ────────────────────────────────────────
router.post('/explain-quiz-answer', async (req, res) => {
  try {
    const { courseName, curriculumOutline, questionText, options, correctAnswer, selectedAnswer } = req.body;
    if (!questionText || !correctAnswer || !selectedAnswer) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes.' });
    }
    if (!requireGeminiKey(res)) return;

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

    const response = await generateContentWithRetry({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            explicacao: { type: 'STRING', description: 'Explicação em markdown.' },
            aulaRecomendada: { type: 'STRING', description: 'Nome da aula para revisar.' }
          },
          required: ['explicacao']
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error('AI Quiz Explanation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/ai/generate-copy ──────────────────────────────────────────────
router.post('/generate-copy', async (req, res) => {
  try {
    const { courseName, description, targetAudience, benefits, framework } = req.body;
    if (!courseName || !description) {
      return res.status(400).json({ error: 'Nome do curso e descrição são obrigatórios.' });
    }
    if (!requireGeminiKey(res)) return;

    const frameworkName =
      framework === 'PAS' ? 'PAS (Problema, Agitação, Solução)' : 'AIDA (Atenção, Interesse, Desejo, Ação)';

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

    const response = await generateContentWithRetry({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            headline: { type: 'STRING' },
            subheadline: { type: 'STRING' },
            intro: { type: 'STRING' },
            frameworkSections: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  content: { type: 'STRING' }
                },
                required: ['title', 'content']
              }
            },
            callToAction: { type: 'STRING' }
          },
          required: ['headline', 'subheadline', 'intro', 'frameworkSections', 'callToAction']
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error('AI Copy generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

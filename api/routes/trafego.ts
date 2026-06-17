import { Router } from 'express';
import { generateContentWithRetry, requireGeminiKey } from '../lib/gemini.js';

const router = Router();

router.post('/ai/generate', async (req, res) => {
  if (!requireGeminiKey(res)) return;

  try {
    const { courseName, courseDescription, targetAudience, curriculo, format, tone } = req.body;

    if (!format) {
      return res.status(400).json({ error: 'Formato é obrigatório (AIDA, PAS ou VIDEO)' });
    }

    let prompt = `Você é um Especialista Sênior em Growth Marketing e Copywriting de resposta direta.\n`;
    prompt += `Aja com o tom: ${tone || 'Persuasivo e Direto'}.\n\n`;
    prompt += `CONTEXTO DO PRODUTO (CURSO):\n`;
    prompt += `- Nome: ${courseName || 'Não informado'}\n`;
    prompt += `- Descrição: ${courseDescription || 'Não informado'}\n`;
    prompt += `- Público-Alvo: ${targetAudience || 'Não informado'}\n`;
    
    if (curriculo && curriculo.length > 0) {
      prompt += `- Grade Curricular Resumida: ${JSON.stringify(curriculo).substring(0, 500)}\n`;
    }

    prompt += `\nTAREFA:\n`;

    if (format === 'AIDA') {
      prompt += `Crie uma copy para anúncio de tráfego pago (Meta Ads) no framework A.I.D.A. (Atenção, Interesse, Desejo, Ação).\n`;
      prompt += `Use emojis sem exagero. Aja de forma focada na conversão.\n`;
    } else if (format === 'PAS') {
      prompt += `Crie uma copy para anúncio de tráfego pago (Meta Ads) no framework P.A.S. (Problema, Agitação, Solução).\n`;
      prompt += `Identifique a dor do público, agite-a para gerar urgência, e apresente o curso como a solução definitiva.\n`;
    } else if (format === 'VIDEO') {
      prompt += `Crie um roteiro de anúncio em vídeo para Reels/TikTok focado na venda do curso.\n`;
      prompt += `O roteiro DEVE ser devolvido em formato de tabela Markdown estritamente com estas 3 colunas: | Tempo | Visual (O que aparece na tela) | Áudio (O que o especialista fala) |.\n`;
      prompt += `Crie um gancho (hook) forte nos primeiros 3 segundos.\n`;
    } else {
      return res.status(400).json({ error: 'Formato inválido.' });
    }

    prompt += `\nRetorne APENAS o resultado final gerado, sem introduções de "Aqui está o seu texto" ou explicações.\n`;

    const response = await generateContentWithRetry({
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return res.json({ 
      success: true, 
      text: resultText
    });
  } catch (error: any) {
    console.error('Error generating traffic copy:', error);
    return res.status(500).json({ error: 'Erro ao gerar copy de tráfego', details: error.message });
  }
});

export default router;

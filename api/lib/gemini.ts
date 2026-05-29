/**
 * Cliente Gemini (Google GenAI) e retry logic
 * Extraído de api/_app.ts para eliminar a duplicação do código de retry
 * em múltiplas rotas de IA.
 */
import { GoogleGenAI } from '@google/genai';

let _ai: any = null;

/**
 * Returns the GoogleGenAI client, initializing it lazily on first call.
 * Throws if GEMINI_API_KEY is not set.
 */
export function getAIClient(): any {
  if (!_ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Chave do Gemini (GEMINI_API_KEY) não configurada no servidor.');
    }
    try {
      _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      throw new Error(`Failed to initialize GoogleGenAI client: ${e}`);
    }
  }
  return _ai;
}

/**
 * Generates content using the Gemini API with automatic retry logic.
 * Tries gemini-2.5-flash first, falls back to gemini-2.5-flash-lite.
 * Retries up to 3 times on transient errors (503, 429, UNAVAILABLE).
 */
export async function generateContentWithRetry(config: {
  contents: string | any[];
  config?: any;
}): Promise<any> {
  const ai = getAIClient();
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    let retries = 3;
    while (retries > 0) {
      try {
        console.log(`Attempting content generation with model: ${model}...`);
        return await ai.models.generateContent({
          model,
          ...config
        });
      } catch (error: any) {
        lastError = error;
        const status = error.status || error.statusCode || (error.error && error.error.code);
        const isTransient =
          status === 503 ||
          status === 429 ||
          (error.message &&
            (error.message.includes('503') ||
              error.message.includes('429') ||
              error.message.includes('high demand') ||
              error.message.includes('UNAVAILABLE') ||
              error.message.includes('exceeded your current quota') ||
              error.message.includes('RESOURCE_EXHAUSTED')));

        if (isTransient) {
          retries--;
          if (retries > 0) {
            const delay = (4 - retries) * 1000;
            console.warn(
              `Transient error on model ${model} (status ${status}). Retrying in ${delay}ms... Details:`,
              error.message
            );
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.warn(`Model ${model} failed after all retries. Trying next model...`);
          }
        } else {
          console.error(`Permanent error with model ${model}:`, error.message);
          retries = 0;
        }
      }
    }
  }

  throw lastError || new Error('Failed to generate content with all models and retries.');
}

/**
 * Guard middleware helper: checks that GEMINI_API_KEY is set.
 * Returns true if key is present, false otherwise (and sends 500 response).
 */
export function requireGeminiKey(res: any): boolean {
  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: 'Chave do Gemini (GEMINI_API_KEY) não configurada no servidor.' });
    return false;
  }
  return true;
}

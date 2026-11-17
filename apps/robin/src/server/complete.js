import { completeAnthropic } from './anthropic.js';
import { completeGemini } from './gemini.js';
import { completeOpenRouter } from './openrouter.js';
import { completeOllama } from './ollama.js';
import { ROBIN_MODELS } from './models.js';

function geminiAttempts(model) {
  const rest = ROBIN_MODELS.filter((item) => item.provider === 'gemini' && item.id !== model.id);
  return [model, ...rest];
}

export async function completeRobin({ model, system, tools, messages }) {
  if (model.provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    let lastError;
    for (const candidate of geminiAttempts(model)) {
      try {
        return await completeGemini({ apiKey, model: candidate.id, system, tools, messages });
      } catch (error) {
        lastError = error;
        if (error.status !== 429 && error.status !== 503) throw error;
      }
    }
    const error = new Error('Gemini está saturado. Probá de nuevo en un momento.');
    error.status = lastError?.status || 503;
    throw error;
  }
  if (model.provider === 'openrouter') {
    return completeOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      model: model.id,
      system,
      tools,
      messages,
    });
  }
  if (model.provider === 'ollama') {
    return completeOllama({ system, tools, messages });
  }
  return completeAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: model.id,
    system,
    tools,
    messages,
  });
}

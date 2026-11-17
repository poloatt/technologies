import { fromOpenAIResponse, toOpenAIMessages } from './openrouter.js';

export async function completeOllama({ system, tools, messages }) {
  const host = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'llama3.2';
  let response;
  try {
    response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: toOpenAIMessages(system, messages),
        tools: (tools || []).map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
          },
        })),
      }),
    });
  } catch {
    const error = new Error('Ollama no está corriendo en esta computadora.');
    error.status = 503;
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error || response.statusText || 'Error de Ollama';
    const error = new Error(typeof detail === 'string' ? detail : 'Error de Ollama');
    error.status = response.status;
    throw error;
  }
  return fromOpenAIResponse({ choices: [{ message: body.message || {} }] });
}

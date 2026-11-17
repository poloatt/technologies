const API_URL = 'https://api.anthropic.com/v1/messages';

export async function completeAnthropic({ apiKey, model, system, tools, messages, maxTokens = 8000 }) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      tools,
      messages,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error?.message || response.statusText || 'Error de Anthropic';
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return body;
}

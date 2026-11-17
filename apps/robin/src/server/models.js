/** Gratis primero: son las opciones por defecto. Claude queda como alternativa de pago. */
export const ROBIN_MODELS = [
  { id: 'gemini-3.1-flash-lite', provider: 'gemini', label: 'Gemini Flash · gratis', free: true },
  { id: 'gemini-3-flash-preview', provider: 'gemini', label: 'Gemini 3 Flash · gratis', free: true },
  { id: 'openrouter/free', provider: 'openrouter', label: 'OpenRouter · gratis', free: true },
  { id: 'ollama', provider: 'ollama', label: 'Ollama local · gratis', free: true },
  { id: 'claude-sonnet-5', provider: 'anthropic', label: 'Claude Sonnet', free: false },
  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', label: 'Claude Haiku', free: false },
];

export const DEFAULT_ROBIN_MODEL = ROBIN_MODELS.find((model) => model.free).id;

export function resolveRobinModel(requested) {
  return ROBIN_MODELS.find((model) => model.id === requested)
    || ROBIN_MODELS.find((model) => model.id === DEFAULT_ROBIN_MODEL);
}

export function missingCredential(model) {
  if (model?.provider === 'gemini' && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    return 'Gemini gratis necesita GEMINI_API_KEY en el servidor. Se crea sin tarjeta en Google AI Studio.';
  }
  if (model?.provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
    return 'OpenRouter gratis necesita OPENROUTER_API_KEY en el servidor.';
  }
  if (model?.provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    return 'Claude necesita ANTHROPIC_API_KEY en el servidor. Es una clave de pago.';
  }
  return null;
}

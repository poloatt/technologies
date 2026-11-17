function namesById(messages) {
  const names = new Map();
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (block?.type === 'tool_use' && block.id) names.set(block.id, block.name);
    }
  }
  return names;
}

function partFromBlock(block, names) {
  if (block?.type === 'text' && block.text) return { text: block.text };
  if ((block?.type === 'image' || block?.type === 'document') && block.source?.data) {
    return {
      inlineData: {
        mimeType: block.source.media_type,
        data: block.source.data,
      },
    };
  }
  if (block?.type === 'tool_use') {
    const part = {
      functionCall: {
        name: block.name,
        args: block.input && typeof block.input === 'object' ? block.input : {},
      },
    };
    if (block.thoughtSignature) part.thoughtSignature = block.thoughtSignature;
    return part;
  }
  if (block?.type === 'tool_result') {
    let response = { result: String(block.content || '') };
    try {
      const parsed = JSON.parse(block.content);
      if (parsed && typeof parsed === 'object') response = parsed;
    } catch {
      response = { result: String(block.content || '') };
    }
    return {
      functionResponse: {
        name: names.get(block.tool_use_id) || 'herramienta',
        response,
      },
    };
  }
  return null;
}

export function toGeminiContents(messages = []) {
  const names = namesById(messages);
  return messages.map((message) => {
    const role = message.role === 'assistant' ? 'model' : 'user';
    const blocks = typeof message.content === 'string'
      ? [{ text: message.content }]
      : (message.content || []).map((block) => partFromBlock(block, names)).filter(Boolean);
    return { role, parts: blocks.length ? blocks : [{ text: '' }] };
  }).filter((message) => message.parts.length);
}

export function fromGeminiResponse(body) {
  const parts = body?.candidates?.[0]?.content?.parts || [];
  const content = [];
  for (const part of parts) {
    if (part.thought) continue;
    if (part.text) content.push({ type: 'text', text: part.text });
    if (part.functionCall?.name) {
      content.push({
        type: 'tool_use',
        id: `gem_${part.functionCall.name}_${content.length}`,
        name: part.functionCall.name,
        input: part.functionCall.args || {},
        ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : null),
      });
    }
  }
  return { content };
}

export async function completeGemini({ apiKey, model, system, tools, messages }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: toGeminiContents(messages),
        tools: tools?.length ? [{
          functionDeclarations: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
          })),
        }] : undefined,
        generationConfig: { maxOutputTokens: 8192 },
      }),
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error?.message || response.statusText || 'Error de Gemini';
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  const block = body?.promptFeedback?.blockReason;
  if (block) {
    const error = new Error(`Gemini bloqueó el pedido (${block}).`);
    error.status = 400;
    throw error;
  }
  return fromGeminiResponse(body);
}

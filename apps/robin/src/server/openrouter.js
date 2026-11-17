function toOpenAIMessages(system, messages) {
  const thread = system ? [{ role: 'system', content: system }] : [];
  for (const message of messages) {
    if (typeof message.content === 'string') {
      thread.push({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content });
      continue;
    }
    const blocks = message.content || [];
    const toolUses = blocks.filter((block) => block?.type === 'tool_use');
    const toolResults = blocks.filter((block) => block?.type === 'tool_result');
    if (toolResults.length) {
      for (const block of toolResults) {
        thread.push({
          role: 'tool',
          tool_call_id: block.tool_use_id,
          content: String(block.content || ''),
        });
      }
      continue;
    }
    const content = [];
    for (const block of blocks) {
      if (block?.type === 'text' && block.text) content.push({ type: 'text', text: block.text });
      if (block?.type === 'image' && block.source?.data) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
        });
      }
      if (block?.type === 'document' && block.source?.data) {
        content.push({
          type: 'file',
          file: {
            filename: 'archivo.pdf',
            file_data: `data:${block.source.media_type};base64,${block.source.data}`,
          },
        });
      }
    }
    const entry = {
      role: 'assistant',
      content: content.length ? content : null,
    };
    if (message.role !== 'assistant') entry.role = 'user';
    if (toolUses.length) {
      entry.tool_calls = toolUses.map((block) => ({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input || {}),
        },
      }));
    }
    thread.push(entry);
  }
  return thread;
}

export function fromOpenAIResponse(body) {
  const message = body?.choices?.[0]?.message || {};
  const content = [];
  if (typeof message.content === 'string' && message.content.trim()) {
    content.push({ type: 'text', text: message.content });
  }
  for (const call of message.tool_calls || []) {
    let input = {};
    const raw = call.function?.arguments;
    if (typeof raw === 'string') {
      try {
        input = JSON.parse(raw || '{}');
      } catch {
        input = {};
      }
    } else if (raw && typeof raw === 'object') {
      input = raw;
    }
    content.push({
      type: 'tool_use',
      id: call.id || `call_${call.function?.name}_${content.length}`,
      name: call.function?.name,
      input,
    });
  }
  return { content };
}

export async function completeOpenRouter({ apiKey, model, system, tools, messages }) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
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
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error?.message || response.statusText || 'Error de OpenRouter';
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return fromOpenAIResponse(body);
}

export { toOpenAIMessages };

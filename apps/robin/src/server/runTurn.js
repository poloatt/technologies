function toolInput(input) {
  if (input && typeof input === 'object') return input;
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      return {};
    }
  }
  return {};
}

function replyText(content) {
  return (content || [])
    .filter((block) => block?.type === 'text' && block.text)
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

/**
 * Un turno de Robin. `complete` habla con el modelo; `executeTool` escribe datos.
 * Los cambios se acumulan para mostrarlos aparte de la respuesta.
 */
export async function runRobinTurn({
  complete,
  executeTool,
  system,
  tools,
  messages,
  maxSteps = 6,
}) {
  const changes = [];
  const undos = [];
  const domains = new Set();
  let thread = messages;

  for (let step = 0; step < maxSteps; step += 1) {
    const response = await complete({ system, tools, messages: thread });
    const content = Array.isArray(response?.content) ? response.content : [];
    const toolUses = content.filter((block) => block?.type === 'tool_use');

    if (!toolUses.length) {
      return {
        reply: replyText(content),
        changes,
        undos,
        domains: [...domains],
      };
    }

    const results = [];
    for (const tool of toolUses) {
      try {
        const result = await executeTool(tool.name, toolInput(tool.input));
        if (result?.change) changes.push(result.change);
        if (result?.domain) domains.add(result.domain);
        if (result?.undo) undos.push(result.undo);
        if (Array.isArray(result?.undos)) undos.push(...result.undos);
        results.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: JSON.stringify(result?.output ?? { ok: true }),
        });
      } catch (error) {
        results.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          is_error: true,
          content: error?.message || 'No se pudo guardar',
        });
      }
    }

    thread = [
      ...thread,
      { role: 'assistant', content },
      { role: 'user', content: results },
    ];
  }

  return {
    reply: changes.length
      ? 'Guardé lo que pude de este mensaje.'
      : 'No llegué a cerrar la respuesta. Probá de nuevo con un pedido más corto.',
    changes,
    undos,
    domains: [...domains],
  };
}

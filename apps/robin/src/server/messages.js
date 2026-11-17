const TEXT_LIMIT = 100_000;
const BASE64_LIMIT = 6_000_000;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export function decodeData(data) {
  const raw = String(data || '');
  const comma = raw.indexOf(',');
  const payload = raw.startsWith('data:') && comma !== -1 ? raw.slice(comma + 1) : raw;
  return payload.replace(/\s/g, '');
}

export function fileBlocks(files = []) {
  return files.slice(0, 4).map((file, index) => {
    const nombre = String(file?.nombre || `archivo-${index + 1}`);
    const mime = String(file?.mime || 'application/octet-stream').toLowerCase();
    const data = decodeData(file?.data);
    if (!data || data.length > BASE64_LIMIT) {
      return {
        type: 'text',
        text: `Archivo ${index} (${nombre}) supera el tamaño o está vacío. Pedile otro archivo.`,
      };
    }
    if (IMAGE_TYPES.has(mime)) {
      return {
        type: 'image',
        source: { type: 'base64', media_type: mime, data },
      };
    }
    if (mime === 'application/pdf') {
      return {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data },
      };
    }
    if (mime.startsWith('text/') || mime === 'application/json') {
      const text = Buffer.from(data, 'base64').toString('utf8').slice(0, TEXT_LIMIT);
      return { type: 'text', text: `Archivo ${index} (${nombre}):\n${text}` };
    }
    return {
      type: 'text',
      text: `Archivo ${index} (${nombre}, ${mime}) no se puede leer. Pedí PDF, imagen o texto.`,
    };
  });
}

export function toAnthropicMessages(messages = [], files = []) {
  const history = messages
    .slice(-20)
    .map((message) => ({
      role: message?.role === 'assistant' ? 'assistant' : 'user',
      content: String(message?.content || '').slice(0, 8000),
    }))
    .filter((message) => message.content);

  if (!history.length) {
    history.push({ role: 'user', content: 'Hola' });
  }

  const blocks = fileBlocks(files);
  const last = history[history.length - 1];
  if (blocks.length && last.role === 'user') {
    history[history.length - 1] = {
      role: 'user',
      content: [...blocks, { type: 'text', text: last.content }],
    };
  }
  return history;
}

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { ROBIN_ORIGIN, decodeData } from '../../../robin/src/server/index.js';

const uploadRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads/robin');

export async function storeRobinFile(usuario, file) {
  const id = randomUUID();
  const dir = path.join(uploadRoot, String(usuario));
  await fs.mkdir(dir, { recursive: true });
  const data = decodeData(file?.data);
  if (!data) throw new Error('Archivo vacío');
  await fs.writeFile(path.join(dir, id), Buffer.from(data, 'base64'));
  return {
    id,
    nombre: String(file?.nombre || 'archivo').slice(0, 180),
    mime: String(file?.mime || ''),
    origen: ROBIN_ORIGIN,
  };
}

export async function removeRobinFiles(usuario, archivos = []) {
  await Promise.all((archivos || []).map(async (archivo) => {
    if (!archivo?.id) return;
    await fs.unlink(path.join(uploadRoot, String(usuario), String(archivo.id))).catch(() => {});
  }));
}

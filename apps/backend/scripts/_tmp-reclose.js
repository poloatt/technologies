import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
const userId = '689ab5422ffb64d7c6de6995';

await mongoose.connect(process.env.MONGO_URL);
const { Tareas } = await import('../src/models/index.js');

const aspirar = await Tareas.findOne({
  usuario: userId,
  titulo: /Aspirar/,
  estado: 'PENDIENTE',
  'googleTasksSync.needsSync': true,
});
if (aspirar) {
  aspirar.googleTasksSync.needsSync = false;
  aspirar.googleTasksSync.syncStatus = 'synced';
  aspirar.$locals = { ...(aspirar.$locals || {}), skipGoogleSyncMark: true };
  await aspirar.save();
}

const rows = await Tareas.find({
  usuario: userId,
  titulo: /Pastas|Medualunas|Brusquet|Carrefour|Verduler|Aspirar/,
  estado: { $ne: 'CANCELADA' },
  fechaInicio: { $gte: new Date('2026-09-15') },
}).select('titulo estado fechaInicio fechaFin googleTasksSync.localOccurrence googleTasksSync.needsSync').sort({ titulo: 1, fechaInicio: 1 }).lean();

console.log(JSON.stringify(rows.map((t) => ({
  t: t.titulo,
  estado: t.estado,
  inicio: t.fechaInicio,
  fin: t.fechaFin || null,
  local: Boolean(t.googleTasksSync?.localOccurrence),
  needs: Boolean(t.googleTasksSync?.needsSync),
})), null, 2));
await mongoose.disconnect();

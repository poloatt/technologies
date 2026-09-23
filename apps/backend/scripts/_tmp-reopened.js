import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
const userId = '689ab5422ffb64d7c6de6995';
const since = new Date('2026-09-23T12:00:00-03:00');

await mongoose.connect(process.env.MONGO_URL);
const { Tareas } = await import('../src/models/index.js');

const reopened = await Tareas.find({
  usuario: userId,
  estado: 'PENDIENTE',
  completada: { $ne: true },
  updatedAt: { $gte: since },
  $or: [
    { 'googleTasksSync.completed': { $ne: null } },
    { serieId: { $exists: true, $ne: null } },
  ],
})
  .select('titulo estado completada fechaInicio updatedAt serieId googleTasksSync.completed googleTasksSync.googleTaskId googleTasksSync.localOccurrence googleTasksSync.syncStatus')
  .sort({ updatedAt: -1 })
  .limit(40)
  .lean();

const completedStill = await Tareas.countDocuments({
  usuario: userId,
  estado: 'COMPLETADA',
  updatedAt: { $gte: since },
});

console.log(JSON.stringify({
  completedUpdatedToday: completedStill,
  sample: reopened.map((t) => ({
    t: t.titulo,
    start: t.fechaInicio,
    updated: t.updatedAt,
    gCompleted: t.googleTasksSync?.completed || null,
    hasGoogleId: Boolean(t.googleTasksSync?.googleTaskId),
    local: Boolean(t.googleTasksSync?.localOccurrence),
    serie: Boolean(t.serieId),
    sync: t.googleTasksSync?.syncStatus || null,
  })),
}, null, 2));
await mongoose.disconnect();

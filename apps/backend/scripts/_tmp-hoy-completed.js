import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
const userId = '689ab5422ffb64d7c6de6995';
const today = new Date();
today.setHours(0, 0, 0, 0);
const end = new Date(today);
end.setDate(end.getDate() + 1);

await mongoose.connect(process.env.MONGO_URL);
const { Tareas } = await import('../src/models/index.js');
const rows = await Tareas.find({
  usuario: userId,
  titulo: /cisterna|pasto frente|Gerli|bajomesada|enredadera|grifer|mosquiter|placares|manguera|detector de humo|semillas patio|cemento y pintura|Riego autom|Venier/,
  estado: { $ne: 'CANCELADA' },
  fechaInicio: { $gte: today, $lt: end },
}).select('titulo estado fechaInicio').lean();
console.log(JSON.stringify(rows.map((t) => ({ t: t.titulo, estado: t.estado, inicio: t.fechaInicio })), null, 2));
await mongoose.disconnect();

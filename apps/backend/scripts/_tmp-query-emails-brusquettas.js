#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Tareas, TareaSeries } from '../src/models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const USER_ID = '689ab5422ffb64d7c6de6995';
const userOid = new mongoose.Types.ObjectId(USER_ID);
const titleRe = /Emails|Brusquet/i;
const dueCutoff = new Date('2026-09-20T00:00:00.000Z');

function fmt(d) {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? String(d) : x.toISOString();
}

function printTask(label, t) {
  if (!t) {
    console.log(`\n=== ${label}: NOT FOUND ===`);
    return;
  }
  console.log(`\n=== ${label} (_id: ${t._id}, titulo: ${t.titulo}) ===`);
  console.log(JSON.stringify({
    googleTasksSync: t.googleTasksSync,
    serieId: t.serieId,
    estado: t.estado,
    completada: t.completada,
    fechaInicio: fmt(t.fechaInicio),
    fechaVencimiento: fmt(t.fechaVencimiento),
    descripcion: String(t.descripcion || '').slice(0, 200),
    updatedAt: fmt(t.updatedAt),
    googleDueHistory: (t.googleDueHistory || []).map(fmt),
  }, null, 2));
}

async function main() {
  await mongoose.connect(process.env.MONGO_URL);

  const baseFilter = {
    usuario: userOid,
    estado: { $ne: 'CANCELADA' },
    titulo: titleRe,
  };

  const emailsRecent = await Tareas.findOne({
    ...baseFilter,
    titulo: /Emails/i,
  })
    .sort({ fechaVencimiento: -1 })
    .lean();

  const brusquetRecent = await Tareas.findOne({
    ...baseFilter,
    titulo: /Brusquet/i,
  })
    .sort({ fechaVencimiento: -1 })
    .lean();

  console.log('--- 1. MOST RECENT non-cancelled Emails / Brusquettas (fechaVencimiento desc) ---');
  printTask('Emails', emailsRecent);
  printTask('Brusquettas', brusquetRecent);

  const series = await TareaSeries.find({
    usuario: userOid,
    titulo: titleRe,
  })
    .select('_id titulo rrule dtstart activa googleSerieKey googleTasksSync')
    .lean();

  console.log('\n--- 2. TareaSeries matching /Emails|Brusquet/i ---');
  console.log(JSON.stringify(series.map((s) => ({
    _id: String(s._id),
    titulo: s.titulo,
    rrule: s.rrule,
    dtstart: fmt(s.dtstart),
    activa: s.activa,
    googleSerieKey: s.googleSerieKey,
    googleTasksSync: s.googleTasksSync,
  })), null, 2));

  const pending = await Tareas.find({
    usuario: userOid,
    titulo: titleRe,
    estado: { $in: ['PENDIENTE', 'EN_PROGRESO'] },
    fechaVencimiento: { $gte: dueCutoff },
  })
    .select('_id titulo estado fechaVencimiento completada serieId googleTasksSync.googleTaskId')
    .sort({ fechaVencimiento: 1 })
    .lean();

  console.log('\n--- 3. PENDING/EN_PROGRESO with due >= 2026-09-20 ---');
  console.log(`count: ${pending.length}`);
  console.log(JSON.stringify(pending.map((t) => ({
    _id: String(t._id),
    titulo: t.titulo,
    estado: t.estado,
    completada: t.completada,
    fechaVencimiento: fmt(t.fechaVencimiento),
    serieId: t.serieId ? String(t.serieId) : null,
    googleTaskId: t.googleTasksSync?.googleTaskId ?? null,
  })), null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

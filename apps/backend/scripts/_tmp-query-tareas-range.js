#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Tareas } from '../src/models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const USER_ID = '689ab5422ffb64d7c6de6995';
const userOid = new mongoose.Types.ObjectId(USER_ID);

// Inclusive union: UTC [Sep22 00:00Z .. Sep25 23:59Z] and ART [Sep22 00:00 .. Sep25 23:59]
const rangeStart = new Date('2026-09-22T00:00:00.000Z');
const rangeEnd = new Date('2026-09-26T02:59:59.999Z');
const cutoff2024 = new Date('2024-01-01T00:00:00.000Z');

const fmtIso = (d) => {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? String(d) : x.toISOString();
};

const fmtDateOnly = (d) => {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? String(d) : x.toISOString().slice(0, 10);
};

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);

  const dateClause = {
    $or: [
      { fechaInicio: { $gte: rangeStart, $lte: rangeEnd } },
      { fechaVencimiento: { $gte: rangeStart, $lte: rangeEnd } },
    ],
  };

  const tasks = await Tareas.find({
    usuario: userOid,
    estado: { $ne: 'CANCELADA' },
    completada: { $ne: true },
    ...dateClause,
  })
    .select('titulo estado completada fechaInicio createdAt updatedAt googleDueHistory serieId googleTasksSync')
    .sort({ fechaInicio: 1, titulo: 1 })
    .lean();

  const rows = tasks.map((t) => ({
    titulo: t.titulo ?? '',
    estado: t.estado ?? '',
    completada: t.completada ?? false,
    fechaInicio: fmtIso(t.fechaInicio),
    createdAt: fmtIso(t.createdAt),
    updatedAt: fmtIso(t.updatedAt),
    googleDueHistory: (Array.isArray(t.googleDueHistory) ? t.googleDueHistory : []).map(fmtDateOnly).join(', '),
    serieId: Boolean(t.serieId),
    hasTimedSchedule: Boolean(t.googleTasksSync?.hasTimedSchedule),
  }));

  const oldCount = tasks.filter((t) => t.createdAt && new Date(t.createdAt) < cutoff2024).length;

  console.log(JSON.stringify({ total: rows.length, createdBefore2024: oldCount, rows }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

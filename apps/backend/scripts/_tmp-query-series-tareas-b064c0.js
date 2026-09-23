#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { TareaSeries, Tareas } from '../src/models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const USER_ID = '689ab5422ffb64d7c6de6995';
const userOid = new mongoose.Types.ObjectId(USER_ID);
const seriesTituloRe = /Emails|Carrefour|Verduler|Talar ficus|🧴/i;

const fmtIso = (d) => {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? '' : x.toISOString();
};

function printTable(title, headers, rows) {
  console.log(`\n## ${title}\n`);
  if (!rows.length) {
    console.log('_(no rows)_');
    return;
  }
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)),
  );
  const sep = widths.map((w) => '-'.repeat(w)).join(' | ');
  const hdr = headers.map((h, i) => h.padEnd(widths[i])).join(' | ');
  console.log(hdr);
  console.log(sep);
  for (const row of rows) {
    console.log(row.map((c, i) => String(c ?? '').padEnd(widths[i])).join(' | '));
  }
}

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);

  const series = await TareaSeries.find({
    usuario: userOid,
    titulo: seriesTituloRe,
  })
    .select('titulo rrule dtstart activa googleTasksSync.exportInstances')
    .sort({ titulo: 1 })
    .lean();

  printTable(
    '1. TareaSeries',
    ['titulo', 'rrule', 'dtstart', 'activa', 'exportInstances'],
    series.map((s) => [
      s.titulo ?? '',
      s.rrule ?? '',
      fmtIso(s.dtstart),
      String(s.activa ?? ''),
      String(s.googleTasksSync?.exportInstances ?? false),
    ]),
  );

  const serieIds = series.map((s) => s._id);
  const fromDate = new Date('2026-09-01T00:00:00.000Z');

  const tareas = await Tareas.find({
    usuario: userOid,
    estado: { $ne: 'CANCELADA' },
    fechaInicio: { $gte: fromDate },
    $or: [{ serieId: { $in: serieIds } }, { titulo: seriesTituloRe }],
  })
    .select('titulo estado fechaInicio fechaFin googleTasksSync')
    .sort({ fechaInicio: 1 })
    .limit(30)
    .lean();

  printTable(
    '2. Tareas (non-cancelled, fechaInicio >= 2026-09-01)',
    ['titulo', 'estado', 'fechaInicio', 'fechaFin', 'hasTimedSchedule', 'localOccurrence'],
    tareas.map((t) => [
      t.titulo ?? '',
      t.estado ?? '',
      fmtIso(t.fechaInicio),
      fmtIso(t.fechaFin),
      String(Boolean(t.googleTasksSync?.hasTimedSchedule)),
      String(Boolean(t.googleTasksSync?.localOccurrence)),
    ]),
  );

  const dayStart = new Date('2026-09-23T03:00:00.000Z');
  const dayEnd = new Date('2026-09-24T02:59:59.999Z');

  const emailsTareas = await Tareas.find({
    usuario: userOid,
    fechaInicio: { $gte: dayStart, $lte: dayEnd },
    $or: [{ titulo: '✉️ Emails' }, { titulo: /^✉️ Emails$|Emails/i }],
  })
    .select('titulo estado fechaInicio')
    .sort({ fechaInicio: 1 })
    .lean();

  printTable(
    '3. Emails Tareas on 2026-09-23 (any estado)',
    ['titulo', 'estado', 'fechaInicio'],
    emailsTareas.map((t) => [t.titulo ?? '', t.estado ?? '', fmtIso(t.fechaInicio)]),
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

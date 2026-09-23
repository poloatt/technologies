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

const TITLE_GROUPS = [
  { label: 'Emails', filter: { $or: [{ titulo: '✉️ Emails' }, { titulo: /^Emails$/i }] } },
  { label: 'Carrefour', filter: { titulo: /Carrefour/i } },
  { label: 'Verduler', filter: { titulo: /Verduler/i } },
  { label: '🧴', filter: { titulo: /🧴/ } },
  { label: 'Talar ficus', filter: { titulo: /Talar ficus/i } },
];

const fmtIso = (d) => {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? '' : x.toISOString();
};

const baTime = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return 'invalid';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(x);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '??';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '??';
  return `${h}:${m}`;
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
  console.log(headers.map((h, i) => h.padEnd(widths[i])).join(' | '));
  console.log(widths.map((w) => '-'.repeat(w)).join('-|-'));
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

  for (const { label, filter } of TITLE_GROUPS) {
    const tasks = await Tareas.find({ usuario: userOid, ...filter })
      .select('titulo estado fechaInicio fechaFin googleCalendarSync.googleEventId')
      .sort({ fechaInicio: 1 })
      .lean();

    const groups = new Map();
    for (const t of tasks) {
      const key = baTime(t.fechaInicio);
      if (!groups.has(key)) groups.set(key, { count: 0, example: t });
      groups.get(key).count += 1;
    }

    const rows = [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hm, g]) => [
        hm,
        g.count,
        g.example.estado ?? '',
        fmtIso(g.example.fechaInicio),
        g.example.fechaFin ? 'yes' : 'no',
      ]);

    printTable(`${label} (${tasks.length} total)`, ['BA time', 'count', 'ex.estado', 'ex.fechaInicio', 'fechaFin?'], rows);
  }

  const allFilter = {
    $or: [
      { titulo: '✉️ Emails' },
      { titulo: /^Emails$/i },
      { titulo: /Carrefour/i },
      { titulo: /Verduler/i },
      { titulo: /🧴/ },
      { titulo: /Talar ficus/i },
    ],
  };

  const gcal = await Tareas.find({
    usuario: userOid,
    ...allFilter,
    'googleCalendarSync.googleEventId': { $exists: true, $nin: [null, ''] },
  })
    .select('titulo fechaInicio')
    .sort({ fechaInicio: -1 })
    .limit(10)
    .lean();

  printTable(
    'googleCalendarSync.googleEventId (max 10)',
    ['titulo', 'fechaInicio'],
    gcal.map((t) => [t.titulo ?? '', fmtIso(t.fechaInicio)]),
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

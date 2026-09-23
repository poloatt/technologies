#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Tareas, Objetivos } from '../src/models/index.js';
import { getTareasForAgendaRange } from '../src/utils/tareasAgendaUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const USER_ID = '689ab5422ffb64d7c6de6995';
const userOid = new mongoose.Types.ObjectId(USER_ID);
const TZ = 'America/Argentina/Buenos_Aires';

const fmtArt = (d) => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return x.toLocaleString('sv-SE', { timeZone: TZ, hour12: false }).replace(' ', 'T') + ' ART';
};
const fmtIso = (d) => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? String(d) : x.toISOString();
};

const pickTask = (t) => ({
  titulo: t.titulo,
  estado: t.estado,
  completada: t.completada,
  fechaInicio: fmtIso(t.fechaInicio),
  fechaInicio_ART: fmtArt(t.fechaInicio),
  fechaVencimiento: fmtIso(t.fechaVencimiento),
  fechaVencimiento_ART: fmtArt(t.fechaVencimiento),
  fechaFin: fmtIso(t.fechaFin),
  serieId: t.serieId ? String(t.serieId) : null,
  'googleTasksSync.hasTimedSchedule': t.googleTasksSync?.hasTimedSchedule ?? null,
  descripcion: String(t.descripcion || '').slice(0, 120),
});

function overlapsWindow(t, from, to) {
  const fi = t.fechaInicio ? new Date(t.fechaInicio) : null;
  const fv = t.fechaVencimiento ? new Date(t.fechaVencimiento) : null;
  const ff = t.fechaFin ? new Date(t.fechaFin) : null;
  if (fv && fv >= from && fv < to) return { match: true, via: 'fechaVencimiento' };
  if (fi && fi >= from && fi < to) return { match: true, via: 'fechaInicio' };
  if (t.tipo === 'EVENTO' && fi && ff && fi < to && ff >= from) return { match: true, via: 'evento_overlap' };
  return { match: false, via: null };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URL);

  const emails = await Tareas.findOne({
    usuario: userOid,
    estado: { $ne: 'CANCELADA' },
    titulo: /^✉️ Emails$/,
  }).sort({ fechaVencimiento: -1 }).lean();

  const brusq = await Tareas.findOne({
    usuario: userOid,
    estado: { $ne: 'CANCELADA' },
    titulo: /^🥪 Brusquettas$/,
  }).sort({ fechaVencimiento: -1 }).lean();

  console.log('=== 1. Latest non-CANCELADA Emails / Brusquettas ===');
  console.log(JSON.stringify({
    Emails: emails ? pickTask(emails) : null,
    Brusquettas: brusq ? pickTask(brusq) : null,
  }, null, 2));

  const saludObjs = await Objetivos.find({ usuario: userOid, nombre: /Salud/i }).select('_id nombre').lean();
  const saludObjIds = saludObjs.map((o) => o._id);
  const saludStart = new Date('2026-09-21T00:00:00.000Z');
  const saludEnd = new Date('2026-09-24T23:59:59.999Z');
  const saludTasks = await Tareas.find({
    usuario: userOid,
    fechaInicio: { $gte: saludStart, $lte: saludEnd },
    $or: [{ titulo: /Salud/i }, { objetivo: { $in: saludObjIds } }],
  })
    .select('titulo tipo fechaInicio fechaFin googleCalendarSync objetivo')
    .populate('objetivo', 'nombre')
    .sort({ fechaInicio: 1 })
    .lean();

  console.log('\n=== 2. Salud tasks/events (fechaInicio 2026-09-21..2026-09-24) ===');
  console.log(JSON.stringify({
    objetivos: saludObjs.map((o) => ({ _id: String(o._id), nombre: o.nombre })),
    matches: saludTasks.map((t) => ({
      titulo: t.titulo,
      objetivo: t.objetivo?.nombre ?? null,
      tipo: t.tipo,
      'googleCalendarSync.allDay': t.googleCalendarSync?.allDay ?? null,
      fechaInicio: fmtIso(t.fechaInicio),
      fechaInicio_ART: fmtArt(t.fechaInicio),
      fechaFin: fmtIso(t.fechaFin),
      fechaFin_ART: fmtArt(t.fechaFin),
    })),
  }, null, 2));

  const winA = {
    label: 'Tue Sep 22 03:00Z – Wed Sep 23 03:00Z',
    from: new Date('2026-09-22T03:00:00.000Z'),
    to: new Date('2026-09-23T03:00:00.000Z'),
  };
  const winB = {
    label: 'Wed Sep 23 03:00Z – Thu Sep 24 03:00Z',
    from: new Date('2026-09-23T03:00:00.000Z'),
    to: new Date('2026-09-24T03:00:00.000Z'),
  };

  console.log('\n=== 3. Agenda window placement (stored task dates) ===');
  for (const [name, t] of [['Emails', emails], ['Brusquettas', brusq]]) {
    if (!t) {
      console.log(`${name}: NOT FOUND`);
      continue;
    }
    const a = overlapsWindow(t, winA.from, winA.to);
    const b = overlapsWindow(t, winB.from, winB.to);
    console.log(JSON.stringify({
      titulo: t.titulo,
      fechaInicio: fmtIso(t.fechaInicio),
      fechaVencimiento: fmtIso(t.fechaVencimiento),
      [winA.label]: a,
      [winB.label]: b,
    }, null, 2));
  }

  console.log('\n=== 3b. Agenda API (getTareasForAgendaRange) ===');
  for (const w of [winA, winB]) {
    const docs = await getTareasForAgendaRange(USER_ID, w.from, w.to);
    const hits = docs.filter((d) => /^✉️ Emails$|^🥪 Brusquettas$/.test(d.titulo || ''));
    console.log(JSON.stringify({
      window: w.label,
      hits: hits.map((d) => ({
        titulo: d.titulo,
        virtual: d.virtual ?? false,
        fechaInicio: fmtIso(d.fechaInicio),
        fechaVencimiento: fmtIso(d.fechaVencimiento),
        serieId: d.serieId ? String(d.serieId) : null,
      })),
    }, null, 2));
  }

  const nearbySalud = await Tareas.find({
    usuario: userOid,
    $or: [{ titulo: /Salud/i }, { objetivo: { $in: saludObjIds } }],
  })
    .select('titulo tipo fechaInicio fechaFin googleCalendarSync objetivo')
    .populate('objetivo', 'nombre')
    .sort({ fechaInicio: -1 })
    .limit(10)
    .lean();

  console.log('\n=== 2c. Nearest Salud tasks (any date, limit 10) ===');
  console.log(JSON.stringify(nearbySalud.map((t) => ({
    titulo: t.titulo,
    objetivo: t.objetivo?.nombre ?? null,
    tipo: t.tipo,
    fechaInicio: fmtIso(t.fechaInicio),
    fechaFin: fmtIso(t.fechaFin),
    'googleCalendarSync.allDay': t.googleCalendarSync?.allDay ?? null,
  })), null, 2));

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

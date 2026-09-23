#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Tareas, Objetivos } from '../src/models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const USER_ID = '689ab5422ffb64d7c6de6995';
const userOid = new mongoose.Types.ObjectId(USER_ID);
const TZ = 'America/Argentina/Buenos_Aires';

const fmtTz = (d) => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return x.toLocaleString('sv-SE', { timeZone: TZ, hour12: false }).replace(' ', 'T') + ' ART';
};

const pickFields = (t) => ({
  _id: String(t._id),
  titulo: t.titulo,
  estado: t.estado,
  completada: t.completada,
  fechaInicio: fmtTz(t.fechaInicio),
  fechaVencimiento: fmtTz(t.fechaVencimiento),
  fechaFin: fmtTz(t.fechaFin),
  tipo: t.tipo,
  serieId: t.serieId ? String(t.serieId) : null,
  'googleTasksSync.hasTimedSchedule': t.googleTasksSync?.hasTimedSchedule ?? null,
  descripcion: String(t.descripcion || '').slice(0, 150),
});

async function main() {
  await mongoose.connect(process.env.MONGO_URL);

  const emailsRecent = await Tareas.findOne({
    usuario: userOid,
    estado: { $ne: 'CANCELADA' },
    titulo: /Emails/i,
  })
    .sort({ fechaVencimiento: -1 })
    .lean();

  const brusquetRecent = await Tareas.findOne({
    usuario: userOid,
    estado: { $ne: 'CANCELADA' },
    titulo: /Brusquet/i,
  })
    .sort({ fechaVencimiento: -1 })
    .lean();

  console.log('=== 1. Latest non-CANCELADA Emails / Brusquettas ===');
  console.log(JSON.stringify({ Emails: emailsRecent ? pickFields(emailsRecent) : null, Brusquettas: brusquetRecent ? pickFields(brusquetRecent) : null }, null, 2));

  const dayStart = new Date('2026-09-22T03:00:00.000Z');
  const dayEnd = new Date('2026-09-24T02:59:59.999Z');

  const saludObjetivos = await Objetivos.find({
    usuario: userOid,
    nombre: /Salud/i,
  })
    .select('_id nombre')
    .lean();

  const saludObjIds = saludObjetivos.map((o) => o._id);

  const saludTasks = await Tareas.find({
    usuario: userOid,
    fechaInicio: { $gte: dayStart, $lte: dayEnd },
    $or: [
      { titulo: /Salud/i },
      { objetivo: { $in: saludObjIds } },
    ],
  })
    .select('titulo tipo fechaInicio fechaFin allDay googleCalendarSync objetivo')
    .populate('objetivo', 'nombre')
    .sort({ fechaInicio: 1 })
    .lean();

  const saludAnyDate = await Tareas.find({
    usuario: userOid,
    $or: [{ titulo: /Salud/i }, { objetivo: { $in: saludObjIds } }],
  })
    .select('titulo tipo fechaInicio objetivo')
    .populate('objetivo', 'nombre')
    .sort({ fechaInicio: -1 })
    .limit(5)
    .lean();

  console.log('\n=== 2a. Salud objetivos ===');
  console.log(JSON.stringify(saludObjetivos, null, 2));
  console.log('\n=== 2b. Salud matches on 2026-09-22 / 2026-09-23 (fechaInicio) ===');
  console.log(JSON.stringify(saludTasks.map((t) => ({
    _id: String(t._id),
    titulo: t.titulo,
    objetivo: t.objetivo?.nombre ?? null,
    tipo: t.tipo,
    allDay: t.allDay ?? null,
    fechaInicio: fmtTz(t.fechaInicio),
    fechaFin: fmtTz(t.fechaFin),
    googleCalendarSync: t.googleCalendarSync ?? null,
  })), null, 2));

  const agendaFrom = new Date('2026-09-22T03:00:00.000Z');
  const agendaTo = new Date('2026-09-23T02:59:59.999Z');
  agendaFrom.setHours(0, 0, 0, 0);
  agendaTo.setHours(23, 59, 59, 999);

  const overlapOr = [
    { fechaVencimiento: { $gte: agendaFrom, $lte: agendaTo } },
    { fechaInicio: { $gte: agendaFrom, $lte: agendaTo } },
    { tipo: 'EVENTO', fechaInicio: { $lte: agendaTo }, fechaFin: { $gte: agendaFrom } },
  ];

  for (const label of ['Emails', 'Brusquettas']) {
    const re = label === 'Emails' ? /Emails/i : /Brusquet/i;
    const t = await Tareas.findOne({ usuario: userOid, estado: { $ne: 'CANCELADA' }, titulo: re })
      .sort({ fechaVencimiento: -1 })
      .lean();
    if (!t) {
      console.log(`\n=== 3. Agenda overlap check: ${label} NOT FOUND ===`);
      continue;
    }
    const matches = overlapOr.some((clause) => {
      if (clause.fechaVencimiento) {
        const v = t.fechaVencimiento ? new Date(t.fechaVencimiento) : null;
        return v && v >= agendaFrom && v <= agendaTo;
      }
      if (clause.fechaInicio && !clause.fechaFin) {
        const fi = t.fechaInicio ? new Date(t.fechaInicio) : null;
        return fi && fi >= agendaFrom && fi <= agendaTo;
      }
      if (clause.tipo === 'EVENTO') {
        if (t.tipo !== 'EVENTO') return false;
        const fi = t.fechaInicio ? new Date(t.fechaInicio) : null;
        const ff = t.fechaFin ? new Date(t.fechaFin) : null;
        return fi && ff && fi <= agendaTo && ff >= agendaFrom;
      }
      return false;
    });
    console.log(`\n=== 3. Agenda overlap: ${label} (latest) ===`);
    console.log(JSON.stringify({
      titulo: t.titulo,
      fechaInicio: fmtTz(t.fechaInicio),
      fechaVencimiento: fmtTz(t.fechaVencimiento),
      agendaFrom: fmtTz(agendaFrom),
      agendaTo: fmtTz(agendaTo),
      buildOverlapQueryMatch: matches,
      serieId: t.serieId ? String(t.serieId) : null,
    }, null, 2));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

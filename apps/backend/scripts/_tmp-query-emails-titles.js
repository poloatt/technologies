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
const tituloRe = /Emails|Talar ficus|🧴/i;

const fmtIso = (d) => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString();
};

const hourInBA = (d) => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: 'numeric',
      hour12: false,
    }).format(x),
  );
};

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);

  const tasks = await Tareas.find({
    usuario: userOid,
    estado: { $ne: 'CANCELADA' },
    titulo: tituloRe,
  })
    .select('titulo estado fechaInicio fechaFin descripcion updatedAt googleTasksSync')
    .sort({ fechaInicio: -1 })
    .limit(15)
    .lean();

  const rows = tasks.map((t) => ({
    titulo: t.titulo ?? '',
    estado: t.estado ?? '',
    fechaInicio: fmtIso(t.fechaInicio),
    fechaFin: fmtIso(t.fechaFin),
    hasTimedSchedule: Boolean(t.googleTasksSync?.hasTimedSchedule),
    localOccurrence: Boolean(t.googleTasksSync?.localOccurrence),
    googleTaskIdPresent: Boolean(t.googleTasksSync?.googleTaskId),
    updatedAt: fmtIso(t.updatedAt),
    horarioAttadia: String(t.descripcion ?? '').includes('Horario Attadia'),
  }));

  const emailsRows = await Tareas.find({
    usuario: userOid,
    estado: { $ne: 'CANCELADA' },
    titulo: /Emails/i,
  })
    .select('fechaInicio titulo')
    .lean();

  const emailsHour13 = emailsRows.filter((t) => hourInBA(t.fechaInicio) === 13).length;

  console.log(
    JSON.stringify(
      {
        rowCount: rows.length,
        rows,
        emailsTotal: emailsRows.length,
        emailsHour13BA: emailsHour13,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

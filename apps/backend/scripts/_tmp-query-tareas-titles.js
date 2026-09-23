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
const tituloRe = /Reporte Mensual|GSUITE|B corp|Farmacia|Gerli|Billing|Provisions|Ledgers|Emails|Transactions/i;
const rangeStart = new Date('2026-09-22T00:00:00.000Z');
const rangeEnd = new Date('2026-09-26T23:59:59.999Z');

const fmtIso = (d) => {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? String(d) : x.toISOString();
};

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);

  const tasks = await Tareas.find({ usuario: userOid, titulo: tituloRe })
    .select('titulo estado completada fechaInicio fechaVencimiento createdAt updatedAt serieId')
    .sort({ fechaInicio: -1 })
    .limit(40)
    .lean();

  const rows = tasks.map((t) => ({
    titulo: t.titulo ?? '',
    estado: t.estado ?? '',
    completada: t.completada ?? false,
    fechaInicio: fmtIso(t.fechaInicio),
    fechaVencimiento: fmtIso(t.fechaVencimiento),
    createdAtYear: t.createdAt ? new Date(t.createdAt).getUTCFullYear() : null,
    updatedAt: fmtIso(t.updatedAt),
    serieId: t.serieId ? 'yes' : 'no',
  }));

  const completedCount = await Tareas.countDocuments({
    usuario: userOid,
    completada: true,
    $or: [
      { fechaInicio: { $gte: rangeStart, $lte: rangeEnd } },
      { fechaVencimiento: { $gte: rangeStart, $lte: rangeEnd } },
    ],
  });

  console.log(JSON.stringify({ matches: rows.length, rows, completedInRange: completedCount }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

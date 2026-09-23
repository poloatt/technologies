#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTareasForAgendaRange } from '../src/utils/tareasAgendaUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const USER_ID = '689ab5422ffb64d7c6de6995';
const TZ = 'America/Argentina/Buenos_Aires';
const fmtTz = (d) => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return x.toLocaleString('sv-SE', { timeZone: TZ, hour12: false }).replace(' ', 'T') + ' ART';
};

async function main() {
  await mongoose.connect(process.env.MONGO_URL);
  const rangeFrom = new Date('2026-09-22T03:00:00.000Z');
  const rangeTo = new Date('2026-09-23T02:59:59.999Z');
  console.log('Server TZ offset (min):', new Date().getTimezoneOffset());
  console.log('Input from:', rangeFrom.toISOString(), '→', fmtTz(rangeFrom));
  console.log('Input to:', rangeTo.toISOString(), '→', fmtTz(rangeTo));

  const docs = await getTareasForAgendaRange(USER_ID, rangeFrom, rangeTo);
  const hits = docs.filter((d) => /Emails|Brusquet/i.test(d.titulo || ''));
  console.log('\nEmails/Brusquettas in agenda response:', hits.length);
  console.log(JSON.stringify(hits.map((d) => ({
    titulo: d.titulo,
    virtual: d.virtual ?? false,
    fechaInicio: fmtTz(d.fechaInicio),
    fechaVencimiento: fmtTz(d.fechaVencimiento),
    serieId: d.serieId ? String(d.serieId) : null,
  })), null, 2));

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

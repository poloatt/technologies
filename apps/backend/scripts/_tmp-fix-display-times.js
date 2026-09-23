#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Tareas, Users, Rutinas, Objetivos } from '../src/models/index.js';
import { appendScheduleToNotes } from '../../shared/utils/googleTasksScheduleNotes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const USER_ID = '689ab5422ffb64d7c6de6995';
const userOid = new mongoose.Types.ObjectId(USER_ID);
const TZ = 'America/Argentina/Buenos_Aires';

const REPAIRS = [
  {
    label: 'Emails',
    tituloRe: /Emails/i,
    fechaInicio: new Date('2026-09-23T16:15:00.000Z'),
    fechaFin: new Date('2026-09-23T16:45:00.000Z'),
  },
  {
    label: 'Brusquettas',
    tituloRe: /Brusquet/i,
    fechaInicio: new Date('2026-09-23T19:15:00.000Z'),
    fechaFin: new Date('2026-09-23T19:45:00.000Z'),
  },
];

function fmt(d) {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return x.toISOString();
}

function fmtTz(d) {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return `${x.toLocaleString('sv-SE', { timeZone: TZ, hour12: false }).replace(' ', 'T')} ART (${x.toISOString()} UTC)`;
}

function snapshotTask(t) {
  if (!t) return null;
  return {
    _id: String(t._id),
    titulo: t.titulo,
    estado: t.estado,
    fechaInicio: fmtTz(t.fechaInicio),
    fechaVencimiento: fmtTz(t.fechaVencimiento),
    fechaFin: fmtTz(t.fechaFin),
    hasTimedSchedule: t.googleTasksSync?.hasTimedSchedule ?? null,
    descripcion: String(t.descripcion || '').slice(0, 250),
  };
}

async function findLatestTask(tituloRe) {
  return Tareas.findOne({
    usuario: userOid,
    estado: { $ne: 'CANCELADA' },
    titulo: tituloRe,
  })
    .sort({ fechaVencimiento: -1 })
    .exec();
}

async function repairTask(spec) {
  const tarea = await findLatestTask(spec.tituloRe);
  if (!tarea) {
    return { label: spec.label, found: false, before: null, after: null };
  }

  const before = snapshotTask(tarea);

  tarea.fechaInicio = spec.fechaInicio;
  tarea.fechaFin = spec.fechaFin;
  tarea.fechaVencimiento = spec.fechaFin;
  tarea.descripcion = appendScheduleToNotes(tarea.descripcion || '', spec.fechaInicio, spec.fechaFin);
  if (!tarea.googleTasksSync) tarea.googleTasksSync = {};
  tarea.googleTasksSync.hasTimedSchedule = true;
  tarea.$locals = { ...(tarea.$locals || {}), skipGoogleSyncMark: true };

  await tarea.save();

  const afterDoc = await Tareas.findById(tarea._id).lean();
  return { label: spec.label, found: true, before, after: snapshotTask(afterDoc) };
}

function jsonContainsSalud(obj, pathPrefix = '') {
  const hits = [];
  if (obj == null) return hits;

  if (typeof obj === 'string') {
    if (/salud/i.test(obj)) hits.push({ path: pathPrefix, value: obj.slice(0, 200) });
    if (/10:00|11:50|10\.00|11\.50/.test(obj)) hits.push({ path: pathPrefix, value: obj.slice(0, 200) });
    return hits;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      hits.push(...jsonContainsSalud(item, `${pathPrefix}[${i}]`));
    });
    return hits;
  }

  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const p = pathPrefix ? `${pathPrefix}.${k}` : k;
      if (/salud/i.test(k)) hits.push({ path: p, key: k, preview: JSON.stringify(v).slice(0, 200) });
      hits.push(...jsonContainsSalud(v, p));
    }
  }
  return hits;
}

function extractHabitEntries(sectionKey, sectionData, rutinasConfigSection) {
  const entries = [];
  if (!sectionData || typeof sectionData !== 'object') return entries;

  for (const [itemId, itemValue] of Object.entries(sectionData)) {
    if (itemId.startsWith('_')) continue;
    const pref = rutinasConfigSection?.[itemId] || {};
    const label = pref.label || pref.nombre || itemId;
    entries.push({
      section: sectionKey,
      itemId,
      label,
      pref: pref,
      rutinaValue: itemValue,
    });
  }
  return entries;
}

async function querySaludSources() {
  const day22Start = new Date('2026-09-22T03:00:00.000Z');
  const day24End = new Date('2026-09-24T02:59:59.999Z');

  const user = await Users.findById(USER_ID)
    .select('preferences.rutinasConfig customHabits preferences.customHabitSections')
    .lean();

  const rutinas = await Rutinas.find({
    usuario: userOid,
    fecha: { $gte: day22Start, $lte: day24End },
  })
    .sort({ fecha: 1 })
    .lean();

  const saludObjetivos = await Objetivos.find({ usuario: userOid, nombre: /Salud/i }).select('_id nombre').lean();
  const saludObjIds = saludObjetivos.map((o) => o._id);

  const saludTasks = await Tareas.find({
    usuario: userOid,
    $or: [
      { titulo: /Salud/i },
      { objetivo: { $in: saludObjIds } },
    ],
    $and: [
      {
        $or: [
          { fechaInicio: { $gte: day22Start, $lte: day24End } },
          { fechaVencimiento: { $gte: day22Start, $lte: day24End } },
          { fechaFin: { $gte: day22Start, $lte: day24End } },
        ],
      },
    ],
  })
    .select('titulo tipo fechaInicio fechaFin fechaVencimiento objetivo googleCalendarSync')
    .populate('objetivo', 'nombre')
    .sort({ fechaInicio: 1 })
    .lean();

  const targetStartUtc = new Date('2026-09-23T13:00:00.000Z');
  const targetEndUtc = new Date('2026-09-23T14:50:00.000Z');
  const nearSaludTasks = await Tareas.find({
    usuario: userOid,
    $or: [{ titulo: /Salud/i }, { objetivo: { $in: saludObjIds } }],
    fechaInicio: { $gte: new Date('2026-09-23T12:00:00.000Z'), $lte: new Date('2026-09-23T15:00:00.000Z') },
  })
    .select('titulo tipo fechaInicio fechaFin fechaVencimiento objetivo googleCalendarSync')
    .populate('objetivo', 'nombre')
    .lean();

  const gcalSaludEvents = await Tareas.find({
    usuario: userOid,
    tipo: 'EVENTO',
    $or: [
      { 'googleCalendarSync.eventLabelName': /Salud/i },
      { titulo: /Salud/i },
    ],
    fechaInicio: { $gte: day22Start, $lte: day24End },
  })
    .select('titulo tipo fechaInicio fechaFin googleCalendarSync objetivo')
    .populate('objetivo', 'nombre')
    .lean();

  const windowTasks = await Tareas.find({
    usuario: userOid,
    estado: { $ne: 'CANCELADA' },
    fechaInicio: { $gte: targetStartUtc, $lte: new Date('2026-09-23T13:05:00.000Z') },
    $or: [
      { fechaFin: { $gte: new Date('2026-09-23T14:45:00.000Z') } },
      { fechaVencimiento: { $gte: new Date('2026-09-23T14:45:00.000Z') } },
    ],
  })
    .select('titulo tipo fechaInicio fechaFin fechaVencimiento objetivo googleCalendarSync')
    .populate('objetivo', 'nombre')
    .lean();

  const rutinasConfig = user?.preferences?.rutinasConfig || {};
  const customHabits = user?.customHabits || {};
  const customSections = user?.preferences?.customHabitSections || [];

  const saludHabits = [];
  const sections = ['bodyCare', 'nutricion', 'ejercicio', 'cleaning', ...Object.keys(customHabits).filter((k) => !['bodyCare', 'nutricion', 'ejercicio', 'cleaning'].includes(k))];

  for (const section of sections) {
    const cfg = rutinasConfig[section] || {};
    const sectionHabits = Array.isArray(customHabits[section]) ? customHabits[section] : [];
    for (const [itemId, pref] of Object.entries(cfg)) {
      if (itemId.startsWith('_')) continue;
      const label = pref?.label || pref?.nombre || itemId;
      const customDef = sectionHabits.find((h) => h.id === itemId);
      const displayLabel = customDef?.label || label;
      if (/salud/i.test(displayLabel) || /salud/i.test(itemId) || /salud/i.test(JSON.stringify(pref))) {
        saludHabits.push({ section, itemId, displayLabel, pref });
      }
    }
  }

  for (const sec of customSections) {
    if (/salud/i.test(sec.label || '') || /salud/i.test(sec.id || '')) {
      saludHabits.push({ section: sec.id, displayLabel: sec.label, type: 'customHabitSection', sectionMeta: sec });
    }
  }

  const rutinasSaludHits = rutinas.map((r) => {
    const fechaLabel = fmtTz(r.fecha);
    const hits = jsonContainsSalud(r);
    const bodyCareEntries = extractHabitEntries('bodyCare', r.bodyCare, rutinasConfig.bodyCare);
    const configBodyCare = extractHabitEntries('bodyCare', r.config?.bodyCare, rutinasConfig.bodyCare);
    const saludEntries = [...bodyCareEntries, ...configBodyCare].filter((e) => /salud/i.test(e.label) || /salud/i.test(e.itemId));

    return {
      _id: String(r._id),
      fecha: fechaLabel,
      saludEntries,
      jsonHits: hits.slice(0, 20),
      bodyCareKeys: Object.keys(r.bodyCare || {}),
      configBodyCareKeys: Object.keys(r.config?.bodyCare || {}),
    };
  }).filter((r) => r.saludEntries.length > 0 || r.jsonHits.length > 0);

  const rutinasConfigSaludHits = jsonContainsSalud(rutinasConfig, 'preferences.rutinasConfig').slice(0, 30);

  return {
    userHabits: {
      saludHabits,
      rutinasConfigSaludHits,
      bodyCareConfig: rutinasConfig.bodyCare || null,
    },
    rutinasDocs: rutinasSaludHits,
    saludTasks: saludTasks.map((t) => ({
      _id: String(t._id),
      titulo: t.titulo,
      objetivo: t.objetivo?.nombre ?? null,
      tipo: t.tipo,
      fechaInicio: fmtTz(t.fechaInicio),
      fechaFin: fmtTz(t.fechaFin),
      fechaVencimiento: fmtTz(t.fechaVencimiento),
      eventLabelName: t.googleCalendarSync?.eventLabelName ?? null,
    })),
    nearSaludTasks10to1150: nearSaludTasks.map((t) => ({
      _id: String(t._id),
      titulo: t.titulo,
      objetivo: t.objetivo?.nombre ?? null,
      fechaInicio: fmtTz(t.fechaInicio),
      fechaFin: fmtTz(t.fechaFin),
      eventLabelName: t.googleCalendarSync?.eventLabelName ?? null,
    })),
    gcalSaludEvents: gcalSaludEvents.map((t) => ({
      _id: String(t._id),
      titulo: t.titulo,
      objetivo: t.objetivo?.nombre ?? null,
      fechaInicio: fmtTz(t.fechaInicio),
      fechaFin: fmtTz(t.fechaFin),
      eventLabelName: t.googleCalendarSync?.eventLabelName ?? null,
      calendarId: t.googleCalendarSync?.calendarId ?? null,
    })),
    tasksIn1000to1150Window: windowTasks.map((t) => ({
      _id: String(t._id),
      titulo: t.titulo,
      objetivo: t.objetivo?.nombre ?? null,
      tipo: t.tipo,
      fechaInicio: fmtTz(t.fechaInicio),
      fechaFin: fmtTz(t.fechaFin),
      fechaVencimiento: fmtTz(t.fechaVencimiento),
      eventLabelName: t.googleCalendarSync?.eventLabelName ?? null,
    })),
    targetWindow: {
      label: 'Miércoles 23 sep · 10:00 – 11:50 ART',
      startUtc: fmt(targetStartUtc),
      endUtc: fmt(targetEndUtc),
    },
  };
}

async function main() {
  const mongoUrl = process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error('MONGO_URL not set');
    process.exit(1);
  }
  await mongoose.connect(mongoUrl);

  const queryOnly = process.argv.includes('--query-only');

  if (!queryOnly) {
    console.log('=== TASK 1: Display time repair (Emails / Brusquettas) ===\n');

    for (const spec of REPAIRS) {
      const result = await repairTask(spec);
      console.log(`--- ${result.label} ---`);
      if (!result.found) {
        console.log('NOT FOUND');
        continue;
      }
      console.log('BEFORE:', JSON.stringify(result.before, null, 2));
      console.log('AFTER:', JSON.stringify(result.after, null, 2));
      console.log('');
    }
  }

  console.log('\n=== TASK 2: Salud habit / rutina sources ===\n');
  const salud = await querySaludSources();
  console.log(JSON.stringify(salud, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

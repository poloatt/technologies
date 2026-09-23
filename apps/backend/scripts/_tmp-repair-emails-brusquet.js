#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Objetivos, Tareas, Users } from '../src/models/index.js';
import googleTasksService from '../src/services/googleTasksService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const USER_ID = '689ab5422ffb64d7c6de6995';
const userOid = new mongoose.Types.ObjectId(USER_ID);
const titleRe = /Emails|Brusquet/i;

const LIST_SPECS = [
  { listId: 'MTcyNjY3MDI0ODQyMzA1NjQ3MDc6MDow', label: 'ATTA' },
  { listId: 'NjVfS0E2LUhpX0lWclRGRQ', label: 'Rutinas' },
];

function fmt(d) {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? String(d) : x.toISOString();
}

function snapshotTasks(tasks) {
  return tasks.map((t) => ({
    _id: String(t._id),
    titulo: t.titulo,
    estado: t.estado,
    fechaVencimiento: fmt(t.fechaVencimiento),
    completada: t.completada,
  }));
}

async function queryMatchingTasks() {
  return Tareas.find({
    usuario: userOid,
    estado: { $ne: 'CANCELADA' },
    titulo: titleRe,
  })
    .select('_id titulo estado fechaVencimiento completada googleTasksSync.googleTaskId')
    .sort({ titulo: 1, fechaVencimiento: -1 })
    .lean();
}

async function main() {
  const mongoUrl = process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error('MONGO_URL not set');
    process.exit(1);
  }
  await mongoose.connect(mongoUrl);

  const user = await Users.findById(USER_ID).select('email googleTasksConfig.enabled googleTasksConfig.accessToken googleTasksConfig.refreshToken').lean();
  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  const hasTokens = Boolean(user.googleTasksConfig?.accessToken);
  console.log('User:', user.email, '| googleTasks enabled:', Boolean(user.googleTasksConfig?.enabled), '| has accessToken:', hasTokens);

  if (!hasTokens) {
    console.error('Google API auth unavailable: no accessToken on user doc');
    await mongoose.disconnect();
    process.exit(2);
  }

  const before = snapshotTasks(await queryMatchingTasks());
  console.log('\n--- BEFORE repair (non-CANCELADA, /Emails|Brusquet/i) ---');
  console.log(JSON.stringify(before, null, 2));

  let syncResults = null;
  let anchorUpdated = 0;

  try {
    console.log('\n--- Running syncTasksFromGoogle(fullImport: true) ---');
    syncResults = await googleTasksService.syncTasksFromGoogle(USER_ID, { fullImport: true });
    console.log('syncTasksFromGoogle results:', JSON.stringify({
      created: syncResults.created,
      updated: syncResults.updated,
      skippedTasks: syncResults.skippedTasks,
      errors: syncResults.errors?.length ?? 0,
      series: syncResults.series,
    }, null, 2));
  } catch (err) {
    const msg = err?.message || String(err);
    const authFail = /invalid_grant|unauthorized|401|403|No hay credenciales|accessToken/i.test(msg);
    console.error('syncTasksFromGoogle failed:', msg);
    if (authFail) {
      console.error('Google API auth failed');
      await mongoose.disconnect();
      process.exit(3);
    }
    throw err;
  }

  // Extra pass: refreshStaleCompletedGoogleAnchors per list (objetivo lookup)
  console.log('\n--- refreshStaleCompletedGoogleAnchors per list ---');
  for (const spec of LIST_SPECS) {
    const objetivo = await Objetivos.findOne({
      usuario: userOid,
      'googleTasksSync.googleTaskListId': spec.listId,
    }).select('_id nombre googleTasksSync.googleTaskListId').lean();

    if (!objetivo) {
      console.log(`${spec.label}: objetivo not found for listId ${spec.listId}`);
      continue;
    }

    console.log(`${spec.label}: objetivo _id=${objetivo._id} nombre="${objetivo.nombre}"`);
    try {
      const rolled = await googleTasksService.refreshStaleCompletedGoogleAnchors(
        USER_ID,
        spec.listId,
        objetivo._id,
        new Map(),
      );
      anchorUpdated += rolled;
      console.log(`${spec.label}: refreshStaleCompletedGoogleAnchors updated ${rolled}`);
    } catch (err) {
      console.error(`${spec.label}: refreshStaleCompletedGoogleAnchors error:`, err?.message || err);
    }
  }

  const after = snapshotTasks(await queryMatchingTasks());
  console.log('\n--- AFTER repair (non-CANCELADA, /Emails|Brusquet/i) ---');
  console.log(JSON.stringify(after, null, 2));

  const beforeById = new Map(before.map((t) => [t._id, t]));
  const changed = after.filter((t) => {
    const prev = beforeById.get(t._id);
    if (!prev) return true;
    return prev.estado !== t.estado || prev.fechaVencimiento !== t.fechaVencimiento || prev.completada !== t.completada;
  });

  console.log('\n--- SUMMARY ---');
  console.log('syncTasksFromGoogle updated:', syncResults?.updated ?? 0);
  console.log('refreshStaleCompletedGoogleAnchors updated:', anchorUpdated);
  console.log('total tasks updated (sync + anchors):', (syncResults?.updated ?? 0) + anchorUpdated);
  console.log('matching tasks changed (Emails|Brusquet):', changed.length);
  if (changed.length) {
    console.log(JSON.stringify(changed.map((t) => ({
      titulo: t.titulo,
      estado: t.estado,
      fechaVencimiento: t.fechaVencimiento,
      completada: t.completada,
    })), null, 2));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Deduplica googleTaskId por usuario para poder crear el índice unique parcial.
 *
 * Política: por cada (usuario, googleTaskId) con >1 doc, conservar el más reciente
 * (updatedAt) y soft-unlink el resto (null id, unlinked, sin borrar la tarea).
 *
 * Uso:
 *   node apps/backend/scripts/dedupe-google-task-ids.js           # dry-run
 *   node apps/backend/scripts/dedupe-google-task-ids.js --apply   # aplica
 */

import mongoose from 'mongoose';
import { Tareas } from '../src/models/index.js';
import config from '../src/config/config.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(APPLY ? '🔧 Modo APPLY' : '👀 Dry-run (pasá --apply para escribir)');
  await mongoose.connect(config.mongoUrl);
  console.log('✅ MongoDB conectado');

  const dupes = await Tareas.aggregate([
    {
      $match: {
        'googleTasksSync.googleTaskId': { $exists: true, $type: 'string', $ne: '' },
      },
    },
    {
      $group: {
        _id: {
          usuario: '$usuario',
          googleTaskId: '$googleTasksSync.googleTaskId',
        },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
        updatedAts: { $push: '$updatedAt' },
        titulos: { $push: '$titulo' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  console.log(`📊 Grupos duplicados: ${dupes.length}`);

  let unlinked = 0;
  for (const group of dupes) {
    const docs = await Tareas.find({ _id: { $in: group.ids } })
      .select('_id titulo updatedAt googleTasksSync')
      .sort({ updatedAt: -1 });
    const [keep, ...rest] = docs;
    console.log(
      `  keep="${keep?.titulo}" (${keep?._id}) id=${group._id.googleTaskId} → unlink ${rest.length}`,
    );
    if (!APPLY) continue;
    for (const t of rest) {
      t.googleTasksSync = {
        ...(t.googleTasksSync || {}),
        googleTaskId: null,
        enabled: false,
        needsSync: false,
        syncStatus: 'unlinked',
        syncingStartedAt: null,
        updated: new Date(),
      };
      await t.save();
      unlinked += 1;
    }
  }

  if (APPLY) {
    console.log(`✅ Soft-unlink aplicados: ${unlinked}`);
    console.log('💡 Reiniciá el backend / asegurate de que el índice unique parcial se cree.');
  } else {
    console.log('💡 Sin cambios. Re-ejecutá con --apply para corregir.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌', err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});

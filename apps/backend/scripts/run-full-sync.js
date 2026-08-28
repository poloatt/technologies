import 'dotenv/config';
import connectDB from '../src/config/database/mongodb.js';
import { Users } from '../src/models/index.js';
import googleTasksService from '../src/services/googleTasksService.js';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};
  for (const arg of args) {
    const [key, value] = arg.split('=');
    if (key.startsWith('--')) {
      parsed[key.replace(/^--/, '')] = value === undefined ? true : value;
    }
  }
  return parsed;
};

const pretty = (obj) => JSON.stringify(obj, null, 2);

const main = async () => {
  try {
    const args = parseArgs();
    const userEmail = args.user || args.email;
    const userId = args.userId || args.uid;

    if (!userEmail && !userId) {
      console.error('❌ Debes especificar --user="<email>" o --userId="<id>"');
      process.exit(1);
    }

    // Permitir override rápido desde CLI
    if (args.concurrency) process.env.GTASKS_CONCURRENCY = String(args.concurrency);
    if (args.limit) process.env.GTASKS_MAX_TASKS_PER_SYNC = String(args.limit);

    console.log('🔧 Parámetros:', {
      userEmail,
      userId,
      GTASKS_CONCURRENCY: process.env.GTASKS_CONCURRENCY || '3',
      GTASKS_MAX_TASKS_PER_SYNC: process.env.GTASKS_MAX_TASKS_PER_SYNC || '25'
    });

    // Conectar DB
    await connectDB();

    // Buscar usuario
    const user = userId
      ? await Users.findById(userId)
      : await Users.findOne({ email: userEmail });

    if (!user) {
      console.error('❌ Usuario no encontrado');
      process.exit(1);
    }

    console.log('👤 Usuario encontrado:', {
      id: user._id?.toString?.(),
      email: user.email,
      googleEnabled: Boolean(user.googleTasksConfig?.enabled)
    });

    if (!user.googleTasksConfig?.enabled) {
      console.error('❌ Google Tasks no está habilitado para este usuario.');
      process.exit(1);
    }

    console.log('🚀 Iniciando fullSyncWithUser...', {
      fullImport: args.fullImport === true || args.fullImport === 'true',
    });
    const t0 = Date.now();
    const forceFullImport = args.fullImport === true || args.fullImport === 'true';
    const results = await googleTasksService.fullSyncWithUser(user, {
      fullImport: forceFullImport || undefined,
    });
    const elapsedMs = Date.now() - t0;

    console.log('✅ Sincronización terminada en', elapsedMs, 'ms');

    // Resumen clave
    const summary = {
      success: true,
      elapsedMs,
      runId: results?.metrics?.runId,
      quotaHit: results?.metrics?.quotaHit,
      timings: results?.metrics?.timings,
      batches: results?.metrics?.batches,
      objetivos: results?.objetivos,
      toGoogle: results?.tareas?.toGoogle,
      fromGoogle: results?.tareas?.fromGoogle
    };

    console.log('📊 Resumen:\n', pretty(summary));

    process.exit(0);
  } catch (err) {
    console.error('❌ Error en ejecución de full sync:', err?.message || err);
    if (err?.response?.data) {
      console.error('Detalles HTTP:', pretty(err.response.data));
    }
    process.exit(1);
  }
};

main();


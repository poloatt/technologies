#!/usr/bin/env node
/**
 * Importa la actividad de la cuenta en dólares de Mercado Pago desde un texto
 * copiado de la pantalla de movimientos (Dólares). Deduplica por ID de movimiento.
 *
 *   node scripts/import-mp-usd-activity.js <archivo.txt> --conexion <bankconnectionId> --hoy 2026-11-25
 *   node scripts/import-mp-usd-activity.js <archivo.txt> --conexion <id> --hoy 2026-11-25 --dry-run
 *
 * Sin --dry-run guarda antes un respaldo JSON de todas las filas de la cuenta
 * en --respaldo (por defecto %USERPROFILE%/mp-pagos) y recién después escribe.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  parsearActividadUsd,
  importarActividadUsd,
} from '../src/services/mercadoPagoUsdActivity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.produccion') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const FLAGS_CON_VALOR = new Set(['--conexion', '--hoy', '--respaldo']);
const opciones = {};
let archivo = null;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (FLAGS_CON_VALOR.has(a)) {
    opciones[a] = args[i + 1];
    i += 1;
  } else if (a === '--dry-run') {
    opciones[a] = true;
  } else if (!a.startsWith('--')) {
    archivo = a;
  }
}

const conexionArg = opciones['--conexion'];
const hoy = opciones['--hoy'] || null;
const respaldoDir = opciones['--respaldo'] || path.join(os.homedir(), 'mp-pagos');
const dryRun = Boolean(opciones['--dry-run']);

if (!archivo || !conexionArg) {
  console.error('Uso: node scripts/import-mp-usd-activity.js <archivo.txt> --conexion <id> [--hoy YYYY-MM-DD] [--dry-run]');
  process.exit(1);
}

const mongoUrl = process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL || process.env.MONGODB_URI;
if (!mongoUrl) {
  console.error('Falta MONGO_PUBLIC_URL, MONGO_URL o MONGODB_URI');
  process.exit(1);
}

const texto = fs.readFileSync(archivo, 'utf8');
const { movimientos, omitidos } = parsearActividadUsd(texto, { hoy });

await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 20000 });
const db = mongoose.connection.db;
const coleccion = db.collection('transacciones');

const conexion = await db.collection('bankconnections').findOne({ _id: new mongoose.Types.ObjectId(conexionArg) });
if (!conexion) {
  console.error(`No existe la conexión ${conexionArg}`);
  await mongoose.disconnect();
  process.exit(1);
}

let backup = null;
if (!dryRun) {
  fs.mkdirSync(respaldoDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  backup = path.join(respaldoDir, `backup-usd-import-${ts}.json`);
  const filas = await coleccion.find({ cuenta: conexion.cuenta }).toArray();
  fs.writeFileSync(backup, JSON.stringify(filas, null, 1));
}

const monedaUsd = await db.collection('monedas').findOne({ codigo: 'USD' });
if (!monedaUsd) {
  console.error('No existe la moneda USD (codigo: USD) en la colección monedas');
  await mongoose.disconnect();
  process.exit(1);
}

const resultado = await importarActividadUsd(coleccion, {
  cuenta: conexion.cuenta,
  usuario: conexion.usuario,
  conexionId: conexion._id,
  movimientos,
  monedaUsdId: monedaUsd._id,
  dryRun,
});

console.log(JSON.stringify({
  dryRun,
  archivo,
  parseados: movimientos.length,
  yaExistian: resultado.yaExistian,
  nuevos: resultado.nuevos.length,
  insertados: resultado.insertados,
  porKind: resultado.nuevos.reduce((acc, m) => {
    acc[m.movementKind] = (acc[m.movementKind] || 0) + 1;
    return acc;
  }, {}),
  omitidos,
  backup,
}, null, 2));

await mongoose.disconnect();

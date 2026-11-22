#!/usr/bin/env node
/**
 * Reclasifica transacciones Mercado Pago ya guardadas al libro de inversiones.
 * Reservas, aportes/rescates y rendimientos salen del flujo. El cashback promocional queda.
 *
 *   node scripts/backfill-mp-ledger-kinds.js            # aplica
 *   node scripts/backfill-mp-ledger-kinds.js --dry-run  # solo cuenta
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  clasificarMovimientoEconomicoMp,
  isInversionesMovementKind,
} from '../src/services/mercadoPagoUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.produccion') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const dryRun = process.argv.includes('--dry-run');
const mongoUrl = process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL || process.env.MONGODB_URI;

if (!mongoUrl) {
  console.error('Falta MONGO_PUBLIC_URL, MONGO_URL o MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 20000 });
const db = mongoose.connection.db;

const cursor = db.collection('transacciones').find({
  'origen.tipo': { $in: ['MERCADOPAGO_PAGO', 'MERCADOPAGO_MOVIMIENTO', 'MERCADOPAGO'] },
});

let scanned = 0;
let updated = 0;
const kindBefore = {};
const kindAfter = {};

while (await cursor.hasNext()) {
  const t = await cursor.next();
  scanned += 1;
  const meta = t.origen?.metadata || {};
  const prevKind = meta.movementKind || '(none)';
  kindBefore[prevKind] = (kindBefore[prevKind] || 0) + 1;

  const signed = t.tipo === 'INGRESO'
    ? Math.abs(Number(t.monto) || 0)
    : -Math.abs(Number(t.monto) || 0);

  // No reinyectar el label que ya guardamos ("MercadoPago - Rendimiento"):
  // si no, un cashback reclasificado volvería a caer como rendimiento.
  const storedDesc = String(t.descripcion || '');
  const originalDescription = meta.description
    || (/^MercadoPago\s*-\s*/i.test(storedDesc) ? '' : storedDesc);

  const economic = clasificarMovimientoEconomicoMp({
    transactionType: meta.transactionType,
    operationType: meta.operationType,
    description: originalDescription,
    paymentMethod: meta.paymentMethod || meta.paymentMethodId,
    metadata: meta,
    netAmount: signed,
    raw: { DESCRIPTION: originalDescription, TRANSACTION_TYPE: meta.transactionType },
  });

  const nextKind = economic.movementKind || '(none)';
  kindAfter[nextKind] = (kindAfter[nextKind] || 0) + 1;

  const needs =
    meta.movementKind !== economic.movementKind ||
    Boolean(meta.statsExclude) !== Boolean(economic.statsExclude) ||
    Boolean(meta.isInternal) !== Boolean(economic.isInternal);

  if (!needs) continue;

  const patch = {
    'origen.metadata.movementKind': economic.movementKind,
    'origen.metadata.statsExclude': economic.statsExclude,
    'origen.metadata.isInternal': economic.isInternal,
  };
  if (isInversionesMovementKind(economic.movementKind) || economic.isInternal || economic.movementKind === 'CASHBACK') {
    patch.descripcion = `MercadoPago - ${economic.label}`;
  }

  updated += 1;
  if (!dryRun) {
    await db.collection('transacciones').updateOne({ _id: t._id }, { $set: patch });
  }
}

console.log(JSON.stringify({ dryRun, scanned, updated, kindBefore, kindAfter }, null, 2));
await mongoose.disconnect();

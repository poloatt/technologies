import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
const url = process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL;
await mongoose.connect(url, { serverSelectionTimeoutMS: 20000, dbName: 'test' });
const col = mongoose.connection.db.collection('transacciones');

const one = await col.findOne({ 'origen.metadata.paymentMethodId': 'master', monto: 21315 });
const keys = Object.keys(one?.origen?.metadata || {}).sort();
console.log('meta keys', keys);
console.log(JSON.stringify({
  desc: one.descripcion,
  tipo: one.tipo,
  monto: one.monto,
  montoNeto: one.montoNeto,
  categoria: one.categoria,
  meta: one.origen?.metadata,
}, null, 2));

const payish = await col.find({
  $or: [
    { descripcion: /cr[eé]dito|resumen|visa|master|naranja|tarjeta/i },
    { 'origen.metadata.description': /cr[eé]dito|resumen|visa|master|naranja|tarjeta/i },
    { 'origen.metadata.itemTitle': /cr[eé]dito|resumen|visa|master|naranja|tarjeta/i },
    { 'origen.metadata.counterpartyName': /cr[eé]dito|resumen|visa|master|naranja|tarjeta/i },
    { 'origen.metadata.statementDescriptor': /cr[eé]dito|resumen|visa|master|tarjeta/i },
  ],
}).project({
  descripcion: 1, monto: 1, tipo: 1, fecha: 1,
  'origen.metadata.movementKind': 1,
  'origen.metadata.counterpartyName': 1,
  'origen.metadata.itemTitle': 1,
  'origen.metadata.description': 1,
  'origen.metadata.paymentMethodId': 1,
  'origen.metadata.paymentMethodType': 1,
}).sort({ fecha: -1 }).limit(40).toArray();

console.log('\n--- text hits', payish.length);
for (const t of payish) {
  const m = t.origen?.metadata || {};
  console.log(t.fecha?.toISOString?.().slice(0, 10), t.tipo, Math.round(t.monto), m.movementKind, m.paymentMethodId || m.paymentMethodType, '|', (m.counterpartyName || ''), '|', (m.itemTitle || m.description || t.descripcion || '').slice(0, 70));
}

await mongoose.disconnect();

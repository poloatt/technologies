import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { clasificarMovimientoEconomicoMp, determinarTipoPago, determinarTipoMovimientoMp } from '../src/services/mercadoPagoUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

await mongoose.connect(process.env.MONGO_URL, { dbName: 'test' });
const col = mongoose.connection.collection('transacciones');

const mislabeled = await col.find({
  fecha: { $gte: new Date('2026-01-01T00:00:00.000-03:00') },
  estado: { $in: ['PAGADO', 'COMPLETADA'] },
  tipo: 'EGRESO',
  'origen.metadata.movementKind': 'RESERVE_RELEASE',
}).project({
  monto: 1,
  fecha: 1,
  descripcion: 1,
  origen: 1,
}).limit(5).toArray();

console.log('mislabeled sample', mislabeled.map((row) => ({
  monto: row.monto,
  fecha: row.fecha,
  descripcion: row.descripcion,
  branch: row.origen?.metadata?.businessBranch,
  op: row.origen?.metadata?.operationType,
  tx: row.origen?.metadata?.transactionType,
  source: row.origen?.metadata?.source,
  metaDesc: row.origen?.metadata?.description,
  name: row.origen?.metadata?.businessName,
  item: row.origen?.metadata?.itemTitle,
  method: row.origen?.metadata?.paymentMethod,
})));

const branches = await col.aggregate([
  {
    $match: {
      tipo: 'EGRESO',
      'origen.metadata.movementKind': 'RESERVE_RELEASE',
    },
  },
  {
    $group: {
      _id: {
        branch: '$origen.metadata.businessBranch',
        op: '$origen.metadata.operationType',
        desc: '$descripcion',
        source: '$origen.metadata.source',
      },
      n: { $sum: 1 },
      sum: { $sum: '$monto' },
    },
  },
  { $sort: { n: -1 } },
]).toArray();
console.log('\ngroups');
for (const row of branches) {
  console.log(row.n, Math.round(row.sum), JSON.stringify(row._id));
}

const one = mislabeled[0];
if (one) {
  const economic = clasificarMovimientoEconomicoMp({
    operationType: one.origen?.metadata?.operationType,
    description: one.origen?.metadata?.description || one.descripcion,
    paymentMethod: one.origen?.metadata?.paymentMethod,
    businessBranch: one.origen?.metadata?.businessBranch,
    netAmount: -Math.abs(one.monto),
    metadata: one.origen?.metadata,
    transactionType: one.origen?.metadata?.transactionType,
  });
  console.log('\nreclass now', economic.movementKind, determinarTipoPago({
    operation_type: one.origen?.metadata?.operationType,
    point_of_interaction: { business_info: { branch: one.origen?.metadata?.businessBranch } },
    transaction_amount: one.monto,
    collector_id: 1,
    payer: { id: 1 },
  }, 1));
}

const blank = await col.find({
  fecha: { $gte: new Date('2026-10-01T00:00:00.000-03:00') },
  tipo: 'INGRESO',
  'origen.metadata.movementKind': 'PAYMENT',
  'origen.metadata.transactionType': 'SETTLEMENT',
  descripcion: 'MercadoPago - Movimiento',
}).project({ monto: 1, fecha: 1, origen: 1 }).limit(3).toArray();

for (const row of blank) {
  const meta = row.origen?.metadata || {};
  const economic = clasificarMovimientoEconomicoMp({
    transactionType: meta.transactionType,
    operationType: meta.operationType,
    description: meta.description,
    paymentMethod: meta.paymentMethod,
    paymentMethodType: meta.paymentMethodType,
    netAmount: row.monto,
    metadata: meta,
  });
  console.log('\nblank reclass', row.monto, economic.movementKind, {
    tx: meta.transactionType,
    method: meta.paymentMethod,
    methodType: meta.paymentMethodType,
    desc: meta.description,
    cp: meta.counterpartyName,
    item: meta.itemTitle,
    source: meta.source,
    keys: Object.keys(meta),
  });
  console.log('tipo mov', determinarTipoMovimientoMp({
    transactionType: meta.transactionType,
    netAmount: row.monto,
    paymentMethod: meta.paymentMethod,
    operationType: meta.operationType,
  }));
}

await mongoose.disconnect();

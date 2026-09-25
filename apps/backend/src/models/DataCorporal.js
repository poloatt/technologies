import mongoose from 'mongoose';
import { createSchema, commonFields } from './BaseSchema.js';

const dataCorporalSchema = createSchema({
  fecha: {
    type: Date,
    default: Date.now,
  },
  origen: {
    type: String,
    enum: ['manual', 'samsung'],
    default: 'manual',
  },
  weight: {
    type: Number,
    required: true,
    min: 0
  },
  muscle: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  fatPercent: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  stress: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  sleep: {
    type: Number,
    required: true,
    min: 0,
    max: 24
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  ...commonFields
});

dataCorporalSchema.index(
  { usuario: 1, fecha: 1 },
  { unique: true, name: 'usuario_fecha_unique' },
);

export const DataCorporal = mongoose.model('DataCorporal', dataCorporalSchema);

async function syncDataCorporalIndexes() {
  try {
    const indexes = await DataCorporal.collection.indexes();
    const legacy = indexes.find((idx) => (
      idx.unique
      && idx.key
      && idx.key.fecha === 1
      && idx.key.usuario == null
    ));
    if (legacy?.name) {
      await DataCorporal.collection.dropIndex(legacy.name);
    }
    await DataCorporal.syncIndexes();
  } catch (error) {
    console.error('DataCorporal index sync:', error.message);
  }
}

if (mongoose.connection.readyState === 1) {
  syncDataCorporalIndexes();
} else {
  mongoose.connection.once('connected', syncDataCorporalIndexes);
} 
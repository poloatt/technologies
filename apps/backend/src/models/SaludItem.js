import mongoose from 'mongoose';
import { createSchema, commonFields } from './BaseSchema.js';
import { SALUD_TIPOS, SALUD_ESTADOS } from '@attadia/shared/pulso';

const saludItemSchema = createSchema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  controlId: { type: String, required: true, trim: true },
  tipo: {
    type: String,
    enum: SALUD_TIPOS,
    required: true,
  },
  titulo: { type: String, required: true, trim: true },
  fecha: { type: Date, required: true },
  estado: {
    type: String,
    enum: SALUD_ESTADOS,
    default: 'PENDIENTE',
  },
  notas: { type: String, default: '' },
  tareaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tareas',
    default: null,
  },
  ...commonFields,
});

saludItemSchema.methods.getLabel = function getLabel() {
  return this.titulo;
};

export const SaludItem = mongoose.model('SaludItem', saludItemSchema);

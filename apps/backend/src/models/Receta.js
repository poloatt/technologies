import mongoose from 'mongoose';
import { createSchema, commonFields } from './BaseSchema.js';
import { DIET_SLOTS, DIET_CHANNELS } from '@attadia/shared/pulso';

const recetaSchema = createSchema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  nombre: { type: String, required: true, trim: true },
  slot: {
    type: String,
    enum: DIET_SLOTS.map((slot) => slot.id),
    required: true,
  },
  ingredientes: [{
    nombre: { type: String, required: true, trim: true },
    canal: {
      type: String,
      enum: DIET_CHANNELS.map((channel) => channel.id),
      default: 'super',
    },
  }],
  calorias: { type: Number, default: 0, min: 0 },
  proteinas: { type: Number, default: 0, min: 0 },
  carbohidratos: { type: Number, default: 0, min: 0 },
  grasas: { type: Number, default: 0, min: 0 },
  preparacion: { type: String, default: '' },
  ...commonFields,
});

recetaSchema.methods.getLabel = function getLabel() {
  return this.nombre;
};

export const Receta = mongoose.model('Receta', recetaSchema);

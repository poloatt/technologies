import mongoose from 'mongoose';
import { createSchema, commonFields } from './BaseSchema.js';
import { DIET_SLOTS, defaultDietPlanVinculos } from '@attadia/shared/pulso';

const slotIds = DIET_SLOTS.map((slot) => slot.id);

const dietaPlanSchema = createSchema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
    unique: true,
  },
  calorias: { type: Number, default: 0, min: 0 },
  proteinas: { type: Number, default: 0, min: 0 },
  carbohidratos: { type: Number, default: 0, min: 0 },
  grasas: { type: Number, default: 0, min: 0 },
  slots: {
    type: [String],
    default: () => slotIds,
  },
  vinculos: {
    type: mongoose.Schema.Types.Mixed,
    default: defaultDietPlanVinculos,
  },
  ...commonFields,
});

export const DietaPlan = mongoose.model('DietaPlan', dietaPlanSchema);

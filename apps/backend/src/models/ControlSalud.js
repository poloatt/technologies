import mongoose from 'mongoose';
import { createSchema, commonFields } from './BaseSchema.js';
import { BODY_ZONES } from '@attadia/shared/pulso';

const controlSaludSchema = createSchema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  controlId: { type: String, required: true, trim: true },
  zona: {
    type: String,
    enum: BODY_ZONES.map((zone) => zone.id),
    required: true,
  },
  label: { type: String, required: true, trim: true },
  intervaloDias: { type: Number, required: true, min: 1, default: 365 },
  ...commonFields,
});

controlSaludSchema.index(
  { usuario: 1, controlId: 1 },
  { unique: true, name: 'control_usuario_id_unique' },
);

controlSaludSchema.methods.getLabel = function getLabel() {
  return this.label;
};

export const ControlSalud = mongoose.model('ControlSalud', controlSaludSchema);

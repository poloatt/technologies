import mongoose from 'mongoose';
import { createSchema, commonFields } from './BaseSchema.js';

const menuDiaSchema = createSchema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  fecha: { type: Date, required: true },
  slots: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  ...commonFields,
});

menuDiaSchema.index(
  { usuario: 1, fecha: 1 },
  { unique: true, name: 'menu_usuario_fecha_unique' },
);

export const MenuDia = mongoose.model('MenuDia', menuDiaSchema);

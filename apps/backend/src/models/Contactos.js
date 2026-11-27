import mongoose from 'mongoose';
import { createSchema, commonFields } from './BaseSchema.js';
import { CATEGORIAS_TRANSACCION } from '../utils/categoriasTransaccion.js';

export const TIPOS_CONTACTO = ['PERSONA', 'COMERCIO', 'ENTIDAD', 'OTRO'];
export const ORIGENES_CONTACTO = ['MANUAL', 'MERCADOPAGO'];

const CATEGORIAS_CONTACTO_ENUM = [...CATEGORIAS_TRANSACCION, null];

const contactoSchema = createSchema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
    index: true,
  },
  nombre: {
    type: String,
    required: true,
    trim: true,
  },
  tipo: {
    type: String,
    enum: TIPOS_CONTACTO,
    default: 'OTRO',
  },
  categoriaDefault: {
    type: String,
    enum: CATEGORIAS_CONTACTO_ENUM,
    default: null,
  },
  categoriaIngreso: {
    type: String,
    enum: CATEGORIAS_CONTACTO_ENUM,
    default: null,
  },
  categoriaEgreso: {
    type: String,
    enum: CATEGORIAS_CONTACTO_ENUM,
    default: null,
  },
  identificadores: {
    mpIds: {
      type: [String],
      default: [],
    },
    emails: {
      type: [String],
      default: [],
    },
    cuentasBancarias: {
      type: [String],
      default: [],
    },
    aliases: {
      type: [String],
      default: [],
    },
  },
  datosContacto: {
    telefono: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    notas: { type: String, trim: true, default: '' },
  },
  origen: {
    type: String,
    enum: ORIGENES_CONTACTO,
    default: 'MANUAL',
  },
  activo: {
    type: Boolean,
    default: true,
  },
  ...commonFields,
});

contactoSchema.methods.getLabel = function () {
  return this.nombre;
};

contactoSchema.index({ usuario: 1, activo: 1, nombre: 1 });
contactoSchema.index({ usuario: 1, 'identificadores.mpIds': 1 });
contactoSchema.index({ usuario: 1, 'identificadores.emails': 1 });
contactoSchema.index({ usuario: 1, 'identificadores.cuentasBancarias': 1 });
contactoSchema.index({ usuario: 1, 'identificadores.aliases': 1 });

export const Contactos = mongoose.model('Contactos', contactoSchema);

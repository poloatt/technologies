import mongoose from 'mongoose';
import { createSchema, commonFields } from './BaseSchema.js';
import './Monedas.js'; // Aseguramos que el modelo Monedas se registre primero

const cuentaSchema = createSchema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  numero: {
    type: String,
    required: false,
    trim: true,
    default: function() {
      return `ACC-${Date.now()}`;
    }
  },
  tipo: {
    type: String,
    required: true,
    enum: ['EFECTIVO', 'BANCO', 'MERCADO_PAGO', 'CRIPTO', 'OTRO'],
    default: 'OTRO'
  },
  saldo: {
    type: Number,
    default: 0
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  moneda: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Monedas',
    required: true
  },
  activo: {
    type: Boolean,
    default: true
  },
  // Metadata adicional para cuentas específicas (MercadoPago, bancos, etc.)
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  // Campos específicos para cuentas de MercadoPago
  mercadopago: {
    userId: String,                    // ID del usuario en MercadoPago
    email: String,                     // Email de la cuenta MercadoPago
    nickname: String,                  // Nickname del usuario
    countryId: String,                 // País de la cuenta (AR, BR, etc.)
    siteId: String,                    // Site ID de MercadoPago (MLA, MLB, etc.)
    accountType: String,               // Tipo de cuenta (personal, vendedor, etc.)
    verificado: Boolean,               // Si la cuenta está verificada
    disponibleRetiro: Number,          // Dinero disponible para retiro
    disponiblePendiente: Number,       // Dinero pendiente de acreditación
    saldoActualizadoEn: Date           // Cuándo se leyó el saldo real de MP (available_balance)
  },
  ...commonFields
});

// Middleware para poblar referencias solo en consultas específicas
cuentaSchema.pre(['find', 'findOne'], function() {
  this.populate('moneda');
});

cuentaSchema.index({ usuario: 1, activo: 1 });
cuentaSchema.index({ usuario: 1, moneda: 1 });

const Cuentas = mongoose.model('Cuentas', cuentaSchema);

export { Cuentas }; 
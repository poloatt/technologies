import mongoose from 'mongoose';
import { createSchema, commonFields } from './BaseSchema.js';

const bankConnectionSchema = createSchema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  nombre: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        if (this.tipo === 'MERCADOPAGO') {
          return !!v && v.trim() !== '';
        }
        return true;
      },
      message: 'El nombre de la conexión no puede estar vacío.'
    }
  },
  banco: {
    type: String,
    required: function() { return this.tipo !== 'MERCADOPAGO' && this.tipo !== 'MANUAL'; },
    trim: true
  },
  tipo: {
    type: String,
    enum: ['PLAID', 'OPEN_BANKING', 'MANUAL', 'API_DIRECTA', 'MERCADOPAGO'],
    required: true
  },
  cuenta: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cuentas',
    required: function() { return this.tipo !== 'MERCADOPAGO' && this.tipo !== 'MANUAL'; }
  },
  // Credenciales encriptadas
  credenciales: {
    accessToken: String,
    refreshToken: String,
    institutionId: String,
    accountId: String,
    // Para APIs directas
    apiKey: String,
    apiSecret: String,
    username: String,
    password: String, // Encriptado
    // Para MercadoPago
    userId: {
      type: String,
      required: function() { return this.tipo === 'MERCADOPAGO'; }
    }
  },
  // Configuración de sincronización
  configuracion: {
    sincronizacionAutomatica: {
      type: Boolean,
      default: true
    },
    frecuenciaSincronizacion: {
      type: String,
      enum: ['DIARIA', 'SEMANAL', 'MENSUAL'],
      default: 'DIARIA'
    },
    ultimaSincronizacion: Date,
    proximaSincronizacion: Date,
    categorizacionAutomatica: {
      type: Boolean,
      default: true
    }
  },
  // Estado de la conexión
  estado: {
    type: String,
    enum: ['ACTIVA', 'INACTIVA', 'ERROR', 'PENDIENTE_VERIFICACION'],
    default: 'PENDIENTE_VERIFICACION'
  },
  // Información de la cuenta bancaria
  informacionCuenta: {
    numeroCuenta: String,
    tipoCuenta: String,
    moneda: String,
    saldoActual: Number,
    saldoDisponible: Number
  },
  // Estado específico Mercado Pago (wallet AR)
  mercadopago: {
    syncParcial: { type: Boolean, default: false },
    ultimoErrorSettlement: String,
    reportePendiente: {
      beginDate: String,
      endDate: String,
      solicitadoEn: Date
    },
    // Diagnóstico de cobertura (P2P / reconciliación)
    diagnostico: {
      actualizadoEn: Date,
      transferenciasP2P: Number,
      transferenciasSettlement: Number,
      transferenciasAccount: Number,
      movementKinds: { type: Map, of: Number },
      saldoMp: Number,
      saldoLedger: Number,
      gapSaldo: Number,
      coberturaP2P: {
        type: String,
        enum: ['OK', 'VACIA', 'DESCONOCIDA'],
        default: 'DESCONOCIDA'
      },
      nota: String
    }
  },
  // Historial de sincronizaciones
  historialSincronizacion: [{
    fecha: {
      type: Date,
      default: Date.now
    },
    estado: {
      type: String,
      enum: ['EXITOSA', 'ERROR', 'PARCIAL']
    },
    transaccionesNuevas: {
      type: Number,
      default: 0
    },
    transaccionesActualizadas: {
      type: Number,
      default: 0
    },
    error: String
  }],
  ...commonFields
});

// Índices para mejorar el rendimiento
bankConnectionSchema.index({ usuario: 1, estado: 1 });
bankConnectionSchema.index({ cuenta: 1 });
bankConnectionSchema.index({ proximaSincronizacion: 1 });

// Método para actualizar última sincronización
bankConnectionSchema.methods.actualizarSincronizacion = function(estado, transaccionesNuevas = 0, transaccionesActualizadas = 0, error = null) {
  this.configuracion.ultimaSincronizacion = new Date();
  
  // Calcular próxima sincronización
  const ahora = new Date();
  switch (this.configuracion.frecuenciaSincronizacion) {
    case 'DIARIA':
      this.configuracion.proximaSincronizacion = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'SEMANAL':
      this.configuracion.proximaSincronizacion = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'MENSUAL':
      this.configuracion.proximaSincronizacion = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);
      break;
  }

  // Agregar al historial
  this.historialSincronizacion.push({
    fecha: new Date(),
    estado,
    transaccionesNuevas,
    transaccionesActualizadas,
    error
  });

  // Mantener solo los últimos 50 registros
  if (this.historialSincronizacion.length > 50) {
    this.historialSincronizacion = this.historialSincronizacion.slice(-50);
  }

  return this.save();
};

// Método estático para obtener conexiones que necesitan sincronización
// usuarioId opcional: limita a un usuario (endpoints HTTP). Sin filtro = cron/scheduler.
bankConnectionSchema.statics.getConexionesParaSincronizar = function(usuarioId = null) {
  const ahora = new Date();
  const query = {
    estado: 'ACTIVA',
    'configuracion.sincronizacionAutomatica': true,
    $or: [
      { 'configuracion.proximaSincronizacion': { $lte: ahora } },
      { 'configuracion.proximaSincronizacion': { $exists: false } }
    ]
  };
  if (usuarioId) {
    query.usuario = usuarioId;
  }
  return this.find(query).populate('cuenta usuario');
};

export const BankConnection = mongoose.model('BankConnection', bankConnectionSchema); 
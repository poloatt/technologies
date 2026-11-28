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
      solicitadoEn: Date,
      // Id del reporte que MP está generando: la próxima sync lo completa en vez de pedir otro.
      reportId: String
    },
    // Rangos con salidas a CBU validadas (reporte de confianza + conciliación contra el ledger).
    // Intervalos ya fusionados; lo que no está acá no se considera completo.
    coberturaRetiros: [{
      _id: false,
      beginDate: String,
      endDate: String,
      reportId: String,
      fuente: String,
      validadoEn: Date,
      releaseValidado: { type: Boolean, default: false }
    }],
    // Saldos reales cargados a mano en una fecha: anclan la conciliación del ledger.
    anclaSaldo: {
      fecha: Date,
      dineroEnCuenta: Number,
      reservado: Number,
      invertido: Number,
      cargadoEn: Date
    },
    // Cursor del historial pedido a mano. Solo retrocede; la sync diaria no lo toca.
    historial: {
      objetivo: String,
      cubiertoHasta: String,
      ultimoMes: {
        beginDate: String,
        endDate: String
      },
      mesLabel: String,
      pendiente: { type: Boolean, default: false },
      cuotaAgotada: { type: Boolean, default: false },
      quedaHistorial: { type: Boolean, default: false },
      completo: { type: Boolean, default: false },
      tramosVacios: { type: Number, default: 0 },
      inicioActividad: String,
      actualizadoEn: Date,
      // Tramos ya cubiertos que se volvieron a pedir porque habían quedado sin retiros (CBU).
      revisados: [{ _id: false, beginDate: String, endDate: String, revisadoEn: Date }],
      // Última revisión de esta sync (solo presente cuando la sync fue una revisión).
      revision: {
        beginDate: String,
        endDate: String,
        mesLabel: String,
        pendiente: Boolean,
        cuotaAgotada: Boolean
      }
    },
    // Diagnóstico de cobertura (P2P / CBU / reconciliación)
    diagnostico: {
      actualizadoEn: Date,
      transferenciasP2P: Number,
      transferenciasBancarias: Number,
      transferenciasSettlement: Number,
      transferenciasAccount: Number,
      transferenciasActivities: Number,
      settlementBankOuts: Number,
      movementKinds: { type: Map, of: Number },
      saldoMp: Number,
      saldoLedger: Number,
      gapSaldo: Number,
      // Brecha entre el ledger y el saldo real cargado a mano (ancla) a la fecha de la ancla.
      anclaGap: {
        fecha: Date,
        dineroEnCuenta: Number,
        ledger: Number,
        gap: Number,
        ok: Boolean
      },
      // Última conciliación de salidas a CBU (reporte de confianza vs ledger).
      retiros: {
        actualizadoEn: Date,
        beginDate: String,
        endDate: String,
        reportId: String,
        esperados: Number,
        conciliados: Number,
        faltantes: Number,
        montoEsperado: Number,
        validado: Boolean,
        motivo: String,
        // ok: true = saldo corrido y payouts coinciden; false = discrepancia; null = sin verificar.
        release: {
          ok: Boolean,
          motivo: String,
          reportId: String,
          beginDate: String,
          endDate: String,
          saltosSaldo: Number,
          soloSettlement: Number,
          soloRelease: Number
        }
      },
      coberturaP2P: {
        type: String,
        enum: ['OK', 'VACIA', 'DESCONOCIDA'],
        default: 'DESCONOCIDA'
      },
      coberturaBancarias: {
        type: String,
        // SOLO_ENTRADA = Debin/ingresos bancarios sin salidas CVU→CBU (PAYOUTS)
        enum: ['OK', 'VACIA', 'SOLO_ENTRADA', 'DESCONOCIDA'],
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
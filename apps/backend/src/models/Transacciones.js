import mongoose from 'mongoose';
import { createSchema, commonFields } from './BaseSchema.js';
import { parseArDay } from '../utils/arDate.js';
import { buildEstadoFilter } from '../utils/transaccionEstado.js';
import { buildLedgerMatch, MP_CREDITOS_KINDS } from '../services/mercadoPagoUtils.js';
import { CATEGORIAS_TRANSACCION } from '../utils/categoriasTransaccion.js';

const transaccionSchema = createSchema({
  descripcion: {
    type: String,
    required: true,
    trim: true
  },
  monto: {
    type: Number,
    required: true
  },
  fecha: {
    type: Date,
    required: true,
    default: Date.now
  },
  categoria: {
    type: String,
    required: true,
    enum: CATEGORIAS_TRANSACCION,
    trim: true
  },
  categoriaManual: {
    type: Boolean,
    default: false
  },
  estado: {
    type: String,
    enum: ['PENDIENTE', 'PAGADO', 'COMPLETADA', 'CANCELADA'],
    default: 'PENDIENTE'
  },
  tipo: {
    type: String,
    enum: ['INGRESO', 'EGRESO'],
    required: true
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
  cuenta: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cuentas',
    required: true
  },
  contrato: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contratos'
  },
  contacto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contactos',
    default: null
  },
  // Campo para transacciones de fuentes externas (MercadoPago, bancos, etc.)
  origen: {
    tipo: {
      type: String,
      enum: [
        'MANUAL',
        'MERCADOPAGO',              // MercadoPago genérico
        'MERCADOPAGO_PAGO',         // Pagos específicos de MercadoPago
        'MERCADOPAGO_MOVIMIENTO',   // Movimientos de cuenta de MercadoPago
        'PLAID',
        'OPEN_BANKING',
        'API_DIRECTA'
      ],
      default: 'MANUAL'
    },
    conexionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankConnection'
    },
    transaccionId: String, // ID de la transacción en el sistema externo
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => ({})
    }
  },
  // Campos adicionales para transacciones de MercadoPago
  comisiones: {
    mercadopago: {
      type: Number,
      default: 0
    },
    financieras: {
      type: Number,
      default: 0
    },
    envio: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  },
  // Monto neto después de comisiones (útil para MercadoPago)
  montoNeto: {
    type: Number
  },
  ...commonFields
});

// Middleware para asignar automáticamente la moneda de la cuenta
transaccionSchema.pre('save', async function(next) {
  try {
    // Solo ejecutar si es un documento nuevo o si la cuenta fue modificada
    if (this.isNew || this.isModified('cuenta')) {
      const Cuentas = mongoose.model('Cuentas');
      // Asegurarnos de que el ID de la cuenta sea un ObjectId válido
      const cuentaId = mongoose.Types.ObjectId.isValid(this.cuenta) ? 
        this.cuenta : 
        null;

      if (!cuentaId) {
        throw new Error('ID de cuenta inválido');
      }

      const cuenta = await Cuentas.findById(cuentaId).populate('moneda');
      if (!cuenta) {
        throw new Error('La cuenta especificada no existe');
      }

      if (cuenta.multimoneda) {
        // En cuentas multimoneda (p. ej. Efectivo) se respeta la moneda elegida
        // en la transacción; si no se informó, se usa la moneda primaria de la cuenta.
        if (!this.moneda) {
          if (cuenta.moneda?._id) {
            this.moneda = cuenta.moneda._id;
          } else {
            const Monedas = mongoose.model('Monedas');
            const primeraActiva = await Monedas.findOne({ activa: true }).sort({ orden: 1, codigo: 1 }).lean();
            if (!primeraActiva) {
              throw new Error('No hay monedas habilitadas para asignar a la transacción');
            }
            this.moneda = primeraActiva._id;
          }
        }
      } else {
        if (!cuenta.moneda) {
          throw new Error('La cuenta no tiene una moneda asociada');
        }

        // Solo asignar si no está ya asignado para evitar bucles
        if (!this.moneda || this.moneda.toString() !== cuenta.moneda._id.toString()) {
          this.moneda = cuenta.moneda._id;
        }
      }
    }
    next();
  } catch (error) {
    console.error('Error en middleware pre-save de Transacciones:', error);
    next(error);
  }
});

// Configuración para populate automático solo en consultas específicas
transaccionSchema.pre(['find', 'findOne', 'findOneAndUpdate'], function(next) {
  this.populate('moneda')
    .populate('cuenta')
    .populate('contacto', 'nombre tipo categoriaDefault categoriaIngreso categoriaEgreso origen');
  next();
});

// Personalizar el método toJSON para transformar _id a id
transaccionSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    if (ret.moneda && typeof ret.moneda === 'object' && ret.moneda._id) {
      ret.moneda.id = ret.moneda._id;
      delete ret.moneda._id;
    }
    if (ret.cuenta && typeof ret.cuenta === 'object' && ret.cuenta._id) {
      ret.cuenta.id = ret.cuenta._id;
      delete ret.cuenta._id;
    }
    if (ret.contacto && typeof ret.contacto === 'object' && ret.contacto._id) {
      ret.contacto.id = ret.contacto._id;
      delete ret.contacto._id;
    }
    return ret;
  }
});

// Personalizar el método getLabel
transaccionSchema.methods.getLabel = function() {
  const tipoSymbol = this.tipo === 'INGRESO' ? '+' : '-';
  return `${tipoSymbol}${this.monto} - ${this.descripcion}`;
};

// Saldo de la cuenta: todo movimiento completado que entra o sale del dinero de la cuenta
// (caja, reservas, rescates, rendimientos, dólares e inversiones). Las compras con tarjeta
// no son dinero de la cuenta: el efectivo sale cuando se paga el resumen (pago de crédito).
// `ledger: 'flujo'` deja solo la caja.
transaccionSchema.statics.getBalance = async function(cuentaId, options = {}) {
  const { estado = 'PAGADO', fechaFin, ledger = 'disponible' } = options;

  const match = {
    cuenta: new mongoose.Types.ObjectId(cuentaId),
  };
  if (ledger === 'flujo' || ledger === 'inversiones') {
    Object.assign(match, buildLedgerMatch(ledger));
  } else if (ledger === 'disponible') {
    // Pesos: sin compras con tarjeta y sin movimientos en USD (esos van al libro dólares).
    match['origen.metadata.movementKind'] = { $nin: [...MP_CREDITOS_KINDS] };
    match['origen.metadata.currencyId'] = { $ne: 'USD' };
  }
  const estadoFilter = buildEstadoFilter(estado);
  if (estadoFilter) match.estado = estadoFilter;
  if (fechaFin) {
    const fin = parseArDay(fechaFin, true);
    if (fin) match.fecha = { $lte: fin };
  }

  const result = await this.aggregate([
    { $match: match },
    { $group: {
      _id: '$moneda',
      ingresos: {
        $sum: {
          $cond: [{ $eq: ['$tipo', 'INGRESO'] }, { $ifNull: ['$monto', 0] }, 0]
        }
      },
      egresos: {
        $sum: {
          $cond: [{ $eq: ['$tipo', 'EGRESO'] }, { $ifNull: ['$monto', 0] }, 0]
        }
      }
    }}
  ]);

  if (result.length === 0) {
    return { ingresos: 0, egresos: 0, balance: 0, porMoneda: [] };
  }

  let totalIngresos = 0;
  let totalEgresos = 0;
  const porMoneda = result.map((row) => {
    const ingresos = row.ingresos || 0;
    const egresos = row.egresos || 0;
    totalIngresos += ingresos;
    totalEgresos += egresos;
    return {
      monedaId: row._id ? String(row._id) : null,
      ingresos,
      egresos,
      balance: ingresos - egresos,
    };
  });

  return {
    ingresos: totalIngresos,
    egresos: totalEgresos,
    balance: totalIngresos - totalEgresos,
    porMoneda,
  };
};

// Índices para mejorar el rendimiento
transaccionSchema.index({ usuario: 1, fecha: -1 });
transaccionSchema.index({ usuario: 1, contacto: 1, fecha: -1 });
transaccionSchema.index({ cuenta: 1, fecha: -1 });
transaccionSchema.index({ contrato: 1, fecha: -1 });
transaccionSchema.index({ estado: 1, fecha: -1 });

export const Transacciones = mongoose.model('Transacciones', transaccionSchema); 
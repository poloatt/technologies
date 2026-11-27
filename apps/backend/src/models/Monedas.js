import mongoose from 'mongoose';
import { createSchema, commonFields } from './BaseSchema.js';

const COLORES_MONEDA = {
  CELESTE_ARGENTINA: '#75AADB', // Celeste de la bandera argentina
  AZUL_NAVY: '#000080',        // Azul navy
  TEAL: '#008080',             // Teal
  DARK_TEAL: '#006666',        // Dark teal
  DARK_GREEN: '#006400',       // Dark green
  VERDE_DOLAR: '#6E8F6B',      // Verde dólar (baja saturación, tono billete)
  VIOLETA_OSCURO: '#4B0082'    // Violeta oscuro
};

// Tabla de referencia de monedas ISO 4217 (código, nombre, símbolo)
export const ISO_4217 = {
  ARS: { nombre: 'Peso Argentino', simbolo: '$' },
  USD: { nombre: 'Dólar Estadounidense', simbolo: 'US$' },
  BRL: { nombre: 'Real Brasileño', simbolo: 'R$' },
  CLP: { nombre: 'Peso Chileno', simbolo: '$' },
  UYU: { nombre: 'Peso Uruguayo', simbolo: '$' },
  EUR: { nombre: 'Euro', simbolo: '€' },
  MXN: { nombre: 'Peso Mexicano', simbolo: '$' },
  // Agrega más monedas según necesidad
};

// Lista de países y sus monedas ISO 4217
export const PAISES_MONEDAS = {
  AR: { nombre: 'Argentina', moneda: 'ARS' },
  BR: { nombre: 'Brasil', moneda: 'BRL' },
  CL: { nombre: 'Chile', moneda: 'CLP' },
  UY: { nombre: 'Uruguay', moneda: 'UYU' },
  US: { nombre: 'Estados Unidos', moneda: 'USD' },
  MX: { nombre: 'México', moneda: 'MXN' },
  CO: { nombre: 'Colombia', moneda: 'COP' },
  PE: { nombre: 'Perú', moneda: 'PEN' },
  EC: { nombre: 'Ecuador', moneda: 'USD' },
  ES: { nombre: 'España', moneda: 'EUR' },
  // Agrega más países según necesidad
};

const monedaSchema = createSchema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: false // Permitir monedas globales sin usuario específico
  },
  /**
   * Código de moneda ISO 4217 (ej: 'ARS', 'USD', 'BRL').
   * Debe seguir el estándar internacional y coincidir con los códigos usados por Mercado Pago Developers.
   */
  codigo: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        // Solo letras mayúsculas, 3 caracteres
        return /^[A-Z]{3}$/.test(v);
      },
      message: 'El código de moneda debe ser ISO 4217 (3 letras mayúsculas)'
    }
  },
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  simbolo: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String,
    enum: Object.values(COLORES_MONEDA),
    default: function() {
      return this.codigo?.toUpperCase() === 'USD'
        ? COLORES_MONEDA.VERDE_DOLAR
        : COLORES_MONEDA.CELESTE_ARGENTINA;
    }
  },
  activa: {
    type: Boolean,
    default: true
  },
  esGlobal: {
    type: Boolean,
    default: false // Indica si es una moneda global del sistema
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  ...commonFields
});

// Middleware para filtrar por usuario solo en consultas de lectura (find)
// No aplicar en operaciones de escritura (create, update, delete)
monedaSchema.pre(/^find/, function() {
  // Solo aplicar filtro si hay condiciones de usuario específicas
  // y no estamos en una operación de administración
  if (this._conditions.usuario && !this._conditions.esGlobal) {
    const userId = this._conditions.usuario;
    this._conditions.$or = [
      { usuario: userId },
      { esGlobal: true, activa: true } // Permitir acceso a monedas globales activas
    ];
  }
});

const Monedas = mongoose.model('Monedas', monedaSchema);

export { Monedas, COLORES_MONEDA }; 
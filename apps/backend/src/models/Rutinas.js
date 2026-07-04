import mongoose from 'mongoose';
import { createSchema, commonFields, timezoneUtils } from './BaseSchema.js';
import { getRutinaPeriodStart, getRutinaPeriodEnd } from '@attadia/shared/habits';
import { collectRutinaSectionKeys } from '../utils/habitSectionsUtils.js';
import { repairRutinaItemConfig } from '../utils/rutinaDocumentUtils.js';
import { calculateRutinaCompletitud } from '../utils/rutinaCompletitudUtils.js';

// Definir el esquema de configuración de cadencia
const cadenciaSchema = {
  tipo: {
    type: String,
    enum: ['DIARIO', 'SEMANAL', 'MENSUAL', 'PERSONALIZADO'],
    default: 'DIARIO'
  },
  periodo: {
    type: String,
    enum: ['CADA_DIA', 'CADA_SEMANA', 'CADA_MES'],
    default: function() {
      // Asignar el periodo predeterminado según el tipo
      if (this.tipo === 'SEMANAL') return 'CADA_SEMANA';
      if (this.tipo === 'MENSUAL') return 'CADA_MES';
      return 'CADA_DIA';
    }
  },
  diasSemana: [{
    type: Number,
    min: 0,
    max: 6
  }],
  diasMes: [{
    type: Number,
    min: 1,
    max: 31
  }],
  frecuencia: {
    type: Number,
    min: 1,
    default: 1,
    get: v => Math.round(v),
    set: v => {
      // Asegurar que siempre se guarde como número
      if (typeof v === 'string') {
        const parsed = parseInt(v, 10);
        return isNaN(parsed) ? 1 : Math.max(1, parsed);
      }
      return typeof v === 'number' ? Math.max(1, v) : 1;
    }
  },
  progresoActual: {
    type: Number,
    default: 0,
    min: 0
  },
  ultimoPeriodo: {
    inicio: Date,
    fin: Date
  },
  completacionesPeriodo: [{
    fecha: Date,
    valor: Number
  }],
  ultimaCompletacion: {
    type: Date
  },
  activo: {
    type: Boolean,
    default: true
  }
};

// Crear esquemas de configuración para cada sección
// IMPORTANTE: Usar Schema.Types.Mixed para permitir hábitos personalizados dinámicos
// Esto permite que los usuarios agreguen nuevos hábitos sin modificar el esquema
const configSchema = {
  bodyCare: { type: mongoose.Schema.Types.Mixed, default: {} },
  nutricion: { type: mongoose.Schema.Types.Mixed, default: {} },
  ejercicio: { type: mongoose.Schema.Types.Mixed, default: {} },
  cleaning: { type: mongoose.Schema.Types.Mixed, default: {} }
};

const rutinaSchema = createSchema({
  fecha: {
    type: Date,
    default: Date.now,
    required: true
  },
  // IMPORTANTE: Usar Schema.Types.Mixed para permitir hábitos personalizados dinámicos
  // Esto permite que los usuarios agreguen nuevos hábitos sin modificar el esquema
  bodyCare: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      bath: false,
      skinCareDay: false,
      skinCareNight: false,
      bodyCream: false
    })
  },
  nutricion: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      cocinar: false,
      agua: false,
      protein: false,
      meds: false
    })
  },
  ejercicio: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      meditate: false,
      stretching: false,
      gym: false,
      cardio: false
    })
  },
  cleaning: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      bed: false,
      platos: false,
      piso: false,
      ropa: false
    })
  },
  config: {
    type: configSchema,
    default: () => ({
      bodyCare: {},
      nutricion: {},
      ejercicio: {},
      cleaning: {}
    }),
    strict: false // Permitir campos dinámicos (hábitos personalizados)
  },
  completitud: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  completitudPorSeccion: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      bodyCare: 0,
      nutricion: 0,
      ejercicio: 0,
      cleaning: 0,
    }),
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  ...commonFields
}, { strict: false });

// Crear un índice compuesto único para fecha y usuario
rutinaSchema.index({ 
  usuario: 1, 
  fecha: 1 
}, { 
  unique: true,
  name: 'usuario_fecha_unique',
  partialFilterExpression: { fecha: { $exists: true } }
});

// Middleware para normalizar la fecha antes de guardar
rutinaSchema.pre('save', async function(next) {
  if (this.isModified('fecha')) {
    try {
      // Si ya está en 00:00:00.000Z (UTC), asumir normalizada y no repetir
      if (this.fecha instanceof Date) {
        const d = this.fecha;
        if (
          d.getUTCHours() === 0 &&
          d.getUTCMinutes() === 0 &&
          d.getUTCSeconds() === 0 &&
          d.getUTCMilliseconds() === 0
        ) {
          return next();
        }
      }

      // Obtener el timezone del usuario
      const Users = mongoose.model('Users');
      const user = await Users.findById(this.usuario).select('preferences.timezone');
      const timezone = timezoneUtils.getUserTimezone(user);
      
      // Normalizar la fecha usando el timezone del usuario
      const fechaNormalizada = timezoneUtils.normalizeToStartOfDay(this.fecha, timezone);
      
      if (fechaNormalizada) {
        this.fecha = fechaNormalizada;
      } else {
        return next(new Error('Fecha inválida'));
      }
    } catch (error) {
      console.error('Error al normalizar fecha en rutina:', error);
      return next(error);
    }
  }
  next();
});

// Middleware para validar que no exista otra rutina en el mismo día
rutinaSchema.pre('save', async function(next) {
  if (this.isModified('fecha')) {
    try {
      // Obtener el timezone del usuario
      const Users = mongoose.model('Users');
      const user = await Users.findById(this.usuario).select('preferences.timezone');
      const timezone = timezoneUtils.getUserTimezone(user);
      
      // Si ya está en 00:00:00.000Z (UTC), asumir que representa el "día lógico"
      // y NO volver a normalizar con timezone (evita corrimientos de día y falsos duplicados).
      let fechaInicio = null;
      if (this.fecha instanceof Date && !isNaN(this.fecha.getTime())) {
        const d = this.fecha;
        if (
          d.getUTCHours() === 0 &&
          d.getUTCMinutes() === 0 &&
          d.getUTCSeconds() === 0 &&
          d.getUTCMilliseconds() === 0
        ) {
          fechaInicio = d;
        }
      }

      // En otros casos, normalizar usando el timezone del usuario
      if (!fechaInicio) {
        fechaInicio = timezoneUtils.normalizeToStartOfDay(this.fecha, timezone);
      }
      
  if (!fechaInicio) {
        return next(new Error('Fecha inválida para validación'));
      }

  // Simplificación: comparar por igualdad exacta de la fecha normalizada
  const existingRutina = await this.constructor.findOne({
    _id: { $ne: this._id },
    usuario: this.usuario,
    fecha: fechaInicio
  });

      if (existingRutina) {
        return next(new Error('Ya existe una rutina para esta fecha'));
      }
    } catch (error) {
      console.error('Error al validar rutina duplicada:', error);
      return next(error);
    }
  }
  next();
});

// Middleware para actualizar completitud
rutinaSchema.pre('save', function(next) {
  const sections = collectRutinaSectionKeys(this);

  sections.forEach((section) => {
    if (!this.isModified(section)) return;

    this.markModified(section);
    if (this[section] && typeof this[section] === 'object') {
      Object.keys(this[section]).forEach((field) => {
        if (this.isModified(`${section}.${field}`)) {
          this.markModified(`${section}.${field}`);
        }
      });
    }
  });

  sections.forEach((section) => {
    const sectionData = this[section] && typeof this[section] === 'object'
      ? this[section]
      : {};

    Object.keys(sectionData).forEach((field) => {
      if (!this.config) this.config = {};
      if (!this.config[section]) this.config[section] = {};

      const currentItemConfig = this.config[section][field];
      if (!currentItemConfig || typeof currentItemConfig !== 'object' || Array.isArray(currentItemConfig)) {
        this.config[section][field] = repairRutinaItemConfig(currentItemConfig);
        this.markModified(`config.${section}.${field}`);
      }

      if (!this.isModified(`${section}.${field}`)) return;

      const fieldValue = sectionData[field];
      const isObjectFormat = typeof fieldValue === 'object' && fieldValue !== null && !Array.isArray(fieldValue);
      const isBooleanFormat = typeof fieldValue === 'boolean';

      if (isObjectFormat && Object.values(fieldValue).some(Boolean)) {
        this.config[section][field].ultimaCompletacion = new Date();
        this.markModified(`config.${section}.${field}`);
      } else if (isBooleanFormat && fieldValue === true) {
        this.config[section][field].ultimaCompletacion = new Date();
        this.markModified(`config.${section}.${field}`);
      }
    });
  });

  const completitudFields = calculateRutinaCompletitud(this);
  this.completitud = completitudFields.completitud;
  this.completitudPorSeccion = completitudFields.completitudPorSeccion;
  this.markModified('completitudPorSeccion');
  next();
});

// Pre-save hook para garantizar que las frecuencias sean números
rutinaSchema.pre('save', function(next) {
  if (this.config) {
    collectRutinaSectionKeys(this).forEach((section) => {
      if (!this.config[section]) return;

      Object.keys(this.config[section]).forEach((item) => {
        let itemConfig = this.config[section][item];
        let repaired = false;

        if (!itemConfig || typeof itemConfig !== 'object' || Array.isArray(itemConfig)) {
          itemConfig = repairRutinaItemConfig(itemConfig);
          this.config[section][item] = itemConfig;
          repaired = true;
        }

        const frecuencia = itemConfig.frecuencia;
        const parsedFrec = parseInt(frecuencia, 10);
        const nextFrecuencia = isNaN(parsedFrec) ? 1 : Math.max(1, parsedFrec);
        if (itemConfig.frecuencia !== nextFrecuencia) {
          itemConfig.frecuencia = nextFrecuencia;
          repaired = true;
        }

        if (itemConfig.tipo) {
          const upperTipo = itemConfig.tipo.toUpperCase();
          if (itemConfig.tipo !== upperTipo) {
            itemConfig.tipo = upperTipo;
            repaired = true;
          }

          if (!itemConfig.periodo) {
            if (upperTipo === 'DIARIO') {
              itemConfig.periodo = 'CADA_DIA';
            } else if (upperTipo === 'SEMANAL') {
              itemConfig.periodo = 'CADA_SEMANA';
            } else if (upperTipo === 'MENSUAL') {
              itemConfig.periodo = 'CADA_MES';
            } else {
              itemConfig.periodo = 'CADA_DIA';
            }
            repaired = true;
          }
        }

        if (repaired || this.isModified(`config.${section}.${item}`)) {
          this.markModified(`config.${section}.${item}`);
        }
      });

      if (this.isModified(`config.${section}`)) {
        this.markModified(`config.${section}`);
      }
    });

    if (this.isModified('config')) {
      this.markModified('config');
    }
  }
  next();
});

// Añadir métodos de utilidad al schema
rutinaSchema.methods.resetearProgresoPeriodo = function(section, item) {
  if (this.config[section]?.[item]) {
    this.config[section][item].progresoActual = 0;
    this.config[section][item].completacionesPeriodo = [];
  }
};

rutinaSchema.methods.actualizarProgreso = function(section, item, fecha = new Date()) {
  const config = this.config[section]?.[item];
  if (!config) return;

  const ahora = new Date(fecha);
  const ultimoPeriodo = config.ultimoPeriodo || {};
  
  // Determinar si necesitamos resetear el progreso
  const necesitaReset = this.necesitaResetearProgreso(config, ahora);
  
  if (necesitaReset) {
    this.resetearProgresoPeriodo(section, item);
    // Actualizar período
    config.ultimoPeriodo = {
      inicio: getRutinaPeriodStart(config, ahora),
      fin: getRutinaPeriodEnd(config, ahora)
    };
  }

  // Incrementar progreso
  config.progresoActual = (config.progresoActual || 0) + 1;
  config.completacionesPeriodo.push({
    fecha: ahora,
    valor: config.progresoActual
  });
};

rutinaSchema.methods.necesitaResetearProgreso = function(config, fecha) {
  if (!config.ultimoPeriodo?.inicio) return true;

  const inicioPeriodoActual = getRutinaPeriodStart(config, fecha);
  return new Date(config.ultimoPeriodo.inicio) < inicioPeriodoActual;
};

rutinaSchema.methods.obtenerInicioPeriodo = function(config, fecha) {
  return getRutinaPeriodStart(config, fecha);
};

rutinaSchema.methods.obtenerFinPeriodo = function(config, fecha) {
  return getRutinaPeriodEnd(config, fecha);
};

export const Rutinas = mongoose.model('Rutinas', rutinaSchema); 
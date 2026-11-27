import mongoose from 'mongoose';
import { createSchema, commonFields } from './BaseSchema.js';

const transaccionRecurrenteSchema = createSchema({
  concepto: {
    type: String,
    required: true
  },
  monto: {
    type: Number,
    required: true
  },
  diaVencimiento: {
    type: Number,
    required: true,
    min: 1,
    max: 31
  },
  moneda: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Monedas',
    required: true
  }
});

const cuotaMensualSchema = createSchema({
  mes: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  año: {
    type: Number,
    required: true
  },
  monto: {
    type: Number,
    required: true,
    min: 0
  },
  fechaVencimiento: {
    type: Date,
    required: true
  },
  estado: {
    type: String,
    enum: ['PENDIENTE', 'PAGADO', 'VENCIDO', 'VENCIDA'],
    default: 'PENDIENTE'
  },
  observaciones: String
});

const contratoSchema = createSchema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  inquilino: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inquilinos'
    }],
    validate: {
      validator: function(v) {
        const esMantenimiento = this.tipoContrato === 'MANTENIMIENTO' || this.esMantenimiento === true;
        console.log('Validando inquilino:', {
          tipoContrato: this.tipoContrato,
          esMantenimiento: this.esMantenimiento,
          esMantenimientoCalculado: esMantenimiento,
          inquilinos: v,
          esArray: Array.isArray(v),
          longitud: Array.isArray(v) ? v.length : 'no es array',
          resultado: !esMantenimiento || (Array.isArray(v) && v.length === 0)
        });
        // Si es mantenimiento, debe tener array vacío
        if (esMantenimiento) {
          return Array.isArray(v) && v.length === 0;
        }
        // Si no es mantenimiento, debe tener al menos un inquilino
        return Array.isArray(v) && v.length > 0;
      },
      message: function(props) {
        const esMantenimiento = this.tipoContrato === 'MANTENIMIENTO' || this.esMantenimiento === true;
        if (esMantenimiento) {
          return 'Los contratos de mantenimiento no pueden tener inquilinos';
        }
        return 'Debe seleccionar al menos un inquilino para contratos de alquiler';
      }
    }
  },
  propiedad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Propiedades',
    required: true
  },
  esPorHabitacion: {
    type: Boolean,
    default: false
  },
  habitacion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Habitaciones',
    required: function() {
      return this.esPorHabitacion;
    }
  },
  cuenta: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cuentas',
    required: function() {
      const esMantenimiento = this.tipoContrato === 'MANTENIMIENTO' || this.esMantenimiento === true;
      console.log('Validando required cuenta:', {
        tipoContrato: this.tipoContrato,
        esMantenimiento: this.esMantenimiento,
        esMantenimientoCalculado: esMantenimiento,
        resultado: !esMantenimiento
      });
      return !esMantenimiento;
    }
  },
  moneda: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Monedas',
    required: function() {
      const esMantenimiento = this.tipoContrato === 'MANTENIMIENTO' || this.esMantenimiento === true;
      console.log('Validando required moneda:', {
        tipoContrato: this.tipoContrato,
        esMantenimiento: this.esMantenimiento,
        esMantenimientoCalculado: esMantenimiento,
        resultado: !esMantenimiento
      });
      return !esMantenimiento;
    }
  },
  fechaInicio: {
    type: Date,
    required: true
  },
  fechaFin: {
    type: Date
  },
  tipoContrato: {
    type: String,
    enum: ['ALQUILER', 'MANTENIMIENTO'],
    default: 'ALQUILER',
    required: true
  },
  esMantenimiento: {
    type: Boolean,
    default: false
  },
  estado: {
    type: String,
    enum: ['ACTIVO', 'PLANEADO', 'FINALIZADO', 'MANTENIMIENTO'],
    default: 'PLANEADO'
  },
  // Nuevo campo: precio total del contrato
  precioTotal: {
    type: Number,
    required: function() {
      const esMantenimiento = this.tipoContrato === 'MANTENIMIENTO' || this.esMantenimiento === true;
      console.log('Validando required precioTotal:', {
        tipoContrato: this.tipoContrato,
        esMantenimiento: this.esMantenimiento,
        esMantenimientoCalculado: esMantenimiento,
        resultado: !esMantenimiento
      });
      return !esMantenimiento;
    },
    min: 0,
    validate: {
      validator: function(v) {
        const esMantenimiento = this.tipoContrato === 'MANTENIMIENTO' || this.esMantenimiento === true;
        console.log('Validando precioTotal:', v, 'tipo:', typeof v, 'es number:', typeof v === 'number', 'es >= 0:', v >= 0, 'esMantenimiento:', esMantenimiento);
        
        // Si es mantenimiento, permitir 0 o null/undefined
        if (esMantenimiento) {
          return v === null || v === undefined || v === 0 || (typeof v === 'number' && v >= 0);
        }
        
        // Si no es mantenimiento, debe ser un número mayor a 0
        return typeof v === 'number' && v > 0;
      },
      message: function(props) {
        const esMantenimiento = this.tipoContrato === 'MANTENIMIENTO' || this.esMantenimiento === true;
        if (esMantenimiento) {
          return 'El precio total debe ser 0 para contratos de mantenimiento';
        }
        return 'El precio total debe ser un número mayor a 0 para contratos de alquiler';
      }
    }
  },
  // Campo calculado: alquiler mensual promedio
  alquilerMensualPromedio: {
    type: Number,
    min: 0
  },
  deposito: {
    type: Number,
    min: 0
  },
  observaciones: String,
  documentoUrl: String,
  transaccionesRecurrentes: [transaccionRecurrenteSchema],
  // Nuevo campo: cuotas mensuales autogeneradas
  cuotasMensuales: [cuotaMensualSchema],
  ...commonFields
}, {
  timestamps: true
});

// Función auxiliar para determinar si un contrato es de mantenimiento
function esContratoMantenimiento(contrato) {
  const resultado = contrato.tipoContrato === 'MANTENIMIENTO' || contrato.esMantenimiento === true;
  console.log('esContratoMantenimiento DEBUG:', {
    tipoContrato: contrato.tipoContrato,
    tipoTipoContrato: typeof contrato.tipoContrato,
    esMantenimiento: contrato.esMantenimiento,
    tipoEsMantenimiento: typeof contrato.esMantenimiento,
    condicion1: contrato.tipoContrato === 'MANTENIMIENTO',
    condicion2: contrato.esMantenimiento === true,
    resultado: resultado
  });
  return resultado;
}

// Middleware para calcular alquiler mensual promedio y generar cuotas
contratoSchema.pre('save', async function(next) {
  try {
    console.log('=== MIDDLEWARE PRE-SAVE 1 ===');
    console.log('this.tipoContrato:', this.tipoContrato);
    console.log('this.esMantenimiento:', this.esMantenimiento);
    console.log('esContratoMantenimiento(this):', esContratoMantenimiento(this));
    console.log('this.precioTotal antes:', this.precioTotal);
    
    // Si es mantenimiento, no generar cuotas
    if (esContratoMantenimiento(this)) {
      console.log('Contrato es de mantenimiento, estableciendo precioTotal = 0');
      this.precioTotal = 0;
      this.alquilerMensualPromedio = 0;
      this.cuotasMensuales = [];
      next();
      return;
    }

    // Calcular duración del contrato en meses
    if (this.fechaInicio && this.fechaFin && this.precioTotal) {
      const inicio = new Date(this.fechaInicio);
      const fin = new Date(this.fechaFin);
      const mesesTotales = (fin.getFullYear() - inicio.getFullYear()) * 12 + 
                          (fin.getMonth() - inicio.getMonth()) + 1;
      
      // Calcular alquiler mensual promedio
      this.alquilerMensualPromedio = Math.round((this.precioTotal / mesesTotales) * 100) / 100;
      
      // Generar cuotas mensuales si no existen o si las fechas cambiaron
      if (!this.cuotasMensuales || this.cuotasMensuales.length === 0 || 
          this.isModified('fechaInicio') || this.isModified('fechaFin') || this.isModified('precioTotal')) {
        
        this.cuotasMensuales = [];
        const montoPorCuota = this.alquilerMensualPromedio;
        
        for (let i = 0; i < mesesTotales; i++) {
          const fechaCuota = new Date(inicio);
          fechaCuota.setMonth(inicio.getMonth() + i);
          
          // Ajustar el monto de la última cuota para compensar redondeos
          let montoCuota = montoPorCuota;
          if (i === mesesTotales - 1) {
            const montoAcumulado = montoPorCuota * (mesesTotales - 1);
            montoCuota = this.precioTotal - montoAcumulado;
          }
          
          this.cuotasMensuales.push({
            mes: fechaCuota.getMonth() + 1,
            año: fechaCuota.getFullYear(),
            monto: Math.round(montoCuota * 100) / 100,
            fechaVencimiento: new Date(fechaCuota.getFullYear(), fechaCuota.getMonth(), 1),
            estado: 'PENDIENTE'
          });
        }
      }
    }
    
    console.log('=== FIN MIDDLEWARE PRE-SAVE 1 (DESHABILITADO) ===');
    console.log('this.precioTotal después:', this.precioTotal);
    
    next();
  } catch (error) {
    console.log('=== ERROR EN MIDDLEWARE PRE-SAVE 1 ===');
    console.log('Error:', error);
    next(error);
  }
});

// Middleware para validar y actualizar estados
contratoSchema.pre('save', async function(next) {
  try {
    console.log('=== MIDDLEWARE PRE-SAVE 2 ===');
    console.log('this.tipoContrato:', this.tipoContrato);
    console.log('this.esMantenimiento:', this.esMantenimiento);
    console.log('esContratoMantenimiento(this):', esContratoMantenimiento(this));
    console.log('this.precioTotal antes:', this.precioTotal);
    
    const now = new Date();
    // Validar fechas
    if (this.fechaFin && this.fechaInicio > this.fechaFin) {
      throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
    }
    
    // Calcular el estado basado en fechas
    const inicio = new Date(this.fechaInicio);
    const fin = new Date(this.fechaFin);
    inicio.setHours(0,0,0,0);
    fin.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    
    // Si es un contrato de mantenimiento
    if (esContratoMantenimiento(this)) {
      console.log('Contrato es de mantenimiento, estableciendo precioTotal = 0');
      this.precioTotal = 0;
      this.alquilerMensualPromedio = 0;
      this.inquilino = [];
      
      // Determinar estado del contrato de mantenimiento
      if (inicio <= now && fin > now) {
        this.estado = 'MANTENIMIENTO';
      } else if (inicio > now) {
        this.estado = 'PLANEADO';
      } else {
        this.estado = 'FINALIZADO';
      }
      
      // Actualizar estado de la propiedad a MANTENIMIENTO si está activo
      if (this.estado === 'MANTENIMIENTO') {
        const Propiedades = mongoose.model('Propiedades');
        const propiedad = await Propiedades.findById(this.propiedad);
        if (propiedad) {
          propiedad.estado = ['MANTENIMIENTO'];
          await propiedad.save();
        }
      }
      next();
      return;
    }
    
    // Para contratos de alquiler
    this.tipoContrato = this.tipoContrato || 'ALQUILER';
    
    // Validar que los inquilinos existan y estén asignados a la propiedad (solo para contratos de alquiler)
    if (this.inquilino && this.inquilino.length > 0) {
      const Inquilinos = mongoose.model('Inquilinos');
      for (const inquilinoId of this.inquilino) {
        const inquilino = await Inquilinos.findById(inquilinoId);
        if (!inquilino) {
          throw new Error(`El inquilino ${inquilinoId} no existe`);
        }
      }
    }
    
    // Determinar estado del contrato de alquiler
    if (inicio <= now && fin > now) {
      this.estado = 'ACTIVO';
      // Actualizar estado de inquilinos a ACTIVO (solo si hay inquilinos)
      if (this.inquilino && this.inquilino.length > 0) {
        const Inquilinos = mongoose.model('Inquilinos');
        for (const inquilinoId of this.inquilino) {
          const inquilino = await Inquilinos.findById(inquilinoId);
          if (inquilino) {
            inquilino.estado = 'ACTIVO';
            await inquilino.save();
          }
        }
      }
      // Actualizar estado de la propiedad a OCUPADA
      const Propiedades = mongoose.model('Propiedades');
      const propiedad = await Propiedades.findById(this.propiedad);
      if (propiedad) {
        propiedad.estado = ['OCUPADA'];
        await propiedad.save();
      }
    } else if (inicio > now) {
      this.estado = 'PLANEADO';
      // Actualizar estado de inquilinos a RESERVADO (solo si hay inquilinos)
      if (this.inquilino && this.inquilino.length > 0) {
        const Inquilinos = mongoose.model('Inquilinos');
        for (const inquilinoId of this.inquilino) {
          const inquilino = await Inquilinos.findById(inquilinoId);
          if (inquilino) {
            inquilino.estado = 'RESERVADO';
            await inquilino.save();
          }
        }
      }
      // Actualizar estado de la propiedad a RESERVADA
      const Propiedades = mongoose.model('Propiedades');
      const propiedad = await Propiedades.findById(this.propiedad);
      if (propiedad) {
        propiedad.estado = ['RESERVADA'];
        await propiedad.save();
      }
    } else if (fin <= now) {
      this.estado = 'FINALIZADO';
      // Actualizar estado de inquilinos a INACTIVO (solo si hay inquilinos)
      if (this.inquilino && this.inquilino.length > 0) {
        const Inquilinos = mongoose.model('Inquilinos');
        for (const inquilinoId of this.inquilino) {
          const inquilino = await Inquilinos.findById(inquilinoId);
          if (inquilino) {
            inquilino.estado = 'INACTIVO';
            await inquilino.save();
          }
        }
      }
      // Actualizar estado de la propiedad a DISPONIBLE
      const Propiedades = mongoose.model('Propiedades');
      const propiedad = await Propiedades.findById(this.propiedad);
      if (propiedad) {
        propiedad.estado = ['DISPONIBLE'];
        await propiedad.save();
      }
    }
    
    console.log('=== FIN MIDDLEWARE PRE-SAVE 2 ===');
    console.log('this.precioTotal después:', this.precioTotal);
    console.log('this.estado:', this.estado);
    
    next();
  } catch (error) {
    console.log('=== ERROR EN MIDDLEWARE PRE-SAVE 2 ===');
    console.log('Error:', error);
    next(error);
  }
});

// Middleware para generar transacciones automáticamente
contratoSchema.pre('save', async function(next) {
  if ((this.isNew || this.isModified('transaccionesRecurrentes'))) {
    try {
      // Calcular el estado actual manualmente para evitar problemas con virtuals
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const inicio = new Date(this.fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      
      let estadoActual = 'PLANEADO';
      if (this.fechaFin) {
        const fin = new Date(this.fechaFin);
        fin.setHours(0, 0, 0, 0);
        
        if (this.tipoContrato === 'MANTENIMIENTO' || this.esMantenimiento === true) {
          if (inicio <= now && fin > now) {
            estadoActual = 'MANTENIMIENTO';
          } else if (inicio > now) {
            estadoActual = 'PLANEADO';
          } else {
            estadoActual = 'FINALIZADO';
          }
        } else {
          if (inicio <= now && fin > now) {
            estadoActual = 'ACTIVO';
          } else if (inicio > now) {
            estadoActual = 'PLANEADO';
          } else {
            estadoActual = 'FINALIZADO';
          }
        }
      } else {
        if (inicio <= now) {
          estadoActual = this.tipoContrato === 'MANTENIMIENTO' ? 'MANTENIMIENTO' : 'ACTIVO';
        } else {
          estadoActual = 'PLANEADO';
        }
      }
      
      if (estadoActual === 'ACTIVO' && (this.transaccionesRecurrentes || []).length > 0) {
        if (!this.cuenta) {
          // Las transacciones exigen cuenta: sin ella no se pueden generar cuotas.
          console.warn('Contrato sin cuenta: no se generan transacciones recurrentes', this._id);
        } else {
          const Transacciones = mongoose.model('Transacciones');
          const fechaActual = new Date();
          const inicio = new Date(this.fechaInicio);
          const fechaFin = this.fechaFin || new Date(fechaActual.getFullYear() + 1, fechaActual.getMonth(), fechaActual.getDate());

          // Un mes por vuelta (por índice, sin arrastrar el día) hasta la fecha de fin.
          let anio = inicio.getFullYear();
          let mes = inicio.getMonth();
          while (new Date(anio, mes, 1) <= fechaFin) {
            const ultimoDia = new Date(anio, mes + 1, 0).getDate();
            for (const transaccion of this.transaccionesRecurrentes) {
              const fecha = new Date(anio, mes, Math.min(transaccion.diaVencimiento, ultimoDia), 12);
              // Idempotente: guardar el contrato otra vez no duplica cuotas ya generadas.
              const existente = await Transacciones.exists({
                contrato: this._id,
                descripcion: transaccion.concepto,
                fecha,
              });
              if (existente) continue;
              await Transacciones.create({
                descripcion: transaccion.concepto,
                monto: transaccion.monto,
                fecha,
                categoria: 'Alquiler',
                estado: 'PENDIENTE',
                tipo: 'INGRESO',
                usuario: this.usuario,
                cuenta: this.cuenta,
                moneda: transaccion.moneda,
                contrato: this._id
              });
            }
            mes += 1;
            if (mes > 11) {
              mes = 0;
              anio += 1;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error al generar transacciones:', error);
      return next(error);
    }
  }
  next();
});

// Middleware para validar que el usuario tenga acceso a la propiedad
contratoSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('propiedad')) {
    try {
      const Propiedades = mongoose.model('Propiedades');
      const propiedad = await Propiedades.findById(this.propiedad);
      
      if (!propiedad) {
        throw new Error('La propiedad especificada no existe');
      }
      
      // Verificar que la propiedad tenga un usuario asignado
      if (!propiedad.usuario) {
        throw new Error('La propiedad no tiene un usuario asignado');
      }
      
      // Comparar los IDs de usuario
      const propiedadUserId = propiedad.usuario.toString();
      const contratoUserId = this.usuario.toString();
      
      if (propiedadUserId !== contratoUserId) {
        throw new Error('No tienes permiso para crear contratos en esta propiedad');
      }
    } catch (error) {
      console.error('Error en validación de propiedad:', error);
      next(error);
    }
  } else {
    next();
  }
});

// Middleware para filtrar por usuario en las consultas
contratoSchema.pre(/^find/, function() {
  this.populate('propiedad').populate('inquilino');
  if (this._conditions.usuario) {
    const userId = this._conditions.usuario;
    this._conditions.$or = [
      { usuario: userId },
      { 'propiedad.usuario': userId }
    ];
  }
});

// Método estático para obtener contratos activos de una propiedad
contratoSchema.statics.getContratosPropiedad = async function(propiedadId) {
  const now = new Date();
  return this.find({
    propiedad: propiedadId,
    $or: [
      // Contratos activos (en curso)
      {
        fechaInicio: { $lte: now },
        fechaFin: { $gt: now },
        estadoActual: 'ACTIVO'
      },
      // Contratos planeados (futuros)
      {
        fechaInicio: { $gt: now },
        estadoActual: 'PLANEADO'
      },
      // Contratos de mantenimiento activos
      {
        fechaInicio: { $lte: now },
        fechaFin: { $gt: now },
        esMantenimiento: true,
        estadoActual: 'MANTENIMIENTO'
      }
    ]
  }).sort({ fechaInicio: 1 });
};

// Relación virtual para obtener inquilinos con información completa
contratoSchema.virtual('inquilinosCompletos', {
  ref: 'Inquilinos',
  localField: 'inquilino',
  foreignField: '_id',
  justOne: false
});

// Relación virtual para obtener transacciones del contrato
contratoSchema.virtual('transacciones', {
  ref: 'Transacciones',
  localField: '_id',
  foreignField: 'contrato',
  justOne: false
});

// Virtual para calcular el estado actual basado en fechas
contratoSchema.virtual('estadoActual').get(function() {
  // Usar cache si está disponible
  if (this._estadoActualCache) {
    return this._estadoActualCache;
  }

  try {
    // Verificar que las fechas existan
    if (!this.fechaInicio) {
      this._estadoActualCache = this.estado || 'PLANEADO';
      return this._estadoActualCache;
    }

    // Normalizar fechas a medianoche
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const inicio = new Date(this.fechaInicio);
    inicio.setHours(0, 0, 0, 0);
    
    // Si no hay fecha de fin, considerar como activo si ya comenzó
    if (!this.fechaFin) {
      if (inicio <= now) {
        this._estadoActualCache = this.tipoContrato === 'MANTENIMIENTO' ? 'MANTENIMIENTO' : 'ACTIVO';
      } else {
        this._estadoActualCache = 'PLANEADO';
      }
      return this._estadoActualCache;
    }
    
    const fin = new Date(this.fechaFin);
    fin.setHours(0, 0, 0, 0);

    if (this.tipoContrato === 'MANTENIMIENTO' || this.esMantenimiento === true) {
      if (inicio <= now && fin > now) {
        this._estadoActualCache = 'MANTENIMIENTO';
      } else if (inicio > now) {
        this._estadoActualCache = 'PLANEADO';
      } else {
        this._estadoActualCache = 'FINALIZADO';
      }
    } else {
      if (inicio <= now && fin > now) {
        this._estadoActualCache = 'ACTIVO';
      } else if (inicio > now) {
        this._estadoActualCache = 'PLANEADO';
      } else {
        this._estadoActualCache = 'FINALIZADO';
    }
    }
    
    return this._estadoActualCache;
  } catch (error) {
    this._estadoActualCache = this.estado || 'PLANEADO';
    return this._estadoActualCache;
  }
});

// Virtual para verificar si el contrato está activo actualmente
contratoSchema.virtual('estaActivo').get(function() {
  const now = new Date();
  return this.fechaInicio <= now && this.fechaFin > now;
});

// Virtual para verificar si el contrato está planeado (futuro)
contratoSchema.virtual('estaPlaneado').get(function() {
  const now = new Date();
  return this.fechaInicio > now;
});

// Virtual para verificar si el contrato está finalizado
contratoSchema.virtual('estaFinalizado').get(function() {
  const now = new Date();
  return this.fechaFin <= now;
});

// Método para obtener información completa del contrato
contratoSchema.methods.getFullInfo = async function() {
  await this.populate([
    'propiedad',
    'inquilino',
    'habitacion',
    'cuenta',
    'moneda',
    'transacciones'
  ]);
  
  return this.toObject();
};

// Método estático para actualizar estados de todos los contratos
contratoSchema.statics.actualizarEstados = async function() {
  try {
    console.log('Iniciando actualización de estados de contratos...');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Obtener todos los contratos que no están explícitamente inactivos
    const contratos = await this.find({ 
      $or: [
        { activo: true },
        { activo: { $exists: false } },
        { activo: null },
        { activo: undefined }
      ]
    }).populate(['propiedad', 'inquilino']);
    console.log(`Procesando ${contratos.length} contratos...`);
    
    let actualizados = 0;
    
    for (const contrato of contratos) {
      try {
        // Calcular el estado actual basado en fechas
        const inicio = new Date(contrato.fechaInicio);
        const fin = new Date(contrato.fechaFin);
        inicio.setHours(0, 0, 0, 0);
        fin.setHours(0, 0, 0, 0);
        
        let nuevoEstado;
        if (contrato.tipoContrato === 'MANTENIMIENTO') {
          if (inicio <= now && fin > now) {
            nuevoEstado = 'MANTENIMIENTO';
          } else if (inicio > now) {
            nuevoEstado = 'PLANEADO';
          } else {
            nuevoEstado = 'FINALIZADO';
          }
        } else {
          if (inicio <= now && fin > now) {
            nuevoEstado = 'ACTIVO';
          } else if (inicio > now) {
            nuevoEstado = 'PLANEADO';
          } else {
            nuevoEstado = 'FINALIZADO';
          }
        }
        
        // Solo actualizar si el estado cambió
        if (contrato.estado !== nuevoEstado) {
          console.log(`Actualizando contrato ${contrato._id}: ${contrato.estado} -> ${nuevoEstado}`);
          
          // Actualizar estado del contrato usando findByIdAndUpdate para evitar validaciones
          await this.findByIdAndUpdate(contrato._id, { estado: nuevoEstado }, { new: true });
          
          // Actualizar estado de inquilinos
          if (contrato.inquilino && contrato.inquilino.length > 0) {
            for (const inquilinoId of contrato.inquilino) {
              const Inquilinos = mongoose.model('Inquilinos');
              const inquilino = await Inquilinos.findById(inquilinoId);
              if (inquilino) {
                let estadoInquilino;
                if (nuevoEstado === 'ACTIVO') {
                  estadoInquilino = 'ACTIVO';
                } else if (nuevoEstado === 'PLANEADO') {
                  estadoInquilino = 'RESERVADO';
                } else {
                  estadoInquilino = 'INACTIVO';
                }
                
                if (inquilino.estado !== estadoInquilino) {
                  inquilino.estado = estadoInquilino;
                  await inquilino.save();
                }
              }
            }
          }
          
          // Actualizar estado de la propiedad
          if (contrato.propiedad) {
            const Propiedades = mongoose.model('Propiedades');
            const propiedad = await Propiedades.findById(contrato.propiedad._id);
            if (propiedad) {
              let estadoPropiedad;
              if (nuevoEstado === 'ACTIVO') {
                estadoPropiedad = contrato.tipoContrato === 'MANTENIMIENTO' ? ['MANTENIMIENTO'] : ['OCUPADA'];
              } else if (nuevoEstado === 'PLANEADO') {
                estadoPropiedad = ['RESERVADA'];
              } else if (nuevoEstado === 'MANTENIMIENTO') {
                estadoPropiedad = ['MANTENIMIENTO'];
              } else {
                // Verificar si hay otros contratos activos para esta propiedad
                const otrosContratosActivos = await this.countDocuments({
                  propiedad: propiedad._id,
                  _id: { $ne: contrato._id },
                  $or: [
                    { estado: 'ACTIVO' },
                    { estado: 'MANTENIMIENTO' },
                    { estado: 'PLANEADO' }
                  ]
                });
                
                if (otrosContratosActivos === 0) {
                  estadoPropiedad = ['DISPONIBLE'];
                } else {
                  // Mantener el estado actual si hay otros contratos
                  estadoPropiedad = propiedad.estado;
                }
              }
              
              if (JSON.stringify(propiedad.estado) !== JSON.stringify(estadoPropiedad)) {
                propiedad.estado = estadoPropiedad;
                await propiedad.save();
              }
            }
          }
          
          actualizados++;
        }
      } catch (error) {
        console.error(`Error actualizando contrato ${contrato._id}:`, error);
      }
    }
    
    console.log(`Actualización completada. ${actualizados} contratos actualizados.`);
    return { procesados: contratos.length, actualizados };
    
  } catch (error) {
    console.error('Error en actualización de estados:', error);
    throw error;
  }
};

export const Contratos = mongoose.model('Contratos', contratoSchema); 
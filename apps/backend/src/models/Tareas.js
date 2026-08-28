import mongoose from 'mongoose';
import { createSchema, commonFields } from './BaseSchema.js';

const subtareaSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  completada: {
    type: Boolean,
    default: false
  },
  // @deprecated Subtareas viven en el campo notes de la tarea padre en Google Tasks (no como Tasks hijas).
  googleTaskId: {
    type: String,
    default: null
  },
  lastSyncDate: {
    type: Date,
    default: null
  },
  ...commonFields
});

const tareaSchema = createSchema({
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    trim: true
  },
  estado: {
    type: String,
    enum: ['PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA'],
    default: 'PENDIENTE'
  },
  tipo: {
    type: String,
    enum: ['TAREA', 'EVENTO'],
    default: 'TAREA',
  },
  fechaInicio: {
    type: Date,
    required: true,
    default: Date.now,
    validate: {
      validator: function(value) {
        return value instanceof Date && !isNaN(value);
      },
      message: 'La fecha de inicio debe ser una fecha válida'
    }
  },
  fechaFin: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || (value instanceof Date && !isNaN(value));
      },
      message: 'La fecha de fin debe ser una fecha válida'
    }
  },
  fechaVencimiento: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || (value instanceof Date && !isNaN(value));
      },
      message: 'La fecha de vencimiento debe ser una fecha válida'
    }
  },
  subtareas: [subtareaSchema],
  objetivo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Objetivos',
    required: false
  },
  serieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TareaSeries',
    default: null,
  },
  esExcepcionSerie: {
    type: Boolean,
    default: false,
  },
  /** Fechas due históricas vistas en sync (Google solo expone la actual). */
  googleDueHistory: [{
    type: Date,
  }],
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  /** Creador + co-owners (Delegar agrega usuarios aquí; `usuario` permanece el creador). */
  owners: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
  }],
  prioridad: {
    type: String,
    enum: ['BAJA', 'ALTA'],
    default: 'BAJA'
  },
  completada: {
    type: Boolean,
    default: false
  },
  archivos: [{
    nombre: String,
    url: String,
    tipo: String
  }],
  orden: {
    type: Number,
    default: 0
  },
  // Campos para integración completa con Google Tasks API
  googleTasksSync: {
    enabled: {
      type: Boolean,
      default: false
    },
    // Campos principales de Google Tasks
    googleTaskId: String, // ID único de la tarea en Google Tasks
    googleTaskListId: String, // ID de la lista en Google Tasks donde está la tarea
    
    // Campos de posición y jerarquía
    position: String, // Posición de la tarea en la lista (para ordenamiento)
    /** @deprecated Modelo notes-only: las subtareas no se exportan como tasks hijas con parent. */
    parent: String,
    
    // Campos de fechas según Google Tasks
    completed: Date, // Fecha y hora de finalización (cuando se marca como completada)
    updated: Date, // Fecha de última modificación en Google Tasks
    
    // Campos de sincronización
    lastSyncDate: Date,
    syncStatus: {
      type: String,
      enum: ['pending', 'syncing', 'synced', 'error', 'unlinked'],
      default: 'pending'
    },
    syncingStartedAt: Date, // Timestamp cuando comenzó la sincronización
    syncErrors: [String], // Array de errores de sincronización
    
    // Metadatos adicionales
    etag: String, // ETag de Google Tasks para control de versiones
    kind: {
      type: String,
      default: 'tasks#task'
    }, // Tipo de recurso de Google Tasks
    selfLink: String, // URL de la tarea en Google Tasks
    
    // Campos para manejo de conflictos
    localVersion: {
      type: Number,
      default: 1
    }, // Versión local para detectar conflictos
    needsSync: {
      type: Boolean,
      default: false
    }, // Flag para marcar tareas que necesitan sincronización
    hasTimedSchedule: {
      type: Boolean,
      default: false,
    },
  },
  googleCalendarSync: {
    googleEventId: String,
    googleCalendarId: String,
    etag: String,
    htmlLink: String,
    status: {
      type: String,
      enum: ['confirmed', 'tentative', 'cancelled'],
      default: 'confirmed',
    },
    eventType: {
      type: String,
      default: 'default',
    },
    lastSyncDate: Date,
  },
  ...commonFields
});

// Middleware para inicializar Google Tasks sync en tareas nuevas
tareaSchema.pre('save', function(next) {
  // Solo para tareas nuevas que no tienen googleTasksSync configurado
  if (this.isNew && !this.googleTasksSync) {
    this.googleTasksSync = {
      enabled: false, // Se habilitará cuando el usuario active Google Tasks
      syncStatus: 'pending',
      needsSync: false,
      localVersion: 1
    };
  }
  
  // Marcar para sincronización si la tarea fue modificada localmente (no en import desde Google)
  if (
    !this.isNew
    && this.isModified()
    && this.googleTasksSync?.enabled
    && !this.$locals?.skipGoogleSyncMark
  ) {
    this.googleTasksSync.needsSync = true;
    this.googleTasksSync.localVersion = (this.googleTasksSync.localVersion || 0) + 1;
    this.googleTasksSync.syncStatus = 'pending';
  }
  
  next();
});

// Middleware para mapear estados entre Google Tasks y nuestra app
tareaSchema.methods.toGoogleTaskFormat = function() {
  const due = this.fechaVencimiento || this.fechaInicio;
  return {
    id: this.googleTasksSync?.googleTaskId,
    title: this.titulo,
    notes: this.descripcion || '',
    status: this.completada ? 'completed' : 'needsAction',
    due: due ? Tareas.formatGoogleDueDateOnly(due) : null,
    completed: this.completada && this.googleTasksSync?.completed ? this.googleTasksSync.completed.toISOString() : null,
    parent: this.googleTasksSync?.parent || null,
    position: this.googleTasksSync?.position || null,
    updated: this.googleTasksSync?.updated || this.updatedAt
  };
};

// Método para verificar si la sincronización está bloqueada por timeout
tareaSchema.methods.isSyncTimedOut = function() {
  if (this.googleTasksSync?.syncStatus !== 'syncing') return false;
  
  const syncingStartedAt = this.googleTasksSync?.syncingStartedAt;
  if (!syncingStartedAt) return true; // Si no hay timestamp, considerar timeout
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return syncingStartedAt < fiveMinutesAgo;
};

// Método para limpiar estado de sincronización bloqueado
tareaSchema.methods.clearSyncTimeout = function() {
  if (this.isSyncTimedOut()) {
    this.googleTasksSync.syncStatus = 'pending';
    this.googleTasksSync.syncingStartedAt = null;
    this.googleTasksSync.syncErrors = [];
  }
};

// Fusiona subtareas parseadas desde el campo notes de Google Tasks
tareaSchema.methods.mergeSubtareasFromParsed = function(parsedSubtareas = []) {
  if (!parsedSubtareas.length) {
    return;
  }
  const normalize = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  const merged = [...(this.subtareas || [])];
  for (const incoming of parsedSubtareas) {
    const norm = normalize(incoming.titulo);
    const found = merged.find((st) => normalize(st.titulo) === norm);
    if (found) {
      found.titulo = incoming.titulo;
      found.completada = incoming.completada;
      found.lastSyncDate = new Date();
    } else {
      merged.push({
        titulo: incoming.titulo,
        completada: incoming.completada,
        lastSyncDate: new Date()
      });
    }
  }
  const parsedNorms = new Set(parsedSubtareas.map((s) => normalize(s.titulo)));
  this.subtareas = merged.filter((st) => parsedNorms.has(normalize(st.titulo)));
};

tareaSchema.methods.recordGoogleDueSnapshot = function recordGoogleDueSnapshot(dueDate) {
  if (!dueDate || isNaN(dueDate.getTime())) return;
  const history = Array.isArray(this.googleDueHistory) ? [...this.googleDueHistory] : [];
  const exists = history.some((d) => {
    const prev = d instanceof Date ? d : new Date(d);
    return (
      prev.getFullYear() === dueDate.getFullYear()
      && prev.getMonth() === dueDate.getMonth()
      && prev.getDate() === dueDate.getDate()
    );
  });
  if (!exists) {
    history.push(dueDate);
    this.googleDueHistory = history;
  }
};

// Método para actualizar desde Google Tasks
tareaSchema.methods.updateFromGoogleTask = function(googleTask, parsedNotes = null) {
  // Limpiar título: remover prefijos entre corchetes y espacios extra
  const cleanedTitle = String(googleTask.title || this.titulo || 'Tarea importada')
    .replace(/^\s*(\[[^\]]+\]\s*)+/g, '')
    .replace(/\s+(\[[^\]]+\])\s+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  this.titulo = cleanedTitle || 'Tarea importada';

  if (parsedNotes) {
    this.descripcion = parsedNotes.descripcion ?? '';
    if (parsedNotes.subtareas?.length) {
      this.mergeSubtareasFromParsed(parsedNotes.subtareas);
    }
  } else {
    this.descripcion = googleTask.notes || this.descripcion;
  }

  this.completada = googleTask.status === 'completed';
  this.estado = googleTask.status === 'completed' ? 'COMPLETADA' : 'PENDIENTE';

  // Fechas: las gestiona mergeGoogleDueWithLocalSchedule en applyGoogleStatusAndDue.
  if (googleTask.due && typeof this.recordGoogleDueSnapshot === 'function') {
    const dueDate = this.constructor.parseGoogleDueDate(googleTask.due);
    if (dueDate) this.recordGoogleDueSnapshot(dueDate);
  }
  
  // Actualizar campos de Google Tasks
  if (!this.googleTasksSync) this.googleTasksSync = {};
  
  this.googleTasksSync.googleTaskId = googleTask.id;
  this.googleTasksSync.updated = googleTask.updated ? new Date(googleTask.updated) : new Date();
  this.googleTasksSync.completed = googleTask.completed ? new Date(googleTask.completed) : null;
  this.googleTasksSync.parent = null;
  this.googleTasksSync.position = googleTask.position || null;
  this.googleTasksSync.etag = googleTask.etag || null;
  this.googleTasksSync.selfLink = googleTask.selfLink || null;
  this.googleTasksSync.lastSyncDate = new Date();
  this.googleTasksSync.syncStatus = 'synced';
  this.googleTasksSync.needsSync = false;
  this.googleTasksSync.enabled = true;
  this.googleTasksSync.syncingStartedAt = null; // Limpiar timestamp de sincronización
};

// Middleware para validar fechas
tareaSchema.pre('save', function(next) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Si no hay fecha de inicio, establecer a hoy (excepto Google Tasks sin due).
  if (!this.fechaInicio) {
    const isGoogleUndated = Boolean(
      this.googleTasksSync?.googleTaskId && !this.fechaVencimiento,
    );
    if (!isGoogleUndated) {
      this.fechaInicio = today;
    }
  }

  // Validar que la fecha de inicio no sea anterior a hoy si es nueva tarea
  // (excepto instancias de series o import Google: conservar due histórico)
  if (
    this.isNew
    && !this.serieId
    && this.fechaInicio < today
    && !this.googleTasksSync?.googleTaskId
  ) {
    this.fechaInicio = today;
  }

  // Validar que la fecha de fin sea posterior a la fecha de inicio
  if (this.fechaFin && this.fechaInicio > this.fechaFin) {
    next(new Error('La fecha de fin debe ser posterior a la fecha de inicio'));
  }

  // Validar que la fecha de vencimiento sea posterior a la fecha de inicio
  // Solo validar si ambas fechas existen y no estamos en modo de sincronización
  if (this.fechaVencimiento && this.fechaInicio && 
      this.fechaInicio > this.fechaVencimiento && 
      !this.isModified('googleTasksSync')) {
    next(new Error('La fecha de vencimiento debe ser posterior a la fecha de inicio'));
  }

  next();
});

// subtareas están embebidas en el documento Tareas (no son ref); no usar populate.

// Middleware para validar actualizaciones parciales
tareaSchema.pre('findOneAndUpdate', async function() {
  const docToUpdate = await this.model.findOne(this.getQuery());
  if (!docToUpdate) return;

  const update = this.getUpdate();
  
  // Si hay subtareas en la actualización, manejar correctamente
  if (update.subtareas) {
    // Si las subtareas vienen como un array completo, usarlas tal como están
    if (Array.isArray(update.subtareas)) {
      // No modificar, usar las subtareas tal como vienen
      console.log('Actualizando subtareas completas:', update.subtareas.length);
    } else {
      // Si es una actualización parcial de subtareas, preservar las existentes
      update.subtareas = [
        ...docToUpdate.subtareas,
        ...update.subtareas.filter(st => 
          !docToUpdate.subtareas.some(existing => 
            existing._id.toString() === st._id?.toString()
          )
        )
      ];
    }
  }

  // Asegurar que el estado se actualice correctamente
  // Solo actualizar automáticamente si hay subtareas o si completada fue explícitamente establecido
  if (update.subtareas !== undefined || update.completada !== undefined) {
    const allSubtareas = update.subtareas !== undefined ? update.subtareas : docToUpdate.subtareas;
    
    // Solo calcular estado basado en subtareas si hay subtareas
    if (allSubtareas && allSubtareas.length > 0) {
      const todasCompletadas = allSubtareas.every(st => st.completada);
      const algunaCompletada = allSubtareas.some(st => st.completada);

      // Solo sobrescribir estado si no fue establecido explícitamente
      if (update.estado === undefined) {
        update.estado = todasCompletadas ? 'COMPLETADA' : 
                        algunaCompletada ? 'EN_PROGRESO' : 
                        'PENDIENTE';
      }
      // Solo sobrescribir completada si no fue establecido explícitamente
      if (update.completada === undefined) {
        update.completada = todasCompletadas;
      }
    } else if (update.completada !== undefined) {
      // Si no hay subtareas pero se establece completada explícitamente, respetar el estado enviado
      // No sobrescribir estado si ya fue establecido
      if (update.estado === undefined) {
        update.estado = update.completada ? 'COMPLETADA' : 'PENDIENTE';
      }
    } else if (update.subtareas !== undefined && (!allSubtareas || allSubtareas.length === 0)) {
      // Si se envía un array vacío de subtareas, no marcar como completada
      // Solo actualizar estado si no fue establecido explícitamente
      if (update.estado === undefined) {
        update.estado = 'PENDIENTE';
      }
      if (update.completada === undefined) {
        update.completada = false;
      }
    }
  }

  const patch = update.$set || update;
  const applyField = (key, value) => {
    if (update.$set) {
      update.$set[key] = value;
    } else {
      update[key] = value;
    }
  };

  const newObjetivoId = patch.objetivo;
  if (
    newObjetivoId
    && docToUpdate.objetivo
    && String(newObjetivoId) !== String(docToUpdate.objetivo)
  ) {
    const Objetivos = mongoose.model('Objetivos');
    const objetivo = await Objetivos.findById(newObjetivoId);
    const listId = objetivo?.googleTasksSync?.googleTaskListId;
    if (listId) {
      applyField('googleTasksSync.googleTaskListId', listId);
      const syncEnabled = patch.googleTasksSync?.enabled
        ?? docToUpdate.googleTasksSync?.enabled;
      if (syncEnabled) {
        applyField('googleTasksSync.needsSync', true);
        applyField('googleTasksSync.syncStatus', 'pending');
      }
    }
  }

  // findByIdAndUpdate bypasses pre('save'); mark Google export when status/completion changes
  const syncEnabled = patch['googleTasksSync.enabled']
    ?? patch.googleTasksSync?.enabled
    ?? docToUpdate.googleTasksSync?.enabled;
  if (syncEnabled) {
    const nextCompletada = patch.completada;
    const nextEstado = patch.estado;
    const completadaChanged = nextCompletada !== undefined
      && Boolean(nextCompletada) !== Boolean(docToUpdate.completada);
    const estadoChanged = nextEstado !== undefined
      && String(nextEstado) !== String(docToUpdate.estado || '');
    const subtareasTouched = update.subtareas !== undefined || patch.subtareas !== undefined;
    if (completadaChanged || estadoChanged || subtareasTouched) {
      applyField('googleTasksSync.needsSync', true);
      applyField('googleTasksSync.syncStatus', 'pending');
      const prevVersion = docToUpdate.googleTasksSync?.localVersion || 0;
      applyField('googleTasksSync.localVersion', prevVersion + 1);
    }
  }
});

// Middleware para validar que el objetivo pertenezca al usuario
tareaSchema.pre('save', async function(next) {
  if (this.objetivo && (this.isNew || this.isModified('objetivo'))) {
    try {
      const Objetivos = mongoose.model('Objetivos');
      const objetivo = await Objetivos.findById(this.objetivo);

      if (!objetivo) {
        throw new Error('El objetivo especificado no existe');
      }

      if (objetivo.usuario.toString() !== this.usuario.toString()) {
        throw new Error('La tarea debe pertenecer al mismo usuario que el objetivo');
      }

      const listId = objetivo.googleTasksSync?.googleTaskListId;
      if (listId) {
        if (!this.googleTasksSync) {
          this.googleTasksSync = { enabled: false };
        }
        const prevListId = this.googleTasksSync.googleTaskListId;
        this.googleTasksSync.googleTaskListId = listId;
        if (
          !this.isNew
          && this.isModified('objetivo')
          && prevListId
          && prevListId !== listId
          && this.googleTasksSync.enabled
        ) {
          this.googleTasksSync.needsSync = true;
          this.googleTasksSync.syncStatus = 'pending';
          this.googleTasksSync.localVersion = (this.googleTasksSync.localVersion || 0) + 1;
        }
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Middleware para actualizar el estado basado en subtareas
tareaSchema.pre('save', function(next) {
  // Solo actualizar automáticamente si las subtareas fueron modificadas o es nueva
  // Y solo si el estado no fue establecido explícitamente
  if (this.isModified('subtareas') || this.isNew) {
    if (this.subtareas && this.subtareas.length > 0) {
      const todasCompletadas = this.subtareas.every(st => st.completada);
      const algunaCompletada = this.subtareas.some(st => st.completada);

      // Solo actualizar estado si no fue modificado explícitamente
      if (!this.isModified('estado')) {
        if (todasCompletadas) {
          this.estado = 'COMPLETADA';
          this.completada = true;
        } else if (algunaCompletada) {
          this.estado = 'EN_PROGRESO';
          this.completada = false;
        } else {
          this.estado = 'PENDIENTE';
          this.completada = false;
        }
      } else {
        // Si el estado fue modificado explícitamente, solo actualizar completada basándose en subtareas
        // pero respetar el estado establecido
        if (!this.isModified('completada')) {
          this.completada = todasCompletadas;
        }
      }
    } else {
      // Si no hay subtareas, solo actualizar si no fue establecido explícitamente
      if (!this.isModified('estado')) {
        this.estado = 'PENDIENTE';
      }
      if (!this.isModified('completada')) {
        this.completada = false;
      }
    }
  }
  next();
});

// Middleware para actualizar el estado del objetivo cuando cambia el estado de la tarea
tareaSchema.post('save', async function() {
  if (!this.objetivo) return;
  try {
    const Objetivos = mongoose.model('Objetivos');
    const tareas = await mongoose.model('Tareas').find({ objetivo: this.objetivo });
    
    const todasCompletadas = tareas.every(tarea => tarea.estado === 'COMPLETADA');
    const algunaEnProgreso = tareas.some(tarea => tarea.estado === 'EN_PROGRESO' || tarea.estado === 'COMPLETADA');
    
    let nuevoEstado = 'PENDIENTE';
    if (todasCompletadas) {
      nuevoEstado = 'COMPLETADO';
    } else if (algunaEnProgreso) {
      nuevoEstado = 'EN_PROGRESO';
    }
    
    await Objetivos.findByIdAndUpdate(this.objetivo, { estado: nuevoEstado });
  } catch (error) {
    console.error('Error al actualizar estado del objetivo:', error);
  }
});

/** Fecha de Google Tasks → mediodía local (Google API solo guarda el día). */
tareaSchema.statics.parseGoogleDueDate = function parseGoogleDueDate(due) {
  if (!due) return null;
  const raw = String(due);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  const dt = new Date(due);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0, 0);
};

/** Export due date-only (RFC3339; Google descarta la hora). */
tareaSchema.statics.formatGoogleDueDateOnly = function formatGoogleDueDateOnly(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}T00:00:00.000Z`;
};

// Índices para acelerar las queries por rango de fechas de la agenda (Foco)
tareaSchema.index({ usuario: 1, fechaVencimiento: 1 });
tareaSchema.index({ usuario: 1, fechaInicio: 1 });
tareaSchema.index({ usuario: 1, estado: 1, fechaVencimiento: 1 });
// Rama EVENTO del overlap query de la agenda (fechaInicio <= to, fechaFin >= from)
tareaSchema.index({ usuario: 1, tipo: 1, fechaInicio: 1 });
tareaSchema.index({ serieId: 1 });
// Tareas por objetivo (panel de Objetivos): { objetivo, usuario }
tareaSchema.index({ usuario: 1, objetivo: 1 });
tareaSchema.index({ objetivo: 1 });
// Búsqueda directa por id de Google Tasks durante la sincronización
tareaSchema.index({ 'googleTasksSync.googleTaskId': 1 });
tareaSchema.index(
  {
    usuario: 1,
    'googleCalendarSync.googleEventId': 1,
    'googleCalendarSync.googleCalendarId': 1,
  },
  { unique: true, sparse: true },
);

export const Tareas = mongoose.model('Tareas', tareaSchema); 
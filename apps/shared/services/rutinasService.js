import clienteAxios from '../config/axios';
import axios from 'axios';
import { getNormalizedToday, toISODateString, normalizeDate, toLogicalDayUtcStart, toLogicalDayUtcEnd } from '../utils/dateUtils';
import { formatDateForAPI, getWeekRange, getMonthRange, parseAPIDate } from '../utils/dateUtils';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Servicio para manejar operaciones relacionadas con rutinas
 */
class RutinasService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;
    this.pendingRequests = new Map();
    this.LOCAL_PREFS_KEY = 'rutina_user_preferences';
  }

  async retryOperation(operation, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === retries - 1) throw error;
        console.warn(`Intento ${i + 1} fallido, reintentando en ${RETRY_DELAY}ms...`);
        await sleep(RETRY_DELAY * (i + 1));
      }
    }
  }

  /**
   * Obtener todas las rutinas
   * @param {Object} options - Opciones de consulta
   * @returns {Promise} Respuesta con las rutinas
   */
  async getRutinas(options = {}) {
    const timestamp = Date.now();
    const params = { _t: timestamp, ...options };
    
    try {
      const response = await clienteAxios.get('/api/rutinas', { params });
      return response.data;
    } catch (error) {
      console.error('Error al obtener rutinas:', error);
      throw error;
    }
  }

  // --- Preferencias locales (fallback/caché) ---
  getLocalUserPreferences() {
    try {
      const raw = localStorage.getItem(this.LOCAL_PREFS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  setLocalUserPreferences(preferences = {}) {
    try {
      localStorage.setItem(this.LOCAL_PREFS_KEY, JSON.stringify(preferences));
    } catch (_) {
      // noop
    }
  }

  mergeLocalUserPreference(section, itemId, config) {
    const prefs = this.getLocalUserPreferences();
    if (!prefs[section]) prefs[section] = {};
    prefs[section][itemId] = {
      ...prefs[section][itemId],
      ...config,
      tipo: (config?.tipo || 'DIARIO').toUpperCase(),
      frecuencia: Number(config?.frecuencia || 1),
      periodo: config?.periodo || 'CADA_DIA',
      activo: config?.activo !== false
    };
    this.setLocalUserPreferences(prefs);
    return prefs;
  }

  /**
   * Obtener una rutina específica por ID
   * @param {string} id - ID de la rutina
   * @returns {Promise} Respuesta con la rutina
   */
  async getRutinaById(id) {
    const timestamp = Date.now();
    
    try {
      const response = await clienteAxios.get(`/api/rutinas/${id}`, { 
        params: { _t: timestamp } 
      });
      return response.data;
    } catch (error) {
      console.error(`Error al obtener rutina ${id}:`, error);
      throw error;
    }
  }

  /**
   * Crear una nueva rutina
   * @param {Object} rutina - Datos de la rutina a crear
   * @returns {Promise} Respuesta con la rutina creada
   */
  async createRutina(rutina) {
    try {
      // Normalizar fecha a YYYY-MM-DD para consistencia con el backend
      const payload = { ...rutina };
      if (payload.fecha) {
        const ymd = formatDateForAPI(payload.fecha);
        if (ymd) payload.fecha = ymd;
      } else {
        // Si no se envía fecha, usar el día actual del usuario (evita ambigüedades)
        const today = getNormalizedToday();
        payload.fecha = formatDateForAPI(today);
      }

      const response = await clienteAxios.post('/api/rutinas', payload);
      return response.data;
    } catch (error) {
      // 409 = la rutina del día ya existe (respuesta idempotente esperada).
      // El caller la maneja (selecciona la existente), así que no es un error real.
      if (error?.response?.status !== 409) {
        console.error('Error al crear rutina:', error);
      }
      throw error;
    }
  }

  /**
   * Actualizar una rutina existente
   * @param {string} id - ID de la rutina
   * @param {Object} rutina - Datos actualizados de la rutina
   * @returns {Promise} Respuesta con la rutina actualizada
   */
  async updateRutina(id, rutina) {
    try {
      // Normalizar fecha si viene en el payload
      const payload = { ...rutina };
      if (payload.fecha) {
        const ymd = formatDateForAPI(payload.fecha);
        if (ymd) payload.fecha = ymd;
      }

      const response = await clienteAxios.put(`/api/rutinas/${id}`, payload);
      return response.data;
    } catch (error) {
      console.error(`Error al actualizar rutina ${id}:`, error);
      throw error;
    }
  }

  /**
   * Eliminar una rutina
   * @param {string} id - ID de la rutina a eliminar
   * @returns {Promise} Respuesta de la operación
   */
  async deleteRutina(id) {
    try {
      const response = await clienteAxios.delete(`/api/rutinas/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error al eliminar rutina ${id}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene el progreso actual de un ítem para el período actual
   * @param {Object} rutina - Rutina actual
   * @param {string} section - Sección del ítem
   * @param {string} itemId - ID del ítem
   * @returns {Object} Objeto con el progreso actual
   */
  obtenerProgresoItem(rutina, section, itemId) {
    try {
      const config = rutina?.config?.[section]?.[itemId];
      if (!config) return null;

      const ahora = new Date();
      const tipo = config.tipo || 'DIARIO';
      const frecuencia = config.frecuencia || 1;
      const progresoActual = config.progresoActual || 0;
      const ultimoPeriodo = config.ultimoPeriodo || {};

      // Verificar si estamos en un nuevo período
      const inicioPeriodo = this.calcularInicioPeriodo(tipo, ahora);
      const finPeriodo = this.calcularFinPeriodo(tipo, ahora);
      const enNuevoPeriodo = !ultimoPeriodo.inicio || new Date(ultimoPeriodo.inicio) < inicioPeriodo;

      // Obtener completaciones del período actual
      const completacionesPeriodo = config.completacionesPeriodo || [];
      const completacionesValidas = completacionesPeriodo.filter(c => 
        new Date(c.fecha) >= inicioPeriodo && new Date(c.fecha) <= finPeriodo
      );

      return {
        tipo,
        frecuencia,
        progresoActual: enNuevoPeriodo ? 0 : progresoActual,
        completacionesPeriodo: completacionesValidas,
        periodo: {
          inicio: inicioPeriodo,
          fin: finPeriodo
        },
        cumplido: progresoActual >= frecuencia,
        porcentaje: Math.min(100, (progresoActual / frecuencia) * 100)
      };
    } catch (error) {
      console.error('[RutinasService] Error al obtener progreso:', error);
      return null;
    }
  }

  /**
   * Calcula el inicio del período actual según el tipo
   * @param {string} tipo - Tipo de período (DIARIO, SEMANAL, MENSUAL)
   * @param {Date} fecha - Fecha de referencia
   * @returns {Date} Fecha de inicio del período
   */
  calcularInicioPeriodo(tipo, fecha) {
    const inicio = new Date(fecha);
    
    switch (tipo) {
      case 'SEMANAL':
        inicio.setDate(inicio.getDate() - inicio.getDay());
        break;
      case 'MENSUAL':
        inicio.setDate(1);
        break;
      default: // DIARIO
        inicio.setHours(0, 0, 0, 0);
    }
    
    return inicio;
  }

  /**
   * Calcula el fin del período actual según el tipo
   * @param {string} tipo - Tipo de período (DIARIO, SEMANAL, MENSUAL)
   * @param {Date} fecha - Fecha de referencia
   * @returns {Date} Fecha de fin del período
   */
  calcularFinPeriodo(tipo, fecha) {
    const fin = new Date(fecha);
    
    switch (tipo) {
      case 'SEMANAL':
        fin.setDate(fin.getDate() - fin.getDay() + 6);
        fin.setHours(23, 59, 59, 999);
        break;
      case 'MENSUAL':
        fin.setMonth(fin.getMonth() + 1);
        fin.setDate(0);
        fin.setHours(23, 59, 59, 999);
        break;
      default: // DIARIO
        fin.setHours(23, 59, 59, 999);
    }
    
    return fin;
  }

  /**
   * Verifica si un ítem está completado actualmente
   * @param {string} section - Sección del ítem
   * @param {string} itemId - ID del ítem
   * @returns {boolean} - true si el ítem está completado
   */
  isItemCompletado(section, itemId) {
    // Verificar en el caché local si el ítem está marcado como completado
    const cacheKey = `${section}_${itemId}_completado`;
    const estadoCache = this.cache.get(cacheKey);
    
    if (estadoCache !== undefined) {
      return estadoCache;
    }
    
    return false;
  }

  /**
   * Versión mejorada de markComplete que maneja el progreso
   */
  async markComplete(id, section, data) {
    let itemId;
    try {
      if (!id || !section || !data) {
        throw new Error('Parámetros inválidos');
      }

      itemId = Object.keys(data)[0];
      if (!itemId) throw new Error('No se proporcionó ID de ítem');
      
      const itemValue = data[itemId];
      
      // Detectar formato: objeto (nuevo formato con horarios) o boolean (legacy)
      const isObjectFormat = typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue);
      const isBooleanFormat = typeof itemValue === 'boolean';
      
      // Determinar si está completado para el caché y logs
      let isCompleted = false;
      if (isObjectFormat) {
        // Si es objeto, verificar si algún horario está completado
        isCompleted = Object.values(itemValue).some(Boolean);
      } else if (isBooleanFormat) {
        isCompleted = itemValue === true;
      }
      
      // Actualizar caché local inmediatamente
      const cacheKey = `${section}_${itemId}_completado`;
      this.cache.set(cacheKey, isCompleted);
      
      // Payload: enviar el valor tal cual (objeto o boolean)
      const payload = {
        [section]: {
          [itemId]: itemValue
        },
        _metadata: {
          timestamp: Date.now(),
          action: isCompleted ? 'COMPLETE' : 'UNCOMPLETE',
          format: isObjectFormat ? 'object' : 'boolean'
        }
      };

      const response = await clienteAxios.put(`/api/rutinas/${id}`, payload);
      
      if (response.data) {
        // Invalidar caché de historial
        this.invalidateCache(section, itemId);
        
        // Log simplificado: solo tick o cross
        return response.data;
      }

      throw new Error('No se recibió respuesta del servidor');
    } catch (error) {
      if (itemId) {
        this.cache.delete(`${section}_${itemId}_completado`);
      }
      
      console.error(`[RutinasService] ❌ Error al marcar completación:`, error);
      throw error;
    }
  }

  /**
   * Invalida la caché para una sección y ítem específicos
   */
  invalidateCache(section, itemId) {
    const keysToRemove = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${section}_${itemId}_`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => this.cache.delete(key));
  }

  // Nota: usar getHistorialCompletaciones (único método soportado)

  getCacheKey(section, itemId, fechaInicio, fechaFin) {
    // Implementa la lógica para generar una clave única para la caché basada en los parámetros
    return `${section}_${itemId}_${fechaInicio}_${fechaFin}`;
  }

  getFromCache(key) {
    // Implementa la lógica para obtener datos de la caché
    return this.cache.get(key);
  }

  setInCache(key, data) {
    // Implementa la lógica para almacenar datos en la caché
    this.cache.set(key, data);
  }

  async registrarCompletacion(rutinaId, seccion, itemId, completado = true) {
    try {
      const response = await clienteAxios.post(`/api/rutinas/${rutinaId}/completar`, {
        seccion,
        itemId,
        completado,
        timestamp: toISODateString(getNormalizedToday())
      });

      return response.data;
    } catch (error) {
      console.error('[rutinasService] Error al registrar completación:', error);
      throw error;
    }
  }

  async getHistorialCompletaciones(section, itemId, fechaInicio, fechaFin) {
    try {
      if (!section || !itemId) {
        throw new Error('section e itemId son requeridos');
      }

      const fechaInicioUTC = toLogicalDayUtcStart(fechaInicio || getNormalizedToday());
      const fechaFinUTC = toLogicalDayUtcEnd(fechaFin || getNormalizedToday());
      if (!fechaInicioUTC || !fechaFinUTC) {
        throw new Error('Fechas de historial inválidas');
      }

      const params = new URLSearchParams({
        fechaInicio: fechaInicioUTC.toISOString(),
        fechaFin: fechaFinUTC.toISOString()
      });

      const response = await clienteAxios.get(`/api/rutinas/historial-completaciones/${section}/${itemId}?${params}`);
      return response.data;
      
    } catch (error) {
      console.error('[rutinasService] Error al obtener historial:', error);
      throw error;
    }
  }

  async getRutinasHistoricas(days = 30) {
    try {
      const fechaFin = getNormalizedToday();
      const fechaInicio = new Date(fechaFin);
      fechaInicio.setDate(fechaFin.getDate() - days);

      const fechaInicioUTC = toLogicalDayUtcStart(fechaInicio);
      const fechaFinUTC = toLogicalDayUtcEnd(fechaFin);
      if (!fechaInicioUTC || !fechaFinUTC) {
        throw new Error('Fechas de historial inválidas');
      }

      const params = new URLSearchParams({
        fechaInicio: fechaInicioUTC.toISOString(),
        fechaFin: fechaFinUTC.toISOString(),
        _t: Date.now()
      });
      
      const response = await clienteAxios.get(`/api/rutinas?${params}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      return response.data.map(rutina => ({
        ...rutina,
        fecha: parseAPIDate(rutina.fecha)
      }));
      
    } catch (error) {
      console.error('[rutinasService] Error al obtener rutinas históricas:', error);
      throw error;
    }
  }

  /**
   * MÉTODO DESHABILITADO - User preferences eliminadas del modelo UX simplificado
   * @returns {Promise} Respuesta con las preferencias del usuario
   */
  async getUserHabitPreferences() {
    // Método deshabilitado - retornar estructura vacía para compatibilidad
    return { preferences: {}, updated: false, global: false, fallback: 'Método deshabilitado' };
    /*
    try {
      // Respetar ventana de deshabilitación si hubo errores previos prolongados
      const now = Date.now();
      let disabledUntil = 0;
      try { disabledUntil = Number(localStorage.getItem('rutina_user_prefs_disabled_until') || '0'); } catch (_) {}
      if (disabledUntil && now < disabledUntil) {
        const localPrefs = this.getLocalUserPreferences();
        return {
          preferences: localPrefs,
          updated: false,
          global: false,
          fallback: 'Endpoint deshabilitado temporalmente por errores previos'
        };
      }

      // Evitar reintentos agresivos tras un error reciente
      // reutilizar el timestamp calculado arriba para evitar redeclaración
      // y mantener coherencia en la ventana de backoff
      // const now2 = Date.now(); // no necesario
      let lastErrorAt = 0;
      try { lastErrorAt = Number(localStorage.getItem('rutina_user_prefs_last_error') || '0'); } catch (_) {}
      if (lastErrorAt && (now - lastErrorAt) < 60_000) { // 60s de backoff
        const localPrefsQuick = this.getLocalUserPreferences();
        return {
          preferences: localPrefsQuick,
          updated: false,
          global: false,
          fallback: 'Backoff activo tras error reciente. Usando preferencias locales'
        };
      }

      // Deduplicar solicitudes concurrentes
      if (!this.pendingRequests) {
        this.pendingRequests = new Map();
      }
      if (this.pendingRequests.has('user-prefs')) {
        return await this.pendingRequests.get('user-prefs');
      }

      const requestPromise = (async () => {
        const response = await clienteAxios.get('/api/rutinas/user-preferences');
        const prefs = response.data || {};
        // Cache local para inicialización rápida
        this.setLocalUserPreferences(prefs);
        return {
          preferences: prefs,
          updated: true,
          global: true
        };
      })();

      this.pendingRequests.set('user-prefs', requestPromise);
      const result = await requestPromise;
      this.pendingRequests.delete('user-prefs');
      return result;
    } catch (error) {
      // Evitar ruido en consola y reintentos constantes: degradar silenciosamente a configuración local
      const status = error?.response?.status;
      const errMsg = error?.message || 'Error al obtener preferencias';
      // No volver a intentar inmediatamente hasta que se refresque la página
      // Guardar un timestamp para evitar múltiples llamadas fallidas seguidas
      try { localStorage.setItem('rutina_user_prefs_last_error', String(Date.now())); } catch (_) {}
      if (this.pendingRequests) {
        this.pendingRequests.delete('user-prefs');
      }
      // Si el servidor devuelve 404 o 5xx, deshabilitar por 12h para evitar 500 en consola
      if (!status || status === 404 || status >= 500) {
        try {
          const twelveHours = 12 * 60 * 60 * 1000;
          localStorage.setItem('rutina_user_prefs_disabled_until', String(Date.now() + twelveHours));
        } catch (_) {}
      }
      // Intentar usar caché local
      const localPrefs = this.getLocalUserPreferences();
      if (Object.keys(localPrefs).length > 0) {
        return {
          preferences: localPrefs,
          updated: false,
          global: false,
          error: errMsg,
          fallback: 'Usando preferencias locales en caché'
        };
      }
      if (status === 404) {
        return { 
          preferences: {}, 
          updated: false, 
          global: false, 
          error: 'Endpoint de preferencias globales no disponible',
          fallback: 'Usando configuración local'
        };
      }
      if (status >= 500) {
        return {
          preferences: localPrefs || {},
          updated: false,
          global: false,
          error: errMsg,
          fallback: 'Preferencias no disponibles (servidor). Usando configuración local'
        };
      }
      
      // Otros errores (degradar a local)
      return {
        preferences: localPrefs || {},
        updated: false,
        global: false,
        error: errMsg,
        fallback: 'Usando configuración local'
      };
    }
    */
  }

  /**
   * MÉTODO DESHABILITADO - User preferences eliminadas del modelo UX simplificado
   * @param {string} section - Sección del hábito (bodyCare, nutricion, etc.)
   * @param {string} itemId - ID del ítem específico
   * @param {Object} config - Configuración del hábito
   * @returns {Promise} Respuesta con el estado de la actualización
   */
  async updateUserHabitPreference(section, itemId, config) {
    // Método deshabilitado - retornar éxito falso para compatibilidad
    return { updated: false, global: false, fallback: 'Método deshabilitado', preferences: {} };
    /*
    try {
      const response = await clienteAxios.put('/api/rutinas/user-preferences', {
        section,
        itemId,
        config: {
          ...config,
          esPreferenciaUsuario: true,
          ultimaActualizacion: new Date().toISOString()
        }
      });
      // Actualizar caché local también
      this.mergeLocalUserPreference(section, itemId, config);
      return { 
        updated: true, 
        global: true, 
        preferences: response.data || this.getLocalUserPreferences(),
        message: 'Preferencia global actualizada correctamente'
      };
    } catch (error) {
      console.error('[rutinasService] Error al actualizar preferencia de usuario:', error);
      
      // Si no hay endpoint, retornar estado honesto
      if (error.response?.status === 404) {
        // Guardar localmente para mantener UX
        const localPrefs = this.mergeLocalUserPreference(section, itemId, config);
        return { 
          updated: false, 
          global: false, 
          error: 'Endpoint de preferencias globales no disponible',
          fallback: 'Cambios guardados solo localmente',
          preferences: localPrefs
        };
      }
      
      // Otros errores
      const localPrefs = this.mergeLocalUserPreference(section, itemId, config);
      return { 
        updated: false, 
        global: false, 
        error: error.message || 'Error al actualizar preferencias globales',
        fallback: 'Cambios guardados localmente',
        preferences: localPrefs
      };
    }
    */
  }
}

export default new RutinasService(); 
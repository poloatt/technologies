import { BaseController } from './BaseController.js';
import { Rutinas } from '../models/Rutinas.js';
import { Users } from '../models/index.js';
import { applyCustomHabitsToRutinaConfig, buildEmptyCompletionSections } from '../constants/defaultCustomHabits.js';
import { timezoneUtils } from '../models/BaseSchema.js';
import { getValidHabitSections } from '../utils/habitSectionsUtils.js';
import {
  collectRutinaUpdateSectionKeys,
  buildRutinaUpdatePatches,
} from '../utils/rutinaUpdatePatches.js';
import {
  buildRutinaUpdateSetOps,
  calculateRutinaCompletitud,
} from '../utils/rutinaCompletitudUtils.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';

class RutinasController extends BaseController {
  constructor() {
    super(Rutinas, {
      searchFields: ['tipo', 'notas'],
      defaultSort: { fecha: -1 }
    });

    // Bind de los métodos al contexto de la instancia
    this.getAllAdmin = this.getAllAdmin.bind(this);
    this.getAdminStats = this.getAdminStats.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.getAll = this.getAll.bind(this);
    this.verifyDate = this.verifyDate.bind(this);
    this.getById = this.getById.bind(this);
    this.getAllFechas = this.getAllFechas.bind(this);
    this.updateItemConfig = this.updateItemConfig.bind(this);
    this.updateItemConfigByPath = this.updateItemConfigByPath.bind(this);
    this.getHistorial = this.getHistorial.bind(this);
    this.getHistorialCompletaciones = this.getHistorialCompletaciones.bind(this);
  }

  async getAll(req, res) {
    try {
      const query = { usuario: req.user.id };
      const options = {
        ...this.paginateOptions,
        sort: { fecha: -1 },
        limit: req.query.limit || 10,
        page: parseInt(req.query.page) || 1,
        lean: true
      };

      logger.dev('Rutinas getAll params', { page: req.query.page, limit: req.query.limit, sort: req.query.sort });

      const result = await this.Model.paginate(query, options);
      
      logger.info(`Rutinas getAll: total=${result.totalDocs} page=${result.page}/${result.totalPages} limit=${result.limit}`);

      // Asegurarnos de que cada documento tenga su _id y sea un objeto plano
      result.docs = result.docs.map(doc => {
        // Si doc._id es un ObjectId, convertirlo a string
        const _id = doc._id?.toString() || doc._id;
        
        // Crear un nuevo objeto plano con _id al inicio
        return {
          _id,
          ...doc,
          // Asegurarnos de que los subdocumentos también sean objetos planos
          bodyCare: { ...doc.bodyCare },
          nutricion: { ...doc.nutricion },
          ejercicio: { ...doc.ejercicio },
          cleaning: { ...doc.cleaning }
        };
      });

      res.json(result);
    } catch (error) {
      console.error('Error al obtener rutinas:', error);
      res.status(500).json({ 
        error: 'Error al obtener rutinas',
        details: error.message 
      });
    }
  }

  async create(req, res) {
    try {
      const { nombre, useGlobalConfig = true } = req.body;
      
      // Obtener el timezone del usuario
      const user = await Users.findById(req.user.id).select('preferences.timezone');
      const timezone = timezoneUtils.getUserTimezone(user);
      
      // Obtener y normalizar la fecha de la rutina
      // Si viene como 'YYYY-MM-DD', NO la convertimos a Date aún (evita doble normalización)
      const fechaInput = req.body.fecha;
      const isYMD = typeof fechaInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaInput);
      const fechaRutina = fechaInput ? (isYMD ? fechaInput : new Date(fechaInput)) : new Date();
      
      // Verificar si la fecha es válida
      if (!isYMD && isNaN(fechaRutina.getTime())) {
        console.error('[rutinasController] Fecha inválida al crear rutina:', req.body.fecha);
        return res.status(400).json({
          error: 'Fecha inválida',
          detalles: 'La fecha proporcionada no es válida'
        });
      }
      
      // Normalizar usando el timezone del usuario
      const fechaNormalizada = timezoneUtils.normalizeToStartOfDay(fechaRutina, timezone);
      
      if (!fechaNormalizada) {
        return res.status(400).json({
          error: 'Error al normalizar fecha',
          detalles: 'No se pudo normalizar la fecha proporcionada'
        });
      }
      
      // Verificar duplicados antes de crear
      logger.dev('[rutinasController] Verificando duplicados al crear', {
        fecha: fechaNormalizada.toISOString(),
        timezone,
        usuario: req.user.id
      });
      
      // Simplificación: verificar por igualdad exacta contra la fecha normalizada
      const existingRutina = await this.Model.findOne({
        fecha: fechaNormalizada,
        usuario: req.user.id
      });
      
      if (existingRutina) {
        logger.info('[rutinasController] Rutina duplicada', { id: existingRutina._id, fecha: existingRutina.fecha });
        return res.status(409).json({
          error: 'Ya existe una rutina para esta fecha',
          rutinaId: existingRutina._id,
          fecha: existingRutina.fecha
        });
      }
      
      // --- Construir configuración completa (evitar config vacío/incompleto) ---
      const usuarioConfig = await Users.findById(req.user.id)
        .select('customHabits preferences.rutinasConfig preferences.customHabitSections')
        .lean();
      const seccionesValidas = getValidHabitSections(usuarioConfig);
      // Función helper para normalizar horarios
      const normalizeHorarios = (horarios) => {
        if (!horarios) return [];
        if (typeof horarios === 'string') horarios = [horarios];
        if (!Array.isArray(horarios)) return [];
        
        const validHorarios = ['MAÑANA', 'TARDE', 'NOCHE'];
        return horarios
          .map(h => String(h).toUpperCase())
          .filter(h => validHorarios.includes(h))
          .filter((h, index, arr) => arr.indexOf(h) === index) // Eliminar duplicados
          .sort();
      };

      const normalizeItemConfig = (cfg = {}, defaultTipo = 'DIARIO') => {
        const tipo = String(cfg?.tipo || defaultTipo).toUpperCase();
        const frecuencia = Number(cfg?.frecuencia || 1);
        const activo = cfg?.activo !== false;
        const diasSemana = Array.isArray(cfg?.diasSemana) ? cfg.diasSemana : [];
        const diasMes = Array.isArray(cfg?.diasMes) ? cfg.diasMes : [];
        const horarios = normalizeHorarios(cfg?.horarios);
        // periodo por defecto según tipo
        const periodo =
          cfg?.periodo ||
          (tipo === 'SEMANAL' ? 'CADA_SEMANA' : (tipo === 'MENSUAL' ? 'CADA_MES' : 'CADA_DIA'));

        return {
          tipo,
          diasSemana,
          diasMes,
          horarios,
          frecuencia: Number.isFinite(frecuencia) ? Math.max(1, frecuencia) : 1,
          periodo,
          activo
        };
      };

      const buildDefaultFullConfig = async () => {
        const full = {};
        seccionesValidas.forEach((section) => {
          full[section] = {};
        });

        try {
          applyCustomHabitsToRutinaConfig(
            usuarioConfig?.customHabits,
            usuarioConfig?.preferences?.rutinasConfig,
            seccionesValidas,
            normalizeItemConfig,
            full,
          );
        } catch (error) {
          logger.warn('[rutinasController] Error al obtener hábitos personalizados al crear rutina', error);
        }

        return full;
      };

      // Skip ObjectId-shaped / metadata keys that can appear in corrupted rutinasConfig
      const CONFIG_SECTION_SKIP = new Set(['_metadata', '_id', 'buffer']);

      const mergeConfigInto = (target, source) => {
        if (!source || typeof source !== 'object') return target;
        Object.keys(source).forEach((section) => {
          if (CONFIG_SECTION_SKIP.has(section) || !source[section] || typeof source[section] !== 'object' || Array.isArray(source[section])) return;
          if (!target[section]) target[section] = {};
          Object.entries(source[section]).forEach(([itemId, cfg]) => {
            if (CONFIG_SECTION_SKIP.has(itemId) || !cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return;
            if (!target[section][itemId]) {
              target[section][itemId] = normalizeItemConfig(cfg);
              return;
            }
            target[section][itemId] = {
              ...target[section][itemId],
              ...normalizeItemConfig(cfg, target[section][itemId]?.tipo || 'DIARIO'),
            };
          });
        });
        return target;
      };

      // Base defaults (ahora incluye hábitos personalizados y sus configuraciones globales)
      const configCompleta = await buildDefaultFullConfig();
      
      logger.dev('[rutinasController] Configuración inicial construida', {
        sections: Object.keys(configCompleta),
        bodyCareCount: Object.keys(configCompleta.bodyCare || {}).length,
        nutricionCount: Object.keys(configCompleta.nutricion || {}).length,
        ejercicioCount: Object.keys(configCompleta.ejercicio || {}).length,
        cleaningCount: Object.keys(configCompleta.cleaning || {}).length
      });

      // 1) Si el frontend envía config explícita (RutinaForm), mergearla sobre la base
      const reqConfig = req.body?.config;
      const hasReqConfig = reqConfig && typeof reqConfig === 'object' && Object.keys(reqConfig).length > 0;

      if (hasReqConfig) {
        logger.dev('[rutinasController] Usando config enviada por el cliente al crear rutina');
        mergeConfigInto(configCompleta, reqConfig);
      }

      // 2) Re-aplicar plantilla global solo si se pide y no vino config del cliente
      //    (buildDefaultFullConfig ya incluye prefs; evita pisar overrides del request)
      if (useGlobalConfig && !hasReqConfig) {
        const globalConfig = usuarioConfig?.preferences?.rutinasConfig;
        if (globalConfig) {
          logger.dev('[rutinasController] Re-aplicando configuración global a nueva rutina');
          mergeConfigInto(configCompleta, globalConfig);
        }
      }

      // Strip keys that break Mongoose ObjectId casting if they leaked into config
      if (configCompleta && typeof configCompleta === 'object') {
        delete configCompleta._id;
        delete configCompleta.buffer;
        delete configCompleta._metadata;
      }

      const completionSections = buildEmptyCompletionSections(
        usuarioConfig?.customHabits,
        seccionesValidas,
      );

      const nuevaRutina = new this.Model({
        nombre: nombre || 'Mi Rutina',
        // Guardar SIEMPRE la fecha normalizada al inicio del día del usuario
        fecha: fechaNormalizada,
        usuario: req.user.id,
        config: configCompleta,
        ...completionSections,
      });

      await nuevaRutina.save();
      
      logger.info(`[rutinasController] Rutina creada`, { id: nuevaRutina._id, fecha: fechaNormalizada.toISOString() });
      
      // Convertir el objeto a un objeto plano y asegurar que el _id sea un string
      const rutinaResponse = nuevaRutina.toObject();
      rutinaResponse._id = rutinaResponse._id.toString();
      
      // Añadir el id como propiedad adicional para compatibilidad
      rutinaResponse.id = rutinaResponse._id;
      
      logger.dev(`[rutinasController] Respuesta rutina creada`, { id: rutinaResponse._id });
      
      res.status(201).json(rutinaResponse);
    } catch (error) {
      console.error('[rutinasController] Error al crear rutina:', error);
      // Manejo de error de validación de duplicado desde hooks del modelo
      if (error?.message && String(error.message).includes('Ya existe una rutina para esta fecha')) {
        try {
          // Intentar recuperar el id existente para que el frontend pueda abrirlo
          const user = await Users.findById(req.user.id).select('preferences.timezone');
          const timezone = timezoneUtils.getUserTimezone(user);
          const fechaInput = req.body.fecha;
          const isYMD = typeof fechaInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaInput);
          const fechaRutina = fechaInput ? (isYMD ? fechaInput : new Date(fechaInput)) : new Date();
          const fechaNormalizada = timezoneUtils.normalizeToStartOfDay(fechaRutina, timezone);
          const existingRutina = fechaNormalizada
            ? await this.Model.findOne({ fecha: fechaNormalizada, usuario: req.user.id }).select('_id fecha')
            : null;

          return res.status(409).json({
            error: 'Ya existe una rutina para esta fecha',
            code: 'RUTINA_DUPLICADA',
            rutinaId: existingRutina?._id,
            fecha: existingRutina?.fecha
          });
        } catch (_) {
          return res.status(409).json({
            error: 'Ya existe una rutina para esta fecha',
            code: 'RUTINA_DUPLICADA'
          });
        }
      }
      // Manejo específico de duplicados por índice único (race condition)
      if (error && (error.code === 11000 || error.name === 'MongoServerError' && error.message?.includes('E11000'))) {
        try {
          const user = await Users.findById(req.user.id).select('preferences.timezone');
          const timezone = timezoneUtils.getUserTimezone(user);
          const fechaInput = req.body.fecha;
          const isYMD = typeof fechaInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaInput);
          const fechaRutina = fechaInput ? (isYMD ? fechaInput : new Date(fechaInput)) : new Date();
          const fechaNormalizada = timezoneUtils.normalizeToStartOfDay(fechaRutina, timezone);
          const existingRutina = fechaNormalizada
            ? await this.Model.findOne({ fecha: fechaNormalizada, usuario: req.user.id }).select('_id fecha')
            : null;
          return res.status(409).json({
            error: 'Ya existe una rutina para esta fecha',
            code: 'RUTINA_DUPLICADA',
            rutinaId: existingRutina?._id,
            fecha: existingRutina?.fecha
          });
        } catch (_) {
          return res.status(409).json({
            error: 'Ya existe una rutina para esta fecha',
            code: 'RUTINA_DUPLICADA'
          });
        }
      }

      res.status(500).json({
        error: 'Error al crear la rutina',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      
      logger.info('Rutina update start', { id });
      
      const currentRutina = await this.Model.findOne({ 
        _id: id, 
        usuario: req.user.id 
      });
      
      if (!currentRutina) {
        return res.status(404).json({ error: 'Rutina no encontrada' });
      }

      // Si se está actualizando la fecha, verificar duplicados (timezone del usuario)
      if (req.body.fecha && req.body.fecha !== currentRutina.fecha.toISOString()) {
        const user = await Users.findById(req.user.id).select('preferences.timezone');
        const timezone = timezoneUtils.getUserTimezone(user);
        const fechaInput = req.body.fecha;
        const isYMD = typeof fechaInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaInput);
        const fechaRutina = isYMD ? fechaInput : new Date(fechaInput);
        const fechaNormalizada = timezoneUtils.normalizeToStartOfDay(fechaRutina, timezone);

        const existingRutina = fechaNormalizada
          ? await this.Model.findOne({
              _id: { $ne: id },
              fecha: fechaNormalizada,
              usuario: req.user.id
            })
          : null;

        if (existingRutina) {
          return res.status(409).json({
            error: 'Ya existe una rutina para esta fecha'
          });
        }

        req.body.fecha = fechaNormalizada;
      }

      const sectionKeys = collectRutinaUpdateSectionKeys(currentRutina, req.body);
      const patches = buildRutinaUpdatePatches(currentRutina, req.body, sectionKeys);
      const updateOps = buildRutinaUpdateSetOps(patches, req.body, currentRutina);

      let updatedRutina = await this.Model.findOneAndUpdate(
        { _id: id, usuario: req.user.id },
        { $set: updateOps },
        { new: true },
      );

      if (!updatedRutina) {
        return res.status(404).json({ error: 'Rutina no encontrada' });
      }

      const completitudFields = calculateRutinaCompletitud(updatedRutina);
      updatedRutina = await this.Model.findOneAndUpdate(
        { _id: id, usuario: req.user.id },
        { $set: completitudFields },
        { new: true },
      );

      logger.info('Rutina actualizada', { id: updatedRutina._id });

      const responseObj = await this.Model.findById(updatedRutina._id).lean();
      if (!responseObj) {
        return res.status(404).json({ error: 'Rutina no encontrada' });
      }
      responseObj._id = responseObj._id.toString();

      res.json(responseObj);
    } catch (error) {
      console.error('Error al actualizar rutina:', error);
      res.status(500).json({ 
        error: 'Error al actualizar la rutina',
        details: error.message 
      });
    }
  }

  // GET /api/rutinas/admin/all
  async getAllAdmin(req, res) {
    try {
      const result = await this.Model.paginate(
        {},
        {
          populate: [
            { path: 'usuario', select: 'nombre email' }
          ],
          sort: { createdAt: 'desc' }
        }
      );
      res.json(result);
    } catch (error) {
      console.error('Error al obtener todas las rutinas:', error);
      res.status(500).json({ 
        error: 'Error al obtener todas las rutinas',
        details: error.message 
      });
    }
  }

  // GET /api/rutinas/admin/stats
  async getAdminStats(req, res) {
    try {
      const totalRutinas = await this.Model.countDocuments();
      const rutinasPorCompletitud = await this.Model.aggregate([
        {
          $group: {
            _id: {
              $cond: [
                { $gte: ['$completitud', 0.8] },
                'Alta',
                {
                  $cond: [
                    { $gte: ['$completitud', 0.5] },
                    'Media',
                    'Baja'
                  ]
                }
              ]
            },
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        totalRutinas,
        rutinasPorCompletitud
      });
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({ 
        error: 'Error al obtener estadísticas',
        details: error.message 
      });
    }
  }

  async verifyDate(req, res) {
    try {
      const { fecha } = req.query;
      
      if (!fecha) {
        return res.status(400).json({ error: 'La fecha es requerida' });
      }
      
      // Obtener el timezone del usuario
      const user = await Users.findById(req.user.id).select('preferences.timezone');
      const timezone = timezoneUtils.getUserTimezone(user);
      
      // Normalizar la fecha usando el timezone del usuario (mismo parsing que create)
      const isYMD = typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha);
      const fechaRutina = isYMD ? fecha : new Date(fecha);

      if (!isYMD && isNaN(fechaRutina.getTime())) {
        logger.dev('[rutinasController] Fecha inválida recibida', { fecha });
        return res.status(400).json({
          error: 'Formato de fecha inválido',
          fecha,
          detalles: 'La fecha proporcionada no es válida',
        });
      }

      const fechaNormalizada = timezoneUtils.normalizeToStartOfDay(fechaRutina, timezone);

      if (!fechaNormalizada) {
        return res.status(400).json({
          error: 'Error al normalizar fecha',
          detalles: 'No se pudo normalizar la fecha proporcionada',
        });
      }

      logger.dev('[rutinasController] Verificando rutina existente', {
        fechaNormalizada: fechaNormalizada.toISOString(),
        timezone,
        usuario: req.user.id,
      });

      const existingRutina = await this.Model.findOne({
        fecha: fechaNormalizada,
        usuario: req.user.id,
      }).lean();
      
      if (existingRutina) {
        logger.dev('[rutinasController] Rutina existente encontrada', {
          id: existingRutina._id,
          fecha: existingRutina.fecha,
          fechaISO: existingRutina.fecha.toISOString()
        });
        return res.json({
          exists: true,
          rutinaId: existingRutina._id,
          fecha: existingRutina.fecha,
          mensaje: 'Ya existe una rutina para esta fecha'
        });
      }
      
      return res.json({
        exists: false,
        fechaNormalizada: fechaNormalizada.toISOString(),
        timezone,
        mensaje: 'Fecha disponible para crear rutina',
      });
    } catch (error) {
      console.error('[rutinasController] Error al verificar fecha:', error);
      res.status(500).json({ 
        error: 'Error al verificar fecha',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const doc = await this.Model.findOne({ 
        _id: id,
        usuario: req.user.id
      }).lean();
      
      if (!doc) {
        return res.status(404).json({ error: 'Rutina no encontrada' });
      }
      
      // Formatear el documento para mantener consistencia.
      // No fusionar prefs globales aquí: el snapshot del día debe preservarse.
      // Hoy/futuro se overlayan en el cliente vía resolveRutinaItemConfig.
      const formattedDoc = {
        _id: doc._id.toString(),
        ...doc,
        bodyCare: { ...doc.bodyCare },
        nutricion: { ...doc.nutricion },
        ejercicio: { ...doc.ejercicio },
        cleaning: { ...doc.cleaning }
      };

      res.json(formattedDoc);
    } catch (error) {
      console.error('Error al obtener rutina por ID:', error);
      res.status(500).json({ 
        error: 'Error al obtener rutina',
        details: error.message 
      });
    }
  }

  async getAllFechas(req, res) {
    try {
      // Obtener todas las fechas de rutinas del usuario
      const rutinas = await this.Model.find(
        { usuario: req.user.id },
        { fecha: 1 }
      ).lean();
      
      // Extraer solo las fechas y formatearlas
      const fechas = rutinas.map(rutina => rutina.fecha);
      
      return res.json({
        fechas,
        total: fechas.length
      });
    } catch (error) {
      console.error('Error al obtener fechas con rutinas:', error);
      res.status(500).json({ 
        error: 'Error al obtener fechas con rutinas',
        details: error.message 
      });
    }
  }

  /**
   * Actualiza la configuración de un ítem (body: seccion, itemId, config).
   * Delega a la ruta por path; escribe en rutina.config (no en campos de completado).
   */
  async updateItemConfig(req, res) {
    const { seccion, itemId, config } = req.body || {};
    if (!seccion || !itemId || !config) {
      return res.status(400).json({
        msg: 'Datos incompletos, se requieren sección, itemId y configuración'
      });
    }
    req.params = { ...req.params, seccion, itemId };
    req.body = config;
    return this.updateItemConfigByPath(req, res);
  }

  /**
   * Actualiza la configuración específica de un ítem en una rutina, donde la sección y el ítem
   * se especifican en la URL en vez del body
   */
  async updateItemConfigByPath(req, res) {
    try {
      const { id, seccion, itemId } = req.params;
      const config = req.body;
      
      console.log(`[rutinasController] Actualizando configuración para ${seccion}.${itemId} vía URL params`);
      
      // Validar datos recibidos
      if (!seccion || !itemId || !config) {
        return res.status(400).json({ 
          msg: 'Datos incompletos, se requiere configuración en el body y sección/itemId en la URL' 
        });
      }
      
      // Buscar la rutina
      const rutina = await this.Model.findById(id);
      
      if (!rutina) {
        return res.status(404).json({ msg: 'Rutina no encontrada' });
      }
      
      // Verificar que el usuario es el creador de la rutina
      if (rutina.usuario.toString() !== req.user.id) {
        return res.status(401).json({ msg: 'No autorizado para modificar esta rutina' });
      }
      
      // Inicializar la estructura de configuración si no existe
      if (!rutina.config) rutina.config = {};
      if (!rutina.config[seccion]) rutina.config[seccion] = {};
      
      // Normalizar la configuración recibida
      const normalizedConfig = {
        ...config,
        tipo: (config.tipo || 'DIARIO').toUpperCase(),
        frecuencia: Number(config.frecuencia || 1),
        periodo: config.periodo || 'CADA_DIA',
        diasSemana: config.diasSemana || [],
        diasMes: config.diasMes || [],
        activo: config.activo !== false
      };
      
      console.log(`[rutinasController] Config normalizada para ${seccion}.${itemId}:`, JSON.stringify(normalizedConfig));
      
      // Actualizar la configuración
      rutina.config[seccion][itemId] = normalizedConfig;
      
      // Guardar los cambios
      await rutina.save();
      
      res.json({ 
        msg: 'Configuración actualizada correctamente',
        config: rutina.config[seccion][itemId]
      });
    } catch (error) {
      console.error(`[rutinasController] Error al actualizar config vía URL params:`, error);
      res.status(500).json({ 
        msg: 'Error al actualizar la configuración del ítem',
        error: error.message 
      });
    }
  }

  /**
   * Obtener el historial de rutinas en un rango de fechas
   * @param {Object} req - Petición HTTP
   * @param {Object} res - Respuesta HTTP
   */
  async getHistorial(req, res) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      // Validar parámetros
      if (!fechaInicio || !fechaFin) {
        console.error('[rutinasController] Faltan parámetros de fecha:', { fechaInicio, fechaFin });
        return res.status(400).json({ 
          error: 'Se requieren fechaInicio y fechaFin',
          params: { fechaInicio, fechaFin }
        });
      }
      
      // Manejo defensivo para fechas inválidas (sin clampear a un año hardcodeado)
      let inicio, fin;
      try {
        inicio = new Date(fechaInicio);
        fin = new Date(fechaFin);

        if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
          console.error(`[rutinasController] Fechas inválidas: inicio=${fechaInicio}, fin=${fechaFin}`);
          return res.status(400).json({
            error: 'Fechas inválidas',
            details: 'Las fechas proporcionadas no son válidas'
          });
        }

        // Rechazar rangos absurdamente futuros (typos), no reescribir a un año fijo
        const añoMaxPermitido = new Date().getFullYear() + 1;
        if (inicio.getFullYear() > añoMaxPermitido || fin.getFullYear() > añoMaxPermitido) {
          return res.status(400).json({
            error: 'Fechas fuera de rango',
            details: `El año no puede ser posterior a ${añoMaxPermitido}`
          });
        }

        inicio.setUTCHours(0, 0, 0, 0);
        fin.setUTCHours(23, 59, 59, 999);
      } catch (fechaError) {
        console.error(`[rutinasController] Error al procesar fechas:`, fechaError);
        return res.status(400).json({ 
          error: 'Error al procesar fechas', 
          details: fechaError.message
        });
      }
      
      console.log(`[rutinasController] Buscando rutinas entre ${inicio.toISOString()} y ${fin.toISOString()}`);
      
      // Verificar que el usuario esté disponible
      if (!req.user || !req.user.id) {
        console.error('[rutinasController] Usuario no disponible en request');
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }
      
      // Verificar que el rango de fechas sea válido (inicio no puede ser posterior a fin)
      if (inicio > fin) {
        console.error('[rutinasController] Rango de fechas inválido: inicio posterior a fin');
        return res.status(400).json({ 
          error: 'Rango de fechas inválido', 
          details: 'La fecha de inicio no puede ser posterior a la fecha de fin'
        });
      }
      
      // Limitar el rango máximo a 90 días para evitar consultas excesivas
      const maxDias = 90;
      const rangoMs = fin.getTime() - inicio.getTime();
      const rangoDias = Math.ceil(rangoMs / (1000 * 60 * 60 * 24));
      
      if (rangoDias > maxDias) {
        console.warn(`[rutinasController] Rango de días (${rangoDias}) excede el máximo permitido (${maxDias})`);
        // Ajustar fin para que el rango no exceda maxDias
        fin = new Date(inicio);
        fin.setDate(inicio.getDate() + maxDias);
        fin.setUTCHours(23, 59, 59, 999);
        console.log(`[rutinasController] Ajustando fecha fin a ${fin.toISOString()}`);
      }
      
      // Consultar las rutinas en el rango de fechas usando agregación para asegurar buena performance
      const pipeline = [
        {
          $match: {
            usuario: new mongoose.Types.ObjectId(req.user.id),
            fecha: {
              $gte: inicio,
              $lte: fin
            }
          }
        },
        { $sort: { fecha: -1 } }
      ];
      
      try {
        const rutinas = await this.Model.aggregate(pipeline);
        console.log(`[rutinasController] Encontradas ${rutinas.length} rutinas en el rango`);
        
        // Asegurar que las rutinas tengan formato correcto para el frontend
        const rutinasFormateadas = rutinas.map(rutina => {
          // Ensure _id is a string
          if (rutina._id) {
            rutina.id = rutina._id.toString();
          }
          
          return rutina;
        });
        
        return res.json(rutinasFormateadas);
      } catch (dbError) {
        console.error('[rutinasController] Error en la consulta a MongoDB:', dbError);
        return res.status(500).json({ 
          error: 'Error en la consulta a la base de datos', 
          details: dbError.message 
        });
      }
    } catch (error) {
      console.error('[rutinasController] Error al obtener historial:', error);
      res.status(500).json({ 
        error: 'Error al obtener historial de rutinas',
        details: error.message 
      });
    }
  }

  /**
   * Obtiene el historial de completaciones para un ítem específico en un rango de fechas
   * @param {Object} req - Petición HTTP con params: section, itemId y query: fechaInicio, fechaFin
   * @param {Object} res - Respuesta HTTP
   */
  async getHistorialCompletaciones(req, res) {
    try {
      const { section, itemId } = req.params;
      const { fechaInicio, fechaFin } = req.query;
      
      console.log(`[rutinasController] Buscando historial de completaciones para ${section}.${itemId}`, {
        fechaInicio,
        fechaFin
      });
      
      // Validar parámetros
      if (!section || !itemId) {
        return res.status(400).json({ 
          error: 'Se requieren section e itemId como parámetros',
          params: { section, itemId }
        });
      }
      
      if (!fechaInicio || !fechaFin) {
        console.error('[rutinasController] Faltan parámetros de fecha:', { fechaInicio, fechaFin });
        return res.status(400).json({ 
          error: 'Se requieren fechaInicio y fechaFin',
          params: { fechaInicio, fechaFin }
        });
      }

      // Procesar y normalizar fechas con manejo de errores mejorado
      let inicio, fin;
      try {
        // Intentar crear objetos Date
        inicio = new Date(fechaInicio);
        fin = new Date(fechaFin);
        
        // Verificar si las fechas son válidas
        if (isNaN(inicio.getTime())) {
          console.error(`[rutinasController] Fecha inicio inválida: ${fechaInicio}`);
          return res.status(400).json({ 
            error: 'Fecha de inicio inválida',
            fechaRecibida: fechaInicio
          });
        }
        
        if (isNaN(fin.getTime())) {
          console.error(`[rutinasController] Fecha fin inválida: ${fechaFin}`);
          return res.status(400).json({ 
            error: 'Fecha de fin inválida',
            fechaRecibida: fechaFin
          });
        }
        
        // Normalizar horas
        inicio.setUTCHours(0, 0, 0, 0);
        fin.setUTCHours(23, 59, 59, 999);
        
        // Verificar que inicio no sea posterior a fin
        if (inicio > fin) {
          return res.status(400).json({
            error: 'Rango de fechas inválido',
            details: 'La fecha de inicio no puede ser posterior a la fecha de fin',
            fechas: { inicio: inicio.toISOString(), fin: fin.toISOString() }
          });
        }
        
        // Log de fechas normalizadas
        console.log('[rutinasController] Fechas normalizadas:', {
          inicio: inicio.toISOString(),
          fin: fin.toISOString()
        });
        
      } catch (fechaError) {
        console.error(`[rutinasController] Error al procesar fechas:`, fechaError);
        return res.status(400).json({ 
          error: 'Error al procesar fechas', 
          details: fechaError.message,
          fechasRecibidas: { fechaInicio, fechaFin }
        });
      }
      
      console.log(`[rutinasController] Buscando completaciones entre ${inicio.toISOString()} y ${fin.toISOString()}`);
      
      // Verificar que el usuario esté disponible
      if (!req.user || !req.user.id) {
        console.error('[rutinasController] Usuario no disponible en request');
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }
      
      // Obtener todas las rutinas en el rango de fechas
      const rutinas = await this.Model.find({
        usuario: req.user.id,
        fecha: {
          $gte: inicio,
          $lte: fin
        }
      }).lean();
      
      console.log(`[rutinasController] Encontradas ${rutinas.length} rutinas en el rango de fechas`);
      
      // Extraer las completaciones del ítem específico
      const completaciones = [];
      
      // Función auxiliar para añadir completación evitando duplicados
      const toLogicalDayKey = (fecha) => {
        if (fecha == null) return null;
        if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
          return fecha.slice(0, 10);
        }
        const d = fecha instanceof Date ? fecha : new Date(fecha);
        if (Number.isNaN(d.getTime())) return null;
        const isUtcMidnight =
          d.getUTCHours() === 0
          && d.getUTCMinutes() === 0
          && d.getUTCSeconds() === 0
          && d.getUTCMilliseconds() === 0;
        if (isUtcMidnight) {
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        }
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const agregarCompletacion = (fecha, rutinaId, fuente) => {
        const fechaStr = toLogicalDayKey(fecha);
        if (!fechaStr) return;

        const yaExiste = completaciones.some((comp) => toLogicalDayKey(comp.fecha) === fechaStr);

        if (!yaExiste) {
          completaciones.push({
            fecha: new Date(`${fechaStr}T00:00:00.000Z`),
            rutinaId: rutinaId.toString(),
            completado: true,
            fuente: fuente || 'rutina'
          });
          console.log(`[rutinasController] ✅ Añadida completación: ${fechaStr} (fuente: ${fuente || 'rutina'})`);
        } else {
          console.log(`[rutinasController] ⚠️ Completación duplicada omitida: ${fechaStr}`);
        }
      };
      
      // Procesar todas las rutinas en el rango de fechas
      rutinas.forEach(rutina => {
        // 1. Verificar si el ítem está completado en la rutina principal
        if (rutina[section]?.[itemId] === true) {
          agregarCompletacion(rutina.fecha, rutina._id, 'rutina_principal');
        }
        
        // 2. Revisar el historial estructurado si existe
        if (rutina.historial && typeof rutina.historial === 'object') {
          // 2.1 Buscar en la estructura sección -> fecha -> items
          if (rutina.historial[section]) {
            Object.entries(rutina.historial[section]).forEach(([fecha, items]) => {
              if (items && items[itemId] === true) {
                agregarCompletacion(fecha, rutina._id, 'historial_seccion');
              }
            });
          }
          
          // 2.2 Buscar en la estructura de rutinas históricas
          if (Array.isArray(rutina.historial.rutinas)) {
            rutina.historial.rutinas.forEach(rutinaHist => {
              if (rutinaHist[section]?.[itemId] === true) {
                agregarCompletacion(rutinaHist.fecha, rutina._id, 'historial_rutinas');
              }
            });
          }
        }
        
        // 3. Revisar estructuras históricas adicionales si existen
        if (rutina.completacionesSemana && rutina.completacionesSemana[section]?.[itemId]) {
          const completacionesItem = rutina.completacionesSemana[section][itemId];
          
          if (Array.isArray(completacionesItem)) {
            completacionesItem.forEach(fecha => {
              agregarCompletacion(fecha, rutina._id, 'completacionesSemana_array');
            });
          } else if (typeof completacionesItem === 'object') {
            Object.entries(completacionesItem).forEach(([fecha, completado]) => {
              if (completado) {
                agregarCompletacion(fecha, rutina._id, 'completacionesSemana_object');
              }
            });
          }
        }
      });
      
      // Ordenar las completaciones por fecha
      completaciones.sort((a, b) => {
        const fechaA = new Date(a.fecha);
        const fechaB = new Date(b.fecha);
        return fechaA - fechaB;
      });
      
      console.log(`[rutinasController] Encontradas ${completaciones.length} completaciones para ${section}.${itemId}`);
      
      // Agrupar completaciones por semana (lun–dom) y mes
      const completacionesPorSemana = {};
      const completacionesPorMes = {};
      
      completaciones.forEach((comp) => {
        const dayKey = toLogicalDayKey(comp.fecha);
        if (!dayKey) return;
        const [y, m, d] = dayKey.split('-').map(Number);
        const dayUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));

        // Lunes = inicio de semana (alineado con CADENCIA_WEEK_STARTS_ON)
        const dayOfWeek = dayUtc.getUTCDay(); // 0=dom … 6=sáb
        const daysFromMonday = (dayOfWeek + 6) % 7;
        const monday = new Date(dayUtc);
        monday.setUTCDate(dayUtc.getUTCDate() - daysFromMonday);
        const claveSemana = `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;

        if (!completacionesPorSemana[claveSemana]) {
          completacionesPorSemana[claveSemana] = [];
        }
        completacionesPorSemana[claveSemana].push(comp);

        const claveMes = `${y}-${String(m).padStart(2, '0')}`;
        if (!completacionesPorMes[claveMes]) {
          completacionesPorMes[claveMes] = [];
        }
        completacionesPorMes[claveMes].push(comp);
      });
      
      return res.json({
        section,
        itemId,
        completaciones,
        completacionesPorSemana,
        completacionesPorMes,
        total: completaciones.length,
        fechas: {
          inicio: inicio.toISOString(),
          fin: fin.toISOString()
        }
      });
      
    } catch (error) {
      console.error('[rutinasController] Error al obtener historial de completaciones:', error);
      res.status(500).json({ 
        error: 'Error al obtener historial de completaciones',
        details: error.message 
      });
    }
  }
}

export const rutinasController = new RutinasController(); 

import { Users, Rutinas } from '../models/index.js';
import bcrypt from 'bcryptjs';
import { timezoneUtils } from '../models/BaseSchema.js';
import { ensureCustomHabits } from '../constants/defaultCustomHabits.js';
import {
  getCustomHabitSections,
  getValidHabitSections,
  isValidHabitSection,
  markCustomHabitsSectionModified,
} from '../utils/habitSectionsUtils.js';
import { findHabitIndexInSection, getHabitId, generateHabitId, validateHabitChains } from '@attadia/shared/habits';

export const usersController = {
  getProfile: async (req, res) => {
    try {
      const user = await Users.findById(req.user.id).select('-password');
      res.json(user);
    } catch (error) {
      console.error('Error al obtener perfil:', error);
      res.status(500).json({ error: 'Error al obtener perfil' });
    }
  },

  updateProfile: async (req, res) => {
    try {
      const { nombre, email, telefono } = req.body;
      
      const user = await Users.findByIdAndUpdate(
        req.user.id,
        { nombre, email, telefono },
        { new: true }
      ).select('-password');

      res.json(user);
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      res.status(500).json({ error: 'Error al actualizar perfil' });
    }
  },

  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Verificar contraseña actual
      const user = await Users.findById(req.user.id);
      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        return res.status(400).json({ error: 'Contraseña actual incorrecta' });
      }

      // Encriptar nueva contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Actualizar contraseña
      await Users.findByIdAndUpdate(req.user.id, { password: hashedPassword });

      res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
  },

  updatePreferences: async (req, res) => {
    try {
      const { preferences } = req.body;

      const user = await Users.findByIdAndUpdate(
        req.user.id,
        { preferences },
        { new: true }
      ).select('-password');

      res.json(user);
    } catch (error) {
      console.error('Error al actualizar preferencias:', error);
      res.status(500).json({ error: 'Error al actualizar preferencias' });
    }
  },

  // Métodos CRUD para administración de usuarios
  searchPublic: async (req, res) => {
    try {
      const q = String(req.query.q || req.query.search || '').trim();
      if (q.length < 2) {
        return res.json({ docs: [] });
      }

      const query = {
        _id: { $ne: req.user.id },
        $or: [
          { nombre: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      };

      const docs = await Users.find(query)
        .select('nombre email')
        .limit(10)
        .lean();

      res.json({
        docs: docs.map((u) => ({
          ...u,
          id: String(u._id),
        })),
      });
    } catch (error) {
      console.error('Error al buscar usuarios:', error);
      res.status(500).json({ error: 'Error al buscar usuarios' });
    }
  },

  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 10, sort = '-createdAt', search } = req.query;
      
      const query = {};
      if (search) {
        query.$or = [
          { nombre: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        select: '-password'
      };
      
      const result = await Users.paginate(query, options);
      res.json(result);
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      res.status(500).json({ error: 'Error al obtener usuarios' });
    }
  },

  getById: async (req, res) => {
    try {
      const user = await Users.findById(req.params.id).select('-password');
      
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      res.json(user);
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      res.status(500).json({ error: 'Error al obtener usuario' });
    }
  },

  update: async (req, res) => {
    try {
      const { nombre, email, telefono, role } = req.body;
      
      const user = await Users.findByIdAndUpdate(
        req.params.id,
        { nombre, email, telefono, role },
        { new: true }
      ).select('-password');
      
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      res.json(user);
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      res.status(500).json({ error: 'Error al actualizar usuario' });
    }
  },

  delete: async (req, res) => {
    try {
      const user = await Users.findByIdAndDelete(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      res.status(500).json({ error: 'Error al eliminar usuario' });
    }
  },

  toggleActive: async (req, res) => {
    try {
      const user = await Users.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      user.activo = !user.activo;
      await user.save();
      
      res.json({
        message: `Usuario ${user.activo ? 'activado' : 'desactivado'} correctamente`,
        activo: user.activo
      });
    } catch (error) {
      console.error('Error al cambiar estado de usuario:', error);
      res.status(500).json({ error: 'Error al cambiar estado de usuario' });
    }
  },

  updateRutinasConfig: async (req, res) => {
    try {
      const { section, item, config } = req.body;
      
      console.log(`Actualizando configuración global de rutina para ${section}.${item}:`, config);
      
      // Verificar que los campos requeridos están presentes
      if (!section || !item || !config) {
        return res.status(400).json({ 
          error: 'Datos incompletos', 
          message: 'Se requiere section, item y config para actualizar la configuración.' 
        });
      }
      
      // Normalizar los valores de configuración
      const normalizedConfig = {
        ...config,
        tipo: (config.tipo || 'DIARIO').toUpperCase(),
        frecuencia: Number(config.frecuencia || 1),
        activo: config.activo !== undefined ? config.activo : true,
        diasSemana: Array.isArray(config.diasSemana) ? config.diasSemana : [],
        diasMes: Array.isArray(config.diasMes) ? config.diasMes : []
      };
      
      // Si tipo es PERSONALIZADO, asegurar que tiene un periodo válido
      if (normalizedConfig.tipo === 'PERSONALIZADO' && !normalizedConfig.periodo) {
        normalizedConfig.periodo = 'CADA_DIA';
      }
      
      console.log('Configuración normalizada:', normalizedConfig);
      console.log('Tipo de frecuencia:', typeof normalizedConfig.frecuencia, normalizedConfig.frecuencia);
      
      // Construir el path para la actualización
      const updatePath = `preferences.rutinasConfig.${section}.${item}`;
      
      // Crear el objeto de actualización
      const updateData = {
        $set: {
          [updatePath]: normalizedConfig
        }
      };
    
      // Actualizar el usuario
      const user = await Users.findByIdAndUpdate(
        req.user.id,
        updateData,
        { new: true }
      ).select('-password');
      
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      // Responder con la configuración actualizada
      res.json({
        message: 'Configuración de rutina actualizada correctamente',
        config: user.preferences.rutinasConfig[section][item]
      });
      
    } catch (error) {
      console.error('Error al actualizar configuración de rutina:', error);
      res.status(500).json({ 
        error: 'Error al actualizar configuración de rutina',
        message: error.message
      });
    }
  },
  
  getDefaultRutinaConfig: async (req, res) => {
    try {
      // Registrar para depuración
      console.log('Obteniendo configuración de rutinas para el usuario:', req.user.id);
      
      // Obtener las preferencias del usuario actual
      const user = await Users.findById(req.user.id)
        .select('preferences.rutinasConfig')
        .lean();
      
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      // Si no hay preferencias o configuración de rutinas, devolver una estructura básica
      if (!user.preferences || !user.preferences.rutinasConfig) {
        console.log('No se encontró configuración de rutinas para el usuario, devolviendo estructura básica');
        return res.json({
          bodyCare: {},
          nutricion: {},
          ejercicio: {},
          cleaning: {},
          _metadata: {
            version: 1,
            generated: true,
            createdAt: new Date()
          }
        });
      }
      
      // Crear una copia de la configuración para no modificar la original
      const config = JSON.parse(JSON.stringify(user.preferences.rutinasConfig || {}));
      
      // Asegurarse de que existan todas las secciones necesarias
      const requiredSections = ['bodyCare', 'nutricion', 'ejercicio', 'cleaning'];
      requiredSections.forEach(section => {
        if (!config[section] || typeof config[section] !== 'object') {
          config[section] = {};
        }
      });
      
      // Verificar metadata
      if (!config._metadata) {
        config._metadata = {
          version: 1,
          generated: true,
          createdAt: new Date()
        };
      }
      
      console.log('Config procesada:', JSON.stringify(config, null, 2));
      
      res.json(config);
    } catch (error) {
      console.error('Error al obtener configuración de rutinas:', error);
      // Devolver una estructura básica en caso de error
      return res.json({
        bodyCare: {},
        nutricion: {},
        ejercicio: {},
        cleaning: {},
        _metadata: {
          version: 1,
          generated: true,
          error: true,
          errorMessage: error.message,
          createdAt: new Date()
        }
      });
    }
  },
  
  /** 
   * Actualiza la plantilla global de cadencia (`preferences.rutinasConfig`).
   */
  updateDefaultRutinaConfig: async (req, res) => {
    try {
      const userId = req.user.id;
      if (!userId) {
        return res.status(401).json({ msg: 'Usuario no autenticado' });
      }

      const user = await Users.findById(userId);
      if (!user) {
        return res.status(404).json({ msg: 'Usuario no encontrado' });
      }

      if (!user.preferences) user.preferences = {};
      if (!user.preferences.rutinasConfig || typeof user.preferences.rutinasConfig !== 'object') {
        user.preferences.rutinasConfig = {
          bodyCare: {},
          nutricion: {},
          ejercicio: {},
          cleaning: {},
          _metadata: { lastUpdated: new Date(), version: 1 },
        };
      }

      const CONFIG_SECTION_SKIP = new Set(['_metadata', '_id', 'buffer']);

      for (const [seccionKey, seccionData] of Object.entries(req.body || {})) {
        if (CONFIG_SECTION_SKIP.has(seccionKey)) continue;
        if (!seccionData || typeof seccionData !== 'object') continue;

        if (!user.preferences.rutinasConfig[seccionKey]) {
          user.preferences.rutinasConfig[seccionKey] = {};
        }

        for (const [itemKey, itemConfig] of Object.entries(seccionData)) {
          if (CONFIG_SECTION_SKIP.has(itemKey) || !itemConfig || typeof itemConfig !== 'object') continue;

          const tipo = String(itemConfig.tipo || 'DIARIO').toUpperCase();
          const frecuenciaRaw = itemConfig.frecuencia?.valor ?? itemConfig.frecuencia ?? 1;
          const frecuencia = Math.max(1, parseInt(frecuenciaRaw, 10) || 1);
          const periodo = itemConfig.periodo
            || itemConfig.frecuencia?.periodo
            || (tipo === 'SEMANAL' ? 'CADA_SEMANA' : tipo === 'MENSUAL' ? 'CADA_MES' : 'CADA_DIA');

          user.preferences.rutinasConfig[seccionKey][itemKey] = {
            tipo,
            frecuencia,
            periodo,
            diasSemana: Array.isArray(itemConfig.diasSemana) ? itemConfig.diasSemana : [],
            diasMes: Array.isArray(itemConfig.diasMes) ? itemConfig.diasMes : [],
            horarios: Array.isArray(itemConfig.horarios) ? itemConfig.horarios : [],
            activo: itemConfig.activo !== false && itemConfig.activado !== false,
          };
        }
      }

      user.preferences.rutinasConfig._metadata = {
        ...(user.preferences.rutinasConfig._metadata || {}),
        lastUpdated: new Date(),
        version: (user.preferences.rutinasConfig._metadata?.version || 0) + 1,
      };

      user.markModified('preferences.rutinasConfig');
      await user.save();

      res.json({
        msg: 'Configuración de rutinas actualizada correctamente',
        rutinasConfig: user.preferences.rutinasConfig,
      });
    } catch (error) {
      console.error('[usersController] Error al actualizar configuración de rutinas:', error);
      res.status(500).json({ 
        msg: 'Error al actualizar la configuración de rutinas',
        error: error.message 
      });
    }
  },
  
  deleteAccount: async (req, res) => {
    try {
      // Eliminar el usuario
      const user = await Users.findByIdAndDelete(req.user.id);
      
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      res.json({ message: 'Cuenta eliminada correctamente' });
    } catch (error) {
      console.error('Error al eliminar cuenta:', error);
      res.status(500).json({ error: 'Error al eliminar cuenta' });
    }
  },

  getAllUsers: async (req, res) => {
    try {
      const users = await Users.find()
        .select('-password')
        .sort({ createdAt: 'desc' });
      res.json(users);
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      res.status(500).json({ error: 'Error al obtener usuarios' });
    }
  },

  updateUserRole: async (req, res) => {
    try {
      const { role } = req.body;
      const user = await Users.findByIdAndUpdate(
        req.params.id,
        { role },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      res.json(user);
    } catch (error) {
      console.error('Error al actualizar rol:', error);
      res.status(500).json({ error: 'Error al actualizar rol' });
    }
  },

  updateUserStatus: async (req, res) => {
    try {
      const { active } = req.body;
      const user = await Users.findByIdAndUpdate(
        req.params.id,
        { active },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      res.json(user);
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      res.status(500).json({ error: 'Error al actualizar estado' });
    }
  },

  create: async (req, res) => {
    try {
      const { nombre, email, password, telefono, role } = req.body;
      
      // Verificar si el usuario ya existe
      const usuarioExistente = await Users.findOne({ email });
      if (usuarioExistente) {
        return res.status(400).json({ error: 'El usuario ya existe' });
      }
      
      // Encriptar la contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Crear el nuevo usuario
      const nuevoUsuario = await Users.create({
        nombre,
        email,
        password: hashedPassword,
        telefono,
        role,
        createdBy: req.user.id
      });
      
      // Devolver el usuario sin la contraseña
      const usuario = nuevoUsuario.toObject();
      delete usuario.password;
      
      res.status(201).json(usuario);
    } catch (error) {
      console.error('Error al crear usuario:', error);
      res.status(500).json({ error: 'Error al crear usuario' });
    }
  },

  /**
   * Obtiene las preferencias de hábitos del usuario
   */
  getHabitPreferences: async (req, res) => {
    try {
      const user = await Users.findById(req.user.id)
        .select('preferences.rutinasConfig preferences.habitChains')
        .lean();
      
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      // Si no hay preferencias de rutinas, devolver un objeto vacío
      if (!user.preferences || !user.preferences.rutinasConfig) {
        return res.json({
          habits: {},
          habitChains: [],
          _metadata: {
            version: 1,
            createdAt: new Date()
          }
        });
      }
      
      const PREF_SECTION_SKIP = new Set(['_metadata', '_id', 'buffer']);

      const rawConfig = user.preferences.rutinasConfig;
      const habits = {};
      Object.keys(rawConfig).forEach((section) => {
        if (PREF_SECTION_SKIP.has(section)) return;
        if (rawConfig[section] && typeof rawConfig[section] === 'object') {
          habits[section] = rawConfig[section];
        }
      });

      const configKeys = Object.keys(habits);
      const totalHabits = configKeys.reduce((acc, section) => {
        const sectionConfig = habits[section];
        return acc + (sectionConfig ? Object.keys(sectionConfig).length : 0);
      }, 0);
      console.log(`[usersController] getHabitPreferences: returning ${totalHabits} habit configs across ${configKeys.length} sections`);
      configKeys.forEach((section) => {
        const sectionConfig = habits[section];
        const habitIds = sectionConfig ? Object.keys(sectionConfig) : [];
        console.log(`[usersController] getHabitPreferences - ${section}: ${habitIds.length} habits`, habitIds);
      });

      res.json({
        habits,
        habitChains: Array.isArray(user.preferences?.habitChains)
          ? user.preferences.habitChains
          : [],
        _metadata: rawConfig._metadata || {
          version: 1,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      console.error('[usersController] Error al obtener preferencias de hábitos:', error);
      res.status(500).json({ 
        error: 'Error al obtener preferencias de hábitos',
        message: error.message
      });
    }
  },
  
  /**
   * Actualiza las preferencias de hábitos específicos
   * Permite actualizar solo los hábitos especificados en la petición,
   * sin sobrescribir otros hábitos
   */
  updateHabitPreferences: async (req, res) => {
    try {
      const { habits } = req.body;
      
      if (!habits || typeof habits !== 'object') {
        return res.status(400).json({ 
          error: 'Datos inválidos',
          message: 'Se requiere un objeto "habits" en el cuerpo de la petición'
        });
      }
      
      console.log('[usersController] Actualizando preferencias de hábitos:', JSON.stringify(habits));
      
      // Obtener el usuario actual
      const user = await Users.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      // Inicializar preferencias y rutinasConfig si no existen
      if (!user.preferences) {
        user.preferences = {};
      }
      
      if (!user.preferences.rutinasConfig) {
        user.preferences.rutinasConfig = {
          _metadata: {
            version: 1,
            lastUpdated: new Date()
          }
        };
      }
      
      // Inicializar secciones si no existen
      ['bodyCare', 'nutricion', 'ejercicio', 'cleaning'].forEach(section => {
        if (!user.preferences.rutinasConfig[section]) {
          user.preferences.rutinasConfig[section] = {};
        }
      });
      
      // Actualizar solo los hábitos específicos
      Object.entries(habits).forEach(([section, items]) => {
        if (section === '_metadata') {
          return; // Ignorar metadata
        }
        
        // Asegurarse de que la sección existe
        if (!user.preferences.rutinasConfig[section]) {
          user.preferences.rutinasConfig[section] = {};
        }
        
        // Actualizar cada ítem en la sección
        Object.entries(items).forEach(([itemId, config]) => {
          console.log(`[usersController] Actualizando configuración para ${section}.${itemId}:`, config);
          
          // Normalizar los valores de configuración
          const tipoNorm = (config.tipo || 'DIARIO').toUpperCase();
          // Para DIARIO/SEMANAL/MENSUAL el periodo debe ser coherente con el tipo.
          // Para PERSONALIZADO respetamos el periodo enviado (con fallback).
          const periodoNorm = (() => {
            if (tipoNorm === 'DIARIO') return 'CADA_DIA';
            if (tipoNorm === 'SEMANAL') return 'CADA_SEMANA';
            if (tipoNorm === 'MENSUAL') return 'CADA_MES';
            return config.periodo || 'CADA_DIA';
          })();

          // Normalizar horarios
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

          const normalizedConfig = {
            tipo: tipoNorm,
            frecuencia: Number(config.frecuencia || 1),
            periodo: periodoNorm,
            activo: config.activo !== undefined ? config.activo : true,
            diasSemana: Array.isArray(config.diasSemana) ? config.diasSemana : [],
            diasMes: Array.isArray(config.diasMes) ? config.diasMes : [],
            horarios: normalizeHorarios(config.horarios),
            esPreferenciaUsuario: true,
            ultimaActualizacion: new Date().toISOString()
          };
          
          // Actualizar la configuración del ítem
          // IMPORTANTE: Asegurar que la sección existe como objeto
          if (!user.preferences.rutinasConfig[section]) {
            user.preferences.rutinasConfig[section] = {};
          }
          user.preferences.rutinasConfig[section][itemId] = normalizedConfig;
          
          // CRÍTICO: Marcar como modificado para que Mongoose guarde campos dinámicos en Schema.Types.Mixed
          user.markModified(`preferences.rutinasConfig.${section}.${itemId}`);
          user.markModified(`preferences.rutinasConfig.${section}`);
          user.markModified('preferences.rutinasConfig');
          
          console.log(`[usersController] Config saved for ${section}.${itemId}:`, JSON.stringify(normalizedConfig));
          // Log para verificar que se guardó en el objeto
          console.log(`[usersController] Verificando guardado - ${section}.${itemId} exists:`, !!user.preferences.rutinasConfig[section][itemId]);
        });
      });
      
      // Actualizar metadata
      user.preferences.rutinasConfig._metadata = {
        ...(user.preferences.rutinasConfig._metadata || {}),
        lastUpdated: new Date(),
        version: ((user.preferences.rutinasConfig._metadata?.version || 0) + 1)
      };
      
      // CRÍTICO: Marcar rutinasConfig como modificado para que Mongoose guarde campos dinámicos
      // Esto es necesario porque Schema.Types.Mixed requiere markModified para campos anidados
      user.markModified('preferences.rutinasConfig');
      
      // Guardar los cambios
      await user.save();
      
      // Verificar que los cambios se guardaron correctamente
      const savedUser = await Users.findById(req.user.id)
        .select('preferences.rutinasConfig')
        .lean();
      Object.entries(habits).forEach(([section, items]) => {
        if (section === '_metadata') return;
        Object.keys(items).forEach(itemId => {
          const savedConfig = savedUser?.preferences?.rutinasConfig?.[section]?.[itemId];
          console.log(`[usersController] Post-save verification - ${section}.${itemId}:`, savedConfig ? 'EXISTS' : 'MISSING', savedConfig ? JSON.stringify(savedConfig).substring(0, 100) : '');
        });
      });

      // --- Aplicar cambios a rutinas existentes ---
      // applyFrom=today | YYYY-MM-DD
      // applyScope=forward (default) | day | none
      const applyFromRaw = (req.query?.applyFrom || req.body?.applyFrom || '').toString().trim();
      const applyScopeRaw = (req.query?.applyScope || req.body?.applyScope || 'forward')
        .toString()
        .trim()
        .toLowerCase();
      let appliedToRutinas = null;

      if (applyFromRaw && applyScopeRaw !== 'none') {
        try {
          const timezone = timezoneUtils.getUserTimezone(user);
          const isYMD = /^\d{4}-\d{2}-\d{2}$/.test(applyFromRaw);
          const applyFromStart = applyFromRaw.toLowerCase() === 'today'
            ? timezoneUtils.normalizeToStartOfDay(new Date(), timezone)
            : (isYMD ? timezoneUtils.normalizeToStartOfDay(applyFromRaw, timezone) : null);

          if (applyFromStart) {
            const setOps = {};
            // Setear solo campos de cadencia (preserva contadores/historial del item en Rutinas.config)
            Object.entries(habits).forEach(([section, items]) => {
              if (section === '_metadata' || !items || typeof items !== 'object') return;
              Object.entries(items).forEach(([itemId, config]) => {
                const normalizedConfig = user.preferences.rutinasConfig?.[section]?.[itemId];
                if (!normalizedConfig) return;

                setOps[`config.${section}.${itemId}.tipo`] = normalizedConfig.tipo;
                setOps[`config.${section}.${itemId}.frecuencia`] = normalizedConfig.frecuencia;
                setOps[`config.${section}.${itemId}.periodo`] = normalizedConfig.periodo;
                setOps[`config.${section}.${itemId}.activo`] = normalizedConfig.activo;
                setOps[`config.${section}.${itemId}.diasSemana`] = Array.isArray(normalizedConfig.diasSemana) ? normalizedConfig.diasSemana : [];
                setOps[`config.${section}.${itemId}.diasMes`] = Array.isArray(normalizedConfig.diasMes) ? normalizedConfig.diasMes : [];
                setOps[`config.${section}.${itemId}.horarios`] = normalizedConfig.horarios || [];
              });
            });

            if (Object.keys(setOps).length > 0) {
              const fechaFilter = applyScopeRaw === 'day'
                ? applyFromStart
                : { $gte: applyFromStart };
              const result = await Rutinas.updateMany(
                { usuario: req.user.id, fecha: fechaFilter },
                { $set: setOps }
              );
              appliedToRutinas = {
                from: applyFromStart.toISOString(),
                applyFrom: applyFromRaw,
                applyScope: applyScopeRaw === 'day' ? 'day' : 'forward',
                matched: result.matchedCount ?? result.n ?? 0,
                modified: result.modifiedCount ?? result.nModified ?? 0
              };
            } else {
              appliedToRutinas = {
                from: applyFromStart.toISOString(),
                applyFrom: applyFromRaw,
                applyScope: applyScopeRaw === 'day' ? 'day' : 'forward',
                matched: 0,
                modified: 0
              };
            }
          }
        } catch (e) {
          // No romper la respuesta principal si falla la propagación; devolvemos indicador
          appliedToRutinas = { error: e?.message || 'Error aplicando cambios a rutinas desde la fecha indicada' };
        }
      }
      
      res.json({
        message: 'Preferencias de hábitos actualizadas correctamente',
        updated: true,
        appliedToRutinas,
        // Devolver solo los hábitos actualizados
        updatedHabits: Object.entries(habits).reduce((acc, [section, items]) => {
          if (section === '_metadata') return acc;
          
          acc[section] = {};
          Object.keys(items).forEach(itemId => {
            acc[section][itemId] = user.preferences.rutinasConfig[section][itemId];
          });
          
          return acc;
        }, {})
      });
    } catch (error) {
      console.error('[usersController] Error al actualizar preferencias de hábitos:', error);
      res.status(500).json({ 
        error: 'Error al actualizar preferencias de hábitos',
        message: error.message
      });
    }
  },

  // ========== ENDPOINTS PARA GESTIÓN DE HÁBITOS PERSONALIZADOS ==========
  
  /**
   * Obtener hábitos personalizados del usuario
   * GET /api/users/habits
   */
  getHabits: async (req, res) => {
    try {
      const user = await Users.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      if (!user.customHabits) {
        ensureCustomHabits(user, { seedDefaults: true });
        await user.save();
      }

      const customSections = getCustomHabitSections(user);
      ensureCustomHabits(user, { seedDefaults: false });
      customSections.forEach((section) => {
        if (section?.id && !Array.isArray(user.customHabits[section.id])) {
          user.customHabits[section.id] = [];
        }
      });

      res.json({
        habits: user.customHabits,
        customSections,
      });
    } catch (error) {
      console.error('[usersController] Error al obtener hábitos:', error);
      res.status(500).json({ 
        error: 'Error al obtener hábitos',
        message: error.message
      });
    }
  },

  /**
   * Crear nuevo grupo de hábitos personalizado
   * POST /api/users/habit-sections
   * Body: { label, icon }
   */
  addHabitSection: async (req, res) => {
    try {
      const { label, icon } = req.body;
      const trimmedLabel = (label || '').trim();

      if (!trimmedLabel) {
        return res.status(400).json({ error: 'El nombre del grupo es requerido' });
      }

      if (!icon) {
        return res.status(400).json({ error: 'Debe seleccionar un icono' });
      }

      const user = await Users.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      ensureCustomHabits(user, { seedDefaults: false });

      if (!user.preferences) {
        user.preferences = {};
      }

      const existingSections = getCustomHabitSections(user);
      const existingIds = new Set(getValidHabitSections(user));
      const existingLabels = new Set(
        existingSections.map((section) => (section.label || '').trim().toLowerCase()),
      );

      if (existingLabels.has(trimmedLabel.toLowerCase())) {
        return res.status(409).json({ error: 'Ya existe un grupo con ese nombre' });
      }

      let sectionId = generateHabitId(trimmedLabel);
      if (!sectionId) {
        return res.status(400).json({ error: 'Nombre de grupo no válido' });
      }

      let counter = 1;
      const baseId = sectionId;
      while (existingIds.has(sectionId)) {
        sectionId = `${baseId}${counter}`;
        counter += 1;
      }

      const newSection = {
        id: sectionId,
        label: trimmedLabel,
        icon,
        orden: existingSections.length,
      };

      user.preferences.customHabitSections = [...existingSections, newSection];
      user.customHabits[sectionId] = [];
      if (!user.preferences.rutinasConfig) {
        user.preferences.rutinasConfig = {};
      }
      if (!user.preferences.rutinasConfig[sectionId]) {
        user.preferences.rutinasConfig[sectionId] = {};
      }

      user.markModified('preferences');
      user.markModified('preferences.customHabitSections');
      user.markModified('preferences.rutinasConfig');
      user.markModified('customHabits');
      user.markModified(`customHabits.${sectionId}`);

      await user.save();

      res.json({
        message: 'Grupo creado correctamente',
        section: newSection,
        customSections: getCustomHabitSections(user),
      });
    } catch (error) {
      console.error('[usersController] Error al crear grupo de hábitos:', error);
      res.status(500).json({
        error: 'Error al crear grupo de hábitos',
        message: error.message,
      });
    }
  },

  /**
   * Actualizar grupo de hábitos personalizado
   * PUT /api/users/habit-sections/:sectionId
   * Body: { label, icon }
   */
  updateHabitSection: async (req, res) => {
    try {
      const { sectionId } = req.params;
      const { label, icon } = req.body;
      const trimmedLabel = (label || '').trim();

      if (!trimmedLabel) {
        return res.status(400).json({ error: 'El nombre del grupo es requerido' });
      }
      if (!icon) {
        return res.status(400).json({ error: 'Debe seleccionar un icono' });
      }

      const user = await Users.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      if (!isValidHabitSection(user, sectionId) || !getCustomHabitSections(user).some((s) => s.id === sectionId)) {
        return res.status(400).json({ error: 'Solo se pueden editar grupos personalizados' });
      }

      const existingSections = getCustomHabitSections(user);
      const sectionIndex = existingSections.findIndex((s) => s.id === sectionId);
      if (sectionIndex === -1) {
        return res.status(404).json({ error: 'Grupo no encontrado' });
      }

      const duplicateLabel = existingSections.some(
        (section, index) => index !== sectionIndex
          && (section.label || '').trim().toLowerCase() === trimmedLabel.toLowerCase(),
      );
      if (duplicateLabel) {
        return res.status(409).json({ error: 'Ya existe un grupo con ese nombre' });
      }

      const updatedSection = {
        ...existingSections[sectionIndex],
        label: trimmedLabel,
        icon,
      };
      const nextSections = [...existingSections];
      nextSections[sectionIndex] = updatedSection;

      user.preferences.customHabitSections = nextSections;
      user.markModified('preferences');
      user.markModified('preferences.customHabitSections');

      await user.save();

      res.json({
        message: 'Grupo actualizado correctamente',
        section: updatedSection,
        customSections: getCustomHabitSections(user),
      });
    } catch (error) {
      console.error('[usersController] Error al actualizar grupo de hábitos:', error);
      res.status(500).json({
        error: 'Error al actualizar grupo de hábitos',
        message: error.message,
      });
    }
  },

  /**
   * Eliminar grupo de hábitos personalizado
   * DELETE /api/users/habit-sections/:sectionId
   */
  deleteHabitSection: async (req, res) => {
    try {
      const { sectionId } = req.params;

      const user = await Users.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      if (!getCustomHabitSections(user).some((s) => s.id === sectionId)) {
        return res.status(404).json({ error: 'Grupo no encontrado' });
      }

      ensureCustomHabits(user, { seedDefaults: false });
      const habitCount = Array.isArray(user.customHabits?.[sectionId])
        ? user.customHabits[sectionId].length
        : 0;
      if (habitCount > 0) {
        return res.status(400).json({
          error: 'Elimina o mueve los hábitos antes de eliminar el grupo',
        });
      }

      user.preferences.customHabitSections = getCustomHabitSections(user)
        .filter((section) => section.id !== sectionId);

      if (user.customHabits?.[sectionId]) {
        delete user.customHabits[sectionId];
        markCustomHabitsSectionModified(user, sectionId);
      }
      if (user.preferences?.rutinasConfig?.[sectionId]) {
        delete user.preferences.rutinasConfig[sectionId];
        user.markModified('preferences.rutinasConfig');
      }

      user.markModified('preferences');
      user.markModified('preferences.customHabitSections');

      await user.save();

      res.json({
        message: 'Grupo eliminado correctamente',
        customSections: getCustomHabitSections(user),
      });
    } catch (error) {
      console.error('[usersController] Error al eliminar grupo de hábitos:', error);
      res.status(500).json({
        error: 'Error al eliminar grupo de hábitos',
        message: error.message,
      });
    }
  },

  /**
   * Crear nuevo hábito personalizado
   * POST /api/users/habits
   * Body: { section, habit: { id, label, icon, activo, orden } }
   */
  addHabit: async (req, res) => {
    try {
      const { section, habit } = req.body;

      const user = await Users.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      if (!isValidHabitSection(user, section)) {
        return res.status(400).json({ error: 'Sección inválida' });
      }

      if (!habit || !habit.id || !habit.label || !habit.icon) {
        return res.status(400).json({ error: 'Datos de hábito incompletos (requiere: id, label, icon)' });
      }

      ensureCustomHabits(user, { seedDefaults: false });

      if (!Array.isArray(user.customHabits[section])) {
        user.customHabits[section] = [];
        user.markModified(`customHabits.${section}`);
      }

      // Verificar que el ID no exista ya en la sección
      if (user.customHabits[section].some(h => h.id === habit.id)) {
        return res.status(409).json({ error: 'Ya existe un hábito con ese ID en esta sección' });
      }

      // Agregar el nuevo hábito
      const newHabit = {
        id: habit.id,
        label: habit.label,
        icon: habit.icon,
        activo: habit.activo !== undefined ? habit.activo : true,
        orden: habit.orden !== undefined ? habit.orden : user.customHabits[section].length
      };

      user.customHabits[section].push(newHabit);
      markCustomHabitsSectionModified(user, section);
      await user.save();

      res.json({ message: 'Hábito creado correctamente', habit: newHabit });
    } catch (error) {
      console.error('[usersController] Error al crear hábito:', error);
      res.status(500).json({ 
        error: 'Error al crear hábito',
        message: error.message
      });
    }
  },

  /**
   * Actualizar hábito existente
   * PUT /api/users/habits/:habitId
   * Body: { section, habit: { label?, icon?, activo?, orden? } }
   */
  updateHabit: async (req, res) => {
    try {
      const { habitId } = req.params;
      const { section, habit } = req.body;

      const user = await Users.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      if (!isValidHabitSection(user, section)) {
        return res.status(400).json({ error: 'Sección inválida' });
      }

      if (!habit || Object.keys(habit).length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron datos para actualizar' });
      }

      if (!user.customHabits || !user.customHabits[section]) {
        return res.status(404).json({ error: 'Sección no encontrada' });
      }

      const habitIndex = findHabitIndexInSection(user.customHabits[section], habitId);
      if (habitIndex === -1) {
        return res.status(404).json({ error: 'Hábito no encontrado' });
      }

      // Actualizar solo los campos proporcionados
      if (habit.label !== undefined) user.customHabits[section][habitIndex].label = habit.label;
      if (habit.icon !== undefined) user.customHabits[section][habitIndex].icon = habit.icon;
      if (habit.activo !== undefined) user.customHabits[section][habitIndex].activo = habit.activo;
      if (habit.orden !== undefined) user.customHabits[section][habitIndex].orden = habit.orden;

      markCustomHabitsSectionModified(user, section);
      await user.save();

      res.json({ 
        message: 'Hábito actualizado correctamente', 
        habit: user.customHabits[section][habitIndex] 
      });
    } catch (error) {
      console.error('[usersController] Error al actualizar hábito:', error);
      res.status(500).json({ 
        error: 'Error al actualizar hábito',
        message: error.message
      });
    }
  },

  /**
   * Eliminar hábito
   * DELETE /api/users/habits/:habitId
   * Body: { section }
   */
  deleteHabit: async (req, res) => {
    try {
      const { habitId } = req.params;
      const { section } = req.body;

      const user = await Users.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      if (!isValidHabitSection(user, section)) {
        return res.status(400).json({ error: 'Sección inválida' });
      }

      if (!user.customHabits || !user.customHabits[section]) {
        return res.status(404).json({ error: 'Sección no encontrada' });
      }

      const habitIndex = findHabitIndexInSection(user.customHabits[section], habitId);
      if (habitIndex === -1) {
        return res.status(404).json({ error: 'Hábito no encontrado' });
      }

      const habitToDelete = user.customHabits[section][habitIndex];
      const canonicalId = getHabitId(habitToDelete) || String(habitId);

      const isCustomSection = getCustomHabitSections(user).some((s) => s.id === section);
      if (user.customHabits[section].length <= 1 && !isCustomSection) {
        return res.status(400).json({ error: 'No se puede eliminar el último hábito de la sección' });
      }

      user.customHabits[section].splice(habitIndex, 1);
      markCustomHabitsSectionModified(user, section);

      if (user.preferences?.rutinasConfig?.[section]?.[canonicalId]) {
        delete user.preferences.rutinasConfig[section][canonicalId];
        user.markModified('preferences.rutinasConfig');
      }
      if (user.preferences?.rutinasConfig?.[section]?.[habitId]
        && String(habitId) !== canonicalId) {
        delete user.preferences.rutinasConfig[section][habitId];
        user.markModified('preferences.rutinasConfig');
      }

      await user.save();

      res.json({ message: 'Hábito eliminado correctamente' });
    } catch (error) {
      console.error('[usersController] Error al eliminar hábito:', error);
      res.status(500).json({ 
        error: 'Error al eliminar hábito',
        message: error.message
      });
    }
  },

  /**
   * Reordenar hábitos en una sección
   * PUT /api/users/habits/reorder
   * Body: { section, habitIds: [id1, id2, ...] }
   */
  reorderHabits: async (req, res) => {
    try {
      const { section, habitIds } = req.body;

      console.log('[usersController.reorderHabits] Recibido:', { section, habitIds, bodyKeys: Object.keys(req.body), bodyType: typeof req.body });

      // Validar sección
      if (!section) {
        console.error('[usersController.reorderHabits] Sección faltante');
        return res.status(400).json({ error: 'Sección inválida', received: section });
      }

      const user = await Users.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      if (!isValidHabitSection(user, section)) {
        console.error('[usersController.reorderHabits] Sección no válida:', section);
        return res.status(400).json({ error: 'Sección inválida', received: section });
      }

      // Validar habitIds
      if (!habitIds) {
        console.error('[usersController.reorderHabits] habitIds faltante');
        return res.status(400).json({ error: 'Se requiere un array de IDs de hábitos', received: habitIds });
      }
      
      if (!Array.isArray(habitIds)) {
        console.error('[usersController.reorderHabits] habitIds no es un array:', typeof habitIds, habitIds);
        return res.status(400).json({ error: 'Se requiere un array de IDs de hábitos', received: { type: typeof habitIds, value: habitIds } });
      }
      
      if (habitIds.length === 0) {
        console.error('[usersController.reorderHabits] habitIds está vacío');
        return res.status(400).json({ error: 'Se requiere al menos un ID de hábito', received: habitIds });
      }

      ensureCustomHabits(user, { seedDefaults: false });

      // Asegurar que la sección existe y es un array
      if (!user.customHabits[section]) {
        user.customHabits[section] = [];
      }

      // Convertir a array si no lo es (por si acaso)
      if (!Array.isArray(user.customHabits[section])) {
        console.warn('[usersController.reorderHabits] customHabits[section] no es un array, convirtiendo...');
        user.customHabits[section] = Object.values(user.customHabits[section] || {});
      }

      // Verificar que todos los IDs existen
      const existingIds = user.customHabits[section].map(h => {
        const id = h.id || h._id?.toString() || h._id;
        return id ? id.toString() : null;
      }).filter(Boolean);
      
      // Normalizar habitIds a strings para comparación
      const normalizedHabitIds = habitIds.map(id => {
        if (id == null || id === '') return null;
        return id.toString();
      }).filter(Boolean);
      
      console.log('[usersController.reorderHabits] Comparando IDs:', {
        existingIds,
        receivedIds: normalizedHabitIds,
        existingCount: existingIds.length,
        receivedCount: normalizedHabitIds.length,
        sectionHabits: user.customHabits[section].map(h => ({ id: h.id, _id: h._id, label: h.label }))
      });
      
      // Verificar que todos los IDs recibidos existen en customHabits
      const invalidIds = normalizedHabitIds.filter(id => !existingIds.includes(id));
      
      if (invalidIds.length > 0) {
        const debugInfo = {
          invalidIds, 
          existingIds, 
          received: normalizedHabitIds,
          sectionHabits: user.customHabits[section].map(h => ({ 
            id: h.id, 
            _id: h._id?.toString(), 
            label: h.label,
            idType: typeof h.id,
            _idType: typeof h._id
          })),
          receivedCount: normalizedHabitIds.length,
          existingCount: existingIds.length
        };
        console.error('[usersController.reorderHabits] IDs inválidos:', debugInfo);
        return res.status(400).json({ 
          error: 'Algunos IDs no existen en customHabits', 
          message: `Los siguientes IDs no se encontraron en customHabits: ${invalidIds.join(', ')}`,
          invalidIds,
          existingIds,
          received: normalizedHabitIds,
          sectionHabits: user.customHabits[section].map(h => ({ id: h.id, _id: h._id?.toString(), label: h.label })),
          debug: debugInfo
        });
      }
      
      // Verificar que el número de IDs coincide (pero no fallar si hay diferencia, solo advertir)
      if (normalizedHabitIds.length !== existingIds.length) {
        console.warn('[usersController.reorderHabits] Número de IDs no coincide:', {
          received: normalizedHabitIds.length,
          existing: existingIds.length,
          receivedIds: normalizedHabitIds,
          existingIds: existingIds
        });
        // Si hay más IDs recibidos que existentes, puede ser un error
        if (normalizedHabitIds.length > existingIds.length) {
          return res.status(400).json({ 
            error: 'Se recibieron más IDs de los que existen en customHabits',
            received: normalizedHabitIds.length,
            existing: existingIds.length,
            receivedIds: normalizedHabitIds,
            existingIds: existingIds
          });
        }
      }

      // Verificar que el número de IDs coincide
      if (habitIds.length !== existingIds.length) {
        console.warn('[usersController.reorderHabits] Número de IDs no coincide:', {
          received: habitIds.length,
          existing: existingIds.length
        });
      }

      // Reordenar según el array proporcionado
      const reorderedHabits = normalizedHabitIds.map((id, index) => {
        const habit = user.customHabits[section].find(h => {
          const habitId = (h.id || h._id?.toString() || h._id)?.toString();
          return habitId === id;
        });
        if (!habit) {
          console.error('[usersController.reorderHabits] Hábito no encontrado durante reordenamiento:', { id, index, availableHabits: user.customHabits[section].map(h => ({ id: h.id, _id: h._id?.toString() })) });
          throw new Error(`Hábito con ID ${id} no encontrado`);
        }
        const habitObj = habit.toObject ? habit.toObject() : (typeof habit === 'object' ? { ...habit } : habit);
        return { 
          ...habitObj, 
          orden: index 
        };
      });

      user.customHabits[section] = reorderedHabits;
      markCustomHabitsSectionModified(user, section);
      await user.save();

      console.log('[usersController.reorderHabits] Hábitos reordenados correctamente');

      res.json({ 
        message: 'Hábitos reordenados correctamente', 
        habits: user.customHabits[section] 
      });
    } catch (error) {
      console.error('[usersController] Error al reordenar hábitos:', error);
      res.status(500).json({ 
        error: 'Error al reordenar hábitos',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  /**
   * Actualiza rutinas encadenadas (habitChains).
   * PUT /api/users/habit-chains
   */
  updateHabitChains: async (req, res) => {
    try {
      const { habitChains } = req.body;

      if (!Array.isArray(habitChains)) {
        return res.status(400).json({
          error: 'Datos inválidos',
          message: 'Se requiere un array "habitChains"',
        });
      }

      const user = await Users.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      ensureCustomHabits(user, { seedDefaults: false });
      const validationErrors = validateHabitChains(habitChains, user.customHabits || {});
      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: 'Cadenas inválidas',
          message: validationErrors.join('; '),
          details: validationErrors,
        });
      }

      if (!user.preferences) {
        user.preferences = {};
      }
      user.preferences.habitChains = habitChains;
      user.markModified('preferences');
      user.markModified('preferences.habitChains');
      await user.save();

      res.json({
        message: 'Cadenas de hábitos actualizadas',
        habitChains: user.preferences.habitChains,
      });
    } catch (error) {
      console.error('[usersController] Error al actualizar habitChains:', error);
      res.status(500).json({
        error: 'Error al actualizar cadenas de hábitos',
        message: error.message,
      });
    }
  },
}; 
import mongoose from 'mongoose';
import { google } from 'googleapis';
import { Users, Tareas } from '../models/index.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { randomUUID } from 'crypto';
import {
  appendRecurrenceToNotes,
  cleanDescriptionFromGoogleNotes,
  inferRecurrenceFromGoogleNotes,
  parseRecurrenceFromNotes,
  resolveRruleFromNotes,
} from '../utils/recurrenceUtils.js';
import {
  reconcileSeriesFromGoogle,
  expandAllSeriesForUser,
} from './googleTasksRecurrenceService.js';
import { mergeGoogleDueWithLocalSchedule } from '../utils/googleTasksScheduleMerge.js';
import {
  appendScheduleToNotes,
  isTimedScheduleInstant,
  parseScheduleFromNotes,
  taskHasTimedSchedule,
} from '../../../shared/utils/googleTasksScheduleNotes.js';

class GoogleTasksService {
  constructor() {
    this.oauthClients = new Map();
    this.tasksClients = new Map();
    this.rateLimitDelay = 100;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.taskListCache = new Map();
  }

  clearTaskListCache() {
    this.taskListCache.clear();
  }

  /** Import completo solo si no hubo sync reciente o se fuerza (GTASKS_FULL_IMPORT_HOURS, default 24h). */
  shouldFullImportFromGoogle(user, options = {}) {
    if (options.fullImport === true) return true;
    if (options.fullImport === false) return false;
    const hours = parseInt(process.env.GTASKS_FULL_IMPORT_HOURS || '24', 10);
    const lastSync = user?.googleTasksConfig?.lastSync;
    if (!lastSync) return true;
    const ageMs = Date.now() - new Date(lastSync).getTime();
    return ageMs > hours * 60 * 60 * 1000;
  }

  getOAuthClient(userId) {
    const uid = String(userId);
    if (!this.oauthClients.has(uid)) {
      const oauth = new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        `${config.backendUrl}/api/google-tasks/callback`
      );
      if (typeof oauth.setMaxListeners === 'function') {
        oauth.setMaxListeners(50);
      }
      this.oauthClients.set(uid, oauth);
    }
    return this.oauthClients.get(uid);
  }

  getTasksApi(userId) {
    const uid = String(userId);
    if (!this.tasksClients.has(uid)) {
      const oauth = this.getOAuthClient(uid);
      const quotaSuffix = uid.slice(-12);
      this.tasksClients.set(
        uid,
        google.tasks({
          version: 'v1',
          auth: oauth,
          params: { quotaUser: `attadia-${quotaSuffix}` }
        })
      );
    }
    return this.tasksClients.get(uid);
  }

  /**
   * Configura las credenciales OAuth2 para un usuario específico con manejo automático de refresh
   */
  async setUserCredentials(userId) {
    const uid = String(userId);
    const user = await Users.findById(userId);
    if (!user || !user.googleTasksConfig.accessToken) {
      throw new Error('Usuario no tiene configuración de Google Tasks');
    }

    const oauth = this.getOAuthClient(uid);
    oauth.setCredentials({
      access_token: user.googleTasksConfig.accessToken,
      refresh_token: user.googleTasksConfig.refreshToken
    });

    if (!oauth._attadiaTokensListener) {
      oauth.on('tokens', async (tokens) => {
        if (tokens.access_token) {
          logger.sync(`🔄 Tokens actualizados automáticamente para usuario ${uid}`);
          const current = await Users.findById(userId);
          await Users.findByIdAndUpdate(userId, {
            'googleTasksConfig.accessToken': tokens.access_token,
            'googleTasksConfig.refreshToken':
              tokens.refresh_token || current?.googleTasksConfig?.refreshToken,
            'googleTasksConfig.lastTokenRefresh': new Date(),
            'googleTasksConfig.tokenError': null,
            'googleTasksConfig.tokenErrorDate': null
          });
        }
      });
      oauth._attadiaTokensListener = true;
    }

    return user;
  }

  /**
   * Lista todas las tareas de una TaskList con paginación.
   * Cachea por taskListId durante la corrida actual.
   */
  async listAllTasksInList(taskListId, userId, options = {}) {
    // Cache básica por corrida (omitir si skipCache — p. ej. listado completo para soft-unlink)
    if (!options.skipCache && this.taskListCache.has(taskListId)) {
      return this.taskListCache.get(taskListId);
    }
    const tasksApi = this.getTasksApi(userId);
    const items = [];
    let pageToken = undefined;
    do {
      const resp = await this.executeWithRetry(
        () => tasksApi.tasks.list({
          tasklist: taskListId,
          showCompleted: options.showCompleted ?? true,
          showHidden: options.showHidden ?? true,
          showDeleted: options.showDeleted ?? false,
          maxResults: options.maxResults ?? 100,
          fields: options.fields ?? 'items(id,title,notes,status,updated,due,parent,position),nextPageToken',
          pageToken,
          // updatedMin solo para import desde Google (no usar para cache usada en subtareas)
          updatedMin: options.updatedMin
        }),
        `listar tareas de TaskList ${taskListId}`,
        userId
      );
      const batch = resp.data.items || [];
      items.push(...batch);
      pageToken = resp.data.nextPageToken;
    } while (pageToken);
    if (!options.skipCache) {
      this.taskListCache.set(taskListId, items);
    }
    return items;
  }

  /**
   * Ejecuta una operación con retry automático siguiendo las mejores prácticas de Google
   */
  async executeWithRetry(operation, context = '', userId = null) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Rate limiting
        if (attempt > 1) {
          await this.delay(this.rateLimitDelay * attempt);
        }
        
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error;
        
        // Manejar errores específicos de OAuth2 primero
        if (userId && (error.message?.includes('invalid_grant') || 
                      error.response?.data?.error === 'invalid_grant')) {
          await this.handleOAuthError(error, userId);
        }
        
        // Verificar si es un error que vale la pena reintentar
        if (this.shouldRetry(error, attempt)) {
          logger.warn(`⚠️ Intento ${attempt}/${this.maxRetries} falló para ${context}:`, error.message);
          // Backoff exponencial con jitter (25%)
          const base = this.retryDelay * Math.pow(2, attempt - 1);
          const jitter = Math.floor(Math.random() * Math.ceil(base * 0.25));
          await this.delay(base + jitter);
          continue;
        } else {
          // Error no recuperable, fallar inmediatamente
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Determina si un error debe ser reintentado
   */
  shouldRetry(error, attempt) {
    if (attempt >= this.maxRetries) return false;

    // Nunca reintentar si la cuota se excedió (no es recuperable en el mismo ciclo)
    const errorMessage = String(error?.message || error?.response?.data?.error?.message || '');
    const reasons = [
      error?.response?.data?.error?.errors?.[0]?.reason,
      error?.errors?.[0]?.reason
    ].filter(Boolean);
    if (
      errorMessage.includes('quotaExceeded') ||
      errorMessage.includes('userRateLimitExceeded') ||
      reasons.includes('quotaExceeded') ||
      reasons.includes('userRateLimitExceeded')
    ) {
      return false;
    }
    
    const retryableErrors = [
      'rateLimitExceeded',
      'internalError',
      'backendError',
      'timeout'
    ];
    
    // Códigos de error HTTP que son reintentatables
    const retryableHttpCodes = [429, 500, 502, 503, 504];
    
    // Convertir errorCode a string para evitar errores de tipo
    const errorCode = String(error.code || error.status || '');
    const httpStatus = parseInt(error.code || error.status || 0);
    
    // Verificar si el error es reintentable por código de texto o código HTTP
    return retryableErrors.some(retryableError => 
      errorCode.includes(retryableError) || 
      errorMessage.includes(retryableError)
    ) || retryableHttpCodes.includes(httpStatus);
  }

  /**
   * Detecta errores de cuota para cortar ciclos/lotes
   */
  isQuotaError(error) {
    const msg = String(error?.message || error?.response?.data?.error?.message || '');
    const reason = error?.response?.data?.error?.errors?.[0]?.reason;
    return (
      msg.includes('quotaExceeded') ||
      msg.includes('userRateLimitExceeded') ||
      reason === 'quotaExceeded' ||
      reason === 'userRateLimitExceeded'
    );
  }

  /**
   * Backwards-compat: algunos flujos antiguos chequean "quota o userRateLimit"
   */
  isQuotaOrUserRateLimit(error) {
    return this.isQuotaError(error);
  }

  /**
   * Categoriza errores en razones estándar para métricas/SLIs
   */
  categorizeError(error) {
    try {
      if (this.isQuotaError(error)) return 'quota';
      const status = Number(error?.status || error?.code || 0);
      const msg = String(error?.message || error?.response?.data?.error?.message || '').toLowerCase();
      const reason = (error?.response?.data?.error?.errors?.[0]?.reason || '').toLowerCase();

      if (status === 401 || msg.includes('unauthorized') || reason === 'autherror') return 'auth';
      if (msg.includes('invalid_grant')) return 'auth';
      if (status === 404 || msg.includes('not found')) return 'not_found';
      if (status === 403 || msg.includes('forbidden')) return 'forbidden';
      if (status === 400 && (msg.includes('missing task id') || reason.includes('invalid'))) return 'validation';
      if ([500, 502, 503, 504].includes(status) || reason.includes('backenderror') || reason.includes('internalerror')) return 'server';
      if (status === 0 && msg.includes('network')) return 'network';
      return 'other';
    } catch {
      return 'other';
    }
  }

  /**
   * Formatea un error para logs/resultado de forma segura
   */
  formatErrorForLog(error) {
    try {
      const status = error?.status || error?.code || null;
      const reason = error?.response?.data?.error?.errors?.[0]?.reason || error?.errors?.[0]?.reason || null;
      const message = error?.message || error?.response?.data?.error?.message || String(error || '');
      const details = [];
      if (status) details.push(`status=${status}`);
      if (reason) details.push(`reason=${reason}`);
      details.push(`msg=${message}`);
      return details.join(' | ');
    } catch (e) {
      return String(error?.message || error || 'unknown error');
    }
  }

  /**
   * Verifica acceso a una TaskList:
   * - si recibe un `objetivo`, valida/crea y persiste `googleTaskListId`
   * - si recibe un `taskListId` (string), solo valida acceso y retorna el mismo id
   */
  async ensureTaskListAccessible(taskListOrObjetivo, userId) {
    const tasksApi = this.getTasksApi(userId);
    // Caso 1: string -> verificar acceso y devolver
    if (typeof taskListOrObjetivo === 'string') {
      const taskListId = taskListOrObjetivo;
      await this.executeWithRetry(
        () => tasksApi.tasklists.get({ tasklist: taskListId }),
        `verificar TaskList ${taskListId}`,
        userId
      );
      return taskListId;
    }

    // Caso 2: objetivo -> validar, re-vincular por nombre o crear TaskList
    const objetivo = taskListOrObjetivo;
    if (objetivo?.googleTasksSync?.googleTaskListId) {
      try {
        await this.executeWithRetry(
          () => tasksApi.tasklists.get({ tasklist: objetivo.googleTasksSync.googleTaskListId }),
          `verificar TaskList ${objetivo.googleTasksSync.googleTaskListId}`,
          userId
        );
        return objetivo.googleTasksSync.googleTaskListId;
      } catch (err) {
        if (err?.status !== 404 && err?.status !== 403) {
          throw err;
        }
        logger.warn(
          `TaskList inaccesible para "${objetivo?.nombre}", buscando lista existente por nombre...`,
        );
        objetivo.googleTasksSync.googleTaskListId = null;
      }
    }

    await this.setUserCredentials(userId);
    const googleLists = await this.listAllGoogleTaskLists(userId);
    const index = this.buildGoogleTaskListIndex(googleLists);
    const existing = this.findGoogleTaskListForObjetivo(objetivo, index);
    if (existing) {
      this.applyGoogleTaskListSyncToObjetivo(objetivo, existing);
      await objetivo.save();
      await this.propagateGoogleTaskListIdToTareas(objetivo._id, existing.id, userId);
      logger.sync(`🔗 Re-vinculada TaskList "${existing.title}" para objetivo "${objetivo.nombre}"`);
      return existing.id;
    }

    const createResp = await this.executeWithRetry(
      () => tasksApi.tasklists.insert({ requestBody: { title: objetivo?.nombre } }),
      `crear TaskList para ${objetivo?.nombre}`,
      userId
    );

    this.applyGoogleTaskListSyncToObjetivo(objetivo, createResp.data);
    await objetivo.save();
    await this.propagateGoogleTaskListIdToTareas(objetivo._id, createResp.data.id, userId);
    return createResp.data.id;
  }

  /**
   * Maneja errores específicos de OAuth2 y tokens
   */
  async handleOAuthError(error, userId) {
    const errorMessage = String(error.message || '');
    const errorData = error.response?.data || {};
    
    // Detectar error de token inválido
    if (errorMessage.includes('invalid_grant') || 
        errorData.error === 'invalid_grant' ||
        error.status === 400 && errorData.error === 'invalid_grant') {
      
      logger.warn(`🔑 Token inválido detectado para usuario ${userId}, limpiando credenciales`);
      
      // Limpiar tokens inválidos del usuario
      await Users.findByIdAndUpdate(userId, {
        'googleTasksConfig.enabled': false,
        'googleTasksConfig.accessToken': null,
        'googleTasksConfig.refreshToken': null,
        'googleTasksConfig.lastSync': null,
        'googleTasksConfig.tokenError': 'invalid_grant',
        'googleTasksConfig.tokenErrorDate': new Date()
      });
      
      throw new Error('TOKEN_INVALID: Los tokens de Google Tasks han expirado. Por favor, reconecta tu cuenta de Google.');
    }
    
    // Detectar otros errores de autenticación
    if (error.status === 401 || errorMessage.includes('unauthorized')) {
      logger.warn(`🔐 Error de autorización para usuario ${userId}`);
      throw new Error('AUTH_ERROR: Error de autorización con Google Tasks. Por favor, reconecta tu cuenta.');
    }
    
    // Re-lanzar otros errores sin modificar
    throw error;
  }

  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Optimiza operaciones en lote para reducir llamadas a la API
   */
  async batchOperation(operations, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      
      // Ejecutar operaciones en paralelo dentro del lote
      const batchPromises = batch.map(async (operation, index) => {
        try {
          // Pequeño delay entre operaciones para evitar rate limiting
          await this.delay(this.rateLimitDelay * (index + 1));
          return await operation();
        } catch (error) {
          console.error(`Error en operación ${i + index + 1}:`, error);
          return { error: error.message };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
      
      // Delay entre lotes para evitar rate limiting
      if (i + batchSize < operations.length) {
        await this.delay(this.rateLimitDelay * batchSize);
      }
    }
    
    return results;
  }

  /**
   * Obtiene o crea la lista de tareas por defecto en Google Tasks
   */
  async getOrCreateDefaultTaskList(userId) {
    await this.setUserCredentials(userId);
    const tasksApi = this.getTasksApi(userId);

    try {
      // Primero intentar obtener las listas existentes con retry (paginadas)
      const taskLists = [];
      let pageToken = undefined;
      do {
      const response = await this.executeWithRetry(
          () => tasksApi.tasklists.list({ pageToken }),
        'obtener listas de tareas',
        userId
      );
        taskLists.push(...(response.data.items || []));
        pageToken = response.data.nextPageToken;
      } while (pageToken);

      // Buscar una lista llamada "Attadia Tasks" o usar la primera disponible
      let targetList = taskLists.find(list => list.title === 'Attadia Tasks');
      
      if (!targetList && taskLists.length > 0) {
        // Si no existe "Attadia Tasks", usar la lista por defecto (primera)
        targetList = taskLists[0];
      }

      if (!targetList) {
        // Si no hay listas, crear una nueva con retry
        const createResponse = await this.executeWithRetry(
          () => tasksApi.tasklists.insert({
            requestBody: {
              title: 'Attadia Tasks'
            }
          }),
          'crear lista de tareas',
          userId
        );
        targetList = createResponse.data;
      }

      return targetList;
    } catch (error) {
      console.error('Error al obtener/crear lista de tareas:', error);
      
      // Manejo específico de errores de Google APIs
      if (error.code === 403) {
        throw new Error('Permisos insuficientes para acceder a Google Tasks. Verifica que la aplicación tenga los permisos necesarios.');
      } else if (error.code === 401) {
        throw new Error('Token de acceso inválido. Por favor, reconecta tu cuenta de Google.');
      } else if (error.code === 429) {
        throw new Error('Límite de solicitudes excedido. Intenta nuevamente en unos minutos.');
      } else if (error.code >= 500) {
        throw new Error('Error temporal del servidor de Google. Intenta nuevamente más tarde.');
      } else {
        throw new Error(`Error al acceder a Google Tasks: ${error.message}`);
      }
    }
  }

  /**
   * Sincroniza una tarea de Attadia hacia Google Tasks
   */
  /**
   * Mueve una tarea de Google de una TaskList a otra (insert + delete).
   */
  async moveGoogleTaskBetweenLists(userId, sourceListId, destListId, tarea) {
    const tasksApi = this.getTasksApi(userId);
    const googleTaskId = tarea.googleTasksSync?.googleTaskId;
    if (!googleTaskId || sourceListId === destListId) {
      return googleTaskId;
    }

    const current = await this.executeWithRetry(
      () => tasksApi.tasks.get({
        tasklist: sourceListId,
        task: googleTaskId,
        fields: 'id,title,notes,status,due,completed',
      }),
      `obtener tarea para mover "${tarea.titulo}"`,
      userId,
    );

    const body = {
      title: current.data.title,
      notes: current.data.notes,
      status: current.data.status,
      due: current.data.due,
      completed: current.data.completed,
    };
    Object.keys(body).forEach((k) => {
      if (body[k] == null) delete body[k];
    });

    const inserted = await this.executeWithRetry(
      () => tasksApi.tasks.insert({
        tasklist: destListId,
        requestBody: body,
        fields: 'id,title,status,updated',
      }),
      `mover tarea "${tarea.titulo}" a otra lista`,
      userId,
    );

    try {
      await this.executeWithRetry(
        () => tasksApi.tasks.delete({ tasklist: sourceListId, task: googleTaskId }),
        `eliminar tarea antigua "${tarea.titulo}" de lista origen`,
        userId,
      );
    } catch (deleteErr) {
      logger.warn?.(
        `No se pudo borrar tarea ${googleTaskId} de lista ${sourceListId}: ${deleteErr.message}`,
      );
    }

    const newId = inserted.data.id;
    await Tareas.findByIdAndUpdate(tarea._id, {
      'googleTasksSync.googleTaskId': newId,
      'googleTasksSync.googleTaskListId': destListId,
    });
    logger.sync(
      `↪️ Tarea "${tarea.titulo}" movida de lista ${sourceListId} → ${destListId}`,
    );
    return newId;
  }

  async syncTaskToGoogle(tareaId, userId) {
    let tarea = await Tareas.findById(tareaId).populate('objetivo');
    if (!tarea) {
      throw new Error('Tarea no encontrada');
    }

    // Limpiar título básicamente antes de sincronizar
    const tituloOriginal = tarea.titulo;
    const tituloLimpio = this.cleanTitle(tarea.titulo);
    
    // Si el título cambió, actualizarlo automáticamente
    if (tituloLimpio !== tituloOriginal) {
      logger.dev(`🔧 Limpiando título: "${tituloOriginal}" -> "${tituloLimpio}"`);
      tarea.titulo = tituloLimpio;
      await tarea.save();
    }

    // Protección básica: evitar sincronizaciones concurrentes
    if (tarea.googleTasksSync?.syncStatus === 'syncing') {
      logger.dev(`⚠️ Tarea "${tarea.titulo}" ya está siendo sincronizada, saltando...`);
      return;
    }

    await this.setUserCredentials(userId);
    const tasksApi = this.getTasksApi(userId);
    
    // Asegurar acceso a la TaskList del objetivo (crea o reubica si es necesario)
    if (!tarea.objetivo) {
      throw new Error('La tarea debe estar asociada a un objetivo');
    }
    const taskListId = await this.ensureTaskListAccessible(tarea.objetivo, userId);

    try {
      const ensuredTaskListId = taskListId;
      const previousListId = tarea.googleTasksSync?.googleTaskListId;

      if (
        tarea.googleTasksSync?.googleTaskId
        && previousListId
        && previousListId !== ensuredTaskListId
      ) {
        await this.moveGoogleTaskBetweenLists(
          userId,
          previousListId,
          ensuredTaskListId,
          tarea,
        );
        tarea = await Tareas.findById(tareaId).populate('objetivo');
        if (!tarea) {
          throw new Error('Tarea no encontrada tras mover entre listas');
        }
      }

      tarea.googleTasksSync = {
        ...(tarea.googleTasksSync || {}),
        googleTaskListId: ensuredTaskListId,
      };
      
      // Usar el método del modelo para obtener el formato de Google Tasks
      const googleTaskData = tarea.toGoogleTaskFormat();
      
      let rruleForNotes = null;
      if (tarea.serieId) {
        const { TareaSeries } = await import('../models/index.js');
        const serie = await TareaSeries.findById(tarea.serieId).select('rrule');
        rruleForNotes = serie?.rrule || null;
      }
      googleTaskData.notes = this.buildTaskNotes(tarea, rruleForNotes);
      
        // Sanitizar requestBody para Google
        // - No enviar id/updated/parent/position
        delete googleTaskData.id;
        delete googleTaskData.updated;
        delete googleTaskData.parent;
        delete googleTaskData.position;
        // - Quitar completed si es null/undefined (Google lo calcula con status)
        if (googleTaskData.completed == null) {
          delete googleTaskData.completed;
        }
        // - Truncar notas por seguridad
        if (googleTaskData.notes && googleTaskData.notes.length > 7000) {
          googleTaskData.notes = googleTaskData.notes.slice(0, 7000);
        }
      
      // Eliminar campos que Google Tasks maneja automáticamente en creación
        // (ya eliminados arriba, mantenemos lógica por claridad)

      let googleTask;
      let parentGoogleTaskId = tarea.googleTasksSync?.googleTaskId || null;
      
      // Inicializar googleTasksSync si no existe
      if (!tarea.googleTasksSync) {
        tarea.googleTasksSync = {
          enabled: true,
          syncStatus: 'pending',
          needsSync: true,
          localVersion: 1
        };
      }

      // Marcar como "syncing" para evitar sincronizaciones concurrentes
      await Tareas.findByIdAndUpdate(tareaId, {
        'googleTasksSync.syncStatus': 'syncing',
        'googleTasksSync.syncingStartedAt': new Date()
      });
      
      if (tarea.googleTasksSync.googleTaskId) {
        try {
          // Obtener estado actual para evitar PATCH si no hay cambios
          let shouldPatch = true;
          try {
            const current = await this.executeWithRetry(
              () => tasksApi.tasks.get({
                tasklist: taskListId,
                task: tarea.googleTasksSync.googleTaskId,
                fields: 'id,title,status,notes'
              }),
              `obtener tarea actual ${tarea.titulo}`,
              userId
            );
            if (this.equalsForPatch(current.data, googleTaskData)) {
              shouldPatch = false;
              logger.dev?.(`⏭️ Sin cambios para "${tarea.titulo}", se omite patch`);
            }
          } catch (getErr) {
            // Si falla el GET, seguir el flujo normal (PATCH intentará y manejará errores)
          }

          // Actualizar tarea existente con retry
          if (shouldPatch) {
            googleTask = await this.executeWithRetry(
              () => tasksApi.tasks.patch({
                tasklist: ensuredTaskListId,
                task: tarea.googleTasksSync.googleTaskId,
                requestBody: googleTaskData,
                fields: 'id,title,status,updated' // Solo campos necesarios
              }),
              `actualizar tarea ${tarea.titulo}`,
              userId
            );
            parentGoogleTaskId = googleTask?.data?.id || tarea.googleTasksSync.googleTaskId;
            try {
              logger.sync?.(`📝 Actualizada tarea: "${tarea.titulo}" ctx=${JSON.stringify({ taskListId, taskId: parentGoogleTaskId })}`);
            } catch { /* ignore */ }
          } else {
            // No hay cambios: asegurar que tenemos el id para subtareas
            parentGoogleTaskId = tarea.googleTasksSync.googleTaskId;
          }
        } catch (error) {
          // Si la tarea no existe o el ID es inválido/inaccesible, crear una nueva
          const isMissingOrInvalid =
            error?.status === 404 ||
            error?.status === 403 ||
            (error?.status === 400 && (
              String(error?.message || '').includes('Missing task ID') ||
              String(error?.errors?.[0]?.message || '').includes('Missing task ID') ||
              String(error?.response?.data?.error?.errors?.[0]?.message || '').includes('Missing task ID') ||
              String(error?.response?.data?.error?.reason || '').includes('invalid')
            ));

          if (isMissingOrInvalid) {
            console.log(`[INFO] Tarea "${tarea.titulo}" no existe/ID inválido o inaccesible, creando nueva...`);
            delete googleTaskData.id; // redundante por sanitización, pero seguro
            googleTask = await this.executeWithRetry(
              () => tasksApi.tasks.insert({
                tasklist: ensuredTaskListId,
                requestBody: googleTaskData,
                fields: 'id,title,status,updated'
              }),
              `crear tarea ${tarea.titulo} (reemplazo de inválida/inexistente)`,
              userId
            );
            // Actualizar el documento local con el nuevo ID de Google
            await Tareas.findByIdAndUpdate(tareaId, {
              'googleTasksSync.googleTaskId': googleTask.data.id,
              'googleTasksSync.googleTaskListId': ensuredTaskListId
            });
            parentGoogleTaskId = googleTask.data.id;
          } else {
            throw error; // Re-lanzar otros errores
          }
        }
      } else {
        // Crear nueva tarea con retry
        googleTask = await this.executeWithRetry(
          () => tasksApi.tasks.insert({
            tasklist: ensuredTaskListId,
            requestBody: googleTaskData,
            fields: 'id,title,status,updated' // Solo campos necesarios
          }),
          `crear tarea ${tarea.titulo}`,
          userId
        );

        // Actualizar el documento local con el ID de Google
        await Tareas.findByIdAndUpdate(tareaId, {
          'googleTasksSync.googleTaskId': googleTask.data.id,
          'googleTasksSync.googleTaskListId': ensuredTaskListId
        });
        parentGoogleTaskId = googleTask.data.id;
      }

      // Actualizar estado de sincronización
      await Tareas.findByIdAndUpdate(tareaId, {
        'googleTasksSync.lastSyncDate': new Date(),
        'googleTasksSync.syncStatus': 'synced',
        'googleTasksSync.syncErrors': [],
        'googleTasksSync.syncingStartedAt': null // Limpiar timestamp
      });

      // Devolver datos consistentes aun cuando no hubo PATCH/INSERT
      const resultData = googleTask?.data || {
        id: parentGoogleTaskId || tarea.googleTasksSync?.googleTaskId || null,
        title: tarea.titulo,
        status: tarea.completada ? 'completed' : 'needsAction'
      };
      return resultData;
    } catch (error) {
      console.error('Error al sincronizar tarea a Google:', error);
      
      // Registrar error
      await Tareas.findByIdAndUpdate(tareaId, {
        'googleTasksSync.syncStatus': 'error',
        'googleTasksSync.syncErrors': [error.message],
        'googleTasksSync.syncingStartedAt': null // Limpiar timestamp
      });
      
      throw error;
    }
  }

  /**
   * Lista todas las TaskLists de Google del usuario (paginado).
   */
  async listAllGoogleTaskLists(userId) {
    const tasksApi = this.getTasksApi(userId);
    const items = [];
    let pageToken;
    do {
      const resp = await this.executeWithRetry(
        () => tasksApi.tasklists.list({ pageToken, maxResults: 100 }),
        'listar TaskLists de Google',
        userId,
      );
      items.push(...(resp.data.items || []));
      pageToken = resp.data.nextPageToken;
    } while (pageToken);
    return items;
  }

  buildGoogleTaskListIndex(googleTaskLists) {
    const byId = new Map();
    const byNormTitle = new Map();
    for (const list of googleTaskLists) {
      byId.set(list.id, list);
      const norm = this.normalizeTitleStrong(list.title || '');
      if (norm && !byNormTitle.has(norm)) {
        byNormTitle.set(norm, list);
      }
    }
    return { byId, byNormTitle };
  }

  applyGoogleTaskListSyncToObjetivo(objetivo, taskList) {
    objetivo.googleTasksSync = {
      ...(objetivo.googleTasksSync?.toObject?.() || objetivo.googleTasksSync || {}),
      enabled: true,
      googleTaskListId: taskList.id,
      syncStatus: 'synced',
      needsSync: false,
      lastSyncDate: new Date(),
      etag: taskList.etag,
      selfLink: taskList.selfLink,
    };
  }

  /**
   * Busca la TaskList de Google para un objetivo (ID guardado o nombre normalizado).
   */
  findGoogleTaskListForObjetivo(objetivo, { byId, byNormTitle }, usedGoogleListIds = new Set()) {
    const storedId = objetivo.googleTasksSync?.googleTaskListId;
    if (storedId && byId.has(storedId) && !usedGoogleListIds.has(storedId)) {
      return byId.get(storedId);
    }
    const norm = this.normalizeTitleStrong(objetivo.nombre || '');
    if (!norm || !byNormTitle.has(norm)) return null;
    const list = byNormTitle.get(norm);
    if (usedGoogleListIds.has(list.id)) return null;
    return list;
  }

  async propagateGoogleTaskListIdToTareas(objetivoId, googleTaskListId, userId) {
    await Tareas.updateMany(
      { objetivo: objetivoId, usuario: userId },
      { $set: { 'googleTasksSync.googleTaskListId': googleTaskListId } },
    );
  }

  /**
   * Si varios objetivos comparten el mismo googleTaskListId, deja solo el primero vinculado.
   */
  async dedupeObjetivoGoogleTaskListIds(objetivos) {
    const byListId = new Map();
    for (const objetivo of objetivos) {
      const listId = objetivo.googleTasksSync?.googleTaskListId;
      if (!listId) continue;
      if (!byListId.has(listId)) byListId.set(listId, []);
      byListId.get(listId).push(objetivo);
    }
    let cleared = 0;
    for (const [, group] of byListId) {
      if (group.length <= 1) continue;
      for (let i = 1; i < group.length; i += 1) {
        const objetivo = group[i];
        objetivo.googleTasksSync = {
          ...(objetivo.googleTasksSync?.toObject?.() || objetivo.googleTasksSync || {}),
          googleTaskListId: null,
          syncStatus: 'pending',
          needsSync: true,
        };
        await objetivo.save();
        cleared += 1;
        logger.warn(
          `⚠️ Objetivo "${objetivo.nombre}" desvinculado: googleTaskListId duplicado`,
        );
      }
    }
    return cleared;
  }

  /**
   * Resuelve el Objetivo local para una TaskList de Google (por ID o por nombre).
   */
  async resolveObjetivoForGoogleTaskList(userId, taskList, Objetivos, { autoCreate = false } = {}) {
    let objetivo = await Objetivos.findOne({
      'googleTasksSync.googleTaskListId': taskList.id,
      usuario: userId,
    });

    if (objetivo) return objetivo;

    const normList = this.normalizeTitleStrong(taskList.title || '');
    if (normList) {
      const candidatos = await Objetivos.find({ usuario: userId });
      objetivo = candidatos.find(
        (o) => this.normalizeTitleStrong(o.nombre || '') === normList,
      );
      if (objetivo) {
        const occupied = await Objetivos.findOne({
          'googleTasksSync.googleTaskListId': taskList.id,
          usuario: userId,
          _id: { $ne: objetivo._id },
        });
        if (occupied) {
          logger.warn(
            `Lista Google "${taskList.title}" ya vinculada al objetivo "${occupied.nombre}"`,
          );
          return occupied;
        }
        this.applyGoogleTaskListSyncToObjetivo(objetivo, taskList);
        await objetivo.save();
        await this.propagateGoogleTaskListIdToTareas(objetivo._id, taskList.id, userId);
        logger.sync(
          `🔗 Vinculado por nombre: lista Google "${taskList.title}" → objetivo "${objetivo.nombre}"`,
        );
        return objetivo;
      }
    }

    if (!autoCreate) return null;

    objetivo = new Objetivos({
      nombre: taskList.title,
      usuario: userId,
      descripcion: `Objetivo importado desde Google Tasks: ${taskList.title}`,
      googleTasksSync: {
        enabled: true,
        googleTaskListId: taskList.id,
        syncStatus: 'synced',
        needsSync: false,
        lastSyncDate: new Date(),
        etag: taskList.etag,
        selfLink: taskList.selfLink,
      },
    });
    await objetivo.save();
    logger.sync(`📁 Creado objetivo desde TaskList: "${taskList.title}"`);
    return objetivo;
  }

  /**
   * Sincroniza desde Google Tasks hacia Attadia - MAPEA TASKLISTS A OBJETIVOS
   */
  async syncTasksFromGoogle(userId, options = {}) {
    const user = await this.setUserCredentials(userId);
    const tasksApi = this.getTasksApi(userId);
    const { Objetivos } = await import('../models/index.js');

    try {
      const googleTaskLists = await this.listAllGoogleTaskLists(userId);
      const syncResults = {
        created: 0,
        updated: 0,
        errors: [],
        /** @deprecated use skippedTaskLists + skippedTasks */
        skipped: 0,
        skippedTaskLists: 0,
        skippedTasks: 0,
        deletedLocalNotInGoogle: 0,
        unlinkedLocalNotInGoogle: 0,
        dedupLocalGroups: 0,
        dedupLocalRemoved: 0,
        series: { seriesCreated: 0, seriesUpdated: 0, instancesLinked: 0 },
      };

      logger.sync(`📥 Importando desde ${googleTaskLists.length} TaskLists de Google Tasks`);

      const repairedUnlinked = await this.repairPreviouslyUnlinkedTasks(userId);
      if (repairedUnlinked > 0) {
        logger.sync(`🩹 Archivadas ${repairedUnlinked} tareas previamente desvinculadas de Google`);
      }

      // Import incremental salvo full sync explícito (necesario para detectar series recurrentes)
      let updatedMin = null;
      const lastSync = user?.googleTasksConfig?.lastSync ? new Date(user.googleTasksConfig.lastSync) : null;
      if (!options.fullImport && lastSync && !Number.isNaN(lastSync.getTime())) {
        updatedMin = new Date(lastSync.getTime() - 5 * 60 * 1000).toISOString();
        logger.sync(`🔎 Import incremental (updatedMin=${updatedMin})`);
      } else if (options.fullImport) {
        logger.sync('🔎 Import completo (sin updatedMin) para series y tareas recurrentes');
      }
      
      const autoCreateObjetivos = process.env.GTASKS_AUTO_CREATE_OBJETIVOS === 'true';

      // Por cada TaskList, buscar o crear el objetivo correspondiente
      for (const taskList of googleTaskLists) {
        try {
          let objetivo = await this.resolveObjetivoForGoogleTaskList(
            userId,
            taskList,
            Objetivos,
            { autoCreate: autoCreateObjetivos },
          );

          if (!objetivo) {
            syncResults.skippedTaskLists++;
            syncResults.skipped++;
            logger.sync(
              `⏭️ Omitida TaskList sin objetivo vinculado: "${taskList.title}" (crea un Objetivo con el mismo nombre o activa GTASKS_AUTO_CREATE_OBJETIVOS)`,
            );
            continue;
          }

          if (objetivo) {
            // Actualizar objetivo existente si el nombre cambió
            if (objetivo.nombre !== taskList.title) {
              objetivo.nombre = taskList.title;
              objetivo.googleTasksSync.lastSyncDate = new Date();
              await objetivo.save();
              logger.sync(`📝 Actualizado objetivo desde TaskList: "${taskList.title}"`);
            }
          }

          // Importar tareas de esta TaskList al objetivo (paginado + opcional updatedMin)
          const googleTasks = await this.listAllTasksInList(
            taskList.id,
            userId,
            {
              showCompleted: true,
              showHidden: true,
              maxResults: 100,
              fields: 'items(id,title,notes,status,updated,due,parent,position),nextPageToken',
              updatedMin
            }
          );
          
          // Filtrar solo tareas principales (sin parent) - las subtareas se manejan por separado
          const mainTasks = (googleTasks || []).filter(task => !task.parent);
          
          logger.sync(`📋 Procesando ${mainTasks.length} tareas principales de "${taskList.title}"`);

          const googleIds = mainTasks.map((t) => t.id).filter(Boolean);
          const existingByGoogleId = new Map();
          if (googleIds.length > 0) {
            const existingBatch = await Tareas.find({
              usuario: userId,
              'googleTasksSync.googleTaskId': { $in: googleIds },
            });
            for (const doc of existingBatch) {
              const gid = doc.googleTasksSync?.googleTaskId;
              if (gid) existingByGoogleId.set(gid, doc);
            }
          }

          const isFullImport = !updatedMin;

          for (const googleTask of mainTasks) {
            try {
              let tarea = existingByGoogleId.get(googleTask.id);

              if (tarea) {
                const localPending = this.hasLocalPendingGoogleSync(tarea);
                const shouldImportContent = this.shouldImportContentFromGoogle(tarea, googleTask);
                if (shouldImportContent) {
                  this.applyNotesFromGoogle(tarea, googleTask);
                  tarea.titulo = this.cleanTitle(tarea.titulo || googleTask.title);
                }
                // Estado completado en Google siempre gana; due avanza si Google es más reciente
                if (localPending) {
                  if (this.statusDiffersFromGoogle(tarea, googleTask)) {
                    this.applyGoogleStatusFromGoogle(tarea, googleTask, { preservePendingExport: true });
                  }
                  if (this.shouldApplyGoogleDueDespitePending(tarea, googleTask)) {
                    this.applyGoogleDueFromGoogle(tarea, googleTask);
                  }
                } else {
                  this.applyGoogleStatusAndDue(tarea, googleTask);
                }
                if (shouldImportContent || tarea.isModified()) {
                  this.markSaveFromGoogleImport(tarea);
                  await tarea.save();
                  syncResults.updated++;
                  if (shouldImportContent) {
                    logger.sync(`📝 Actualizada tarea desde Google: "${googleTask.title}"`);
                  }
                } else {
                  syncResults.skippedTasks++;
                  syncResults.skipped++;
                }
              } else {
                const tituloLimpio = this.cleanTitle(googleTask.title);

                const nuevaTarea = new Tareas({
                  titulo: tituloLimpio,
                  usuario: userId,
                  prioridad: 'BAJA',
                  objetivo: objetivo._id,
                });

                this.applyNotesFromGoogle(nuevaTarea, googleTask);
                this.applyGoogleStatusAndDue(nuevaTarea, googleTask);
                nuevaTarea.googleTasksSync.googleTaskListId = taskList.id;

                this.markSaveFromGoogleImport(nuevaTarea);
                await nuevaTarea.save();
                existingByGoogleId.set(googleTask.id, nuevaTarea);
                syncResults.created++;
                logger.sync(`📥 Creada tarea: "${tituloLimpio}"`);
              }

            } catch (error) {
              console.error(`Error al procesar tarea "${googleTask.title}":`, error);
              syncResults.errors.push(`${googleTask.title}: ${error.message}`);
            }
          }

          // Soft-unlink: detectar tareas eliminadas en Google (en cada sync, no solo full import)
          try {
            const allGoogleTasks = await this.listAllTasksInList(taskList.id, userId, {
              showCompleted: true,
              showHidden: true,
              showDeleted: true,
              maxResults: 100,
              fields: 'items(id,parent,deleted),nextPageToken',
              skipCache: true,
            });
            const googleMainIds = new Set(
              (allGoogleTasks || [])
                .filter((task) => !task.parent && !task.deleted)
                .map((t) => t.id),
            );
            const tareasLocales = await Tareas.find({
              usuario: userId,
              objetivo: objetivo._id,
              'googleTasksSync.googleTaskListId': taskList.id,
              'googleTasksSync.googleTaskId': { $exists: true, $ne: null },
            });
            const toUnlink = tareasLocales.filter(
              (t) => t.googleTasksSync?.googleTaskId && !googleMainIds.has(t.googleTasksSync.googleTaskId),
            );
            if (toUnlink.length > 0) {
              logger.sync(`🧹 Desvinculando ${toUnlink.length} tareas locales que no existen más en Google (soft-unlink)`);
              for (const t of toUnlink) {
                try {
                  if (!t.googleTasksSync) t.googleTasksSync = {};
                  t.googleTasksSync.googleTaskId = null;
                  t.googleTasksSync.enabled = false;
                  t.googleTasksSync.needsSync = false;
                  t.googleTasksSync.syncStatus = 'unlinked';
                  t.googleTasksSync.syncingStartedAt = null;
                  t.googleTasksSync.updated = new Date();
                  // Eliminada en Google → archivar localmente (sale de RETRASADAS/activas)
                  t.estado = 'CANCELADA';
                  t.completada = false;
                  this.markSaveFromGoogleImport(t);
                  await t.save();
                } catch (unlinkErr) {
                  logger.warn?.(`No se pudo desvincular tarea ${t._id}: ${unlinkErr.message}`);
                }
              }
              syncResults.unlinkedLocalNotInGoogle = (syncResults.unlinkedLocalNotInGoogle || 0) + toUnlink.length;
              syncResults.deletedLocalNotInGoogle = syncResults.unlinkedLocalNotInGoogle;
            }
          } catch (cleanupErr) {
            logger.warn?.(`No se pudo limpiar tareas locales inexistentes en Google para "${taskList.title}": ${cleanupErr.message}`);
          }

          if (isFullImport) {
          // Limpieza: deduplicar en BD por título normalizado dentro del objetivo cuando NO tienen googleTaskId
          try {
            const tareasSinId = await Tareas.find({
              usuario: userId,
              objetivo: objetivo._id,
              $and: [
                { $or: [{ serieId: { $exists: false } }, { serieId: null }] },
                {
                  $or: [
                    { 'googleTasksSync.googleTaskId': { $exists: false } },
                    { 'googleTasksSync.googleTaskId': null },
                  ],
                },
              ],
            });
            const norm = (s) => this.normalizeTitleStrong(s || '');
            const buckets = new Map();
            for (const t of tareasSinId) {
              const key = norm(t.titulo);
              if (!buckets.has(key)) buckets.set(key, []);
              buckets.get(key).push(t);
            }
            const groups = Array.from(buckets.values()).filter(g => g.length > 1);
            for (const group of groups) {
              // Mantener el que tenga más subtareas; en empate, el más reciente
              group.sort((a, b) => {
                const sa = a.subtareas?.length || 0;
                const sb = b.subtareas?.length || 0;
                if (sa !== sb) return sb - sa;
                const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return ub - ua;
              });
              const keep = group[0];
              const remove = group.slice(1);
              if (remove.length > 0) {
                logger.sync(`🧹 Dedupe local por título: mantener "${keep.titulo}", eliminar ${remove.length}`);
                await Promise.allSettled(remove.map(r => Tareas.findByIdAndDelete(r._id)));
                syncResults.dedupLocalGroups += 1;
                syncResults.dedupLocalRemoved += remove.length;
              }
            }
          } catch (dedupeErr) {
            logger.warn?.(`No se pudo deduplicar tareas locales sin id en "${taskList.title}": ${dedupeErr.message}`);
          }
          } // isFullImport

          if (isFullImport || mainTasks.length > 0) {
          try {
            const serieStats = await reconcileSeriesFromGoogle(
              userId,
              objetivo._id,
              taskList.id,
              mainTasks,
            );
            syncResults.series.seriesCreated += serieStats.seriesCreated;
            syncResults.series.seriesUpdated += serieStats.seriesUpdated;
            syncResults.series.instancesLinked += serieStats.instancesLinked;
          } catch (serieErr) {
            logger.warn?.(`Reconcile series falló para "${taskList.title}": ${serieErr.message}`);
          }
          }

        } catch (error) {
          console.error(`Error al procesar TaskList "${taskList.title}":`, error);
          syncResults.errors.push(`TaskList ${taskList.title}: ${error.message}`);
        }
      }

      // Actualizar última sincronización del usuario
      await Users.findByIdAndUpdate(userId, {
        'googleTasksConfig.lastSync': new Date()
      });

      logger.sync(`📊 Resumen de importación: ${syncResults.created} creadas, ${syncResults.updated} actualizadas`);
      return syncResults;
      
    } catch (error) {
      console.error('Error al sincronizar desde Google Tasks:', error);
      throw error;
    }
  }

  /**
   * Sincronización bidireccional completa
   */
  async fullSync(userId) {
    const user = await Users.findById(userId);
    if (!user || !user.googleTasksConfig.enabled) {
      throw new Error('Google Tasks no está habilitado para este usuario');
    }

    return this.fullSyncWithUser(user);
  }

  /**
   * Sincroniza objetivos con TaskLists — un Objetivo ↔ una Google Task List
   */
  async syncObjetivosWithTaskLists(userId) {
    try {
      await this.setUserCredentials(userId);
      const tasksApi = this.getTasksApi(userId);
      const { Objetivos } = await import('../models/index.js');

      const objetivos = await Objetivos.find({ usuario: userId });
      const deduped = await this.dedupeObjetivoGoogleTaskListIds(objetivos);

      logger.sync(`🔄 Sincronizando ${objetivos.length} objetivos con Google TaskLists`);

      const googleTaskLists = await this.listAllGoogleTaskLists(userId);
      const index = this.buildGoogleTaskListIndex(googleTaskLists);
      const usedGoogleListIds = new Set();

      const results = {
        created: 0,
        linked: 0,
        updated: 0,
        deduped,
        errors: [],
      };

      for (const objetivo of objetivos) {
        try {
          const storedId = objetivo.googleTasksSync?.googleTaskListId;
          if (storedId && !index.byId.has(storedId)) {
            logger.warn(
              `TaskList ${storedId} no existe en Google para "${objetivo.nombre}", re-vinculando...`,
            );
            objetivo.googleTasksSync = {
              ...(objetivo.googleTasksSync?.toObject?.() || objetivo.googleTasksSync || {}),
              googleTaskListId: null,
            };
          }

          let googleList = this.findGoogleTaskListForObjetivo(
            objetivo,
            index,
            usedGoogleListIds,
          );

          if (!googleList) {
            const createResp = await this.executeWithRetry(
              () => tasksApi.tasklists.insert({
                requestBody: { title: objetivo.nombre },
              }),
              `crear TaskList para objetivo ${objetivo.nombre}`,
              userId,
            );
            googleList = createResp.data;
            index.byId.set(googleList.id, googleList);
            const norm = this.normalizeTitleStrong(googleList.title || '');
            if (norm && !index.byNormTitle.has(norm)) {
              index.byNormTitle.set(norm, googleList);
            }
            this.applyGoogleTaskListSyncToObjetivo(objetivo, googleList);
            await objetivo.save();
            await this.propagateGoogleTaskListIdToTareas(objetivo._id, googleList.id, userId);
            usedGoogleListIds.add(googleList.id);
            results.created += 1;
            logger.sync(`📁 Creada TaskList "${objetivo.nombre}" en Google`);
            continue;
          }

          this.applyGoogleTaskListSyncToObjetivo(objetivo, googleList);
          await objetivo.save();
          await this.propagateGoogleTaskListIdToTareas(objetivo._id, googleList.id, userId);
          usedGoogleListIds.add(googleList.id);

          if (!storedId || storedId !== googleList.id) {
            results.linked += 1;
            logger.sync(
              `🔗 Vinculada TaskList existente "${googleList.title}" → objetivo "${objetivo.nombre}"`,
            );
          }

          if (googleList.title !== objetivo.nombre) {
            await this.executeWithRetry(
              () => tasksApi.tasklists.update({
                tasklist: googleList.id,
                requestBody: {
                  title: objetivo.nombre,
                  etag: googleList.etag,
                },
              }),
              `actualizar TaskList ${objetivo.nombre}`,
              userId,
            );
            objetivo.googleTasksSync.lastSyncDate = new Date();
            await objetivo.save();
            results.updated += 1;
            logger.sync(`📝 Actualizada TaskList "${objetivo.nombre}" en Google`);
          }
        } catch (error) {
          console.error(`Error al sincronizar objetivo "${objetivo.nombre}":`, error);
          results.errors.push(`${objetivo.nombre}: ${error.message}`);
        }
      }

      logger.sync(
        `📊 Objetivos↔Listas: ${results.created} creadas, ${results.linked} vinculadas, ${results.updated} actualizadas`,
      );
      return results;
      
    } catch (error) {
      logger.error('Error al sincronizar objetivos con Google Tasks:', error);
      throw error;
    }
  }

  /**
   * Habilita Google Tasks para todas las tareas existentes de un usuario
   */
  async enableGoogleTasksForAllUserTasks(userId) {
    try {
      const result = await Tareas.updateMany(
        { 
          usuario: userId,
          objetivo: { $exists: true, $ne: null },
          $or: [
            { 'googleTasksSync': { $exists: false } },
            { 'googleTasksSync.enabled': false }
          ]
        },
        {
          $set: {
            'googleTasksSync.enabled': true,
            'googleTasksSync.syncStatus': 'pending',
            'googleTasksSync.needsSync': true,
            'googleTasksSync.localVersion': 1
          }
        }
      );
      
      logger.sync(`✅ Habilitadas ${result.modifiedCount} tareas para sincronización con Google Tasks`);
      return result;
    } catch (error) {
      console.error('Error al habilitar Google Tasks para tareas existentes:', error);
      throw error;
    }
  }

  /**
   * Sincronización bidireccional completa con flujo correcto
   */
  async fullSyncWithUser(user, options = {}) {
    if (!user || !user.googleTasksConfig?.enabled) {
      throw new Error('Google Tasks no está habilitado para este usuario');
    }

    const userId = user._id || user.id;
    const fullImport = this.shouldFullImportFromGoogle(user, options);
    const runId = randomUUID();
    const startedAt = new Date();

    const results = {
      objetivos: { created: 0, updated: 0, errors: [] },
      tareas: { toGoogle: { success: 0, errors: [] }, fromGoogle: null },
      quotaHit: false,
      metrics: {
        timings: {
          objetivosMs: 0,
          importFromGoogleMs: 0,
          exportToGoogleMs: 0,
          totalMs: 0
        },
        errorsByReason: {},
        batches: {
          concurrency: 0,
          totalBatches: 0,
          processedBatches: 0
        }
      },
      meta: {
        runId,
        startedAt,
        finishedAt: null
      }
    };

    const syncDirection = user.googleTasksConfig?.syncDirection || 'bidirectional';
    const exportToGoogle = syncDirection === 'bidirectional' || syncDirection === 'to_google';
    const importFromGoogle = syncDirection === 'bidirectional' || syncDirection === 'from_google';
    const skippedImport = { created: 0, updated: 0, errors: [], skipped: 0 };
    const skippedExport = { success: 0, errors: [] };

    try {
      this.clearTaskListCache();
      logger.sync(`🔄 Iniciando sincronización completa runId=${runId} para usuario ${userId} (syncDirection=${syncDirection}, fullImport=${fullImport})`);

      let stepT0 = Date.now();

      if (exportToGoogle) {
        logger.sync(`📁 Paso 1: Sincronizando objetivos con TaskLists`);
        results.objetivos = await this.syncObjetivosWithTaskLists(userId);
        results.metrics.timings.objetivosMs = Date.now() - stepT0;
      } else {
        logger.sync(`⏭️ Paso 1 omitido (syncDirection=${syncDirection})`);
        results.objetivos = { created: 0, updated: 0, errors: [] };
      }

      if (importFromGoogle) {
        logger.sync(`📥 Paso 2: Importando desde Google Tasks`);
        stepT0 = Date.now();
        results.tareas.fromGoogle = await this.syncTasksFromGoogle(userId, { fullImport });
        results.metrics.fullImport = fullImport;
        results.metrics.timings.importFromGoogleMs = Date.now() - stepT0;
        // Series ya reconciliadas por TaskList en syncTasksFromGoogle (con mainTasks de Google)
        results.series = results.tareas.fromGoogle?.series || {
          seriesCreated: 0,
          seriesUpdated: 0,
          instancesLinked: 0,
        };
        try {
          results.seriesExpandLocal = await expandAllSeriesForUser(this, userId, { syncToGoogle: false });
          logger.sync(
            `🔁 Instancias locales tras import: ${results.seriesExpandLocal.instancesCreated} nuevas`,
          );
        } catch (expandLocalErr) {
          logger.warn?.(`Expand local tras import: ${expandLocalErr.message}`);
          results.seriesExpandLocal = {
            instancesCreated: 0,
            instancesSynced: 0,
            errors: [expandLocalErr.message],
          };
        }
      } else {
        logger.sync(`⏭️ Paso 2 omitido (syncDirection=${syncDirection})`);
        results.tareas.fromGoogle = skippedImport;
      }

      if (!exportToGoogle) {
        logger.sync(`⏭️ Paso 3 omitido (syncDirection=${syncDirection})`);
        results.tareas.toGoogle = skippedExport;
      } else {
      logger.sync(`📤 Paso 3: Sincronizando tareas locales hacia Google`);

      results.seriesExpand = results.seriesExpandLocal || {
        instancesCreated: 0,
        instancesSynced: 0,
        errors: [],
      };

      const maxTasksPerSync = parseInt(process.env.GTASKS_MAX_TASKS_PER_SYNC || '25', 10);
      const concurrency = parseInt(process.env.GTASKS_CONCURRENCY || '3', 10);
      results.metrics.batches.concurrency = concurrency;

      const tareasQuery = {
        usuario: userId,
        objetivo: { $exists: true, $ne: null },
        'googleTasksSync.enabled': true,
        $or: [
          // Tareas con sincronización pendiente
          { 'googleTasksSync.syncStatus': 'pending' },
          { 'googleTasksSync.needsSync': true },
          // Tareas que NO tienen googleTaskId (nunca se han sincronizado)
          { 'googleTasksSync.googleTaskId': { $exists: false } },
          // Tareas con timeout de sincronización
          { 
            'googleTasksSync.syncStatus': 'syncing',
            'googleTasksSync.syncingStartedAt': { 
              $lt: new Date(Date.now() - 5 * 60 * 1000) // Hace más de 5 minutos
            }
          }
        ]
      };

      const tareasLocales = await Tareas.find(tareasQuery)
        .populate('objetivo')
        .limit(maxTasksPerSync);
      
      logger.sync(`🔄 Procesando hasta ${maxTasksPerSync} tareas (encontradas=${tareasLocales.length}), concurrencia=${concurrency}`);

      // Procesar en lotes con concurrencia limitada
      results.quotaHit = false;
      stepT0 = Date.now();
      const totalBatches = Math.ceil(tareasLocales.length / Math.max(1, concurrency));
      results.metrics.batches.totalBatches = totalBatches;
      for (let i = 0; i < tareasLocales.length; i += concurrency) {
        const batch = tareasLocales.slice(i, i + concurrency);
        logger.sync(`▶️ Lote ${Math.floor(i / concurrency) + 1}: ${batch.length} tareas`);

        const promises = batch.map(async (tarea) => {
          try {
          // Verificar timeout antes de sincronizar
          if (tarea.isSyncTimedOut && tarea.isSyncTimedOut()) {
            logger.warn(`⏰ Limpiando timeout de sincronización para: "${tarea.titulo}"`);
            tarea.clearSyncTimeout();
            await tarea.save();
          }

          await this.syncTaskToGoogle(tarea._id, userId);
          results.tareas.toGoogle.success++;
        } catch (error) {
          const errText = this.formatErrorForLog(error);
          results.tareas.toGoogle.errors.push(`${tarea.titulo}: ${errText}`);
          logger.error(`Error al sincronizar tarea "${tarea.titulo}":`, error);
            if (this.isQuotaError(error)) {
              results.quotaHit = true;
            }
            const reason = this.categorizeError(error);
            results.metrics.errorsByReason[reason] = (results.metrics.errorsByReason[reason] || 0) + 1;
          }
        });

        await Promise.allSettled(promises);
        results.metrics.batches.processedBatches++;
        logger.sync(`✅ Lote ${Math.floor(i / concurrency) + 1} completado. Progreso: ${Math.min(i + concurrency, tareasLocales.length)}/${tareasLocales.length}`);
        if (results.quotaHit) {
          logger.warn('⛔️ Cuota alcanzada. Deteniendo la sincronización del lote actual.');
          break;
        }
      }
      results.metrics.timings.exportToGoogleMs = Date.now() - stepT0;
      }

      // Actualizar última sincronización del usuario
      await Users.findByIdAndUpdate(userId, {
        'googleTasksConfig.lastSync': new Date()
      });

      results.meta.finishedAt = new Date();
      results.metrics.timings.totalMs = results.meta.finishedAt.getTime() - results.meta.startedAt.getTime();

      logger.sync(`✅ Sincronización completa finalizada:`);
      logger.sync(`   📁 Objetivos: ${results.objetivos.created} creados, ${results.objetivos.updated} actualizados`);
      logger.sync(`   📤 Tareas a Google: ${results.tareas.toGoogle.success} sincronizadas`);
      logger.sync(`   📥 Tareas desde Google: ${results.tareas.fromGoogle.created} creadas, ${results.tareas.fromGoogle.updated} actualizadas`);
      logger.sync(`   ⏱️ Tiempos(ms): objetivos=${results.metrics.timings.objetivosMs}, import=${results.metrics.timings.importFromGoogleMs}, export=${results.metrics.timings.exportToGoogleMs}, total=${results.metrics.timings.totalMs}`);
      if (results.quotaHit) logger.sync(`   ⛔️ Quota hit durante export; batches procesados=${results.metrics.batches.processedBatches}/${results.metrics.batches.totalBatches}`);

      this.clearTaskListCache();
      return results;
    } catch (error) {
      this.clearTaskListCache();
      console.error('Error en sincronización completa:', error);
      throw error;
    }
  }

  /**
   * Habilita Google Tasks para un usuario
   */
  async enableGoogleTasks(userId, accessToken, refreshToken) {
    await Users.findByIdAndUpdate(userId, {
      'googleTasksConfig.enabled': true,
      'googleTasksConfig.accessToken': accessToken,
      'googleTasksConfig.refreshToken': refreshToken
    });

    // Realizar primera sincronización
    return await this.fullSync(userId);
  }

  /**
   * Obtiene estadísticas de sincronización para un usuario
   */
  async getStats(userId) {
    const user = await Users.findById(userId);
    if (!user || !user.googleTasksConfig.enabled) {
      return {
        enabled: false,
        tasks: { synced: 0, pending: 0, errors: 0, total: 0 },
        lastSync: null
      };
    }

    // Contar tareas por estado de sincronización
    const totalTasks = await Tareas.countDocuments({ usuario: userId });
    const syncedTasks = await Tareas.countDocuments({ 
      usuario: userId, 
      'googleTasksSync.syncStatus': 'synced' 
    });
    const pendingTasks = await Tareas.countDocuments({ 
      usuario: userId, 
      'googleTasksSync.syncStatus': 'pending' 
    });
    const errorTasks = await Tareas.countDocuments({ 
      usuario: userId, 
      'googleTasksSync.syncStatus': 'error' 
    });

    return {
      enabled: true,
      tasks: {
        synced: syncedTasks,
        pending: pendingTasks,
        errors: errorTasks,
        total: totalTasks
      },
      lastSync: user.googleTasksConfig.lastSync
    };
  }

  /**
   * Sincroniza una tarea específica
   */
  async syncSpecificTask(userId, taskId) {
    const tarea = await Tareas.findOne({ _id: taskId, usuario: userId });
    if (!tarea) {
      throw new Error('Tarea no encontrada');
    }

    return await this.syncTaskToGoogle(taskId, userId);
  }

  /**
   * Obtiene las listas de tareas de Google
   */
  async getTaskLists(userId) {
    await this.setUserCredentials(userId);
    const tasksApi = this.getTasksApi(userId);

    try {
      const response = await tasksApi.tasklists.list();
      return response.data.items || [];
    } catch (error) {
      console.error('Error al obtener listas de tareas:', error);
      throw new Error('No se pudieron obtener las listas de tareas de Google');
    }
  }

  // Métodos auxiliares

  /** Evita que pre('save') marque needsSync al persistir cambios importados desde Google. */
  markSaveFromGoogleImport(tarea) {
    tarea.$locals = { ...(tarea.$locals || {}), skipGoogleSyncMark: true };
  }

  hasLocalPendingGoogleSync(tarea) {
    const sync = tarea?.googleTasksSync || {};
    return sync.needsSync === true || sync.syncStatus === 'pending';
  }

  statusDiffersFromGoogle(tarea, googleTask) {
    const googleCompleted = googleTask?.status === 'completed';
    const localCompleted =
      Boolean(tarea.completada)
      || String(tarea.estado || '').toUpperCase() === 'COMPLETADA';
    return googleCompleted !== localCompleted;
  }

  shouldRefreshGoogleDueDate(tarea, googleTask) {
    if (this.hasLocalPendingGoogleSync(tarea)) return false;
    if (!googleTask?.due) return false;
    const due = Tareas.parseGoogleDueDate(googleTask.due);
    if (!due) return false;
    const local = tarea.fechaVencimiento || tarea.fechaInicio;
    if (!local) return true;
    const localDt = local instanceof Date ? local : new Date(local);
    if (Number.isNaN(localDt.getTime())) return true;
    return Math.abs(localDt.getTime() - due.getTime()) > 60_000;
  }

  shouldRefreshGoogleNotes(tarea, googleTask) {
    if (this.hasLocalPendingGoogleSync(tarea)) return false;
    const googleNotes = String(googleTask?.notes || '');
    if (!googleNotes.trim()) return false;

    const localNotes = String(tarea.descripcion || '');
    const googleRrule = resolveRruleFromNotes(googleNotes);
    const localRrule = resolveRruleFromNotes(localNotes);
    if (googleRrule && googleRrule !== localRrule) return true;

    const googleHint = inferRecurrenceFromGoogleNotes(googleNotes);
    const localHint = inferRecurrenceFromGoogleNotes(localNotes);
    if (googleHint && googleHint !== localHint) return true;

    const cleanedGoogle = cleanDescriptionFromGoogleNotes(googleNotes);
    if (cleanedGoogle !== localNotes.trim()) return true;

    return false;
  }

  shouldRefreshGoogleStatus(tarea, googleTask) {
    return this.statusDiffersFromGoogle(tarea, googleTask);
  }

  /** Import de título/notas/due (no incluye status — se maneja aparte). */
  shouldImportContentFromGoogle(tarea, googleTask) {
    if (this.hasLocalPendingGoogleSync(tarea)) return false;
    return (
      this.shouldApplyGoogleUpdate(tarea, googleTask)
      || this.shouldRefreshGoogleDueDate(tarea, googleTask)
      || this.shouldRefreshGoogleNotes(tarea, googleTask)
    );
  }

  shouldImportFromGoogle(tarea, googleTask) {
    return (
      this.shouldImportContentFromGoogle(tarea, googleTask)
      || this.shouldRefreshGoogleStatus(tarea, googleTask)
    );
  }

  /** Solo estado completado/pendiente + metadatos Google (sin due). */
  applyGoogleStatusFromGoogle(tarea, googleTask, { preservePendingExport = false } = {}) {
    if (!tarea.googleTasksSync) tarea.googleTasksSync = {};
    tarea.completada = googleTask.status === 'completed';
    tarea.estado = googleTask.status === 'completed' ? 'COMPLETADA' : 'PENDIENTE';
    tarea.googleTasksSync.googleTaskId = googleTask.id;
    tarea.googleTasksSync.updated = googleTask.updated
      ? new Date(googleTask.updated)
      : new Date();
    tarea.googleTasksSync.completed = googleTask.completed
      ? new Date(googleTask.completed)
      : null;
    tarea.googleTasksSync.enabled = true;
    if (!preservePendingExport) {
      tarea.googleTasksSync.syncStatus = 'synced';
      tarea.googleTasksSync.needsSync = false;
      tarea.googleTasksSync.syncingStartedAt = null;
    }
  }

  /** Estado, due y metadatos Google en import (omitir due si hasLocalPendingGoogleSync). */
  applyGoogleStatusAndDue(tarea, googleTask) {
    this.applyGoogleStatusFromGoogle(tarea, googleTask, { preservePendingExport: false });
    this.applyGoogleDueFromGoogle(tarea, googleTask);
  }

  applyGoogleDueFromGoogle(tarea, googleTask) {
    if (!googleTask?.due) return;
    const dueDate = Tareas.parseGoogleDueDate(googleTask.due);
    if (dueDate && typeof tarea.recordGoogleDueSnapshot === 'function') {
      tarea.recordGoogleDueSnapshot(dueDate);
    }
    mergeGoogleDueWithLocalSchedule(tarea, googleTask.due);
    if (googleTask.updated) {
      if (!tarea.googleTasksSync) tarea.googleTasksSync = {};
      tarea.googleTasksSync.updated = new Date(googleTask.updated);
    }
  }

  googleDueDiffersFromLocal(tarea, googleTask) {
    if (!googleTask?.due) return false;
    const due = Tareas.parseGoogleDueDate(googleTask.due);
    if (!due) return false;
    const local = tarea.fechaVencimiento || tarea.fechaInicio;
    if (!local) return true;
    const localDt = local instanceof Date ? local : new Date(local);
    if (Number.isNaN(localDt.getTime())) return true;
    return Math.abs(localDt.getTime() - due.getTime()) > 60_000;
  }

  /** Due de Google avanza aunque haya export local pendiente (p. ej. recurrente completada en Google). */
  shouldApplyGoogleDueDespitePending(tarea, googleTask) {
    if (!this.googleDueDiffersFromLocal(tarea, googleTask)) return false;
    const googleUpdated = googleTask.updated ? new Date(googleTask.updated) : null;
    if (!googleUpdated || Number.isNaN(googleUpdated.getTime())) return true;
    const syncUpdated = tarea.googleTasksSync?.updated
      ? new Date(tarea.googleTasksSync.updated)
      : null;
    if (!syncUpdated || Number.isNaN(syncUpdated.getTime())) return true;
    return googleUpdated.getTime() > syncUpdated.getTime();
  }

  /** Tareas desvinculadas antes del fix quedaban visibles en RETRASADAS — archivarlas. */
  async repairPreviouslyUnlinkedTasks(userId) {
    const stale = await Tareas.find({
      usuario: userId,
      'googleTasksSync.syncStatus': 'unlinked',
      estado: { $ne: 'CANCELADA' },
    });
    let repaired = 0;
    for (const t of stale) {
      t.estado = 'CANCELADA';
      t.completada = false;
      this.markSaveFromGoogleImport(t);
      await t.save();
      repaired += 1;
    }
    return repaired;
  }

  shouldApplyGoogleUpdate(tarea, googleTask) {
    const sync = tarea.googleTasksSync || {};
    if (sync.needsSync === true || sync.syncStatus === 'pending') {
      return false;
    }
    const googleUpdated = googleTask.updated ? new Date(googleTask.updated) : null;
    if (!googleUpdated || Number.isNaN(googleUpdated.getTime())) {
      return true;
    }
    const localTimes = [sync.updated, tarea.updatedAt]
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .filter((t) => !Number.isNaN(t));
    if (localTimes.length === 0) {
      return true;
    }
    return googleUpdated.getTime() >= Math.max(...localTimes);
  }

  parseSubtasksFromNotes(notes) {
    const descripcion = this.extractDescriptionFromNotes(notes || '');
    const subtareas = [];
    if (!notes) {
      return { descripcion, subtareas };
    }

    const lines = String(notes).split('\n');
    let inSubtasksBlock = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'Subtareas:') {
        inSubtasksBlock = true;
        continue;
      }
      if (!inSubtasksBlock || !trimmed) {
        continue;
      }
      const completed = /^[☑✓]/.test(trimmed);
      const pending = /^[☐○]/.test(trimmed);
      if (completed || pending) {
        const titulo = trimmed.replace(/^[☐☑○✓]\s*/, '').trim();
        if (titulo) {
          subtareas.push({ titulo, completada: completed });
        }
      }
    }
    return { descripcion, subtareas };
  }

  applyNotesFromGoogle(tarea, googleTask) {
    const notes = googleTask.notes || '';
    const parsed = this.parseSubtasksFromNotes(notes);
    parsed.descripcion = cleanDescriptionFromGoogleNotes(notes);
    tarea.updateFromGoogleTask(googleTask, parsed);

    const schedule = parseScheduleFromNotes(notes);
    if (schedule?.fechaInicio) {
      tarea.fechaInicio = schedule.fechaInicio;
      tarea.fechaVencimiento = schedule.fechaFin || schedule.fechaInicio;
      if (schedule.fechaFin) tarea.fechaFin = schedule.fechaFin;
      if (!tarea.googleTasksSync) tarea.googleTasksSync = {};
      tarea.googleTasksSync.hasTimedSchedule = true;
    } else if (taskHasTimedSchedule(tarea)) {
      if (!tarea.googleTasksSync) tarea.googleTasksSync = {};
      tarea.googleTasksSync.hasTimedSchedule = true;
    }
  }

  buildTaskNotes(tarea, rrule = null) {
    let baseDescription = this.extractDescriptionFromNotes(tarea.descripcion || '');
    let notes = baseDescription || '';

    if (tarea.subtareas && tarea.subtareas.length > 0) {
      notes += '\n\nSubtareas:\n';
      tarea.subtareas.forEach(subtarea => {
        const marker = subtarea.completada ? '☑' : '☐';
        notes += `${marker} ${subtarea.titulo}\n`;
      });
    }

    if (rrule) {
      notes = appendRecurrenceToNotes(notes, rrule);
    }

    if (tarea.googleTasksSync?.hasTimedSchedule && tarea.fechaInicio) {
      const start = tarea.fechaInicio instanceof Date
        ? tarea.fechaInicio
        : new Date(tarea.fechaInicio);
      const endRaw = tarea.fechaFin || tarea.fechaVencimiento;
      const end = endRaw instanceof Date ? endRaw : (endRaw ? new Date(endRaw) : null);
      if (end && !Number.isNaN(start.getTime()) && isTimedScheduleInstant(start, end)) {
        notes = appendScheduleToNotes(notes, start, end);
      }
    }

    if (notes.length > 7000) {
      notes = notes.slice(0, 7000);
    }

    return notes;
  }

  extractDescriptionFromNotes(notes) {
    if (!notes) return '';

    const { descripcionSinRecurrencia } = parseRecurrenceFromNotes(notes);
    const lines = (descripcionSinRecurrencia || notes).split('\n');
    const endMarkers = ['Subtareas:', 'Objetivo:', 'Proyecto:', 'Recurrencia:', 'Horario Attadia:', '---'];
    
    let description = '';
    for (const line of lines) {
      if (endMarkers.some(marker => line.startsWith(marker))) {
        break;
      }
      description += line + '\n';
    }
    
    return description.trim();
  }


  mapEstadoToGoogleStatus(estado) {
    switch (estado) {
      case 'COMPLETADA':
        return 'completed';
      default:
        return 'needsAction';
    }
  }

  mapGoogleStatusToEstado(status) {
    switch (status) {
      case 'completed':
        return 'COMPLETADA';
      default:
        return 'PENDIENTE';
    }
  }

  /**
   * Compara campos relevantes para evitar PATCH innecesario
   */
  equalsForPatch(remote, local) {
    const pick = (o) => ({
      title: o?.title || '',
      status: o?.status || '',
      notes: o?.notes || ''
    });
    const a = pick(remote);
    const b = pick(local);
    return a.title === b.title && a.status === b.status && a.notes === b.notes;
  }

  /**
   * Elimina una tarea en Google Tasks
   */
  async deleteGoogleTask(userId, taskListId, taskId) {
    await this.setUserCredentials(userId);
    const tasksApi = this.getTasksApi(userId);
    const taskList = taskListId || (await this.getOrCreateDefaultTaskList(userId)).id;
    await this.executeWithRetry(
      () => tasksApi.tasks.delete({ tasklist: taskList, task: taskId }),
      `eliminar tarea ${taskId}`,
      userId
    );
  }

  /**
   * Actualiza el título de una tarea en Google Tasks
   */
  async updateGoogleTaskTitle(userId, taskListId, taskId, title) {
    await this.setUserCredentials(userId);
    const tasksApi = this.getTasksApi(userId);
    const taskList = taskListId || (await this.getOrCreateDefaultTaskList(userId)).id;
    await this.executeWithRetry(
      () => tasksApi.tasks.patch({
        tasklist: taskList,
        task: taskId,
        requestBody: { title },
        fields: 'id,title,updated'
      }),
      `actualizar título de tarea ${taskId}`,
      userId
    );
  }

  /**
   * Limpia tokens inválidos de todos los usuarios
   */
  async cleanupInvalidTokens() {
    try {
      logger.sync('🧹 Iniciando limpieza de tokens inválidos...');
      
      const users = await Users.find({
        'googleTasksConfig.enabled': true,
        'googleTasksConfig.accessToken': { $exists: true, $ne: null }
      });

      let cleanedCount = 0;
      let validCount = 0;

      for (const user of users) {
        try {
          const uid = String(user._id);
          await this.setUserCredentials(uid);
          const tasksApi = this.getTasksApi(uid);
          await tasksApi.tasklists.list();
          validCount++;
          
        } catch (error) {
          if (error.message?.includes('invalid_grant') || 
              error.response?.data?.error === 'invalid_grant') {
            
            logger.warn(`🔑 Limpiando tokens inválidos para usuario ${user.email}`);
            
            await Users.findByIdAndUpdate(user._id, {
              'googleTasksConfig.enabled': false,
              'googleTasksConfig.accessToken': null,
              'googleTasksConfig.refreshToken': null,
              'googleTasksConfig.lastSync': null,
              'googleTasksConfig.tokenError': 'invalid_grant',
              'googleTasksConfig.tokenErrorDate': new Date()
            });
            
            cleanedCount++;
          }
        }
      }

      logger.sync(`✅ Limpieza completada: ${validCount} tokens válidos, ${cleanedCount} tokens limpiados`);
      return { validCount, cleanedCount };
      
    } catch (error) {
      logger.error('Error en limpieza de tokens:', error);
      throw error;
    }
  }

  /**
   * Limpia un título básicamente - solo espacios y caracteres extraños
   */
  cleanTitle(rawTitle) {
    if (!rawTitle) return 'Tarea importada';
    let title = String(rawTitle).trim();
    
    // Remover prefijos entre corchetes (p.ej. [Proyecto], [Mis tareas])
    title = title.replace(/^\s*(\[[^\]]+\]\s*)+/g, '').trim();
    // Remover ocurrencias intermedias redundantes de corchetes aislados
    title = title.replace(/\s+(\[[^\]]+\])\s+/g, ' ').trim();
    
    // Limpiar espacios múltiples
    title = title.replace(/\s{2,}/g, ' ').trim();
    
    if (!title) {
      return 'Tarea importada';
    }
    
    return title;
  }

  /**
   * Normaliza un título de forma fuerte para comparaciones (no para mostrar)
   */
  normalizeTitleStrong(raw) {
    if (!raw) return '';
    let s = String(raw).toLowerCase().trim();
    // quitar prefijos entre corchetes, p.ej [Salud]
    s = s.replace(/\[[^\]]+\]\s*/g, '');
    // remover diacríticos
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // colapsar espacios
    s = s.replace(/\s{2,}/g, ' ').trim();
    return s;
  }
}

export default new GoogleTasksService();

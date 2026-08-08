import { Users } from '../models/index.js';
import config from '../config/config.js';
import autoSyncService from '../services/autoSyncService.js';
import { getUserId } from '../utils/authUtils.js';
import { spawn } from 'child_process';
import path from 'path';
import {
  CALENDAR_OAUTH_STATE_PREFIX,
  completeCalendarOAuth,
} from './googleCalendarController.js';
import { signOAuthState, verifyOAuthState } from '../utils/oauthState.js';

const postMessageOrigin = () => {
  try {
    return new URL(config.frontendUrl).origin;
  } catch {
    return '*';
  }
};

function callbackHtml(scriptBody, bodyText) {
  const origin = postMessageOrigin();
  return `<!DOCTYPE html><html><body><script>
    try { window.opener && window.opener.postMessage(${scriptBody}, ${JSON.stringify(origin)}); } catch (e) {}
    window.close();
  </script>
  <p>${bodyText}</p></body></html>`;
}

// Intentar importar googleapis de forma condicional
let google = null;
let oauth2Client = null;
let googleTasksService = null;

try {
  console.log('🔄 Intentando cargar googleapis...');
  const googleModule = await import('googleapis');
  google = googleModule.google;
  console.log('✅ googleapis cargado exitosamente');
  
  console.log('🔄 Configurando OAuth2 client...');
  console.log('🔑 Config disponible:', {
    hasClientId: !!config.google?.clientId,
    hasClientSecret: !!config.google?.clientSecret,
    backendUrl: config.backendUrl,
    clientIdStart: config.google?.clientId?.substring(0, 10) + '...'
  });
  
  // Configurar OAuth2 client para Google Tasks
  oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    `${config.backendUrl}/api/google-tasks/callback`
  );
  console.log('✅ OAuth2 client configurado');
  
  // Importar servicio de Google Tasks
  try {
    const serviceModule = await import('../services/googleTasksService.js');
    googleTasksService = serviceModule.default;
    console.log('✅ Google Tasks service cargado');
  } catch (serviceError) {
    console.warn('⚠️ Google Tasks service no disponible:', serviceError.message);
  }
  
  console.log('✅ Google Tasks API habilitado con googleapis');
} catch (error) {
  console.error('❌ Error cargando googleapis:', error);
  console.warn('⚠️ googleapis no disponible, usando modo simulado para Google Tasks');
}

const isGoogleTasksEnabled = () => {
  const hasGoogle = google !== null && oauth2Client !== null;
  const hasConfig = config.google?.clientId && config.google?.clientSecret;
  console.log('🔍 Verificando Google Tasks habilitado:', { hasGoogle, hasConfig, clientId: config.google?.clientId ? 'PRESENTE' : 'AUSENTE' });
  return hasGoogle && hasConfig;
};

/**
 * Intenta habilitar Google Tasks para un usuario que ya tiene sesión de Google
 */
async function enableGoogleTasksForExistingUser(userId) {
  const user = await Users.findById(userId);
  if (!user?.googleId) {
    throw new Error('Usuario no tiene sesión de Google');
  }

  console.log('🔄 Intentando habilitar Tasks con sesión existente para:', user.email);

  // Si ya tiene token de Google Tasks, intentar usarlo
  if (user.googleTasksConfig?.accessToken) {
    console.log('✅ Usuario ya tiene token de Google Tasks, verificando validez');
    
    try {
      // Configurar cliente con token existente
      oauth2Client.setCredentials({
        access_token: user.googleTasksConfig.accessToken,
        refresh_token: user.googleTasksConfig.refreshToken
      });

      // Probar acceso a Google Tasks
      const tasks = google.tasks({ version: 'v1', auth: oauth2Client });
      await tasks.tasklists.list(); // Test call
      
      console.log('✅ Token existente válido, habilitando Google Tasks');
      
      await Users.findByIdAndUpdate(userId, {
        'googleTasksConfig.enabled': true,
        'googleTasksConfig.lastSync': new Date()
      });

      if (googleTasksService) {
        await googleTasksService.enableGoogleTasksForAllUserTasks(userId);
      }

      return { success: true, message: 'Google Tasks habilitado con token existente' };
    } catch (error) {
      console.log('⚠️ Token existente inválido:', error.message);
      // Continuar para solicitar nuevos permisos
    }
  }

  // Si no tiene token o es inválido, necesita nuevos permisos
  throw new Error('Requiere nuevos permisos para Google Tasks');
}

/**
 * Obtiene la URL de autorización para Google Tasks
 */
export const getAuthUrl = async (req, res) => {
  try {
    console.log('🚀 getAuthUrl llamado - req.user:', req.user);
    
    // Evitar cache
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (!isGoogleTasksEnabled()) {
      console.log('❌ Google Tasks no habilitado');
      const errorMessage = !google 
        ? 'Google Tasks no está disponible. Instala googleapis: npm install googleapis'
        : !config.google?.clientId || !config.google?.clientSecret
        ? 'Configuración de Google OAuth incompleta. Verifica GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env'
        : 'Google Tasks no está disponible';
      
      return res.status(503).json({ 
        success: false, 
        error: errorMessage
      });
    }

    // Obtener userId correctamente
    const userId = getUserId(req.user);
    console.log('🔑 userId extraído:', userId, 'de req.user:', req.user);
    
    if (!userId) {
      console.log('❌ Usuario no autenticado');
      return res.status(401).json({ 
        success: false, 
        error: 'Usuario no autenticado' 
      });
    }

    // Verificar si el usuario ya tiene una sesión de Google activa
    const user = await Users.findById(userId);
    console.log('👤 Usuario encontrado:', { googleId: user?.googleId, hasGoogleTasksToken: !!user?.googleTasksConfig?.accessToken });

    if (user?.googleId) {
      console.log('✅ Usuario ya logueado con Google, intentando habilitar Tasks directamente');
      
      try {
        // Intentar habilitar Google Tasks usando el token existente o solicitando permisos adicionales
        await enableGoogleTasksForExistingUser(userId);
        
        return res.json({
          success: true,
          message: 'Google Tasks habilitado usando sesión existente',
          directEnable: true
        });
      } catch (error) {
        console.log('⚠️ No se pudo usar sesión existente, generando nueva URL:', error.message);
        // Si falla, continuar con el flujo OAuth normal
      }
    }

    console.log('🔑 Generando URL OAuth para nuevos permisos');

    const scopes = ['https://www.googleapis.com/auth/tasks'];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: signOAuthState({ userId, kind: 'tasks' }),
      prompt: 'consent',
      login_hint: user?.email // Sugerir la cuenta ya logueada
    });

    console.log('🔗 URL generada con state firmado para userId:', String(userId));

    res.json({ 
      success: true, 
      authUrl,
      message: 'URL de autorización generada correctamente'
    });
  } catch (error) {
    console.error('❌ Error en getAuthUrl:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
};

/**
 * Maneja el callback de autorización de Google Tasks
 */
export const handleCallback = async (req, res) => {
  try {
    const { code, state, error: authError } = req.query;
    
    if (authError) {
      console.error('Error de autorización:', authError);
      return res.send(callbackHtml(
        "{ type: 'google_tasks_auth', status: 'error', message: 'Autorización denegada' }",
        'Autorización denegada. Puedes cerrar esta ventana.'
      ));
    }

    if (!code) {
      return res.send(callbackHtml(
        "{ type: 'google_tasks_auth', status: 'error', message: 'Código de autorización no proporcionado' }",
        'Error: No se recibió código de autorización. Puedes cerrar esta ventana.'
      ));
    }

    console.log('🔄 Google Tasks Callback recibido:');
    console.log('  - code:', code ? 'PRESENTE' : 'AUSENTE');
    console.log('  - state:', state);
    console.log('  - authError:', authError);
    console.log('  - req.user:', req.user);

    const verified = verifyOAuthState(state);
    if (!verified?.userId) {
      console.error('❌ OAuth state inválido o expirado:', state);
      return res.send(callbackHtml(
        "{ type: 'google_tasks_auth', status: 'error', message: 'Sesión OAuth inválida o expirada' }",
        'Error: Sesión OAuth inválida o expirada. Cierra esta ventana e intenta de nuevo.'
      ));
    }
    const isCalendarAuth = verified.kind === 'cal'
      || String(state || '').startsWith(CALENDAR_OAUTH_STATE_PREFIX);
    const userId = verified.userId;
    console.log('🔍 userId final extraído:', userId, isCalendarAuth ? '(Calendar)' : '(Tasks)');
    
    if (!userId || userId === 'undefined') {
      console.error('❌ UserId inválido en callback:', userId);
      const authType = isCalendarAuth ? 'google_calendar_auth' : 'google_tasks_auth';
      return res.send(callbackHtml(
        `{ type: '${authType}', status: 'error', message: 'Usuario no identificado' }`,
        'Error: Usuario no identificado. Puedes cerrar esta ventana.'
      ));
    }

    if (isCalendarAuth) {
      const { scriptBody, bodyText } = await completeCalendarOAuth(userId, code);
      return res.send(callbackHtml(scriptBody, bodyText));
    }

    if (!isGoogleTasksEnabled()) {
      return res.send(callbackHtml(
        "{ type: 'google_tasks_auth', status: 'error', message: 'Google Tasks no disponible' }",
        'Error: Google Tasks no está disponible. Puedes cerrar esta ventana.'
      ));
    }

    // Modo real - intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Guardar tokens en la base de datos
    await Users.findByIdAndUpdate(userId, {
      'googleTasksConfig.enabled': true,
      'googleTasksConfig.accessToken': tokens.access_token,
      'googleTasksConfig.refreshToken': tokens.refresh_token,
      'googleTasksConfig.lastSync': new Date(),
      'googleTasksConfig.syncDirection': 'bidirectional'
    });

    if (googleTasksService) {
      await googleTasksService.enableGoogleTasksForAllUserTasks(userId);
    }

    // Realizar sincronización inicial si el servicio está disponible
    let syncResults = null;
    if (googleTasksService) {
      try {
        syncResults = await googleTasksService.fullSync(userId);
      } catch (syncError) {
        console.warn('Error en sincronización inicial:', syncError);
      }
    }

    const sent = syncResults?.tareas?.toGoogle?.success || 0;
    const imported = syncResults?.tareas?.fromGoogle?.created || 0;
    const message = syncResults
      ? `Google Tasks conectado y sincronizado. ${sent} enviadas, ${imported} importadas`
      : 'Google Tasks conectado correctamente';

    console.log('🎉 Conexión exitosa:', message);

    return res.send(callbackHtml(
      `{ type: 'google_tasks_auth', status: 'success', message: ${JSON.stringify(message)} }`,
      '¡Google Tasks conectado exitosamente! Puedes cerrar esta ventana.'
    ));

  } catch (error) {
    console.error('❌ Error en callback de Google Tasks:', error);
    return res.send(callbackHtml(
      "{ type: 'google_tasks_auth', status: 'error', message: 'Error al procesar autorización' }",
      'Ocurrió un error al procesar la autorización. Puedes cerrar esta ventana.'
    ));
  }
};

/**
 * Obtiene el estado de configuración de Google Tasks del usuario
 */
export const getStatus = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    const dbUser = userId ? await Users.findById(userId).select('googleTasksConfig') : null;
    const googleTasksConfig = dbUser?.googleTasksConfig || req.user?.googleTasksConfig || {};

    const status = {
      enabled: googleTasksConfig.enabled || false,
      lastSync: googleTasksConfig.lastSync || null,
      defaultTaskList: googleTasksConfig.defaultTaskList || null,
      syncDirection: googleTasksConfig.syncDirection || 'bidirectional',
      available: isGoogleTasksEnabled(),
      mode: isGoogleTasksEnabled() ? 'production' : 'simulation',
      message: googleTasksConfig.enabled 
        ? `Google Tasks conectado${!isGoogleTasksEnabled() ? ' (modo simulado)' : ''}` 
        : 'Google Tasks no conectado'
    };

    res.json({ success: true, status });
  } catch (error) {
    console.error('Error al obtener estado:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener estado de Google Tasks' 
    });
  }
};

/**
 * Actualiza la configuración de Google Tasks
 */
export const updateConfig = async (req, res) => {
  try {
    const { syncDirection, defaultTaskList } = req.body;
    
    const updateData = {};
    if (syncDirection) updateData['googleTasksConfig.syncDirection'] = syncDirection;
    if (defaultTaskList) updateData['googleTasksConfig.defaultTaskList'] = defaultTaskList;
    
    await Users.findByIdAndUpdate(getUserId(req.user), updateData);
    
    res.json({ 
      success: true, 
      message: 'Configuración actualizada correctamente' 
    });
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al actualizar configuración' 
    });
  }
};

/**
 * Desconecta Google Tasks
 */
export const disconnect = async (req, res) => {
  try {
    await Users.findByIdAndUpdate(getUserId(req.user), {
      'googleTasksConfig.enabled': false,
      'googleTasksConfig.accessToken': null,
      'googleTasksConfig.refreshToken': null,
      'googleTasksConfig.lastSync': null
    });
    
    res.json({ 
      success: true, 
      message: 'Google Tasks desconectado correctamente' 
    });
  } catch (error) {
    console.error('Error al desconectar Google Tasks:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al desconectar Google Tasks' 
    });
  }
};

/**
 * Obtiene estadísticas de sincronización
 */
export const getStats = async (req, res) => {
  try {
    if (!isGoogleTasksEnabled() || !googleTasksService) {
      // Modo simulado - estadísticas mock
      const stats = {
        totalTasks: 0,
        syncedTasks: 0,
        lastSyncDate: null,
        pendingSync: 0,
        errors: 0,
        mode: 'simulation'
      };
      return res.json({ success: true, stats });
    }

    // Modo real - obtener estadísticas reales
    const stats = await googleTasksService.getStats(getUserId(req.user));
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener estadísticas' 
    });
  }
};

/**
 * Limpia tokens inválidos de Google Tasks
 */
export const cleanupInvalidTokens = async (req, res) => {
  try {
    if (!isGoogleTasksEnabled() || !googleTasksService) {
      return res.json({
        success: false,
        error: 'Google Tasks no está disponible'
      });
    }

    console.log('🧹 Iniciando limpieza de tokens inválidos...');
    const results = await googleTasksService.cleanupInvalidTokens();

    res.json({
      success: true,
      message: `Limpieza completada: ${results.validCount} tokens válidos, ${results.cleanedCount} tokens limpiados`,
      data: results
    });

  } catch (error) {
    console.error('Error en limpieza de tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Error al limpiar tokens inválidos'
    });
  }
};

/**
 * Limpia duplicados de Google Tasks
 */
export const cleanupDuplicates = async (req, res) => {
  try {
    if (!isGoogleTasksEnabled() || !googleTasksService) {
      return res.json({
        success: false,
        error: 'Google Tasks no está disponible'
      });
    }

    const userId = getUserId(req.user);
    console.log(`🧹 Iniciando limpieza de duplicados para usuario: ${userId}`);

    // 1. Primero, limpiar tareas locales spam
    const { Tareas } = await import('../models/index.js');
    
    const localTasks = await Tareas.find({
      usuario: userId,
      'googleTasksSync.enabled': true
    });

    let localFixed = 0;
    let localSpamDeleted = 0;

    let notesCleaned = 0;
    
    // Limpiar títulos básicamente
    for (const tarea of localTasks) {
      const tituloOriginal = tarea.titulo;
      const tituloLimpio = googleTasksService.cleanTitle(tarea.titulo);
      
      // Limpiar y guardar si cambió
      if (tituloLimpio !== tituloOriginal) {
        tarea.titulo = tituloLimpio;
        await tarea.save();
        localFixed++;
        console.log(`🔧 Limpiado: "${tituloOriginal}" -> "${tituloLimpio}"`);
      }
    }

    const results = {
      success: true,
      message: 'Títulos locales normalizados (no elimina duplicados en Google)',
      data: {
        localFixed,
        totalProcessed: localTasks.length,
        titlesCleaned: true,
        notesCleaned,
      },
    };

    console.log(`✅ Limpieza completada:`, results.data);
    res.json(results);

  } catch (error) {
    console.error('Error en limpieza de duplicados:', error);
    res.status(500).json({
      success: false,
      error: 'Error al limpiar duplicados'
    });
  }
};

/**
 * Sincronización manual
 */
export const manualSync = async (req, res) => {
  try {
    if (!isGoogleTasksEnabled() || !googleTasksService) {
      // Modo simulado
      return res.json({ 
        success: true, 
        message: 'Sincronización completada (modo simulado)',
        results: {
          toGoogle: { success: 0, errors: [] },
          fromGoogle: { created: 0, updated: 0, errors: [] },
          mode: 'simulation'
        }
      });
    }

    // Verificar que el usuario tenga Google Tasks habilitado
    if (!req.user.googleTasksConfig?.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Google Tasks no está habilitado para este usuario. Conecta tu cuenta de Google primero.'
      });
    }

    // Modo real - sincronización real
    // Pasar el usuario completo en lugar de solo el ID para evitar consultas adicionales
    const fullImport = req.body?.fullImport === true;
    const syncResults = await googleTasksService.fullSyncWithUser(req.user, { fullImport });
    
    // Actualizar fecha de última sincronización
    await Users.findByIdAndUpdate(getUserId(req.user), {
      'googleTasksConfig.lastSync': new Date()
    });

    // Preparar mensaje informativo
    let message = 'Sincronización completada correctamente';
    if (syncResults.tareas?.toGoogle?.success > 0 || syncResults.tareas?.fromGoogle?.created > 0) {
      message += '. Los objetivos de Attadia se sincronizan como listas en Google Tasks.';
    }

    res.json({ 
      success: true, 
      message,
      results: syncResults
    });
  } catch (error) {
    console.error('Error en sincronización manual:', error);
    
    let errorMessage = 'Error en sincronización manual';
    if (error.message.includes('Google Tasks no está habilitado')) {
      errorMessage = 'Google Tasks no está habilitado para este usuario';
    } else if (error.message.includes('token') || error.message.includes('credentials')) {
      errorMessage = 'Error de autenticación con Google. Intenta reconectar tu cuenta.';
    } else if (error.message.includes('No se pudo acceder a Google Tasks')) {
      errorMessage = 'No se pudo acceder a Google Tasks. Verifica tu conexión y permisos.';
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
};

/**
 * Sincronizar tarea específica
 */
export const syncTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (!isGoogleTasksEnabled() || !googleTasksService) {
      // Modo simulado
      return res.json({ 
        success: true, 
        message: `Tarea ${taskId} sincronizada correctamente (modo simulado)` 
      });
    }

    // Modo real - sincronizar tarea específica
    await googleTasksService.syncSpecificTask(getUserId(req.user), taskId);
    
    res.json({ 
      success: true, 
      message: `Tarea ${taskId} sincronizada correctamente` 
    });
  } catch (error) {
    console.error('Error al sincronizar tarea:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al sincronizar tarea' 
    });
  }
};

/**
 * Obtener listas de tareas de Google
 */
export const getTaskLists = async (req, res) => {
  try {
    if (!isGoogleTasksEnabled() || !googleTasksService) {
      // Modo simulado
      return res.json({ 
        success: true, 
        taskLists: [
          { id: 'default', title: 'My Tasks (Simulado)' }
        ]
      });
    }

    // Modo real
    const taskLists = await googleTasksService.getTaskLists(getUserId(req.user));
    res.json({ success: true, taskLists });
  } catch (error) {
    console.error('Error al obtener listas de tareas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener listas de tareas' 
    });
  }
};

// Endpoints para sincronización automática
export const getAutoSyncStatus = async (req, res) => {
  try {
    const status = autoSyncService.getStatus();
    
    res.json({
      success: true,
      autoSync: status
    });
  } catch (error) {
    console.error('Error al obtener estado de sincronización automática:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de sincronización automática'
    });
  }
};

export const startAutoSync = async (req, res) => {
  try {
    autoSyncService.start();
    
    res.json({
      success: true,
      message: 'Sincronización automática iniciada'
    });
  } catch (error) {
    console.error('Error al iniciar sincronización automática:', error);
    res.status(500).json({
      success: false,
      error: 'Error al iniciar sincronización automática'
    });
  }
};

export const stopAutoSync = async (req, res) => {
  try {
    autoSyncService.stop();
    
    res.json({
      success: true,
      message: 'Sincronización automática detenida'
    });
  } catch (error) {
    console.error('Error al detener sincronización automática:', error);
    res.status(500).json({
      success: false,
      error: 'Error al detener sincronización automática'
    });
  }
};

export const setAutoSyncInterval = async (req, res) => {
  try {
    const { interval } = req.body;
    
    if (!interval) {
      return res.status(400).json({
        success: false,
        error: 'Intervalo requerido'
      });
    }

    autoSyncService.setInterval(interval);
    
    res.json({
      success: true,
      message: 'Intervalo de sincronización actualizado',
      interval
    });
  } catch (error) {
    console.error('Error al actualizar intervalo de sincronización:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar intervalo de sincronización'
    });
  }
};

export const forceAutoSync = async (req, res) => {
  try {
    await autoSyncService.forceSync();
    
    res.json({
      success: true,
      message: 'Sincronización forzada completada'
    });
  } catch (error) {
    console.error('Error al forzar sincronización:', error);
    res.status(500).json({
      success: false,
      error: 'Error al forzar sincronización'
    });
  }
};

/**
 * Auditoría por objetivo (ejecuta script CLI) y devuelve salida
 */
export const auditProject = async (req, res) => {
  try {
    const { objetivoName, projectName } = req.body || {};
    const name = objetivoName || projectName;
    if (!name) {
      return res.status(400).json({ success: false, error: 'objetivoName es requerido' });
    }
    if (!isGoogleTasksEnabled()) {
      return res.status(503).json({ success: false, error: 'Google Tasks no está disponible' });
    }
    const user = req.user;
    const scriptPath = path.resolve(process.cwd(), 'apps/backend/scripts/audit-google-tasks-consistency.js');
    const args = [scriptPath, `--user=${user.email || user._id}`, `--objetivo-name=${name}`];

    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let errorOut = '';

    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { errorOut += data.toString(); });

    child.on('close', (code) => {
      return res.json({
        success: code === 0,
        code,
        output,
        error: errorOut || null
      });
    });
  } catch (error) {
    console.error('Error al auditar objetivo:', error);
    res.status(500).json({ success: false, error: 'Error al auditar objetivo' });
  }
};

/**
 * Limpieza por objetivo (ejecuta script CLI). Si apply=true, aplica cambios.
 */
export const cleanupProject = async (req, res) => {
  try {
    const { objetivoName, projectName, apply = false } = req.body || {};
    const name = objetivoName || projectName;
    if (!name) {
      return res.status(400).json({ success: false, error: 'objetivoName es requerido' });
    }
    if (!isGoogleTasksEnabled()) {
      return res.status(503).json({ success: false, error: 'Google Tasks no está disponible' });
    }
    const user = req.user;
    const scriptPath = path.resolve(process.cwd(), 'apps/backend/scripts/fix-main-equals-subtasks.js');
    const args = [
      scriptPath,
      `--user=${user.email || user._id}`,
      `--objetivo-name=${name}`,
      '--google',
      `--dry-run=${apply ? 'false' : 'true'}`
    ];

    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let errorOut = '';

    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { errorOut += data.toString(); });

    child.on('close', (code) => {
      return res.json({
        success: code === 0,
        code,
        output,
        error: errorOut || null
      });
    });
  } catch (error) {
    console.error('Error al limpiar objetivo:', error);
    res.status(500).json({ success: false, error: 'Error al limpiar objetivo' });
  }
};
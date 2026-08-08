import express from 'express';
import * as googleTasksController from '../controllers/googleTasksController.js';
import { checkAuth } from '../middleware/auth.js';
import { checkRole, ROLES } from '../middleware/checkRole.js';

const router = express.Router();

// Callback de OAuth DEBE estar accesible sin autenticación JWT
router.get('/callback', googleTasksController.handleCallback);

// El resto de rutas requieren autenticación
router.use(checkAuth);

// Rutas de configuración
router.get('/auth-url', googleTasksController.getAuthUrl);
router.get('/status', googleTasksController.getStatus);
router.put('/config', googleTasksController.updateConfig);
router.delete('/disconnect', googleTasksController.disconnect);
// Alias para compatibilidad con el frontend actual
router.delete('/disable', googleTasksController.disconnect);

// Rutas de sincronización
router.post('/sync', googleTasksController.manualSync);
router.post('/sync/task/:taskId', googleTasksController.syncTask);
router.post('/cleanup', googleTasksController.cleanupDuplicates);
router.post('/cleanup-tokens', googleTasksController.cleanupInvalidTokens);

// Rutas adicionales
router.get('/stats', googleTasksController.getStats);
router.get('/task-lists', googleTasksController.getTaskLists);
// Auditoría y limpieza por objetivo
router.post('/audit-project', googleTasksController.auditProject);
router.post('/cleanup-project', googleTasksController.cleanupProject);

// Auto-sync: status para todos; mutaciones solo admin (cron es global al proceso)
router.get('/auto-sync/status', googleTasksController.getAutoSyncStatus);
router.post('/auto-sync/start', checkRole([ROLES.ADMIN]), googleTasksController.startAutoSync);
router.post('/auto-sync/stop', checkRole([ROLES.ADMIN]), googleTasksController.stopAutoSync);
router.put('/auto-sync/interval', checkRole([ROLES.ADMIN]), googleTasksController.setAutoSyncInterval);
router.post('/auto-sync/force', checkRole([ROLES.ADMIN]), googleTasksController.forceAutoSync);

export default router;

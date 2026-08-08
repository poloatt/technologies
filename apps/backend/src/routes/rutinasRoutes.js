import express from 'express';
import { rutinasController } from '../controllers/rutinasController.js';
import { checkAuth } from '../middleware/auth.js';
import { checkRole } from '../middleware/checkRole.js';
import { checkOwnership } from '../middleware/checkOwnership.js';
import { Rutinas } from '../models/index.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(checkAuth);

// Ruta para verificar si existe una rutina para una fecha específica
router.get('/verify', rutinasController.verifyDate);

// Rutas administrativas
router.get('/admin/all', [checkRole([ROLES.ADMIN])], rutinasController.getAllAdmin);
router.get('/admin/stats', [checkRole([ROLES.ADMIN])], rutinasController.getAdminStats);

// Ruta para obtener historial de rutinas en un rango de fechas
// IMPORTANTE: Esta ruta debe estar antes de '/:id' para evitar que se interprete "historial" como un ID
router.get('/historial', rutinasController.getHistorial);

// Nueva ruta para obtener historial de completaciones de un ítem específico
router.get('/historial-completaciones/:section/:itemId', rutinasController.getHistorialCompletaciones);

// Rutas CRUD estándar
router.post('/', rutinasController.create);
router.get('/', rutinasController.getAll);
router.get('/:id', rutinasController.getById);
router.put('/:id', checkOwnership(Rutinas), rutinasController.update);
router.delete('/:id', checkOwnership(Rutinas), rutinasController.delete);

// Actualizar configuración de un ítem específico en una rutina
router.put('/:id/config', checkAuth, rutinasController.updateItemConfig);
// Nueva ruta para actualizar la configuración por sección e ítem específico
router.put('/:id/config/:seccion/:itemId', checkAuth, rutinasController.updateItemConfigByPath);

export default router; 
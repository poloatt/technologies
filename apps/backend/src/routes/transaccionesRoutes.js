import express from 'express';
import { checkAuth } from '../middleware/auth.js';
import { transaccionesController } from '../controllers/transaccionesController.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(checkAuth);

// Rutas adicionales (deben ir antes de las rutas con parámetros)
router.get('/stats', transaccionesController.getStats);
router.get('/saldos', transaccionesController.getSaldos);
router.get('/resumen', transaccionesController.getResumen);

// Rutas base del controlador
router.get('/', transaccionesController.getAll);
router.post('/', transaccionesController.create);

// Rutas con parámetros
router.get('/balance/:cuentaId', transaccionesController.getBalance);
router.get('/by-cuenta/:cuentaId', transaccionesController.getByCuenta);
router.get('/:id', transaccionesController.getById);
router.put('/:id', transaccionesController.update);
router.delete('/:id', transaccionesController.delete);
router.patch('/:id/estado', transaccionesController.updateEstado);

export default router; 
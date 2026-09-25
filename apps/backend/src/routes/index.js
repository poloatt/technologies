import express from 'express';
import usersRoutes from './usersRoutes.js';
import propiedadesRoutes from './propiedadesRoutes.js';
import inquilinosRoutes from './inquilinosRoutes.js';
import contratosRoutes from './contratosRoutes.js';
import inventariosRoutes from './inventariosRoutes.js';
import habitacionesRoutes from './habitacionesRoutes.js';
import monedasRoutes from './monedasRoutes.js';
import cuentasRoutes from './cuentasRoutes.js';
import transaccionesRoutes from './transaccionesRoutes.js';
import transaccionRecurrenteRoutes from './transaccionRecurrenteRoutes.js';
import objetivosRoutes from './objetivosRoutes.js';
import tareasRoutes from './tareasRoutes.js';
import tareaSeriesRoutes from './tareaSeriesRoutes.js';
import subtareasRoutes from './subtareasRoutes.js';
import googleTasksRoutes from './googleTasksRoutes.js';
import googleCalendarRoutes from './googleCalendarRoutes.js';
import rutinasRoutes from './rutinasRoutes.js';
import labsRoutes from './labsRoutes.js';
import dietasRoutes from './dietasRoutes.js';
import monitoreoRoutes from './monitoreoRoutes.js';
import perfilRoutes from './perfilRoutes.js';
import healthRoutes from './healthRoutes.js';
import dataCorporalRoutes from './dataCorporalRoutes.js';
import saludRoutes from './saludRoutes.js';
import bankConnectionRoutes from './bankConnectionRoutes.js';
import statsRoutes from './statsRoutes.js';

const router = express.Router();

// Rutas de salud
router.use('/health', healthRoutes);

// Conteos batch (hub/strip)
router.use('/stats', statsRoutes);

// Rutas de usuarios y perfil
router.use('/users', usersRoutes);
router.use('/perfil', perfilRoutes);

// Rutas de gestión de propiedades
router.use('/propiedades', propiedadesRoutes);
router.use('/inquilinos', inquilinosRoutes);
router.use('/contratos', contratosRoutes);
router.use('/inventarios', inventariosRoutes);
router.use('/habitaciones', habitacionesRoutes);

// Rutas de gestión financiera
router.use('/monedas', monedasRoutes);
router.use('/cuentas', cuentasRoutes);
router.use('/transacciones', transaccionesRoutes);
router.use('/transaccionesrecurrentes', transaccionRecurrenteRoutes);
router.use('/bankconnections', bankConnectionRoutes);

// Rutas de gestión de objetivos (contenedores de tareas) y tareas
router.use('/objetivos', objetivosRoutes);
router.use('/tareas', tareasRoutes);
router.use('/tarea-series', tareaSeriesRoutes);
router.use('/subtareas', subtareasRoutes);
router.use('/google-tasks', googleTasksRoutes);
router.use('/google-calendar', googleCalendarRoutes);

// Rutas de salud y bienestar
router.use('/rutinas', rutinasRoutes);
router.use('/labs', labsRoutes);
router.use('/dietas', dietasRoutes);
router.use('/datacorporal', dataCorporalRoutes);
router.use('/salud', saludRoutes);

// Rutas de monitoreo
router.use('/monitoreo', monitoreoRoutes);

export { router };

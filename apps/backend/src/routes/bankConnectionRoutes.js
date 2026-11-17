import express from 'express';
import BankConnectionController from '../controllers/bankConnectionController.js';
import { checkAuth } from '../middleware/auth.js';
import { checkOwnership } from '../middleware/checkOwnership.js';
import { checkRole, ROLES } from '../middleware/checkRole.js';
import { BankConnection } from '../models/BankConnection.js';
import { 
  validateMercadoPagoAuthUrl, 
  validateMercadoPagoCallback, 
  validateSyncRequest 
} from '../middleware/validateMercadoPago.js';
import rateLimit from 'express-rate-limit';
import config from '../config/config.js';

const router = express.Router();

/** Endpoints de diagnóstico/prueba MP: solo desarrollo o admin */
const allowMercadoPagoDebug = (req, res, next) => {
  if (config.isDev) return next();
  return checkRole(ROLES.ADMIN)(req, res, next);
};

// Rate limiting específico para MercadoPago (evitar exceder límites de API)
const mercadopagoLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 requests por minuto para MercadoPago
  message: { 
    error: 'Demasiadas peticiones a MercadoPago. Por favor, espera un momento.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usar IP real para rate limiting
    return req.headers['x-real-ip'] || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           req.ip;
  }
});

// Rate limiting para sincronización (evitar sobrecarga)
const syncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 5, // máximo 5 sincronizaciones por 5 minutos
  message: { 
    error: 'Demasiadas sincronizaciones. Por favor, espera antes de intentar nuevamente.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-real-ip'] || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           req.ip;
  }
});

// Aplicar autenticación a todas las rutas
router.use(checkAuth);

// Endpoints de prueba/diagnóstico MP (bloqueados en producción salvo admin)
router.post('/pagos/prueba', allowMercadoPagoDebug, (req, res) => {
  const controller = new BankConnectionController();
  controller.pagoPrueba(req, res);
});

router.post('/pagos/diagnostico', allowMercadoPagoDebug, (req, res) => {
  const controller = new BankConnectionController();
  controller.pagoPruebaSimple(req, res);
});

router.post('/mercadopago/probar-token', allowMercadoPagoDebug, (req, res) => {
  const controller = new BankConnectionController();
  controller.probarTokenUsuario(req, res);
});

// Rutas de MercadoPago con rate limiting y validación
router.get('/mercadopago/auth-url', 
  mercadopagoLimiter, 
  validateMercadoPagoAuthUrl,
  (req, res) => {
    const controller = new BankConnectionController();
    controller.getMercadoPagoAuthUrl(req, res);
  }
);

router.post('/mercadopago/callback', 
  mercadopagoLimiter, 
  validateMercadoPagoCallback,
  (req, res) => {
    const controller = new BankConnectionController();
    controller.mercadoPagoCallback(req, res);
  }
);

// Nuevos endpoints para datos completos de MercadoPago
router.get('/mercadopago/datos-completos/:conexionId', 
  mercadopagoLimiter,
  (req, res) => {
    const controller = new BankConnectionController();
    controller.obtenerDatosCompletosMercadoPago(req, res);
  }
);

router.post('/mercadopago/procesar-datos/:conexionId', 
  mercadopagoLimiter,
  (req, res) => {
    const controller = new BankConnectionController();
    controller.procesarDatosMercadoPago(req, res);
  }
);

router.post('/mercadopago/importar-csv/:conexionId',
  mercadopagoLimiter,
  (req, res) => {
    const controller = new BankConnectionController();
    controller.importarCsvMercadoPago(req, res);
  }
);

router.get('/mercadopago/sfa-status',
  mercadopagoLimiter,
  (req, res) => {
    const controller = new BankConnectionController();
    controller.getMercadoPagoSfaStatus(req, res);
  }
);

// Rutas de sincronización con rate limiting y validación
router.post('/sync/:id', 
  syncLimiter, 
  validateSyncRequest,
  (req, res) => {
    const controller = new BankConnectionController();
    controller.sincronizarConexion(req, res);
  }
);

router.post('/sync-all', 
  syncLimiter, 
  (req, res) => {
    const controller = new BankConnectionController();
    controller.sincronizarTodas(req, res);
  }
);

// Rutas estándar CRUD
router.get('/', (req, res) => {
  const controller = new BankConnectionController();
  controller.getAll(req, res);
});

router.post('/', (req, res) => {
  const controller = new BankConnectionController();
  controller.create(req, res);
});

router.get('/:id', checkOwnership(BankConnection), (req, res) => {
  const controller = new BankConnectionController();
  controller.getById(req, res);
});

router.put('/:id', checkOwnership(BankConnection), (req, res) => {
  const controller = new BankConnectionController();
  controller.update(req, res);
});

router.delete('/:id', checkOwnership(BankConnection), (req, res) => {
  const controller = new BankConnectionController();
  controller.delete(req, res);
});

// Ruta de verificación
router.post('/verify', (req, res) => {
  const controller = new BankConnectionController();
  controller.verificarConexion(req, res);
});

// Verificación por ID de conexión (recomendada para MP)
router.post('/:id/verify', (req, res) => {
  const controller = new BankConnectionController();
  controller.verificarConexionPorId(req, res);
});

export default router; 
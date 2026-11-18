import { check, validationResult } from 'express-validator';
import config from '../config/config.js';

function getAllowedRedirectOrigins() {
  const origins = new Set();
  if (Array.isArray(config.corsOrigins)) {
    config.corsOrigins.forEach((o) => origins.add(o));
  }
  if (config.frontendUrl) origins.add(config.frontendUrl);
  if (config.frontendUrls) {
    Object.values(config.frontendUrls).forEach((o) => {
      if (o) origins.add(o);
    });
  }
  // Dev local habitual
  ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175',
   'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175'
  ].forEach((o) => origins.add(o));
  return origins;
}

// Validación para la URL de autorización de MercadoPago
export const validateMercadoPagoAuthUrl = [
  check('redirect_uri')
    .notEmpty()
    .withMessage('redirect_uri es requerido')
    .custom((value) => {
      try {
        const url = new URL(value);
        const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('redirect_uri debe usar protocolo http o https');
        }

        if (process.env.NODE_ENV === 'production' && url.protocol === 'http:' && !isLocalhost) {
          throw new Error('redirect_uri debe usar HTTPS en producción');
        }

        if (!url.pathname.endsWith('/mercadopago/callback')) {
          throw new Error('redirect_uri debe terminar en /mercadopago/callback');
        }

        const origin = url.origin;
        const allowed = getAllowedRedirectOrigins();
        if (!allowed.has(origin)) {
          throw new Error('redirect_uri no está en la lista de orígenes permitidos');
        }

        return true;
      } catch (error) {
        throw new Error(error.message || 'redirect_uri debe ser una URL válida');
      }
    }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ [MercadoPago] Validación fallida:', {
        redirect_uri: req.query.redirect_uri,
        errors: errors.array()
      });
      return res.status(400).json({ 
        error: 'Parámetros inválidos',
        details: errors.array() 
      });
    }
    next();
  }
];

// Validación para el callback de MercadoPago
export const validateMercadoPagoCallback = [
  check('code')
    .notEmpty()
    .withMessage('Código de autorización es requerido')
    .isString()
    .withMessage('Código debe ser una cadena de texto')
    .isLength({ min: 10, max: 200 })
    .withMessage('Código debe tener entre 10 y 200 caracteres'),
  check('state')
    .notEmpty()
    .withMessage('Parámetro state es requerido')
    .isString()
    .withMessage('State debe ser una cadena de texto')
    .isLength({ min: 16, max: 128 })
    .withMessage('State inválido'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos',
        details: errors.array() 
      });
    }
    next();
  }
];

// Validación para sincronización
export const validateSyncRequest = [
  check('id')
    .isMongoId()
    .withMessage('ID de conexión inválido'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos',
        details: errors.array() 
      });
    }
    next();
  }
]; 
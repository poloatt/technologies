import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determinar el ambiente
const environment = process.env.NODE_ENV || process.env.ENVIRONMENT || 'development';
console.log('Ambiente detectado:', environment);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('ENVIRONMENT:', process.env.ENVIRONMENT);

// Cargar el archivo .env correspondiente
let envPath;
if (environment === 'production') {
  envPath = path.resolve(__dirname, '../../.env.production');
} else {
  envPath = path.resolve(__dirname, '../../.env');
}
console.log('Cargando configuración desde:', envPath);
dotenv.config({ path: envPath });

// Validar variables de entorno requeridas
const validateRequiredEnvVars = () => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'REFRESH_TOKEN_SECRET',
    'SESSION_SECRET',
    'MONGO_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'FRONTEND_URL',
    'BACKEND_URL',
    'GOOGLE_CALLBACK_URL',
    'CORS_ORIGINS',
    'MERCADOPAGO_CLIENT_ID',
    'MERCADOPAGO_CLIENT_SECRET'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`Advertencia: La variable de entorno ${envVar} no está definida en ${environment}`);
    }
  }
};

// Dominio compartido para cookie SSO entre subdominios (*.attadia.com)
const resolveAuthCookieDomain = (env) => {
  if (process.env.AUTH_COOKIE_DOMAIN) {
    return process.env.AUTH_COOKIE_DOMAIN;
  }
  if (env === 'production') {
    return '.attadia.com';
  }
  // Dev con subdominios locales: foco.local.attadia.com → .local.attadia.com
  if (process.env.USE_LOCAL_SUBDOMAINS === 'true') {
    return '.local.attadia.com';
  }
  return undefined;
};

// Configuración base para todos los ambientes
const baseConfig = {
  port: parseInt(process.env.PORT || '8080', 10),
  sessionSecret: process.env.SESSION_SECRET || 'fallback_session_secret',
  jwtSecret: process.env.JWT_SECRET || 'fallback_jwt_secret',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'fallback_refresh_token_secret',
  isDev: false,
  // Configuración de MercadoPago
  mercadopago: {
    clientId: process.env.MERCADOPAGO_CLIENT_ID,
    clientSecret: process.env.MERCADOPAGO_CLIENT_SECRET,
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
    publicKey: process.env.MERCADOPAGO_PUBLIC_KEY,
    settlementPollIntervalMs: parseInt(process.env.MP_SETTLEMENT_POLL_INTERVAL_MS || '3000', 10),
    settlementMaxPollAttempts: parseInt(process.env.MP_SETTLEMENT_MAX_POLL_ATTEMPTS || '40', 10),
    settlementPendingMaxAgeMs: parseInt(
      process.env.MP_SETTLEMENT_PENDING_MAX_AGE_MS || String(24 * 60 * 60 * 1000),
      10
    ),
    syncDays: parseInt(process.env.MP_SYNC_DAYS || '90', 10)
  },
  openFinance: {
    sfaEnabled: process.env.OPEN_FINANCE_SFA_ENABLED === 'true',
    monitorIntervalHours: parseInt(process.env.OPEN_FINANCE_MONITOR_INTERVAL_HOURS || '168', 10)
  }
};

// Configuraciones específicas por ambiente
const configs = {
  development: {
    ...baseConfig,
    env: 'development',
    isDev: true,
    authCookieDomain: resolveAuthCookieDomain('development'),
    port: parseInt(process.env.PORT || '5000', 10),
    mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017/present',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173', // Foco por defecto
    backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    // URLs de todas las apps en desarrollo
    frontendUrls: {
      foco: 'http://localhost:5173',
      caja: 'http://localhost:5174',
      pulso: 'http://localhost:5175'
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
    }
  },
  production: {
    ...baseConfig,
    env: 'production',
    authCookieDomain: resolveAuthCookieDomain('production'),
    mongoUrl: process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL || process.env.MONGODB_URI || `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@mongodb:27017/${process.env.MONGO_DB}?authSource=admin`,
    frontendUrl: process.env.FRONTEND_URL || 'https://foco.attadia.com',
    backendUrl: process.env.BACKEND_URL || 'https://api.attadia.com',
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['https://foco.attadia.com', 'https://caja.attadia.com', 'https://atta.attadia.com', 'https://pulso.attadia.com', 'https://attadia.com', 'https://www.attadia.com'],
    // URLs de todas las apps en producción
    frontendUrls: {
      foco: 'https://foco.attadia.com',
      caja: 'https://caja.attadia.com',
      pulso: 'https://pulso.attadia.com'
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'https://api.attadia.com/api/auth/google/callback'
    }
  }
};

// Validar variables de entorno
validateRequiredEnvVars();

// Exportar la configuración según el ambiente
export default configs[environment] || configs.development;
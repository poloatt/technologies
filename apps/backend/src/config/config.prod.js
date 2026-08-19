import dotenv from 'dotenv';

// Cargar el archivo .env correspondiente
const isStaging = process.env.ENVIRONMENT === 'staging';
dotenv.config({ path: isStaging ? '.env.staging' : '.env.prod' });

const config = {
  env: process.env.ENVIRONMENT || 'production',
  port: parseInt(process.env.PORT || '8080', 10),
  mongoUrl: process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL || process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
  apiUrl: process.env.BACKEND_URL,
  frontendUrl: process.env.FRONTEND_URL,
  corsOrigins: [
    'https://foco.attadia.com',
    'https://caja.attadia.com',
    'https://atta.attadia.com',
    'https://pulso.attadia.com',
    'https://attadia.com',
    'https://www.attadia.com',
  ],
  sessionSecret: process.env.SESSION_SECRET,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: 'https://api.attadia.com/api/auth/google/callback'
  },
  isDev: false,
  isStaging
};

// Validación de configuración crítica
const requiredEnvVars = [
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'SESSION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'FRONTEND_URL',
  'BACKEND_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`La variable de entorno ${envVar} es requerida en ${config.env}`);
  }
}

console.log(`Configuración de MongoDB en ${config.env}:`, {
  url: config.mongoUrl,
  environment: config.env,
  isStaging: config.isStaging
});

console.log(`Configuración de URLs en ${config.env}:`, {
  frontend: config.frontendUrl,
  backend: config.apiUrl,
  corsOrigins: config.corsOrigins,
  port: config.port
});

export default config;
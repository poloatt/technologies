// Configuración centralizada según el ambiente
import { getApiBaseUrl } from './apiBaseUrl.js';

// SSO cross-app: en producción la cookie refreshToken usa Domain=.attadia.com (backend).
// En dev localhost (puertos distintos) se usa handoff URL; opcionalmente subdominios
// locales (*.local.attadia.com) + USE_LOCAL_SUBDOMAINS=true en el backend.
export const config = {
  development: {
    authPrefix: '/api/auth',
    apiPrefix: '/api',
    baseUrl: typeof window !== 'undefined'
      ? getApiBaseUrl()
      : (import.meta.env.VITE_API_URL || 'http://localhost:5000'),
    frontendUrls: {
      atta: import.meta.env.VITE_ATTA_URL || 'http://localhost:5174',
      foco: import.meta.env.VITE_FOCO_URL || 'http://localhost:5173',
      pulso: import.meta.env.VITE_PULSO_URL || 'http://localhost:5175'
    }
  },
  production: {
    authPrefix: '/api/auth',
    apiPrefix: '/api',
    baseUrl: import.meta.env.VITE_API_URL || 'https://api.attadia.com',
    frontendUrls: {
      atta: import.meta.env.VITE_ATTA_URL || 'https://atta.attadia.com',
      foco: import.meta.env.VITE_FOCO_URL || 'https://foco.attadia.com',
      pulso: import.meta.env.VITE_PULSO_URL || 'https://pulso.attadia.com'
    }
  }
};

// Determinar el ambiente actual
const env = import.meta.env.MODE || 'development';
const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname === 'atta.attadia.com' || 
   window.location.hostname === 'foco.attadia.com' || 
   window.location.hostname === 'pulso.attadia.com' ||
   window.location.hostname.endsWith('.local.attadia.com'));

// Forzar uso de configuración de producción si VITE_API_URL está definido
const useProductionConfig = typeof window !== 'undefined' && 
  (import.meta.env.VITE_API_URL || isProduction);

export const currentConfig = useProductionConfig 
  ? config.production 
  : config[env] || config.development;

// Función para depurar la configuración
export const logEnvironment = () => {
  // Comentado para reducir logs en consola
  // console.log('Ambiente detectado:', {
  //   env,
  //   baseUrl: currentConfig.baseUrl,
  //   mode: import.meta.env.MODE,
  //   viteApiUrl: import.meta.env.VITE_API_URL,
  //   isProduction
  // });
  // console.log('Configuración completa:', currentConfig);
};

// Función para obtener la URL de la app actual
export const getCurrentAppUrl = () => {
  if (typeof window === 'undefined') return null;

  const { hostname, port, origin } = window.location;

  // Previews de Vercel u otros hosts temporales: usar el origin real del navegador
  if (hostname.endsWith('.vercel.app')) {
    return origin;
  }

  // Desarrollo
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    switch (port) {
      case '5173': return currentConfig.frontendUrls.foco;
      case '5174': return currentConfig.frontendUrls.atta;
      case '5175': return currentConfig.frontendUrls.pulso;
      default: return origin;
    }
  }

  // Subdominios locales opcionales (USE_LOCAL_SUBDOMAINS en backend)
  if (hostname === 'foco.local.attadia.com') return currentConfig.frontendUrls.foco;
  if (hostname === 'atta.local.attadia.com') return currentConfig.frontendUrls.atta;
  if (hostname === 'pulso.local.attadia.com') return currentConfig.frontendUrls.pulso;

  // Producción
  if (hostname === 'foco.attadia.com') return currentConfig.frontendUrls.foco;
  if (hostname === 'atta.attadia.com') return currentConfig.frontendUrls.atta;
  if (hostname === 'pulso.attadia.com') return currentConfig.frontendUrls.pulso;

  // Staging u otros dominios: origin actual
  return origin;
};

// Exportar configuración actual
export default currentConfig; 
import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl.js';

const baseURL = getApiBaseUrl();
// console.log('URL base de Axios:', baseURL);

const clienteAxios = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true,
});

// Interceptor para agregar el token a las peticiones
let pendingRequests = {};

clienteAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Evitar solicitudes duplicadas en intervalos cortos (incluir params: limit=1 ≠ listado completo)
    const paramsKey = config.params && Object.keys(config.params).length > 0
      ? `?${new URLSearchParams(
        Object.entries(config.params).flatMap(([k, v]) => (v == null ? [] : [[k, String(v)]])),
      ).toString()}`
      : '';
    const requestId = `${config.method}:${config.url}${paramsKey}`;

    // Excluir rutas que se consultan en paralelo (hub de secciones + páginas de detalle)
    const frecuentEndpoints = [
      '/api/auth/check',
      '/api/health',
      '/api/rutinas',
      '/api/propiedades',
      '/api/cuentas',
      '/api/inquilinos',
      '/api/contratos',
      '/api/habitaciones',
      '/api/inventarios',
      '/api/tareas',
      '/api/objetivos',
      '/api/transacciones',
      '/api/transaccionesrecurrentes',
      '/api/monedas',
      '/api/users',
      '/api/users/rutinas-config',
      '/api/mediciones',
      '/api/dietas',
      '/api/datacorporal',
      '/api/lab',
    ];
    
    const isFrecuentEndpoint = frecuentEndpoints.some(endpoint => config.url.includes(endpoint));
    
    // Para los endpoints frecuentes, no aplicar restricciones
    if (config.method === 'get' && config.url.includes('/api/monedas')) {
      // Permitir siempre las solicitudes a /api/monedas sin cancelarlas
      return config;
    }
    
    // Si es una solicitud GET de API (no afectar a POST, PUT, DELETE) y no es un endpoint frecuente
    if (config.method === 'get' && config.url.includes('/api/') && !isFrecuentEndpoint) {
      // Si la misma solicitud está pendiente, cancelarla
      if (pendingRequests[requestId]) {
        const now = Date.now();
        const lastTime = pendingRequests[requestId];
        
        // Si hay una solicitud reciente (menos de 1000ms), cancelar (aumentado de 600ms)
        if (now - lastTime < 1000) {
          // console.log(`Solicitud cancelada (demasiado frecuente): ${requestId}`);
          return Promise.reject({ 
            cancelado: true, 
            message: 'Solicitud cancelada por repetirse demasiado rápido'
          });
        }
      }
      
      // Registrar esta solicitud
      pendingRequests[requestId] = Date.now();
      
      // Limpiar el registro después de 2 segundos
      setTimeout(() => {
        delete pendingRequests[requestId];
      }, 2000);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de respuesta
clienteAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Si el error es de cancelación por demasiadas solicitudes, manejarlo de forma silenciosa
    if (error.cancelado) {
      // console.log('Solicitud cancelada por control de frecuencia:', error.message);
      
      // Asegurarse de que el error mantiene la propiedad cancelado para que
      // los componentes puedan detectarla y manejarla adecuadamente
      const cancelError = new Error(error.message || 'Solicitud cancelada por repetirse demasiado rápido');
      cancelError.cancelado = true;
      cancelError.name = 'CanceledError';
      cancelError.code = 'ERR_CANCELED';
      
      return Promise.reject(cancelError);
    }
    
    if (
      error.message === 'Network Error'
      || error.code === 'ERR_NETWORK'
      || error.code === 'ERR_CONNECTION_REFUSED'
      || error.code === 'ERR_CONNECTION_RESET'
    ) {
      throw new Error(
        'No se puede conectar con el servidor. Comprueba que el backend esté en ejecución (por ejemplo npm run dev en apps/backend, puerto 5000).',
      );
    }

    // Log detallado en desarrollo
    if (import.meta.env.MODE === 'development') {
      // console.error('Error en la petición:', {
      //   status: error.response?.status,
      //   url: error.config?.url,
      //   method: error.config?.method,
      //   headers: error.config?.headers,
      //   data: error.config?.data
      // });
    }

    const originalRequest = error.config;

    // 🔧 HABILITADO: Refresh token automático para peticiones que no son de auth
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Solo refrescar si no es una petición de auth y no es login
      if (!originalRequest.url.includes('/auth/') && 
          !originalRequest.url.includes('/login') &&
          originalRequest.method !== 'post') {
        try {
          console.log('🔄 Intentando refresh token automático...');
          originalRequest._retry = true;
          
          const refreshToken = localStorage.getItem('refreshToken');
          const refreshBody = refreshToken ? { refreshToken } : {};

          const response = await clienteAxios.post('/api/auth/refresh-token', refreshBody, {
            withCredentials: true,
          });
          
          const { token: newToken } = response.data;
          localStorage.setItem('token', newToken);
          localStorage.removeItem('refreshToken');
          clienteAxios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          
          console.log('✅ Token refrescado exitosamente');
          return clienteAxios(originalRequest);
        } catch (refreshError) {
          console.log('❌ Error al refrescar token:', refreshError.message);
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          delete clienteAxios.defaults.headers.common['Authorization'];
          
          // Redirigir a login solo si no estamos ya ahí
          if (!window.location.pathname.includes('/login') &&
              !window.location.pathname.includes('/auth')) {
            window.location.href = '/login';
          }
        }
      }
    }

    return Promise.reject(error);
  }
);

// Asegurarse de que clienteAxios esté disponible globalmente
window.clienteAxios = clienteAxios;

/** Petición abortada por el control de frecuencia del interceptor (no es fallo de red). */
export function isAxiosCanceled(error) {
  return !!(error?.cancelado || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError');
}

export default clienteAxios;
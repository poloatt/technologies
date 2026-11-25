import clienteAxios from '../config/axios';
import { getRedirectURI } from '../config/mercadopago';

/**
 * Servicio para la integración con MercadoPago
 * Maneja todas las comunicaciones OAuth y sincronización de datos
 * Actualizado: Test de deploy para verificar configuración de Vercel 2
 */
class MercadoPagoService {
  constructor() {
    this.baseURL = '/api/bankconnections/mercadopago';
    this.timeout = 30000; // 30 segundos
  }

  /**
   * Obtiene la URL de autorización de MercadoPago
   * @returns {Promise<{authUrl: string, state: string}>} URL de autorización y state
   * @throws {Error} Si hay error en la comunicación con el backend
   */
  async getAuthUrl() {
    try {
      const redirectURI = getRedirectURI();
      console.log('🔵 [MercadoPagoService] getAuthUrl - baseURL:', this.baseURL);
      console.log('🔵 [MercadoPagoService] getAuthUrl - redirectURI:', redirectURI);
      
      const { data } = await clienteAxios.get(`${this.baseURL}/auth-url`, {
        params: { redirect_uri: redirectURI },
        timeout: this.timeout
      });
      
      console.log('✅ [MercadoPagoService] getAuthUrl - response received:', { hasAuthUrl: !!data.authUrl, hasState: !!data.state });
      
      if (!data.authUrl || !data.state) {
        throw new Error('Respuesta inválida del servidor: faltan datos de autorización');
      }
      
      return { authUrl: data.authUrl, state: data.state };
    } catch (error) {
      console.error('❌ [MercadoPagoService] Error obteniendo URL de autorización:', error);
      console.error('❌ [MercadoPagoService] Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout: El servidor no respondió en el tiempo esperado');
      }
      
      if (error.response?.status === 401) {
        throw new Error('No autorizado: Verifica tus credenciales de MercadoPago');
      }
      
      if (error.response?.status === 503) {
        throw new Error('Servicio temporalmente no disponible: Intenta más tarde');
      }
      
      throw new Error(
        error.response?.data?.message || 
        'Error obteniendo URL de autorización de MercadoPago'
      );
    }
  }

  /**
   * Procesa el callback OAuth de MercadoPago
   * @param {string} code - Código de autorización
   * @param {string} state - Parámetro state para validación CSRF
   * @returns {Promise<Object>} Resultado de la conexión
   * @throws {Error} Si hay error en el procesamiento del callback
   */
  async processCallback(code, state) {
    try {
      if (!code) {
        throw new Error('Código de autorización requerido');
      }
      
      const mode = localStorage.getItem('mercadopago_sync_mode') === 'historial' ? 'historial' : 'rapido';
      const since = localStorage.getItem('mercadopago_sync_since') || undefined;
      const { data } = await clienteAxios.post(`${this.baseURL}/callback`, {
        code,
        state,
        mode,
        since,
      }, {
        timeout: 180000
      });
      localStorage.removeItem('mercadopago_sync_mode');
      localStorage.removeItem('mercadopago_sync_since');
      
      return data;
    } catch (error) {
      console.error('Error procesando callback MercadoPago:', error);
      
      if (error.response?.status === 400) {
        throw new Error('Código de autorización inválido o expirado');
      }
      
      if (error.response?.status === 409) {
        throw new Error('Conexión ya existe para esta cuenta de MercadoPago');
      }
      
      throw new Error(
        error.response?.data?.message || 
        'Error procesando autorización de MercadoPago'
      );
    }
  }

  /**
   * Inicia el flujo de conexión OAuth
   * @returns {Promise<void>}
   * @throws {Error} Si hay error al iniciar la conexión
   */
  async connect() {
    try {
      const { authUrl, state } = await this.getAuthUrl();
      
      console.log('🔵 [MercadoPagoService] connect - authUrl:', authUrl);
      console.log('🔵 [MercadoPagoService] connect - state:', state);
      
      // Guardar el state en localStorage para validarlo en el callback
      if (state) {
        localStorage.setItem('mercadopago_state', state);
        localStorage.setItem('mercadopago_state_timestamp', Date.now().toString());
      }
      
      // Redirigir al usuario a MercadoPago
      console.log('✅ [MercadoPagoService] Redirigiendo a MercadoPago...');
      window.location.href = authUrl;
    } catch (error) {
      console.error('❌ [MercadoPagoService] Error en connect:', error);
      // Limpiar state en caso de error
      localStorage.removeItem('mercadopago_state');
      localStorage.removeItem('mercadopago_state_timestamp');
      throw error;
    }
  }

  /**
   * Sincroniza manualmente una conexión MercadoPago
   * @param {string} connectionId - ID de la conexión
   * @param {Object} options - Opciones de sincronización
   * @param {boolean} options.force - Forzar sincronización completa
   * @param {string} options.since - Fecha desde la cual sincronizar (ISO string)
   * @returns {Promise<Object>} Resultado de la sincronización
   * @throws {Error} Si hay error en la sincronización
   */
  async syncConnection(connectionId, options = {}) {
    try {
      if (!connectionId) {
        throw new Error('ID de conexión requerido');
      }
      
      const { data } = await clienteAxios.post(`/api/bankconnections/sync/${connectionId}`, options, {
        timeout: 180000 // 3 min — settlement report poll puede tardar
      });
      
      return data;
    } catch (error) {
      console.error('Error sincronizando conexión MercadoPago:', error);
      
      if (error.response?.status === 404) {
        throw new Error('Conexión no encontrada');
      }
      
      if (error.response?.status === 423) {
        throw new Error('Conexión bloqueada: Verifica tu cuenta de MercadoPago');
      }
      
      throw new Error(
        error.response?.data?.message || 
        'Error sincronizando conexión MercadoPago'
      );
    }
  }

  /**
   * Verifica el estado de una conexión MercadoPago
   * @param {string} connectionId - ID de la conexión
   * @returns {Promise<Object>} Estado de la conexión
   * @throws {Error} Si hay error verificando la conexión
   */
  async verifyConnection(connectionId) {
    try {
      if (!connectionId) {
        throw new Error('ID de conexión requerido');
      }
      
      const { data } = await clienteAxios.post(`/api/bankconnections/${connectionId}/verify`, {}, {
        timeout: this.timeout
      });
      
      return data;
    } catch (error) {
      console.error('Error verificando conexión MercadoPago:', error);
      
      if (error.response?.status === 404) {
        throw new Error('Conexión no encontrada');
      }
      
      throw new Error(
        error.response?.data?.message || 
        'Error verificando conexión MercadoPago'
      );
    }
  }

  /**
   * Obtiene datos completos de una conexión MercadoPago
   * @param {string} connectionId - ID de la conexión
   * @param {Object} options - Opciones de obtención de datos
   * @param {string} options.fechaDesde - Fecha desde la cual obtener datos (ISO string)
   * @param {number} options.limit - Límite de registros a obtener
   * @returns {Promise<Object>} Datos completos de la conexión
   * @throws {Error} Si hay error obteniendo los datos
   */
  async getCompleteData(connectionId, options = {}) {
    try {
      if (!connectionId) {
        throw new Error('ID de conexión requerido');
      }
      
      const params = new URLSearchParams();
      if (options.fechaDesde) params.append('fechaDesde', options.fechaDesde);
      if (options.limit) params.append('limit', options.limit.toString());
      
      const { data } = await clienteAxios.get(
        `${this.baseURL}/datos-completos/${connectionId}?${params.toString()}`,
        { timeout: this.timeout * 3 } // Triple timeout para datos completos
      );
      
      return data;
    } catch (error) {
      console.error('Error obteniendo datos completos de MercadoPago:', error);
      
      if (error.response?.status === 404) {
        throw new Error('Conexión no encontrada');
      }
      
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para acceder a estos datos');
      }
      
      throw new Error(
        error.response?.data?.message || 
        'Error obteniendo datos completos de MercadoPago'
      );
    }
  }

  /**
   * Procesa datos de una conexión MercadoPago
   * @param {string} connectionId - ID de la conexión
   * @param {Object} options - Opciones de procesamiento
   * @param {boolean} options.procesarPagos - Si procesar pagos
   * @param {boolean} options.procesarMovimientos - Si procesar movimientos
   * @returns {Promise<Object>} Resultado del procesamiento
   * @throws {Error} Si hay error procesando los datos
   */
  async processData(connectionId, options = {}) {
    try {
      if (!connectionId) {
        throw new Error('ID de conexión requerido');
      }
      
      const { data } = await clienteAxios.post(
        `${this.baseURL}/procesar-datos/${connectionId}`,
        options,
        { timeout: this.timeout * 4 } // Cuádruple timeout para procesamiento
      );
      
      return data;
    } catch (error) {
      console.error('Error procesando datos de MercadoPago:', error);
      
      if (error.response?.status === 404) {
        throw new Error('Conexión no encontrada');
      }
      
      if (error.response?.status === 409) {
        throw new Error('Conflicto: Los datos ya están siendo procesados');
      }
      
      throw new Error(
        error.response?.data?.message || 
        'Error procesando datos de MercadoPago'
      );
    }
  }

  /**
   * Valida el state guardado en localStorage
   * @param {string} receivedState - State recibido del callback
   * @returns {boolean} True si el state es válido
   */
  validateState(receivedState) {
    const savedState = localStorage.getItem('mercadopago_state');
    const timestamp = localStorage.getItem('mercadopago_state_timestamp');
    
    if (!savedState || !timestamp) {
      return false;
    }
    
    // Expiración amplia: reconocimiento facial / login MP puede demorar
    const now = Date.now();
    const savedTime = parseInt(timestamp, 10);
    const expirationTime = 20 * 60 * 1000; // 20 minutos
    
    if (now - savedTime > expirationTime) {
      this.clearState();
      return false;
    }
    
    return receivedState === savedState;
  }

  /**
   * Limpia el state guardado en localStorage
   */
  clearState() {
    localStorage.removeItem('mercadopago_state');
    localStorage.removeItem('mercadopago_state_timestamp');
  }

  /**
   * Obtiene el estado de conexión de MercadoPago
   * @returns {string} Estado de la conexión ('connected', 'disconnected', 'error')
   */
  getConnectionStatus() {
    const state = localStorage.getItem('mercadopago_state');
    const timestamp = localStorage.getItem('mercadopago_state_timestamp');
    
    if (!state || !timestamp) {
      return 'disconnected';
    }
    
    const now = Date.now();
    const savedTime = parseInt(timestamp, 10);
    const expirationTime = 20 * 60 * 1000; // 20 minutos
    
    if (now - savedTime > expirationTime) {
      this.clearState();
      return 'disconnected';
    }
    
    return 'connected';
  }
}

export default new MercadoPagoService(); 
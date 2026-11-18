import fetch from 'node-fetch';
import { deduplicarPagos, mpAuthHeaders } from '../mercadoPagoUtils.js';

export class MercadoPagoAdapter {
  constructor({ accessToken, refreshToken, userId }) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.userId = userId;
    this.maxRetries = 3;
    this.timeout = 10000; // 10 segundos
  }

  // Método helper para retry con exponential backoff
  async withRetry(operation, retries = this.maxRetries) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await Promise.race([
          operation(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), this.timeout)
          )
        ]);
      } catch (error) {
        console.error(`Intento ${attempt} falló:`, {
          error: error.message,
          userId: this.userId,
          attempt,
          maxRetries: retries
        });

        if (attempt === retries) {
          throw error;
        }

        // Exponential backoff: esperar 2^attempt * 1000ms
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`Reintentando en ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async getUserInfo() {
    return this.withRetry(async () => {
      console.log('Obteniendo información de usuario MercadoPago...');
      
      const response = await fetch('https://api.mercadopago.com/users/me', {
        headers: mpAuthHeaders(this.accessToken)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from MercadoPago:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          userId: this.userId
        });
        
        // Manejar errores específicos de MercadoPago
        if (response.status === 401) {
          throw new Error('Token de acceso expirado o inválido');
        } else if (response.status === 403) {
          throw new Error('Acceso denegado - verificar permisos de la aplicación');
        } else if (response.status === 429) {
          throw new Error('Rate limit excedido - intentar más tarde');
        }
        
        throw new Error(`Error obteniendo información del usuario: ${response.status} - ${errorText}`);
      }
      
      const userInfo = await response.json();
      
      if (!userInfo || !userInfo.id) {
        throw new Error('No se pudo obtener info de usuario MercadoPago');
      }
      
      console.log('Información de usuario obtenida:', {
        userId: userInfo.id,
        email: userInfo.email,
        nickname: userInfo.nickname
      });
      
      return userInfo;
    });
  }

  async searchPayments({ since, limit = 100, offset = 0, filter = null }) {
    return this.withRetry(async () => {
      const params = new URLSearchParams();
      if (since) {
        params.append('range', 'date_created');
        params.append('begin_date', since);
        params.append('end_date', new Date().toISOString());
      }
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      params.append('sort', 'date_created.desc');

      if (filter?.collectorId) {
        params.append('collector.id', String(filter.collectorId));
      }
      if (filter?.payerId) {
        params.append('payer.id', String(filter.payerId));
      }

      const url = `https://api.mercadopago.com/v1/payments/search?${params.toString()}`;
      const response = await fetch(url, { headers: mpAuthHeaders(this.accessToken) });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) throw new Error('Token de acceso expirado o inválido');
        if (response.status === 403) throw new Error('Acceso denegado - verificar permisos de la aplicación');
        if (response.status === 429) throw new Error('Rate limit excedido - intentar más tarde');
        throw new Error(`Error obteniendo pagos: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return {
        results: data.results || [],
        total: data.paging?.total ?? (data.results?.length || 0)
      };
    });
  }

  async fetchAllPaymentsForFilter({ since, pageSize = 100, maxPages = 20, filter }) {
    const all = [];
    let offset = 0;
    let total = Infinity;

    for (let page = 0; page < maxPages && offset < total; page++) {
      const { results, total: pagingTotal } = await this.searchPayments({
        since,
        limit: pageSize,
        offset,
        filter
      });
      total = pagingTotal;
      all.push(...results);
      if (results.length < pageSize) break;
      offset += pageSize;
    }

    return all;
  }

  async getMovimientos({ since, limit = 100 }) {
    return this.getAllPayments({ since, limit });
  }

  async getAllPayments({ since, limit = 100, maxPages = 20 }) {
    const mpUserId = this.userId;
    const pageSize = Math.min(limit, 100);
    const results = await Promise.allSettled([
      this.fetchAllPaymentsForFilter({
        since,
        pageSize,
        maxPages,
        filter: { collectorId: mpUserId }
      }),
      this.fetchAllPaymentsForFilter({
        since,
        pageSize,
        maxPages,
        filter: { payerId: mpUserId }
      })
    ]);

    const all = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        all.push(...result.value);
      } else {
        console.warn('[MP] Búsqueda parcial de pagos falló:', result.reason?.message);
      }
    }

    const deduped = deduplicarPagos(all);
    console.log(`Pagos obtenidos (collector + payer): ${deduped.length}`, { userId: mpUserId, since, limit });
    return deduped;
  }

  async getAccountBalance() {
    if (!this.userId) return { available: 0, unavailable: 0 };

    return this.withRetry(async () => {
      const url = `https://api.mercadopago.com/users/${this.userId}/mercadopago_account/balance`;
      const response = await fetch(url, { headers: mpAuthHeaders(this.accessToken) });

      if (!response.ok) {
        console.warn('[MP] Balance no disponible:', response.status);
        return { available: 0, unavailable: 0, error: response.status };
      }

      const data = await response.json();
      return {
        available: data.available_balance || 0,
        unavailable: data.unavailable_balance || 0
      };
    }).catch(() => ({ available: 0, unavailable: 0 }));
  }

  /**
   * Movimientos de dinero en cuenta (incluye transferencias / retiros que no
   * siempre aparecen en payments/search). Prueba endpoints actuales y legacy.
   */
  async getAccountMovements({ since, limit = 100, maxPages = 10 }) {
    const pageSize = Math.min(limit, 100);
    const candidates = [
      {
        name: 'v1/account/movements/search',
        buildUrl: (offset) => {
          const params = new URLSearchParams();
          if (since) {
            params.append('date_created_from', since);
            params.append('date_created_to', new Date().toISOString());
          }
          params.append('limit', String(pageSize));
          params.append('offset', String(offset));
          return `https://api.mercadopago.com/v1/account/movements/search?${params}`;
        }
      },
      {
        name: 'mercadopago_account/movements/search',
        buildUrl: (offset) => {
          const params = new URLSearchParams();
          if (since) {
            params.append('range', 'date_created');
            params.append('begin_date', since);
            params.append('end_date', new Date().toISOString());
          }
          params.append('limit', String(pageSize));
          params.append('offset', String(offset));
          return `https://api.mercadopago.com/mercadopago_account/movements/search?${params}`;
        }
      }
    ];

    for (const candidate of candidates) {
      try {
        const results = await this.fetchAllAccountMovements(candidate, pageSize, maxPages);
        if (results.length > 0 || candidate === candidates[candidates.length - 1]) {
          console.log(`[MP] Movimientos de cuenta (${candidate.name}): ${results.length}`);
          return results;
        }
      } catch (error) {
        console.warn(`[MP] ${candidate.name} no disponible:`, error.message);
      }
    }

    return [];
  }

  async fetchAllAccountMovements(candidate, pageSize, maxPages) {
    const all = [];
    let offset = 0;
    let total = Infinity;

    for (let page = 0; page < maxPages && offset < total; page++) {
      const pageResults = await this.withRetry(async () => {
        const url = candidate.buildUrl(offset);
        const response = await fetch(url, { headers: mpAuthHeaders(this.accessToken) });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 401) throw new Error('Token de acceso expirado o inválido');
          if (response.status === 403) throw new Error('Acceso denegado - verificar permisos de la aplicación');
          if (response.status === 429) throw new Error('Rate limit excedido - intentar más tarde');
          throw new Error(`${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return {
          results: data.results || data.elements || (Array.isArray(data) ? data : []),
          total: data.paging?.total ?? data.total ?? null
        };
      });

      all.push(...pageResults.results);
      if (pageResults.total != null) total = pageResults.total;
      if (pageResults.results.length < pageSize) break;
      offset += pageSize;
    }

    return all;
  }

  // Método para obtener transacciones usando el endpoint de merchant_orders
  async getMerchantOrders({ since, limit = 100 }) {
    return this.withRetry(async () => {
      console.log('Obteniendo órdenes de comerciante MercadoPago...', {
        since: since || 'sin filtro de fecha',
        limit,
        userId: this.userId
      });
      
      // Construir URL para el endpoint de merchant_orders
      let url = 'https://api.mercadopago.com/v1/merchant_orders/search';
      const params = new URLSearchParams();
      
      if (since) {
        // Para este endpoint usamos date_created_from y date_created_to
        params.append('date_created_from', since);
        // end_date se puede omitir para obtener hasta la fecha actual
      }
      
      // Agregar límite para evitar respuestas muy grandes
      params.append('limit', limit.toString());
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log('URL de consulta órdenes de comerciante:', url);
      
      const response = await fetch(url, { headers: mpAuthHeaders(this.accessToken) });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from MercadoPago merchant orders:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          userId: this.userId,
          url
        });
        
        // Manejar errores específicos de MercadoPago
        if (response.status === 401) {
          throw new Error('Token de acceso expirado o inválido');
        } else if (response.status === 403) {
          throw new Error('Acceso denegado - verificar permisos de la aplicación');
        } else if (response.status === 429) {
          throw new Error('Rate limit excedido - intentar más tarde');
        }
        
        throw new Error(`Error obteniendo órdenes de comerciante: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      console.log(`Órdenes de comerciante obtenidas: ${results.length}`, {
        userId: this.userId,
        since,
        limit,
        totalResults: results.length,
        hasPaging: !!data.paging
      });
      
      return results;
    });
  }

  // Método para verificar la salud de la conexión
  async healthCheck() {
    try {
      const userInfo = await this.getUserInfo();
      const recentMovements = await this.getMovimientos({ 
        since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() 
      });
      
      return {
        status: 'healthy',
        userInfo: {
          id: userInfo.id,
          email: userInfo.email,
          nickname: userInfo.nickname
        },
        recentMovements: recentMovements.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Health check falló:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
} 
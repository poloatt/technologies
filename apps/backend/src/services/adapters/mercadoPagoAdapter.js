import fetch from 'node-fetch';
import { deduplicarPagos, mpAuthHeaders } from '../mercadoPagoUtils.js';

export class MercadoPagoAdapter {
  constructor({ accessToken, refreshToken, userId }) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.userId = userId;
    this.maxRetries = 3;
    this.timeout = 20000; // payments/search P2P puede demorar
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

  async searchPayments({ since, limit = 50, offset = 0, filter = null }) {
    return this.withRetry(async () => {
      const params = new URLSearchParams();
      // Docs MP: sort + criteria por separado (no "date_created.desc")
      params.append('sort', 'date_created');
      params.append('criteria', 'desc');
      // Máximo documentado suele ser 50
      const pageLimit = Math.min(Number(limit) || 50, 50);
      params.append('limit', String(pageLimit));
      params.append('offset', String(offset));

      if (since) {
        params.append('range', 'date_created');
        params.append('begin_date', since);
        // MP acepta ISO o relativos (NOW / NOW-90DAYS)
        const endDate = String(since).startsWith('NOW') ? 'NOW' : new Date().toISOString();
        params.append('end_date', endDate);
      }

      if (filter?.collectorId) {
        params.append('collector.id', String(filter.collectorId));
      }
      if (filter?.payerId) {
        params.append('payer.id', String(filter.payerId));
      }
      if (filter?.operationType) {
        params.append('operation_type', String(filter.operationType));
      }
      if (filter?.paymentTypeId) {
        params.append('payment_type_id', String(filter.paymentTypeId));
      }
      if (filter?.status) {
        params.append('status', String(filter.status));
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

  async fetchAllPaymentsForFilter({ since, pageSize = 50, maxPages = 20, filter, label = '' }) {
    const all = [];
    let offset = 0;
    let total = Infinity;
    const size = Math.min(pageSize, 50);

    for (let page = 0; page < maxPages && offset < total; page++) {
      const { results, total: pagingTotal } = await this.searchPayments({
        since,
        limit: size,
        offset,
        filter
      });
      total = pagingTotal;
      all.push(...results);
      if (results.length < size) break;
      offset += size;
    }

    if (label) {
      console.log(`[MP] payments/search ${label}: ${all.length} (total API=${total === Infinity ? '?' : total})`);
    }
    return all;
  }

  async getMovimientos({ since, limit = 100 }) {
    return this.getAllPayments({ since, limit });
  }

  /**
   * Pagos + transferencias P2P (operation_type=money_transfer).
   * Las transferencias in-app a otros usuarios MP no salen en WITHDRAWAL del settlement;
   * hay que pedirlas explícitamente como payments.
   */
  async getAllPayments({ since, limit = 50, maxPages = 20 }) {
    const mpUserId = this.userId;
    const pageSize = Math.min(limit, 50);

    const searches = [
      {
        label: 'collector',
        since,
        filter: { collectorId: mpUserId }
      },
      {
        label: 'payer',
        since,
        filter: { payerId: mpUserId }
      },
      // P2P in-app: el token OAuth delimita la cuenta
      {
        label: 'money_transfer',
        since,
        filter: { operationType: 'money_transfer' }
      },
      {
        label: 'money_transfer+payer',
        since,
        filter: { operationType: 'money_transfer', payerId: mpUserId }
      },
      {
        label: 'money_transfer+collector',
        since,
        filter: { operationType: 'money_transfer', collectorId: mpUserId }
      },
      // Fallback relativo (MP acepta NOW-NDAYS) por si el ISO timezone filtra de más
      {
        label: 'money_transfer/NOW-90DAYS',
        since: 'NOW-90DAYS',
        filter: { operationType: 'money_transfer' }
      },
      // Enviar dinero suele ir con account_money
      {
        label: 'account_money+payer',
        since,
        filter: { paymentTypeId: 'account_money', payerId: mpUserId }
      },
      {
        label: 'account_money (token scope)',
        since,
        filter: { paymentTypeId: 'account_money' }
      }
    ];

    const results = await Promise.allSettled(
      searches.map((s) =>
        this.fetchAllPaymentsForFilter({
          since: s.since,
          pageSize,
          maxPages,
          filter: s.filter,
          label: s.label
        })
      )
    );

    const all = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        all.push(...result.value);
      } else {
        console.warn(`[MP] Búsqueda ${searches[i].label} falló:`, result.reason?.message);
      }
    }

    const deduped = deduplicarPagos(all);
    const transfers = deduped.filter(
      (p) => String(p.operation_type || '').toLowerCase() === 'money_transfer'
    );
    const accountMoney = deduped.filter(
      (p) =>
        String(p.payment_type_id || p.payment_method?.type || '').toLowerCase() === 'account_money'
    );
    console.log(`Pagos obtenidos (collector/payer/P2P): ${deduped.length}`, {
      userId: mpUserId,
      since,
      moneyTransfers: transfers.length,
      accountMoney: accountMoney.length,
      operationTypes: [...new Set(deduped.map((p) => p.operation_type).filter(Boolean))],
      sampleTransferIds: transfers.slice(0, 5).map((p) => p.id)
    });
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
    const userId = this.userId;
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
      },
      userId
        ? {
            name: `users/${userId}/mercadopago_account/movements/search`,
            buildUrl: (offset) => {
              const params = new URLSearchParams();
              if (since) {
                params.append('range', 'date_created');
                params.append('begin_date', since);
                params.append('end_date', new Date().toISOString());
              }
              params.append('limit', String(pageSize));
              params.append('offset', String(offset));
              return `https://api.mercadopago.com/users/${userId}/mercadopago_account/movements/search?${params}`;
            }
          }
        : null
    ].filter(Boolean);

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
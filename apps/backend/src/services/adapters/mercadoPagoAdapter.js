import fetch from 'node-fetch';
import {
  deduplicarPagos,
  esTransferenciaBancariaPago,
  esTransferenciaPago,
  mpAuthHeaders
} from '../mercadoPagoUtils.js';

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

  async searchPayments({ since, until, limit = 50, offset = 0, filter = null }) {
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
        // MP acepta ISO o relativos (NOW / NOW-90DAYS). until acota un mes de historial.
        const endDate = until
          ? until
          : String(since).startsWith('NOW')
            ? 'NOW'
            : new Date().toISOString();
        params.append('end_date', endDate);
      }

      if (filter?.collectorId != null && filter.collectorId !== '') {
        params.append('collector.id', String(filter.collectorId));
      }
      if (filter?.payerId != null && filter.payerId !== '') {
        params.append('payer.id', String(filter.payerId));
      }
      if (filter?.operationType) {
        params.append('operation_type', String(filter.operationType));
      }
      if (filter?.paymentTypeId) {
        params.append('payment_type_id', String(filter.paymentTypeId));
      }
      // AR: transferencias CVU a veces van como payment_method_id=cvu / account_money
      if (filter?.paymentMethodId) {
        params.append('payment_method_id', String(filter.paymentMethodId));
      }
      if (filter?.status) {
        params.append('status', String(filter.status));
      }
      if (filter?.currencyId) {
        params.append('currency_id', String(filter.currencyId));
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

  async fetchAllPaymentsForFilter({ since, until, pageSize = 50, maxPages = 20, filter, label = '' }) {
    const all = [];
    let offset = 0;
    let total = Infinity;
    const size = Math.min(pageSize, 50);

    for (let page = 0; page < maxPages && offset < total; page++) {
      const { results, total: pagingTotal } = await this.searchPayments({
        since,
        until,
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

  async getPaymentById(paymentId) {
    if (!paymentId) return null;
    const id = String(paymentId).trim();
    if (!/^\d+$/.test(id)) return null;

    return this.withRetry(async () => {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: mpAuthHeaders(this.accessToken)
      });

      if (response.status === 404) return null;
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) throw new Error('Token de acceso expirado o inválido');
        if (response.status === 403) return null;
        if (response.status === 429) throw new Error('Rate limit excedido - intentar más tarde');
        throw new Error(`Error obteniendo pago ${id}: ${response.status} - ${errorText}`);
      }

      return response.json();
    }).catch((error) => {
      console.warn(`[MP] getPaymentById ${id}:`, error.message);
      return null;
    });
  }

  /**
   * Enriquece filas del settlement con GET /v1/payments/{SOURCE_ID}
   * para recuperar comercio / contraparte / money_transfer.
   */
  async enrichMovementsWithPayments(movimientos, { concurrency = 5 } = {}) {
    if (!Array.isArray(movimientos) || movimientos.length === 0) return [];

    const out = [...movimientos];
    let cursor = 0;
    let enriched = 0;

    const worker = async () => {
      while (cursor < out.length) {
        const index = cursor++;
        const mov = out[index];
        const sourceId = String(mov?.sourceId || mov?.id || '').trim();
        if (!/^\d+$/.test(sourceId)) continue;

        const payment = await this.getPaymentById(sourceId);
        if (!payment) continue;

        enriched += 1;
        out[index] = {
          ...mov,
          payment,
          description:
            payment.description ||
            payment.statement_descriptor ||
            mov.description ||
            '',
          paymentMethod:
            payment.payment_type_id ||
            payment.payment_method?.type ||
            mov.paymentMethod ||
            '',
          paymentMethodType:
            payment.payment_type_id || mov.paymentMethodType || '',
          externalReference:
            payment.external_reference || mov.externalReference || '',
          transactionType: esTransferenciaBancariaPago(payment)
            ? 'BANK_TRANSFER'
            : esTransferenciaPago(payment)
              ? (String(payment.operation_type || '').toLowerCase() === 'account_fund'
                ? 'ACCOUNT_FUND'
                : 'MONEY_TRANSFER')
              : mov.transactionType,
          raw: {
            ...(mov.raw || {}),
            DESCRIPTION:
              payment.description ||
              payment.statement_descriptor ||
              mov.raw?.DESCRIPTION ||
              '',
            METADATA: payment.metadata || mov.raw?.METADATA || null,
            PAYMENT_METHOD:
              payment.payment_method_id || payment.payment_type_id || mov.raw?.PAYMENT_METHOD,
            PAYMENT_METHOD_TYPE:
              payment.payment_type_id || mov.raw?.PAYMENT_METHOD_TYPE,
            OPERATION_TYPE: payment.operation_type || null
          }
        };
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, out.length) }, () => worker());
    await Promise.all(workers);
    console.log(`[MP] Settlement enriquecido con payments: ${enriched}/${out.length}`);
    return out;
  }

  /**
   * Pagos + transferencias.
   * Códigos oficiales / observados:
   * - operation_type: money_transfer (wire entre usuarios), account_fund (ingreso a cuenta)
   * - payment_type_id / payment_method_id: account_money, cvu (AR)
   * - collector.id / payer.id: id numérico o alias "me" (token OAuth)
   * Settlement TRANSACTION_TYPE PAYOUT a veces incluye transferencias (no solo efectivo).
   */
  async getAllPayments({ since, until, limit = 50, maxPages = 20 }) {
    const mpUserId = this.userId;
    const pageSize = Math.min(limit, 50);

    const searches = [
      { label: 'collector', since, filter: { collectorId: mpUserId } },
      { label: 'payer', since, filter: { payerId: mpUserId } },
      // Alias "me" usado en clientes/docs legacy con token de usuario
      { label: 'collector=me', since, filter: { collectorId: 'me' } },
      { label: 'payer=me', since, filter: { payerId: 'me' } },
      // P2P documentado
      { label: 'money_transfer', since, filter: { operationType: 'money_transfer' } },
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
      {
        label: 'money_transfer+payer=me',
        since,
        filter: { operationType: 'money_transfer', payerId: 'me' }
      },
      // Ingresos a cuenta (contraparte de envíos recibidos)
      // Reserva: el usuario es payer y collector. Sin este filtro las salidas
      // pueden quedar fuera del tope de páginas de la búsqueda general.
      // Dólares y suscripciones del fondo: operation_type investment.
      // Sin este filtro quedan solo en el settlement y se confunden con un rescate.
      { label: 'investment', since, filter: { operationType: 'investment' } },
      {
        label: 'investment+payer',
        since,
        filter: { operationType: 'investment', payerId: mpUserId }
      },
      {
        label: 'investment+payer=me',
        since,
        filter: { operationType: 'investment', payerId: 'me' }
      },
      { label: 'partition_transfer', since, filter: { operationType: 'partition_transfer' } },
      {
        label: 'partition_transfer+payer',
        since,
        filter: { operationType: 'partition_transfer', payerId: mpUserId }
      },
      { label: 'account_fund', since, filter: { operationType: 'account_fund' } },
      {
        label: 'account_fund+collector=me',
        since,
        filter: { operationType: 'account_fund', collectorId: 'me' }
      },
      // Dinero en cuenta / CVU (AR)
      {
        label: 'account_money+payer',
        since,
        filter: { paymentTypeId: 'account_money', payerId: mpUserId }
      },
      {
        label: 'account_money+payer=me',
        since,
        filter: { paymentTypeId: 'account_money', payerId: 'me' }
      },
      { label: 'account_money', since, filter: { paymentTypeId: 'account_money' } },
      // La búsqueda general de payer se corta a 1000 filas y deja afuera
      // compras con tarjeta más viejas. Este filtro las trae todas.
      {
        label: 'credit_card+payer',
        since,
        filter: { paymentTypeId: 'credit_card', payerId: mpUserId }
      },
      {
        label: 'credit_card+payer=me',
        since,
        filter: { paymentTypeId: 'credit_card', payerId: 'me' }
      },
      { label: 'payment_method=account_money', since, filter: { paymentMethodId: 'account_money' } },
      { label: 'payment_method=cvu', since, filter: { paymentMethodId: 'cvu' } },
      {
        label: 'cvu+payer=me',
        since,
        filter: { paymentMethodId: 'cvu', payerId: 'me' }
      },
      // CVU propio → CBU bancario (no aparecen como money_transfer P2P)
      { label: 'operation=withdrawal', since, filter: { operationType: 'withdrawal' } },
      {
        label: 'withdrawal+payer=me',
        since,
        filter: { operationType: 'withdrawal', payerId: 'me' }
      },
      { label: 'payment_type=bank_transfer', since, filter: { paymentTypeId: 'bank_transfer' } },
      {
        label: 'payment_method=bank_transfer',
        since,
        filter: { paymentMethodId: 'bank_transfer' }
      },
      {
        label: 'bank_transfer+payer=me',
        since,
        filter: { paymentTypeId: 'bank_transfer', payerId: 'me' }
      },
      // La búsqueda sin moneda se queda en pesos y no trae el saldo en dólares.
      { label: 'currency=USD', since, filter: { currencyId: 'USD' } }
    ];

    const results = await Promise.allSettled(
      searches.map((s) =>
        this.fetchAllPaymentsForFilter({
          since: s.since,
          until,
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
    const transferLike = deduped.filter((p) => esTransferenciaPago(p));
    const bankLike = deduped.filter((p) => esTransferenciaBancariaPago(p));
    console.log(`Pagos obtenidos (collector/payer/P2P/cvu/CBU): ${deduped.length}`, {
      userId: mpUserId,
      since,
      transferLike: transferLike.length,
      bankTransfers: bankLike.length,
      operationTypes: [...new Set(deduped.map((p) => p.operation_type).filter(Boolean))],
      paymentMethodIds: [...new Set(deduped.map((p) => p.payment_method_id).filter(Boolean))],
      sampleTransferIds: transferLike.slice(0, 5).map((p) => p.id),
      sampleBankIds: bankLike.slice(0, 5).map((p) => p.id)
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
  async getAccountMovements({ since, until, limit = 100, maxPages = 10 }) {
    const pageSize = Math.min(limit, 100);
    const userId = this.userId;
    const untilIso = until || new Date().toISOString();
    const candidates = [
      {
        name: 'v1/account/movements/search',
        buildUrl: (offset) => {
          const params = new URLSearchParams();
          if (since) {
            params.append('date_created_from', since);
            params.append('date_created_to', untilIso);
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
            params.append('end_date', untilIso);
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
                params.append('end_date', untilIso);
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
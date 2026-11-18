import { MercadoPagoAdapter } from './adapters/mercadoPagoAdapter.js';
import { MercadoPagoReportService } from './mercadoPagoReportService.js';
import { Monedas } from '../models/Monedas.js';
import { Transacciones } from '../models/Transacciones.js';
import { Cuentas } from '../models/Cuentas.js';
import {
  calcularComisiones as calcComisiones,
  determinarTipoPago,
  formatearDescripcionPago as fmtDescripcionPago,
  formatearDescripcionMovimiento as fmtDescripcionMov,
  extraerContrapartePago,
  mapearEstadoPago as mapEstadoPago,
  normalizeAccountMovement
} from './mercadoPagoUtils.js';

export class MercadoPagoDataService {
  constructor({ accessToken, refreshToken, userId, usuarioId }) {
    this.mpAdapter = new MercadoPagoAdapter({
      accessToken,
      refreshToken,
      userId
    });
    this.usuarioId = usuarioId;
  }

  // Diagnóstico wallet AR: pagos dual + settlement report (sin endpoints legacy de comercio)
  async obtenerDatosCompletos({ fechaDesde = null, limit = 100, incluirReporte = false }) {
    try {
      console.log('[MP Diagnóstico] Obteniendo datos wallet AR...', {
        fechaDesde,
        limit,
        usuarioId: this.usuarioId
      });

      const fechaDesdeISO = fechaDesde ? new Date(fechaDesde).toISOString() : null;
      const userInfo = await this.mpAdapter.getUserInfo();
      const errores = [];
      const avisos = [
        {
          tipo: 'modo_diagnostico',
          mensaje:
            'Solo diagnóstico. La sync real usa bankSyncService (pagos + settlement WITHDRAWAL + account/movements para transferencias).'
        }
      ];

      let pagos = [];
      try {
        pagos = await this.mpAdapter.getAllPayments({ since: fechaDesdeISO, limit });
      } catch (error) {
        console.error('Error obteniendo pagos:', error);
        errores.push({ tipo: 'pagos', error: error.message });
      }

      let movimientosReporte = [];
      let reportePendiente = false;
      if (incluirReporte && this.mpAdapter.accessToken && this.mpAdapter.userId) {
        try {
          const reportService = new MercadoPagoReportService({
            accessToken: this.mpAdapter.accessToken,
            userId: this.mpAdapter.userId
          });
          const beginDate =
            fechaDesdeISO || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const endDate = new Date().toISOString();
          const report = await reportService.fetchSettlementMovements(beginDate, endDate, {
            pollOptions: { maxPollAttempts: 5 }
          });
          if (report.pending) {
            reportePendiente = true;
            avisos.push({
              tipo: 'reporte_pendiente',
              mensaje: 'Reporte Account Money aún en generación. Reintentar sync o importar CSV manual.'
            });
          } else {
            movimientosReporte = report.rows || [];
          }
        } catch (error) {
          console.error('Error obteniendo reporte settlement:', error);
          errores.push({ tipo: 'settlement_report', error: error.message });
        }
      }

      let movimientosCuentaRaw = [];
      try {
        movimientosCuentaRaw = await this.mpAdapter.getAccountMovements({
          since: fechaDesdeISO,
          limit,
          maxPages: 5
        });
      } catch (error) {
        console.warn('Account movements no disponible en diagnóstico:', error.message);
        errores.push({ tipo: 'account_movements', error: error.message });
      }

      const movimientosCuentaNorm = movimientosCuentaRaw
        .map(normalizeAccountMovement)
        .filter(Boolean);

      const resultados = {
        modo: 'diagnostico',
        usuario: userInfo,
        pagos,
        movimientosCuenta: [
          ...movimientosReporte.map((row) => ({
            id: row.sourceId || row.id,
            description: row.description || row.transactionType || row.raw?.TRANSACTION_TYPE,
            amount: row.netAmount ?? row.amount,
            type: (row.netAmount ?? row.amount) >= 0 ? 'credit' : 'debit',
            status: 'available',
            date_created: row.date,
            currency_id: 'ARS',
            _fromSettlementReport: true
          })),
          ...movimientosCuentaNorm.map((row) => ({
            id: row.sourceId || row.id,
            description: row.description || row.transactionType,
            amount: row.netAmount ?? row.amount,
            type: (row.netAmount ?? row.amount) >= 0 ? 'credit' : 'debit',
            status: 'available',
            date_created: row.date,
            currency_id: row.currency || 'ARS',
            _fromAccountMovements: true
          }))
        ],
        movimientosReporte,
        movimientosCuentaRaw,
        ordenesComerciante: [],
        reportePendiente,
        avisos,
        errores
      };

      console.log('[MP Diagnóstico] Resultado:', {
        totalPagos: resultados.pagos.length,
        totalMovimientosReporte: movimientosReporte.length,
        totalAccountMovements: movimientosCuentaRaw.length,
        errores: errores.length
      });

      return resultados;
    } catch (error) {
      console.error('Error obteniendo datos de diagnóstico Mercado Pago:', error);
      throw error;
    }
  }

  // Procesar y guardar transacciones de pagos
  async procesarPagos(pagos, cuentaId) {
    try {
      console.log(`Procesando ${pagos.length} pagos para cuenta ${cuentaId}`);

      const transaccionesNuevas = [];
      const transaccionesActualizadas = [];

      for (const pago of pagos) {
        try {
          // Verificar si la transacción ya existe
          const transaccionExistente = await Transacciones.findOne({
            cuenta: cuentaId,
            'origen.transaccionId': pago.id.toString(),
            'origen.tipo': 'MERCADOPAGO_PAGO'
          });

          if (transaccionExistente) {
            // Actualizar transacción existente si es necesario
            const actualizada = await this.actualizarTransaccionExistente(transaccionExistente, pago);
            if (actualizada) {
              transaccionesActualizadas.push(actualizada);
            }
            continue;
          }

          // Crear nueva transacción
          const nuevaTransaccion = await this.crearTransaccionDePago(pago, cuentaId);
          if (nuevaTransaccion) {
            transaccionesNuevas.push(nuevaTransaccion);
          }
        } catch (error) {
          console.error(`Error procesando pago ${pago.id}:`, error);
        }
      }

      return {
        nuevas: transaccionesNuevas.length,
        actualizadas: transaccionesActualizadas.length,
        transacciones: [...transaccionesNuevas, ...transaccionesActualizadas]
      };
    } catch (error) {
      console.error('Error procesando pagos:', error);
      throw error;
    }
  }

  // Procesar y guardar transacciones de movimientos de cuenta
  async procesarMovimientosCuenta(movimientos, cuentaId) {
    try {
      console.log(`Procesando ${movimientos.length} movimientos de cuenta para cuenta ${cuentaId}`);

      const transaccionesNuevas = [];
      const transaccionesActualizadas = [];

      for (const movimiento of movimientos) {
        try {
          // Verificar si la transacción ya existe
          const transaccionExistente = await Transacciones.findOne({
            cuenta: cuentaId,
            'origen.transaccionId': movimiento.id.toString(),
            'origen.tipo': 'MERCADOPAGO_MOVIMIENTO'
          });

          if (transaccionExistente) {
            // Actualizar transacción existente si es necesario
            const actualizada = await this.actualizarTransaccionExistente(transaccionExistente, movimiento);
            if (actualizada) {
              transaccionesActualizadas.push(actualizada);
            }
            continue;
          }

          // Crear nueva transacción
          const nuevaTransaccion = await this.crearTransaccionDeMovimiento(movimiento, cuentaId);
          if (nuevaTransaccion) {
            transaccionesNuevas.push(nuevaTransaccion);
          }
        } catch (error) {
          console.error(`Error procesando movimiento ${movimiento.id}:`, error);
        }
      }

      return {
        nuevas: transaccionesNuevas.length,
        actualizadas: transaccionesActualizadas.length,
        transacciones: [...transaccionesNuevas, ...transaccionesActualizadas]
      };
    } catch (error) {
      console.error('Error procesando movimientos de cuenta:', error);
      throw error;
    }
  }

  // Crear transacción a partir de un pago
  async crearTransaccionDePago(pago, cuentaId) {
    try {
      const monto = Math.abs(pago.transaction_amount || 0);
      const moneda = await this.obtenerOCrearMoneda(pago.currency_id || 'ARS');
      const comisiones = calcComisiones(pago);
      const montoNeto = monto - comisiones.total;
      const userId = this.mpAdapter.userId;
      const contraparte = extraerContrapartePago(pago, userId);
      const descripcion = fmtDescripcionPago(pago, userId);

      const nuevaTransaccion = new Transacciones({
        descripcion,
        monto,
        montoNeto,
        fecha: new Date(pago.date_created),
        categoria: this.categorizarTransaccion(descripcion),
        estado: mapEstadoPago(pago.status),
        tipo: determinarTipoPago(pago, userId),
        usuario: this.usuarioId,
        cuenta: cuentaId,
        moneda: moneda._id,
        comisiones: comisiones,
        origen: {
          tipo: 'MERCADOPAGO_PAGO',
          transaccionId: pago.id.toString(),
          metadata: {
            paymentId: pago.id,
            status: pago.status,
            statusDetail: pago.status_detail,
            paymentMethod: pago.payment_method?.type,
            paymentMethodId: pago.payment_method_id,
            installments: pago.installments,
            currencyId: pago.currency_id,
            collectorId: pago.collector_id,
            payerId: pago.payer?.id,
            transactionAmount: pago.transaction_amount,
            netReceivedAmount: pago.transaction_details?.net_received_amount,
            totalPaidAmount: pago.transaction_details?.total_paid_amount,
            description: pago.description || null,
            statementDescriptor: pago.statement_descriptor || null,
            itemTitle: pago.additional_info?.items?.[0]?.title || null,
            counterpartyName: contraparte?.name || null,
            counterpartyLabel: contraparte?.label || null,
            counterpartyRole: contraparte?.role || null,
            counterpartyId: contraparte?.id || null,
            counterpartyEmail: contraparte?.email || null
          }
        }
      });

      await nuevaTransaccion.save();
      console.log(`Transacción de pago creada: ${nuevaTransaccion._id}`);
      return nuevaTransaccion;
    } catch (error) {
      console.error('Error creando transacción de pago:', error);
      return null;
    }
  }

  // Crear transacción a partir de un movimiento de cuenta
  async crearTransaccionDeMovimiento(movimiento, cuentaId) {
    try {
      // Determinar tipo de transacción
      let tipo = 'EGRESO';
      let monto = Math.abs(movimiento.amount || 0);
      
      // Si es un ingreso, cambiar tipo
      if (movimiento.type === 'credit' || movimiento.amount > 0) {
        tipo = 'INGRESO';
      }

      // Obtener o crear moneda
      const moneda = await this.obtenerOCrearMoneda(movimiento.currency_id || 'ARS');

      // Los movimientos pueden tener comisiones también
      const comisiones = {
        mercadopago: 0,
        financieras: 0,
        envio: 0,
        total: 0
      };
      const montoNeto = monto;

      // Crear nueva transacción
      const nuevaTransaccion = new Transacciones({
        descripcion: fmtDescripcionMov(movimiento),
        monto: monto,
        montoNeto: montoNeto,
        fecha: new Date(movimiento.date_created),
        categoria: this.categorizarTransaccion(fmtDescripcionMov(movimiento)),
        estado: this.mapearEstadoMovimiento(movimiento.status),
        tipo: tipo,
        usuario: this.usuarioId,
        cuenta: cuentaId,
        moneda: moneda._id,
        comisiones: comisiones,
        origen: {
          tipo: 'MERCADOPAGO_MOVIMIENTO',
          transaccionId: movimiento.id.toString(),
          metadata: {
            movementId: movimiento.id,
            status: movimiento.status,
            type: movimiento.type,
            currencyId: movimiento.currency_id,
            reference: movimiento.reference,
            concept: movimiento.concept
          }
        }
      });

      await nuevaTransaccion.save();
      console.log(`Transacción de movimiento creada: ${nuevaTransaccion._id}`);
      return nuevaTransaccion;
    } catch (error) {
      console.error('Error creando transacción de movimiento:', error);
      return null;
    }
  }

  // Actualizar transacción existente
  async actualizarTransaccionExistente(transaccion, datos) {
    try {
      let actualizada = false;

      // Actualizar estado si cambió
      const nuevoEstado = mapEstadoPago(datos.status) || this.mapearEstadoMovimiento(datos.status);
      if (nuevoEstado && transaccion.estado !== nuevoEstado) {
        transaccion.estado = nuevoEstado;
        actualizada = true;
      }

      // Actualizar monto si cambió
      const nuevoMonto = Math.abs(datos.transaction_amount || datos.amount || 0);
      if (nuevoMonto && transaccion.monto !== nuevoMonto) {
        transaccion.monto = nuevoMonto;
        actualizada = true;
      }

      // Actualizar metadata si es necesario
      if (datos.status && transaccion.origen.metadata.status !== datos.status) {
        transaccion.origen.metadata.status = datos.status;
        actualizada = true;
      }

      if (actualizada) {
        await transaccion.save();
        console.log(`Transacción actualizada: ${transaccion._id}`);
        return transaccion;
      }

      return null;
    } catch (error) {
      console.error('Error actualizando transacción:', error);
      return null;
    }
  }

  // Obtener o crear moneda
  async obtenerOCrearMoneda(currencyId) {
    try {
      // Buscar moneda existente
      let moneda = await Monedas.findOne({ codigo: currencyId });
      
      if (!moneda) {
        // Crear nueva moneda si no existe
        moneda = new Monedas({
          codigo: currencyId,
          nombre: this.obtenerNombreMoneda(currencyId),
          simbolo: this.obtenerSimboloMoneda(currencyId),
          pais: this.obtenerPaisMoneda(currencyId)
        });
        await moneda.save();
        console.log(`Nueva moneda creada: ${currencyId}`);
      }
      
      return moneda;
    } catch (error) {
      console.error('Error obteniendo/creando moneda:', error);
      // Retornar moneda por defecto (ARS)
      return await Monedas.findOne({ codigo: 'ARS' }) || 
             await Monedas.findOne({ codigo: 'USD' }) || 
             await Monedas.findOne();
    }
  }

  categorizarTransaccion(descripcion) {
    const desc = descripcion.toLowerCase();
    
    if (desc.includes('comida') || desc.includes('restaurante') || desc.includes('supermercado')) {
      return 'Comida y Mercado';
    }
    if (desc.includes('transporte') || desc.includes('uber') || desc.includes('taxi')) {
      return 'Transporte';
    }
    if (desc.includes('ropa') || desc.includes('zapatos') || desc.includes('vestimenta')) {
      return 'Ropa';
    }
    if (desc.includes('tecnología') || desc.includes('computadora') || desc.includes('celular')) {
      return 'Tecnología';
    }
    if (desc.includes('salud') || desc.includes('médico') || desc.includes('farmacia')) {
      return 'Salud y Belleza';
    }
    if (desc.includes('fiesta') || desc.includes('evento') || desc.includes('celebración')) {
      return 'Fiesta';
    }
    
    return 'Otro';
  }

  mapearEstadoMovimiento(status) {
    const estados = {
      available: 'COMPLETADA',
      pending: 'PENDIENTE',
      cancelled: 'CANCELADA'
    };
    return estados[status] || 'PENDIENTE';
  }

  obtenerNombreMoneda(currencyId) {
    const monedas = {
      ARS: 'Peso Argentino',
      USD: 'Dólar Estadounidense',
      BRL: 'Real Brasileño',
      CLP: 'Peso Chileno',
      COP: 'Peso Colombiano',
      MXN: 'Peso Mexicano',
      PEN: 'Sol Peruano',
      UYU: 'Peso Uruguayo',
      VES: 'Bolívar Venezolano'
    };
    return monedas[currencyId] || currencyId;
  }

  obtenerSimboloMoneda(currencyId) {
    const simbolos = {
      ARS: '$',
      USD: 'US$',
      BRL: 'R$',
      CLP: '$',
      COP: '$',
      MXN: '$',
      PEN: 'S/',
      UYU: '$',
      VES: 'Bs.'
    };
    return simbolos[currencyId] || currencyId;
  }

  obtenerPaisMoneda(currencyId) {
    const paises = {
      ARS: 'Argentina',
      USD: 'Estados Unidos',
      BRL: 'Brasil',
      CLP: 'Chile',
      COP: 'Colombia',
      MXN: 'México',
      PEN: 'Perú',
      UYU: 'Uruguay',
      VES: 'Venezuela'
    };
    return paises[currencyId] || 'Desconocido';
  }
} 
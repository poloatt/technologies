import { BankConnection } from '../models/BankConnection.js';
import { Transacciones } from '../models/Transacciones.js';
import { Cuentas } from '../models/Cuentas.js';
import crypto from 'crypto';
import {
  calcularComisiones,
  determinarTipoPago,
  determinarTipoMovimiento,
  formatearDescripcionPago,
  formatearDescripcionMovimiento,
  extraerContrapartePago,
  extraerContraparteMovimiento,
  mapearEstadoPago,
  getMpSyncDays,
  normalizeAccountMovement,
  esTipoTransferenciaMovimiento,
  esTransferenciaPago
} from './mercadoPagoUtils.js';
import { MercadoPagoReportService } from './mercadoPagoReportService.js';
import { extractBalanceFromRows } from './mercadoPagoCsvParser.js';

export class BankSyncService {
  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  }

  // Encriptar credenciales sensibles (Node.js moderno - usa createCipheriv)
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Error encriptando:', error);
      throw new Error('Error al encriptar credenciales');
    }
  }

  // Desencriptar credenciales (Node.js moderno - usa createDecipheriv)
  decrypt(encryptedText) {
    try {
      if (encryptedText.includes(':')) {
        const parts = encryptedText.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } else {
        console.warn('⚠️ Detectado formato de encriptación antiguo');
        throw new Error('Formato de encriptación antiguo no soportado. Por favor, reconecta la cuenta.');
      }
    } catch (error) {
      console.error('Error desencriptando:', error);
      throw new Error('Error al desencriptar credenciales');
    }
  }

  // Categorizar transacción automáticamente basado en descripción
  categorizarTransaccion(descripcion) {
    const descripcionLower = descripcion.toLowerCase();
    
    const categorias = {
      'Salud y Belleza': ['farmacia', 'medico', 'doctor', 'hospital', 'clinica', 'salud', 'belleza', 'cosmeticos'],
      'Contabilidad y Facturas': ['factura', 'impuesto', 'servicio', 'luz', 'agua', 'gas', 'internet', 'telefono'],
      'Transporte': ['uber', 'taxi', 'bus', 'metro', 'combustible', 'gasolina', 'nafta', 'estacionamiento'],
      'Comida y Mercado': ['supermercado', 'restaurante', 'cafe', 'comida', 'mercado', 'verduleria', 'carniceria'],
      'Fiesta': ['bar', 'pub', 'discoteca', 'fiesta', 'evento', 'entrada', 'ticket'],
      'Ropa': ['ropa', 'zapatillas', 'calzado', 'tienda', 'shopping', 'moda'],
      'Tecnología': ['tecnologia', 'electronica', 'computadora', 'celular', 'software', 'app'],
      'Otro': []
    };

    for (const [categoria, palabras] of Object.entries(categorias)) {
      if (palabras.some(palabra => descripcionLower.includes(palabra))) {
        return categoria;
      }
    }

    return 'Otro';
  }

  // Sincronizar transacciones usando Plaid
  async sincronizarConPlaid(bankConnection) {
    try {
      console.log(`Sincronizando con Plaid para conexión: ${bankConnection.nombre}`);
      
      // Aquí iría la lógica real de Plaid
      // Por ahora simulamos la sincronización
      const transaccionesSimuladas = await this.simularTransaccionesPlaid(bankConnection);
      
      let transaccionesNuevas = 0;
      let transaccionesActualizadas = 0;

      for (const transaccionBanco of transaccionesSimuladas) {
        // Verificar si la transacción ya existe
        const transaccionExistente = await Transacciones.findOne({
          cuenta: bankConnection.cuenta,
          fecha: transaccionBanco.fecha,
          monto: transaccionBanco.monto,
          descripcion: transaccionBanco.descripcion
        });

        if (!transaccionExistente) {
          // Crear nueva transacción
          const nuevaTransaccion = new Transacciones({
            descripcion: transaccionBanco.descripcion,
            monto: transaccionBanco.monto,
            fecha: transaccionBanco.fecha,
            categoria: bankConnection.configuracion.categorizacionAutomatica ? 
              this.categorizarTransaccion(transaccionBanco.descripcion) : 'Otro',
            estado: 'COMPLETADA', // Las transacciones bancarias vienen como completadas
            tipo: transaccionBanco.monto > 0 ? 'INGRESO' : 'EGRESO',
            usuario: bankConnection.usuario,
            cuenta: bankConnection.cuenta,
            origen: {
              tipo: 'BANCARIO',
              conexionId: bankConnection._id,
              transaccionId: transaccionBanco.id
            }
          });

          await nuevaTransaccion.save();
          transaccionesNuevas++;
        }
      }

      // Actualizar estado de la conexión
      await bankConnection.actualizarSincronizacion(
        'EXITOSA',
        transaccionesNuevas,
        transaccionesActualizadas
      );

      return {
        exito: true,
        transaccionesNuevas,
        transaccionesActualizadas
      };

    } catch (error) {
      console.error('Error en sincronización Plaid:', error);
      
      await bankConnection.actualizarSincronizacion(
        'ERROR',
        0,
        0,
        error.message
      );

      return {
        exito: false,
        error: error.message
      };
    }
  }

  // Sincronizar transacciones usando Open Banking
  async sincronizarConOpenBanking(bankConnection) {
    try {
      console.log(`Sincronizando con Open Banking para conexión: ${bankConnection.nombre}`);
      
      // Aquí iría la lógica real de Open Banking
      // Por ahora simulamos la sincronización
      const transaccionesSimuladas = await this.simularTransaccionesOpenBanking(bankConnection);
      
      let transaccionesNuevas = 0;
      let transaccionesActualizadas = 0;

      for (const transaccionBanco of transaccionesSimuladas) {
        const transaccionExistente = await Transacciones.findOne({
          cuenta: bankConnection.cuenta,
          fecha: transaccionBanco.fecha,
          monto: transaccionBanco.monto,
          descripcion: transaccionBanco.descripcion
        });

        if (!transaccionExistente) {
          const nuevaTransaccion = new Transacciones({
            descripcion: transaccionBanco.descripcion,
            monto: transaccionBanco.monto,
            fecha: transaccionBanco.fecha,
            categoria: bankConnection.configuracion.categorizacionAutomatica ? 
              this.categorizarTransaccion(transaccionBanco.descripcion) : 'Otro',
            estado: 'COMPLETADA',
            tipo: transaccionBanco.monto > 0 ? 'INGRESO' : 'EGRESO',
            usuario: bankConnection.usuario,
            cuenta: bankConnection.cuenta,
            origen: {
              tipo: 'BANCARIO',
              conexionId: bankConnection._id,
              transaccionId: transaccionBanco.id
            }
          });

          await nuevaTransaccion.save();
          transaccionesNuevas++;
        }
      }

      await bankConnection.actualizarSincronizacion(
        'EXITOSA',
        transaccionesNuevas,
        transaccionesActualizadas
      );

      return {
        exito: true,
        transaccionesNuevas,
        transaccionesActualizadas
      };

    } catch (error) {
      console.error('Error en sincronización Open Banking:', error);
      
      await bankConnection.actualizarSincronizacion(
        'ERROR',
        0,
        0,
        error.message
      );

      return {
        exito: false,
        error: error.message
      };
    }
  }

  // Sincronizar transacciones usando API directa
  async sincronizarConAPIDirecta(bankConnection) {
    try {
      console.log(`Sincronizando con API directa para conexión: ${bankConnection.nombre}`);
      
      // Aquí iría la lógica real de API directa
      // Por ahora simulamos la sincronización
      const transaccionesSimuladas = await this.simularTransaccionesAPIDirecta(bankConnection);
      
      let transaccionesNuevas = 0;
      let transaccionesActualizadas = 0;

      for (const transaccionBanco of transaccionesSimuladas) {
        const transaccionExistente = await Transacciones.findOne({
          cuenta: bankConnection.cuenta,
          fecha: transaccionBanco.fecha,
          monto: transaccionBanco.monto,
          descripcion: transaccionBanco.descripcion
        });

        if (!transaccionExistente) {
          const nuevaTransaccion = new Transacciones({
            descripcion: transaccionBanco.descripcion,
            monto: transaccionBanco.monto,
            fecha: transaccionBanco.fecha,
            categoria: bankConnection.configuracion.categorizacionAutomatica ? 
              this.categorizarTransaccion(transaccionBanco.descripcion) : 'Otro',
            estado: 'COMPLETADA',
            tipo: transaccionBanco.monto > 0 ? 'INGRESO' : 'EGRESO',
            usuario: bankConnection.usuario,
            cuenta: bankConnection.cuenta,
            origen: {
              tipo: 'BANCARIO',
              conexionId: bankConnection._id,
              transaccionId: transaccionBanco.id
            }
          });

          await nuevaTransaccion.save();
          transaccionesNuevas++;
        }
      }

      await bankConnection.actualizarSincronizacion(
        'EXITOSA',
        transaccionesNuevas,
        transaccionesActualizadas
      );

      return {
        exito: true,
        transaccionesNuevas,
        transaccionesActualizadas
      };

    } catch (error) {
      console.error('Error en sincronización API directa:', error);
      
      await bankConnection.actualizarSincronizacion(
        'ERROR',
        0,
        0,
        error.message
      );

      return {
        exito: false,
        error: error.message
      };
    }
  }

  // Sincronizar transacciones usando MercadoPago (wallet personal AR)
  async sincronizarConMercadoPago(bankConnection) {
    try {
      console.log(`Sincronizando con MercadoPago para conexión: ${bankConnection.nombre}`);

      const userAccessToken = this.decrypt(bankConnection.credenciales.accessToken);
      const userId = this.decrypt(bankConnection.credenciales.userId);

      const cuenta = await Cuentas.findById(bankConnection.cuenta);
      if (!cuenta) {
        throw new Error('Cuenta no encontrada');
      }

      const { MercadoPagoAdapter } = await import('./adapters/mercadoPagoAdapter.js');
      const mpAdapter = new MercadoPagoAdapter({
        accessToken: userAccessToken,
        refreshToken: null,
        userId
      });

      const userInfo = await mpAdapter.getUserInfo();
      console.log('Usuario MercadoPago verificado:', userInfo.nickname || userInfo.email);

      const syncDays = getMpSyncDays();
      const fechaDesde = new Date(Date.now() - syncDays * 24 * 60 * 60 * 1000);
      let pagos = [];
      let movimientos = [];
      let totalCsvRows = 0;
      const errores = [];

      try {
        pagos = await mpAdapter.getAllPayments({
          since: fechaDesde.toISOString(),
          limit: 100,
          maxPages: 20
        });
        console.log(`✅ Pagos obtenidos (collector + payer): ${pagos.length}`);
      } catch (error) {
        console.error('❌ Error obteniendo pagos:', error.message);
        errores.push({ tipo: 'pagos', error: error.message });
      }

      let settlementPending = false;
      try {
        const reportService = new MercadoPagoReportService({
          accessToken: userAccessToken,
          userId
        });
        const beginDate = fechaDesde.toISOString();
        const endDate = new Date().toISOString();
        const pending = bankConnection.mercadopago?.reportePendiente;
        const report = await reportService.fetchAllSettlementMovements(beginDate, endDate, { pending });

        totalCsvRows = report.total || report.rows?.length || 0;

        if (report.pending) {
          settlementPending = true;
          movimientos = report.rows || [];
          bankConnection.mercadopago = {
            ...(bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {}),
            syncParcial: true,
            reportePendiente: {
              beginDate: report.beginDate || beginDate,
              endDate: report.endDate || endDate,
              solicitadoEn: pending?.solicitadoEn || new Date()
            },
            ultimoErrorSettlement:
              'Reporte Account Money en generación. Se completará en la próxima sincronización o podés importar CSV manual.'
          };
          await bankConnection.save();
          errores.push({
            tipo: 'settlement_report',
            error: bankConnection.mercadopago.ultimoErrorSettlement,
            pending: true
          });
          console.warn(`⚠️ Reporte settlement pendiente; importados parcialmente: ${movimientos.length}`);
        } else {
          movimientos = report.rows || [];
          bankConnection.mercadopago = {
            ...(bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {}),
            syncParcial: false,
            ultimoErrorSettlement: undefined,
            reportePendiente: undefined
          };
          await bankConnection.save();
          console.log(`✅ Movimientos del reporte Account Money: ${movimientos.length}`);
        }
      } catch (error) {
        console.warn('⚠️ Reporte settlement no disponible:', error.message);
        bankConnection.mercadopago = {
          ...(bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {}),
          syncParcial: true,
          ultimoErrorSettlement: error.message
        };
        await bankConnection.save();
        errores.push({ tipo: 'settlement_report', error: error.message });
      }

      // Transferencias/retiros: settlement WITHDRAWAL + account/movements.
      // payments/search no cubre retiros a CBU/CVU; movements cubre huecos del CSV.
      let accountMovements = [];
      try {
        const rawMovements = await mpAdapter.getAccountMovements({
          since: fechaDesde.toISOString(),
          limit: 100,
          maxPages: 20
        });
        accountMovements = rawMovements.map(normalizeAccountMovement).filter(Boolean);
        console.log(`✅ Movimientos de cuenta (transferencias): ${accountMovements.length}`);
      } catch (error) {
        console.warn('⚠️ Account movements no disponible:', error.message);
        errores.push({ tipo: 'account_movements', error: error.message });
      }

      const movimientosMerged = this.mergeMovimientosMp(movimientos, accountMovements);

      let balance = await mpAdapter.getAccountBalance();
      if ((!balance.available && !balance.unavailable) && movimientosMerged.length > 0) {
        const fromReport = extractBalanceFromRows(movimientosMerged);
        if (fromReport.available != null) {
          balance = { available: fromReport.available, unavailable: 0 };
        }
      }

      let transaccionesNuevas = 0;
      let transaccionesActualizadas = 0;

      const pagosResult = await this.procesarPagosMercadoPago(pagos, bankConnection, cuenta, userId);
      transaccionesNuevas += pagosResult.nuevas;
      transaccionesActualizadas += pagosResult.actualizadas;

      const movResult = await this.procesarMovimientosReporte(movimientosMerged, bankConnection, cuenta);
      transaccionesNuevas += movResult.nuevas;
      transaccionesActualizadas += movResult.actualizadas;

      try {
        await Cuentas.findByIdAndUpdate(bankConnection.cuenta, {
          saldo: balance.available || 0,
          'mercadopago.disponibleRetiro': balance.available || 0,
          'mercadopago.disponiblePendiente': balance.unavailable || 0
        });
      } catch (error) {
        console.error('Error actualizando balances:', error);
      }

      const syncParcial =
        settlementPending ||
        errores.some((e) => e.tipo === 'settlement_report') ||
        Boolean(bankConnection.mercadopago?.syncParcial);
      const syncEstado = syncParcial ? 'PARCIAL' : 'EXITOSA';

      await bankConnection.actualizarSincronizacion(
        syncEstado,
        transaccionesNuevas,
        transaccionesActualizadas,
        syncParcial ? bankConnection.mercadopago?.ultimoErrorSettlement : null
      );

      return {
        exito: true,
        syncParcial,
        settlementPending,
        transaccionesNuevas,
        transaccionesActualizadas,
        detalles: {
          usuario: userInfo.nickname || userInfo.email,
          totalPagos: pagos.length,
          totalMovimientos: movimientosMerged.length,
          totalSettlementRows: movimientos.length,
          totalAccountMovements: accountMovements.length,
          transferenciasSettlement: movimientos.filter((m) =>
            esTipoTransferenciaMovimiento(m.transactionType)
          ).length,
          transferenciasAccount: accountMovements.filter((m) =>
            esTipoTransferenciaMovimiento(m.transactionType)
          ).length,
          totalCsvRows,
          movimientosImportados: movResult.nuevas,
          movimientosOmitidos: movResult.omitidas,
          rangoDias: syncDays,
          balance,
          errores,
          reportePendiente: bankConnection.mercadopago?.reportePendiente || null
        }
      };
    } catch (error) {
      console.error('Error en sincronización MercadoPago:', error);
      await bankConnection.actualizarSincronizacion('ERROR', 0, 0, error.message);
      return { exito: false, error: error.message };
    }
  }

  mergeMovimientosMp(settlementRows = [], accountRows = []) {
    const byId = new Map();
    for (const row of settlementRows) {
      const key = String(row.sourceId || row.id || '');
      if (key) byId.set(key, row);
    }
    for (const row of accountRows) {
      const key = String(row.sourceId || row.id || '');
      if (!key) continue;
      if (!byId.has(key)) {
        byId.set(key, row);
        continue;
      }
      // Preferir settlement; enriquecer descripción/contraparte si el movement la trae
      const existing = byId.get(key);
      if (!existing.description && row.description) {
        byId.set(key, {
          ...existing,
          description: row.description,
          raw: { ...(existing.raw || {}), DESCRIPTION: row.description, ...(row.raw || {}) }
        });
      }
    }
    return Array.from(byId.values());
  }

  async procesarPagosMercadoPago(pagos, bankConnection, cuenta, userId) {
    let nuevas = 0;
    let actualizadas = 0;
    const MP_ORIGEN_TIPOS = ['MERCADOPAGO_PAGO', 'MERCADOPAGO_MOVIMIENTO'];

    for (const pago of pagos) {
      try {
        const transaccionExistente = await Transacciones.findOne({
          cuenta: bankConnection.cuenta,
          'origen.transaccionId': pago.id.toString(),
          'origen.tipo': { $in: MP_ORIGEN_TIPOS }
        });

        if (transaccionExistente) continue;

        const comisiones = calcularComisiones(pago);
        const monto = Math.abs(pago.transaction_amount || 0);
        const montoNeto = monto - comisiones.total;
        const contraparte = extraerContrapartePago(pago, userId);
        const descripcion = formatearDescripcionPago(pago, userId);
        const isTransfer = esTransferenciaPago(pago);

        const nuevaTransaccion = new Transacciones({
          descripcion,
          monto,
          montoNeto,
          fecha: new Date(pago.date_created),
          categoria: bankConnection.configuracion?.categorizacionAutomatica
            ? this.categorizarTransaccion(descripcion)
            : 'Otro',
          estado: mapearEstadoPago(pago.status),
          tipo: determinarTipoPago(pago, userId),
          usuario: bankConnection.usuario,
          cuenta: bankConnection.cuenta,
          moneda: cuenta.moneda,
          comisiones,
          origen: {
            tipo: 'MERCADOPAGO_PAGO',
            conexionId: bankConnection._id,
            transaccionId: pago.id.toString(),
            metadata: {
              paymentId: pago.id,
              status: pago.status,
              statusDetail: pago.status_detail,
              paymentMethod: pago.payment_method?.type,
              paymentMethodId: pago.payment_method_id,
              operationType: pago.operation_type || null,
              isTransfer,
              collectorId: pago.collector_id,
              payerId: pago.payer?.id,
              currencyId: pago.currency_id,
              installments: pago.installments,
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
        nuevas++;
      } catch (error) {
        console.error(`Error procesando pago ${pago.id}:`, error.message);
      }
    }

    return { nuevas, actualizadas };
  }

  async procesarMovimientosReporte(movimientos, bankConnection, cuenta) {
    let nuevas = 0;
    let actualizadas = 0;
    let omitidas = 0;
    const MP_ORIGEN_TIPOS = ['MERCADOPAGO_PAGO', 'MERCADOPAGO_MOVIMIENTO'];

    for (const mov of movimientos) {
      try {
        const transaccionId = String(mov.sourceId || mov.id);
        if (!transaccionId) continue;

        const transaccionExistente = await Transacciones.findOne({
          cuenta: bankConnection.cuenta,
          'origen.transaccionId': transaccionId,
          'origen.tipo': { $in: MP_ORIGEN_TIPOS }
        });

        if (transaccionExistente) {
          omitidas++;
          continue;
        }

        const monto = Math.abs(mov.amount || mov.netAmount || 0);
        const montoNeto = Math.abs(mov.netAmount || monto);
        const rowSource = {
          ...(mov.raw || {}),
          ...mov,
          netAmount: mov.netAmount,
          TRANSACTION_TYPE: mov.transactionType || mov.raw?.TRANSACTION_TYPE,
          DESCRIPTION: mov.description || mov.raw?.DESCRIPTION,
          EXTERNAL_REFERENCE: mov.externalReference || mov.raw?.EXTERNAL_REFERENCE,
          SETTLEMENT_NET_AMOUNT: mov.netAmount ?? mov.raw?.SETTLEMENT_NET_AMOUNT
        };
        const contraparte = extraerContraparteMovimiento(rowSource);
        const descripcion = formatearDescripcionMovimiento(rowSource);

        const transaccion = new Transacciones({
          descripcion,
          monto,
          montoNeto,
          fecha: new Date(mov.date),
          categoria: 'Otro',
          estado: 'COMPLETADA',
          tipo: determinarTipoMovimiento(mov.netAmount ?? mov.amount),
          usuario: bankConnection.usuario,
          cuenta: bankConnection.cuenta,
          moneda: cuenta.moneda,
          comisiones: {
            mercadopago: Math.abs(mov.feeAmount || 0),
            financieras: 0,
            envio: 0,
            total: Math.abs(mov.feeAmount || 0)
          },
          origen: {
            tipo: 'MERCADOPAGO_MOVIMIENTO',
            conexionId: bankConnection._id,
            transaccionId,
            metadata: {
              transactionType: mov.transactionType,
              description: mov.description,
              paymentMethod: mov.paymentMethod,
              paymentMethodType: mov.paymentMethodType,
              externalReference: mov.externalReference,
              currency: mov.currency,
              source: mov.source || 'settlement_report',
              isTransfer: esTipoTransferenciaMovimiento(mov.transactionType),
              counterpartyName: contraparte?.name || null,
              counterpartyLabel: contraparte?.label || null,
              counterpartyRole: contraparte?.role || null
            }
          }
        });

        await transaccion.save();
        nuevas++;
      } catch (error) {
        console.error(`Error procesando movimiento ${mov.id}:`, error.message);
      }
    }

    return { nuevas, actualizadas, omitidas };
  }

  async importarCsvMercadoPago(bankConnection, csvContent) {
    const cuenta = await Cuentas.findById(bankConnection.cuenta);
    if (!cuenta) {
      throw new Error('Cuenta no encontrada');
    }

    const reportService = new MercadoPagoReportService({
      accessToken: this.decrypt(bankConnection.credenciales.accessToken),
      userId: this.decrypt(bankConnection.credenciales.userId)
    });

    const movimientos = reportService.parseCsvContent(csvContent);
    const result = await this.procesarMovimientosReporte(movimientos, bankConnection, cuenta);

    const balance = extractBalanceFromRows(movimientos);
    if (balance.available != null) {
      await Cuentas.findByIdAndUpdate(bankConnection.cuenta, {
        saldo: balance.available,
        'mercadopago.disponibleRetiro': balance.available,
        'mercadopago.disponiblePendiente': 0
      });
    }

    bankConnection.mercadopago = {
      ...(bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {}),
      syncParcial: false,
      ultimoErrorSettlement: undefined,
      reportePendiente: undefined
    };
    await bankConnection.save();

    await bankConnection.actualizarSincronizacion(
      'EXITOSA',
      result.nuevas,
      result.actualizadas
    );

    return {
      exito: true,
      syncParcial: false,
      movimientosProcesados: movimientos.length,
      ...result
    };
  }

  // Obtener pagos de MercadoPago (método actualizado para usar el adaptador)
  async obtenerPagosMercadoPago(accessToken, fechaDesde) {
    try {
      // Importar el adaptador de MercadoPago
      const { MercadoPagoAdapter } = await import('./adapters/mercadoPagoAdapter.js');
      
      // Crear instancia del adaptador
      const mpAdapter = new MercadoPagoAdapter({
        accessToken,
        refreshToken: null, // No necesario para este método
        userId: null // No necesario para este método
      });

      // Obtener pagos usando el adaptador corregido
      const pagos = await mpAdapter.getMovimientos({
        since: fechaDesde.toISOString(),
        limit: 100
      });
      
      return pagos;
    } catch (error) {
      console.error('Error obteniendo pagos de MercadoPago:', error);
      throw error;
    }
  }

  // Formatear descripción de transacción de MercadoPago
  formatearDescripcionMercadoPago(pago) {
    let descripcion = `MercadoPago - ${pago.payment_method?.type || 'Pago'}`;
    
    if (pago.description) {
      descripcion += ` - ${pago.description}`;
    }
    
    if (pago.external_reference) {
      descripcion += ` (Ref: ${pago.external_reference})`;
    }
    
    return descripcion;
  }

  // Mapear estado de MercadoPago a estado interno
  mapearEstadoMercadoPago(status) {
    const estados = {
      'approved': 'COMPLETADA',
      'pending': 'PENDIENTE',
      'in_process': 'PENDIENTE',
      'rejected': 'CANCELADA',
      'cancelled': 'CANCELADA',
      'refunded': 'CANCELADA'
    };
    
    return estados[status] || 'PENDIENTE';
  }

  // Método principal de sincronización
  async sincronizarConexion(bankConnection) {
    try {
      switch (bankConnection.tipo) {
        case 'PLAID':
          return await this.sincronizarConPlaid(bankConnection);
        case 'OPEN_BANKING':
          return await this.sincronizarConOpenBanking(bankConnection);
        case 'API_DIRECTA':
          return await this.sincronizarConAPIDirecta(bankConnection);
        case 'MERCADOPAGO':
          return await this.sincronizarConMercadoPago(bankConnection);
        default:
          throw new Error(`Tipo de conexión no soportado: ${bankConnection.tipo}`);
      }
    } catch (error) {
      console.error('Error en sincronización:', error);
      throw error;
    }
  }

  // Sincronizar conexiones pendientes (usuarioId: solo ese usuario; omitir = todas, p.ej. cron)
  async sincronizarTodasLasConexiones(usuarioId = null) {
    try {
      const conexiones = await BankConnection.getConexionesParaSincronizar(usuarioId);
      console.log(`Sincronizando ${conexiones.length} conexiones bancarias`, {
        scopedToUser: !!usuarioId
      });

      const resultados = [];
      for (const conexion of conexiones) {
        try {
          const resultado = await this.sincronizarConexion(conexion);
          resultados.push({
            conexionId: conexion._id,
            nombre: conexion.nombre,
            ...resultado
          });
        } catch (error) {
          console.error(`Error sincronizando conexión ${conexion.nombre}:`, error);
          resultados.push({
            conexionId: conexion._id,
            nombre: conexion.nombre,
            exito: false,
            error: error.message
          });
        }
      }

      return resultados;
    } catch (error) {
      console.error('Error en sincronización masiva:', error);
      throw error;
    }
  }

  // Métodos de simulación para desarrollo
  async simularTransaccionesPlaid(bankConnection) {
    // Simular transacciones de Plaid
    const transacciones = [];
    const ahora = new Date();
    
    for (let i = 0; i < 5; i++) {
      const fecha = new Date(ahora.getTime() - i * 24 * 60 * 60 * 1000);
      transacciones.push({
        id: `plaid_${Date.now()}_${i}`,
        descripcion: `Transacción Plaid ${i + 1}`,
        monto: Math.random() > 0.5 ? Math.random() * 1000 : -Math.random() * 500,
        fecha: fecha,
        categoria: 'Otro'
      });
    }
    
    return transacciones;
  }

  async simularTransaccionesOpenBanking(bankConnection) {
    // Simular transacciones de Open Banking
    const transacciones = [];
    const ahora = new Date();
    
    for (let i = 0; i < 3; i++) {
      const fecha = new Date(ahora.getTime() - i * 24 * 60 * 60 * 1000);
      transacciones.push({
        id: `openbanking_${Date.now()}_${i}`,
        descripcion: `Transacción Open Banking ${i + 1}`,
        monto: Math.random() > 0.5 ? Math.random() * 800 : -Math.random() * 300,
        fecha: fecha,
        categoria: 'Otro'
      });
    }
    
    return transacciones;
  }

  async simularTransaccionesAPIDirecta(bankConnection) {
    // Simular transacciones de API directa
    const transacciones = [];
    const ahora = new Date();
    
    for (let i = 0; i < 4; i++) {
      const fecha = new Date(ahora.getTime() - i * 24 * 60 * 60 * 1000);
      transacciones.push({
        id: `api_${Date.now()}_${i}`,
        descripcion: `Transacción API Directa ${i + 1}`,
        monto: Math.random() > 0.5 ? Math.random() * 1200 : -Math.random() * 600,
        fecha: fecha,
        categoria: 'Otro'
      });
    }
    
    return transacciones;
  }

  // Calcular comisiones de MercadoPago (delegado a util compartida)
  calcularComisionesMercadoPago(pago) {
    return calcularComisiones(pago);
  }
} 
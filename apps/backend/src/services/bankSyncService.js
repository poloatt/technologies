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
  esTransferenciaPago,
  esTransferenciaBancariaPago,
  limpiarNombreContraparte,
  clasificarMovimientoEconomicoMp
} from './mercadoPagoUtils.js';
import { MercadoPagoReportService } from './mercadoPagoReportService.js';
import { MercadoPagoActivitiesService } from './mercadoPagoActivitiesService.js';
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
      // Usar siempre el id vivo de /users/me (el guardado en credenciales puede quedar desfasado)
      const mpUserId = String(userInfo.id || userId);
      mpAdapter.userId = mpUserId;
      if (mpUserId && mpUserId !== String(userId)) {
        try {
          bankConnection.credenciales.userId = this.encrypt(mpUserId);
          await bankConnection.save();
          console.warn('[MP] userId de credenciales actualizado desde /users/me', {
            storedUserId: userId,
            mpUserId
          });
        } catch (e) {
          console.warn('[MP] No se pudo persistir userId actualizado:', e.message);
        }
      }
      console.log('Usuario MercadoPago verificado:', {
        nickname: userInfo.nickname || userInfo.email,
        mpUserId,
        storedUserId: userId
      });

      const syncDays = getMpSyncDays();
      const fechaDesde = new Date(Date.now() - syncDays * 24 * 60 * 60 * 1000);
      let pagos = [];
      let movimientos = [];
      let totalCsvRows = 0;
      const errores = [];

      try {
        pagos = await mpAdapter.getAllPayments({
          since: fechaDesde.toISOString(),
          limit: 50,
          maxPages: 40
        });
        const p2pCount = pagos.filter((p) => esTransferenciaPago(p)).length;
        console.log(`✅ Pagos obtenidos: ${pagos.length} (transferencias detectadas: ${p2pCount})`);
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

        if (report.quotaExceeded) {
          movimientos = report.rows || [];
          const missingW = report.missingWithdrawals === true;
          const quotaMsg = missingW
            ? 'Cupo de reportes MP agotado: los CSV reutilizados se generaron sin retiros (include_withdraw). Reintentá mañana o importá CSV Account Money con retiros desde MP.'
            : movimientos.length > 0
              ? `Cupo de reportes MP agotado: se reutilizaron ${movimientos.length} movimientos ya generados. Podés importar CSV o reintentar más tarde.`
              : 'Cupo de reportes MP agotado (máximo de reportes). Importá el CSV desde Mercado Pago o reintentá más tarde.';
          bankConnection.mercadopago = {
            ...(bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {}),
            syncParcial: true,
            reportePendiente: undefined,
            ultimoErrorSettlement: quotaMsg
          };
          await bankConnection.save();
          errores.push({
            tipo: 'settlement_report',
            error: quotaMsg,
            quotaExceeded: true,
            missingWithdrawals: missingW
          });
          console.warn(`⚠️ Settlement cupo 429; reutilizados: ${movimientos.length}; missingWithdrawals=${missingW}`);
        } else if (report.pending) {
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
            syncParcial: Boolean(report.partial),
            ultimoErrorSettlement: report.partial
              ? 'Settlement parcial: se reutilizaron reportes existentes.'
              : undefined,
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

      // Transferencias/retiros unificados:
      // 1) settlement WITHDRAWAL  2) account/movements  3) activities_withdraw (API oficial retiros+transferencias)
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

      let activitiesWithdraw = [];
      try {
        const activitiesService = new MercadoPagoActivitiesService({
          accessToken: userAccessToken,
          userId: mpUserId
        });
        const withdrawReport = await activitiesService.fetchWithdrawMovements(
          fechaDesde.toISOString(),
          new Date().toISOString(),
          { pollOptions: { maxPollAttempts: 16 } }
        );
        if (withdrawReport.pending) {
          errores.push({
            tipo: 'activities_withdraw',
            error: 'Reporte de retiros/transferencias en generación; se completa en próxima sync',
            pending: true
          });
          bankConnection.mercadopago = {
            ...(bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {}),
            syncParcial: true,
            ultimoErrorSettlement:
              bankConnection.mercadopago?.ultimoErrorSettlement ||
              'Reporte activities_withdraw (transferencias) en generación.'
          };
          await bankConnection.save();
        } else {
          activitiesWithdraw = withdrawReport.rows || [];
          console.log(`✅ Activities withdraw (transferencias): ${activitiesWithdraw.length}`);
        }
      } catch (error) {
        console.warn('⚠️ activities_withdraw no disponible:', error.message);
        errores.push({ tipo: 'activities_withdraw', error: error.message });
        // Settlement con include_withdraw ya trae PAYOUTS/WITHDRAWAL (CVU→CBU).
        // No ensuciar ultimoError ni forzar parcial solo por activities_withdraw.
        const settlementHasBankOut = (movimientos || []).some((m) =>
          ['WITHDRAWAL', 'WITHDRAWAL_CANCEL', 'PAYOUT', 'PAYOUTS', 'BANK_TRANSFER'].includes(
            String(m.transactionType || '').toUpperCase()
          )
        );
        if (!settlementHasBankOut) {
          bankConnection.mercadopago = {
            ...(bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {}),
            syncParcial: true,
            ultimoErrorSettlement:
              bankConnection.mercadopago?.ultimoErrorSettlement ||
              `Sin salidas bancarias en settlement y activities_withdraw falló: ${error.message}`
          };
          await bankConnection.save();
        }
      }

      let movimientosMerged = this.mergeMovimientosMp(
        this.mergeMovimientosMp(movimientos, accountMovements),
        activitiesWithdraw
      );
      try {
        movimientosMerged = await mpAdapter.enrichMovementsWithPayments(movimientosMerged, {
          concurrency: 5
        });
      } catch (error) {
        console.warn('⚠️ Enrichment de payments falló:', error.message);
        errores.push({ tipo: 'payment_enrichment', error: error.message });
      }

      let balance = await mpAdapter.getAccountBalance();
      if ((!balance.available && !balance.unavailable) && movimientosMerged.length > 0) {
        const fromReport = extractBalanceFromRows(movimientosMerged);
        if (fromReport.available != null) {
          balance = { available: fromReport.available, unavailable: 0 };
        }
      }

      let transaccionesNuevas = 0;
      let transaccionesActualizadas = 0;

      const pagosResult = await this.procesarPagosMercadoPago(pagos, bankConnection, cuenta, mpUserId);
      transaccionesNuevas += pagosResult.nuevas;
      transaccionesActualizadas += pagosResult.actualizadas;

      const movResult = await this.procesarMovimientosReporte(
        movimientosMerged,
        bankConnection,
        cuenta,
        mpUserId
      );
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

      const transferenciasP2P = Math.max(
        pagos.filter(
          (p) => esTransferenciaPago(p) && !esTransferenciaBancariaPago(p)
        ).length,
        activitiesWithdraw.filter((m) => m.transactionType === 'MONEY_TRANSFER').length
      );
      const transferenciasBancarias = Math.max(
        pagos.filter((p) => esTransferenciaBancariaPago(p)).length,
        activitiesWithdraw.filter(
          (m) =>
            m.transactionType === 'BANK_TRANSFER' ||
            m.transactionType === 'WITHDRAWAL' ||
            m.transactionType === 'PAYOUT' ||
            m.transactionType === 'PAYOUTS' ||
            Boolean(m.raw?.METADATA?.bank_account || m.raw?.bank_account)
        ).length,
        movimientos.filter((m) =>
          ['WITHDRAWAL', 'BANK_TRANSFER', 'PAYOUT', 'PAYOUTS'].includes(
            String(m.transactionType || '').toUpperCase()
          )
        ).length
      );
      const transferenciasSettlement = movimientos.filter((m) =>
        esTipoTransferenciaMovimiento(m.transactionType)
      ).length;
      const transferenciasAccount = accountMovements.filter((m) =>
        esTipoTransferenciaMovimiento(m.transactionType)
      ).length;
      const transferenciasActivities = activitiesWithdraw.length;
      const movementKinds = movimientosMerged.reduce((acc, m) => {
        const kind = clasificarMovimientoEconomicoMp({
          transactionType: m.transactionType,
          description: m.description,
          netAmount: m.netAmount,
          raw: m.raw,
          paymentMethod: m.paymentMethod,
          operationType: m.payment?.operation_type
        }).movementKind;
        acc[kind] = (acc[kind] || 0) + 1;
        return acc;
      }, {});
      for (const pago of pagos) {
        const kind = clasificarMovimientoEconomicoMp({
          operationType: pago.operation_type,
          description: pago.description,
          paymentMethod: pago.payment_method?.type
        }).movementKind;
        movementKinds[kind] = (movementKinds[kind] || 0) + 1;
      }

      // Reconciliación: saldo MP vs sumatoria de txs no internas (detecta P2P faltantes)
      let saldoLedger = null;
      let gapSaldo = null;
      try {
        const ledger = await Transacciones.getBalance(bankConnection.cuenta, { estado: 'PAGADO' });
        saldoLedger = Number(ledger?.balance) || 0;
        const saldoMp = Number(balance.available) || 0;
        gapSaldo = Math.round((saldoMp - saldoLedger) * 100) / 100;
      } catch (error) {
        console.warn('⚠️ No se pudo calcular gap de reconciliación:', error.message);
      }

      const settlementBankOuts = (movimientos || []).filter((m) =>
        ['WITHDRAWAL', 'WITHDRAWAL_CANCEL', 'PAYOUT', 'PAYOUTS', 'BANK_TRANSFER'].includes(
          String(m.transactionType || '').toUpperCase()
        )
      ).length;
      const settlementHasBankOut = settlementBankOuts > 0;

      const coberturaP2P =
        transferenciasP2P > 0 || (movementKinds.P2P_TRANSFER || 0) > 0 ? 'OK' : 'VACIA';
      // Salidas CVU→CBU = PAYOUTS/WITHDRAWAL en settlement (no confundir con Debin ingreso)
      const coberturaBancarias = settlementHasBankOut || transferenciasActivities > 0
        ? 'OK'
        : transferenciasBancarias > 0
          ? 'SOLO_ENTRADA'
          : 'VACIA';
      const diagnosticoNota =
        coberturaP2P === 'VACIA' && coberturaBancarias === 'VACIA'
          ? 'No se detectaron transferencias P2P ni bancarias (CVU→CBU).'
          : coberturaBancarias === 'VACIA'
            ? 'Hay P2P (CVU→CVU) pero no salidas a banco (CVU→CBU / PAYOUTS).'
            : coberturaBancarias === 'SOLO_ENTRADA'
              ? 'Hay Debin/ingresos bancarios, pero aún no salidas CVU→CBU (PAYOUTS) en settlement.'
              : 'Transferencias P2P y/o bancarias (incl. salidas) detectadas en esta sync.';

      const p2pGapHint =
        (coberturaP2P === 'VACIA' || coberturaBancarias === 'VACIA' || coberturaBancarias === 'SOLO_ENTRADA') &&
        gapSaldo != null &&
        Math.abs(gapSaldo) >= 1
          ? ` Posible hueco de ledger ≈ ${gapSaldo} (saldo MP ${balance.available} vs flujo ${saldoLedger}).`
          : '';

      const syncParcial =
        settlementPending ||
        errores.some((e) => e.tipo === 'settlement_report') ||
        (coberturaP2P === 'VACIA' && gapSaldo != null && Math.abs(gapSaldo) >= 50) ||
        (coberturaBancarias === 'VACIA' && !settlementHasBankOut);

      let ultimoError = bankConnection.mercadopago?.ultimoErrorSettlement;
      if (settlementHasBankOut || coberturaBancarias === 'OK') {
        if (ultimoError && /activities_withdraw/i.test(String(ultimoError))) {
          ultimoError = undefined;
        }
      }
      if (
        coberturaP2P === 'VACIA' &&
        gapSaldo != null &&
        Math.abs(gapSaldo) >= 50
      ) {
        ultimoError =
          `Cobertura incompleta: no hay transferencias P2P y el saldo MP difiere del ledger (${gapSaldo}).`;
      }

      bankConnection.mercadopago = {
        ...(bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {}),
        syncParcial,
        ultimoErrorSettlement: syncParcial ? ultimoError : undefined,
        diagnostico: {
          actualizadoEn: new Date(),
          transferenciasP2P,
          transferenciasBancarias,
          transferenciasSettlement: Math.max(transferenciasSettlement, settlementBankOuts),
          transferenciasAccount,
          transferenciasActivities,
          settlementBankOuts,
          movementKinds,
          saldoMp: balance.available || 0,
          saldoLedger,
          gapSaldo,
          coberturaP2P,
          coberturaBancarias,
          nota: diagnosticoNota + p2pGapHint
        }
      };
      await bankConnection.save();

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
          transferenciasP2P,
          transferenciasBancarias,
          transferenciasSettlement,
          transferenciasAccount,
          transferenciasActivities,
          movementKinds,
          coberturaP2P,
          coberturaBancarias,
          reconciliacion: {
            saldoMp: balance.available || 0,
            saldoLedger,
            gapSaldo
          },
          totalCsvRows,
          movimientosImportados: movResult.nuevas,
          movimientosOmitidos: movResult.omitidas,
          rangoDias: syncDays,
          balance,
          errores,
          reportePendiente: bankConnection.mercadopago?.reportePendiente || null,
          diagnostico: bankConnection.mercadopago?.diagnostico || null
        }
      };
    } catch (error) {
      console.error('Error en sincronización MercadoPago:', error);
      await bankConnection.actualizarSincronizacion('ERROR', 0, 0, error.message);
      return { exito: false, error: error.message };
    }
  }

  mergeMovimientosMp(primaryRows = [], secondaryRows = []) {
    const byId = new Map();
    for (const row of primaryRows) {
      const key = String(row.sourceId || row.id || '');
      if (key) byId.set(key, row);
    }
    for (const row of secondaryRows) {
      const key = String(row.sourceId || row.id || '');
      if (!key) continue;
      if (!byId.has(key)) {
        byId.set(key, row);
        continue;
      }
      // Enriquecer con contraparte / descripción / tipo transferencia del secondary
      const existing = byId.get(key);
      const enriched = { ...existing };
      const existingDesc = String(existing.description || '').trim();
      const genericDesc =
        !existingDesc ||
        /^(settlement|withdrawal|payout|pago aprobado|transferencia)$/i.test(existingDesc);
      if ((genericDesc || !existing.description) && row.description) {
        enriched.description = row.description;
      }
      if (!existing.counterpartName && row.counterpartName) {
        enriched.counterpartName = row.counterpartName;
      }
      // activities_withdraw trae bank_account (CVU→CBU); no perderlo aunque settlement ya diga WITHDRAWAL
      if (row.source === 'activities_withdraw') {
        const bankAccount =
          row.raw?.METADATA?.bank_account ||
          row.raw?.BANK_ACCOUNT ||
          row.raw?.bank_account ||
          null;
        if (
          !existing.transactionType ||
          existing.transactionType === 'SETTLEMENT' ||
          (bankAccount && existing.transactionType !== 'BANK_TRANSFER')
        ) {
          enriched.transactionType = row.transactionType || (bankAccount ? 'BANK_TRANSFER' : existing.transactionType);
        }
        enriched.source = row.source;
        enriched.raw = {
          ...(existing.raw || {}),
          ...(row.raw || {}),
          DESCRIPTION: enriched.description || existing.raw?.DESCRIPTION,
          TRANSACTION_TYPE: enriched.transactionType,
          METADATA: {
            ...(existing.raw?.METADATA || {}),
            ...(row.raw?.METADATA || {}),
            bank_account: bankAccount || existing.raw?.METADATA?.bank_account || null,
            cbu: bankAccount || existing.raw?.METADATA?.cbu || null,
            counterpart_name:
              row.counterpartName ||
              existing.counterpartName ||
              existing.raw?.METADATA?.counterpart_name ||
              null
          },
          PAYMENT_METHOD: bankAccount
            ? 'bank_transfer'
            : (existing.raw?.PAYMENT_METHOD || row.raw?.PAYMENT_METHOD),
          PAYMENT_METHOD_TYPE: bankAccount
            ? 'bank_transfer'
            : (existing.raw?.PAYMENT_METHOD_TYPE || row.raw?.PAYMENT_METHOD_TYPE)
        };
        if (bankAccount) {
          enriched.paymentMethod = 'bank_transfer';
          enriched.paymentMethodType = 'bank_transfer';
        }
      } else if (row.description && genericDesc) {
        enriched.raw = {
          ...(existing.raw || {}),
          DESCRIPTION: row.description,
          ...(row.raw || {})
        };
      }
      byId.set(key, enriched);
    }
    return Array.from(byId.values());
  }

  async procesarPagosMercadoPago(pagos, bankConnection, cuenta, userId) {
    let nuevas = 0;
    let actualizadas = 0;
    const MP_ORIGEN_TIPOS = ['MERCADOPAGO_PAGO', 'MERCADOPAGO_MOVIMIENTO'];

    for (const pago of pagos) {
      try {
        const comisiones = calcularComisiones(pago);
        const monto = Math.abs(pago.transaction_amount || 0);
        const montoNeto = monto - comisiones.total;
        const contraparte = extraerContrapartePago(pago, userId);
        const descripcion = formatearDescripcionPago(pago, userId);
        const isTransfer = esTransferenciaPago(pago);
        const economic = clasificarMovimientoEconomicoMp({
          operationType: pago.operation_type,
          description: pago.description,
          paymentMethod: pago.payment_method?.type || pago.payment_method_id,
          metadata: pago.metadata,
          netAmount: determinarTipoPago(pago, userId) === 'INGRESO'
            ? Math.abs(pago.transaction_amount || 0)
            : -Math.abs(pago.transaction_amount || 0)
        });

        const paymentMeta = {
          paymentId: pago.id,
          status: pago.status,
          statusDetail: pago.status_detail,
          paymentMethod: pago.payment_method?.type,
          paymentMethodId: pago.payment_method_id,
          operationType: pago.operation_type || null,
          isTransfer: isTransfer || economic.isTransfer,
          movementKind: economic.movementKind,
          statsExclude: economic.statsExclude,
          isInternal: economic.isInternal,
          description: pago.description || null,
          statementDescriptor: pago.statement_descriptor || null,
          itemTitle: pago.additional_info?.items?.[0]?.title || null,
          businessName: pago.point_of_interaction?.business_info?.name || null,
          counterpartyName: contraparte?.name || null,
          counterpartyLabel: contraparte?.label || null,
          counterpartyRole: contraparte?.role || null,
          counterpartyId: contraparte?.id || null,
          counterpartyEmail: contraparte?.email || null
        };

        const transaccionExistente = await Transacciones.findOne({
          cuenta: bankConnection.cuenta,
          'origen.transaccionId': pago.id.toString(),
          'origen.tipo': { $in: MP_ORIGEN_TIPOS }
        });

        if (transaccionExistente) {
          const prevName = transaccionExistente.origen?.metadata?.counterpartyName;
          const prevKind = transaccionExistente.origen?.metadata?.movementKind;
          const shouldUpdate =
            (contraparte?.name && (!prevName || !limpiarNombreContraparte(prevName))) ||
            !prevKind ||
            prevKind !== economic.movementKind;
          if (shouldUpdate) {
            if (contraparte?.name || economic.isInternal || economic.isTransfer) {
              transaccionExistente.descripcion = economic.isInternal
                ? `MercadoPago - ${economic.label}`
                : descripcion;
            }
            transaccionExistente.origen.metadata = {
              ...(transaccionExistente.origen.metadata?.toObject?.() ||
                transaccionExistente.origen.metadata ||
                {}),
              ...paymentMeta
            };
            await transaccionExistente.save();
            actualizadas++;
          }
          continue;
        }

        const descripcionFinal = economic.isInternal
          ? `MercadoPago - ${economic.label}`
          : descripcion;

        const nuevaTransaccion = new Transacciones({
          descripcion: descripcionFinal,
          monto,
          montoNeto,
          fecha: new Date(pago.date_created),
          categoria: bankConnection.configuracion?.categorizacionAutomatica
            ? this.categorizarTransaccion(descripcionFinal)
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
              ...paymentMeta,
              collectorId: pago.collector_id,
              payerId: pago.payer?.id,
              currencyId: pago.currency_id,
              installments: pago.installments
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

  resolverContraparteMovimiento(mov, userId) {
    if (mov?.payment && userId != null) {
      const fromPayment = extraerContrapartePago(mov.payment, userId);
      if (limpiarNombreContraparte(fromPayment?.name)) {
        return fromPayment;
      }
    }

    if (limpiarNombreContraparte(mov?.counterpartName)) {
      const isIn = Number(mov.netAmount) >= 0;
      return {
        role: isIn ? 'origen' : 'destino',
        label: isIn ? 'Recibiste de' : 'Transferiste a',
        name: mov.counterpartName,
        id: null,
        email: null
      };
    }

    const rowSource = {
      ...(mov.raw || {}),
      ...mov,
      netAmount: mov.netAmount,
      TRANSACTION_TYPE: mov.transactionType || mov.raw?.TRANSACTION_TYPE,
      DESCRIPTION: mov.description || mov.raw?.DESCRIPTION,
      EXTERNAL_REFERENCE: mov.externalReference || mov.raw?.EXTERNAL_REFERENCE,
      SETTLEMENT_NET_AMOUNT: mov.netAmount ?? mov.raw?.SETTLEMENT_NET_AMOUNT
    };
    const fromRow = extraerContraparteMovimiento(rowSource);
    if (fromRow?.name) return fromRow;

    // Sin nombre real: no inventar "Pagaste a Pago aprobado"
    return {
      role: Number(mov.netAmount) >= 0 ? 'origen' : 'destino',
      label: null,
      name: null,
      id: null,
      email: null
    };
  }

  async procesarMovimientosReporte(movimientos, bankConnection, cuenta, userId = null) {
    let nuevas = 0;
    let actualizadas = 0;
    let omitidas = 0;
    const MP_ORIGEN_TIPOS = ['MERCADOPAGO_PAGO', 'MERCADOPAGO_MOVIMIENTO'];

    for (const mov of movimientos) {
      try {
        const transaccionId = String(mov.sourceId || mov.id);
        if (!transaccionId) continue;

        const contraparte = this.resolverContraparteMovimiento(mov, userId);
        const rowSource = {
          ...(mov.raw || {}),
          ...mov,
          netAmount: mov.netAmount,
          TRANSACTION_TYPE: mov.transactionType || mov.raw?.TRANSACTION_TYPE,
          DESCRIPTION: mov.description || mov.raw?.DESCRIPTION,
          EXTERNAL_REFERENCE: mov.externalReference || mov.raw?.EXTERNAL_REFERENCE,
          SETTLEMENT_NET_AMOUNT: mov.netAmount ?? mov.raw?.SETTLEMENT_NET_AMOUNT,
          operationType: mov.payment?.operation_type || mov.raw?.OPERATION_TYPE || null,
          metadata: mov.raw?.METADATA || mov.payment?.metadata || null
        };
        const economic = clasificarMovimientoEconomicoMp({
          ...rowSource,
          transactionType: mov.transactionType,
          operationType: mov.payment?.operation_type || mov.raw?.OPERATION_TYPE,
          description: mov.description || mov.payment?.description || mov.raw?.DESCRIPTION,
          paymentMethod: mov.paymentMethod || mov.payment?.payment_type_id,
          netAmount: mov.netAmount,
          metadata: mov.raw?.METADATA || mov.payment?.metadata,
          raw: mov.raw
        });
        const isTransfer =
          economic.isTransfer ||
          esTipoTransferenciaMovimiento(mov.transactionType) ||
          esTransferenciaPago(mov.payment || {});

        let descripcion = mov.payment && userId != null && !economic.isInternal
          ? formatearDescripcionPago(mov.payment, userId)
          : formatearDescripcionMovimiento(rowSource);
        if (economic.isInternal) {
          descripcion = `MercadoPago - ${economic.label}`;
        } else if (economic.isTransfer && !contraparte?.name) {
          descripcion = `MercadoPago - ${economic.label}`;
        }

        const metadataPatch = {
          transactionType: mov.transactionType,
          description: mov.description || mov.payment?.description || null,
          paymentMethod: mov.paymentMethod || mov.payment?.payment_type_id || null,
          paymentMethodType: mov.paymentMethodType || mov.payment?.payment_type_id || null,
          paymentMethodId: mov.payment?.payment_method_id || null,
          operationType: mov.payment?.operation_type || mov.raw?.OPERATION_TYPE || null,
          externalReference: mov.externalReference || mov.payment?.external_reference || null,
          currency: mov.currency,
          source: mov.payment ? 'settlement_enriched' : (mov.source || 'settlement_report'),
          isTransfer,
          movementKind: economic.movementKind,
          statsExclude: economic.statsExclude,
          isInternal: economic.isInternal,
          statementDescriptor: mov.payment?.statement_descriptor || null,
          itemTitle: mov.payment?.additional_info?.items?.[0]?.title || null,
          businessName: mov.payment?.point_of_interaction?.business_info?.name || null,
          counterpartyName: contraparte?.name || null,
          counterpartyLabel: contraparte?.label || null,
          counterpartyRole: contraparte?.role || null,
          counterpartyId: contraparte?.id || null,
          counterpartyEmail: contraparte?.email || null
        };

        const transaccionExistente = await Transacciones.findOne({
          cuenta: bankConnection.cuenta,
          'origen.transaccionId': transaccionId,
          'origen.tipo': { $in: MP_ORIGEN_TIPOS }
        });

        if (transaccionExistente) {
          const prevMeta =
            transaccionExistente.origen?.metadata?.toObject?.() ||
            transaccionExistente.origen?.metadata ||
            {};
          const prevName = prevMeta.counterpartyName;
          const shouldEnrich =
            (contraparte?.name && (!prevName || !limpiarNombreContraparte(prevName))) ||
            (isTransfer && !prevMeta.isTransfer) ||
            prevMeta.movementKind !== economic.movementKind ||
            Boolean(prevMeta.statsExclude) !== Boolean(economic.statsExclude);

          if (shouldEnrich) {
            transaccionExistente.descripcion = descripcion;
            transaccionExistente.origen.metadata = {
              ...prevMeta,
              ...metadataPatch
            };
            await transaccionExistente.save();
            actualizadas++;
          } else {
            omitidas++;
          }
          continue;
        }

        const monto = Math.abs(mov.amount || mov.netAmount || 0);
        const montoNeto = Math.abs(mov.netAmount || monto);

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
            metadata: metadataPatch
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
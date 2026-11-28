import { BankConnection } from '../models/BankConnection.js';
import { Transacciones } from '../models/Transacciones.js';
import { Cuentas } from '../models/Cuentas.js';
import crypto from 'crypto';
import {
  calcularComisiones,
  determinarTipoPago,
  determinarTipoMovimientoMp,
  formatearDescripcionPago,
  formatearDescripcionMovimiento,
  extraerContrapartePago,
  extraerContraparteMovimiento,
  mapearEstadoPago,
  getMpSyncDays,
  dailySyncSince,
  nextHistoryChunk,
  parseHistorySince,
  normalizeAccountMovement,
  esTipoTransferenciaMovimiento,
  esTransferenciaPago,
  esTransferenciaBancariaPago,
  limpiarNombreContraparte,
  clasificarMovimientoEconomicoMp,
  conservarClasificacionUsd,
  conservarClasificacionTarjeta,
  datosCambioUsd,
  datosPosicionUsd,
  isDolaresMovementKind,
  isInversionesMovementKind,
  investmentOperationIdDePago,
  deduplicarPagosInversionMp,
  tipoDeCambioUsd
} from './mercadoPagoUtils.js';
import {
  MercadoPagoReportService,
  getSettlementRapidoReuseMaxAgeMs
} from './mercadoPagoReportService.js';
import { calcularAnclaGap } from './mercadoPagoAnclaService.js';
import {
  MercadoPagoReleaseReportService,
  validarRangoConRelease
} from './mercadoPagoReleaseReportService.js';
import {
  tramosSinCobertura,
  inicioSettlementRapido,
  extraerRetiros,
  conciliarRetiros,
  agregarCobertura
} from './mercadoPagoRetiros.js';
import { MercadoPagoActivitiesService } from './mercadoPagoActivitiesService.js';
import {
  createContactoSyncCache,
  extraerSenalesContraparteMp,
  resolverCategoriaDeContacto,
  resolverOCrearContactoMp,
} from './contactoResolverService.js';

function pendingInsideWindow(pending, beginDate, endDate) {
  if (!pending?.beginDate || !pending?.endDate) return undefined;
  const from = new Date(pending.beginDate).getTime();
  const to = new Date(pending.endDate).getTime();
  const windowFrom = new Date(beginDate).getTime();
  const windowTo = new Date(endDate).getTime();
  if ([from, to, windowFrom, windowTo].some((value) => Number.isNaN(value))) return undefined;
  if (to < windowFrom || from > windowTo) return undefined;
  return pending;
}

// Un tramo revisado que no se pudo validar no se vuelve a pedir enseguida (evita trabar el historial).
const REVISION_REINTENTO_MS = 12 * 60 * 60 * 1000;

function revisadosDe(historial) {
  return (historial?.revisados || [])
    .filter((r) => r?.beginDate && r?.endDate)
    .map((r) => ({ beginDate: r.beginDate, endDate: r.endDate, revisadoEn: r.revisadoEn || null }));
}

function camposCuotas(pago) {
  if (!pago || typeof pago !== 'object') return {};
  const installments = Number(pago.installments);
  const installmentAmount = Number(pago.transaction_details?.installment_amount);
  const paymentMethodType = pago.payment_type_id || pago.payment_method?.type || null;
  const out = {};
  if (Number.isFinite(installments) && installments > 0) out.installments = Math.round(installments);
  if (Number.isFinite(installmentAmount) && installmentAmount > 0) {
    out.installmentAmount = installmentAmount;
  }
  if (paymentMethodType) out.paymentMethodType = String(paymentMethodType);
  return out;
}

function camposCambioUsd(pago) {
  const fx = datosCambioUsd(pago || {});
  if (fx) {
    return {
      exchangeOperation: fx.exchangeOperation,
      usdAmount: fx.usdAmount,
      exchangeRate: fx.exchangeRate,
      payerCurrency: fx.payerCurrency,
      collectorCurrency: fx.collectorCurrency,
    };
  }
  const posicion = datosPosicionUsd(pago || {});
  if (!posicion) return {};
  return { usdAmount: posicion.usdAmount, currency: 'USD' };
}

function libroConEtiqueta(kind) {
  return isInversionesMovementKind(kind) || isDolaresMovementKind(kind);
}

const MP_ORIGEN_TIPOS = ['MERCADOPAGO_PAGO', 'MERCADOPAGO_MOVIMIENTO'];

function idsMp(...values) {
  return [...new Set(values.flat().map((value) => String(value || '').trim()).filter(Boolean))];
}

/** El pago y el settlement del mismo cambio comparten id o la referencia externa. */
async function findTransaccionMp(cuenta, ids) {
  const keys = idsMp(ids);
  if (!keys.length) return null;
  const numeric = keys.filter((key) => /^\d+$/.test(key)).map((key) => Number(key));
  return Transacciones.findOne({
    cuenta,
    'origen.tipo': { $in: MP_ORIGEN_TIPOS },
    $or: [
      { 'origen.transaccionId': { $in: keys } },
      { 'origen.metadata.externalReference': { $in: keys } },
      { 'origen.metadata.paymentId': { $in: [...keys, ...numeric] } },
    ],
  });
}

/** Ids de pago de Mercado Pago. Una referencia corta no alcanza para borrar copias. */
function idsOperacionMp(...values) {
  // Spread: si llega un array de ids, idsMp debe recibir cada id por separado.
  return idsMp(...values).filter((key) => /^\d{8,}$/.test(key));
}

/** El pago y el reporte del mismo id no pueden convivir como dos transacciones. */
async function dejarUnaSolaMp(cuenta, canonical, ids) {
  const keys = idsOperacionMp(ids);
  if (!cuenta || !canonical?._id || !keys.length) return;
  const numeric = keys.map((key) => Number(key));
  await Transacciones.deleteMany({
    cuenta,
    _id: { $ne: canonical._id },
    'origen.tipo': { $in: MP_ORIGEN_TIPOS },
    $or: [
      { 'origen.transaccionId': { $in: keys } },
      { 'origen.metadata.paymentId': { $in: [...keys, ...numeric] } },
    ],
  });
}

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

  // Renueva access_token con refresh_token y persiste ambos (MP rota el refresh_token).
  async refrescarTokenMercadoPago(bankConnection) {
    const refreshCifrado = bankConnection.credenciales?.refreshToken;
    if (!refreshCifrado) {
      throw new Error('Token de MercadoPago vencido y sin refresh_token: reconectá la cuenta');
    }
    const refreshToken = this.decrypt(refreshCifrado);
    const { refreshAccessToken } = await import('../oauth/mercadoPagoOAuth.js');
    const data = await refreshAccessToken({ refreshToken });

    bankConnection.credenciales.accessToken = this.encrypt(data.access_token);
    bankConnection.credenciales.refreshToken = this.encrypt(data.refresh_token || refreshToken);
    await bankConnection.save();
    return data.access_token;
  }

  /**
   * Próximo tramo ya importado cuyas salidas a CBU nunca se validaron (fuera de la cobertura
   * registrada), o null. El más reciente primero. Un tramo revisado hace poco sin lograr validarlo
   * se saltea un rato para no trabar el recorrido hacia atrás.
   */
  siguienteTramoSinCoberturaMp(bankConnection, historial = {}, { now = new Date(), minDesde = null } = {}) {
    const cobertura = bankConnection?.mercadopago?.coberturaRetiros || [];
    let desde = historial.cubiertoHasta ? new Date(historial.cubiertoHasta) : dailySyncSince(now);
    if (minDesde && new Date(minDesde).getTime() > desde.getTime()) desde = new Date(minDesde);
    const recientes = revisadosDe(historial).filter(
      (r) => r.revisadoEn && now.getTime() - new Date(r.revisadoEn).getTime() < REVISION_REINTENTO_MS
    );
    const tramos = tramosSinCobertura(cobertura, { desde, hasta: now }).filter(
      (t) =>
        !recientes.some(
          (r) =>
            new Date(r.beginDate).getTime() < new Date(t.endDate).getTime() &&
            new Date(r.endDate).getTime() > new Date(t.beginDate).getTime()
        )
    );
    return tramos[0] || null;
  }

  /** Ids (transaccionId o paymentId) de Mercado Pago presentes en el ledger de la cuenta. */
  async idsMpEnLedger(cuentaId, ids = []) {
    const keys = idsMp(ids);
    if (!cuentaId || !keys.length) return new Set();
    const numeric = keys.filter((key) => /^\d+$/.test(key)).map((key) => Number(key));
    const docs = await Transacciones.find({
      cuenta: cuentaId,
      'origen.tipo': { $in: MP_ORIGEN_TIPOS },
      $or: [
        { 'origen.transaccionId': { $in: keys } },
        { 'origen.metadata.paymentId': { $in: [...keys, ...numeric] } },
      ],
    })
      .select({ 'origen.transaccionId': 1, 'origen.metadata.paymentId': 1 })
      .lean();
    const presentes = new Set();
    for (const doc of docs) {
      if (doc.origen?.transaccionId) presentes.add(String(doc.origen.transaccionId));
      if (doc.origen?.metadata?.paymentId) presentes.add(String(doc.origen.metadata.paymentId));
    }
    return presentes;
  }

  /**
   * Concilia los retiros (CVU→CBU) del reporte de confianza contra el ledger y, si todo coincide,
   * suma las ventanas del reporte a la cobertura validada. Si falta alguno reingesta una vez.
   * Nunca registra cobertura con un reporte que no es de confianza ni con faltantes.
   */
  /**
   * Segunda fuente independiente (reporte de liberaciones): saldo corrido sin saltos y cada
   * payout del settlement cruzado con uno de la liberación. Detrás de MP_RELEASE_VALIDACION.
   * ok=true valida, ok=false es discrepancia, ok=null no se pudo verificar (sin penalizar).
   */
  async validarConRelease({ accessToken, bankConnection, desde, hasta, retiros }) {
    if (process.env.MP_RELEASE_VALIDACION !== 'true') return null;
    try {
      const prev = bankConnection.mercadopago?.diagnostico?.retiros?.release;
      const mismoRango =
        prev?.reportId && prev.ok == null && prev.beginDate === desde && prev.endDate === hasta;
      const service = new MercadoPagoReleaseReportService({ accessToken });
      const res = await service.fetchRange(desde, hasta, {
        reportId: mismoRango ? prev.reportId : null,
        maxPollAttempts: 8
      });
      if (res.pending) {
        return {
          ok: null,
          motivo: 'Reporte de liberaciones en generación',
          reportId: res.reportId != null ? String(res.reportId) : null,
          beginDate: desde,
          endDate: hasta
        };
      }
      const v = validarRangoConRelease({ releaseRows: res.rows, retirosSettlement: retiros });
      const motivo = v.ok
        ? null
        : !v.saldo.ok
          ? `Saldo corrido con ${v.saldo.saltos?.length || 0} saltos (${v.saldo.motivo || 'inconsistente'})`
          : `Payouts sin cruzar: ${v.cruce.soloSettlement?.length || 0} solo en settlement, ${v.cruce.soloRelease?.length || 0} solo en liberaciones`;
      return {
        ok: v.ok,
        motivo,
        reportId: res.reportId != null ? String(res.reportId) : null,
        beginDate: desde,
        endDate: hasta,
        saltosSaldo: v.saldo.saltos?.length || 0,
        soloSettlement: v.cruce.soloSettlement?.length || 0,
        soloRelease: v.cruce.soloRelease?.length || 0
      };
    } catch (error) {
      console.warn('[MP] Validación con reporte de liberaciones no disponible:', error.message);
      return { ok: null, motivo: error.message, beginDate: desde, endDate: hasta };
    }
  }

  async conciliarYRegistrarRetiros({ bankConnection, cuenta, settlementReport, movimientos, movimientosMerged, mpUserId, accessToken }) {
    const actual = bankConnection.mercadopago?.coberturaRetiros;
    const coberturaActual = (actual?.toObject?.() || actual || []).map((t) => ({ ...t }));
    if (!settlementReport?.trusted || !(settlementReport.ventanasValidadas || []).length) {
      return {
        validado: false,
        cobertura: coberturaActual,
        motivo: settlementReport?.pending
          ? 'Reporte en generación'
          : 'El reporte usado no es de confianza (puede no incluir retiros)'
      };
    }

    const retiros = extraerRetiros(movimientos);
    let conciliacion = conciliarRetiros(retiros, await this.idsMpEnLedger(cuenta._id, retiros.map((r) => r.id)));
    if (!conciliacion.ok) {
      const faltantes = new Set(conciliacion.faltantes.map((f) => String(f.id)));
      const filas = (movimientosMerged || []).filter((m) => faltantes.has(String(m.sourceId || m.id)));
      console.warn(`[MP] Retiros del reporte sin ledger: ${faltantes.size}; reingestando`);
      await this.procesarMovimientosReporte(filas, bankConnection, cuenta, mpUserId);
      conciliacion = conciliarRetiros(retiros, await this.idsMpEnLedger(cuenta._id, retiros.map((r) => r.id)));
    }

    const ventanas = settlementReport.ventanasValidadas;
    const desde = ventanas.map((v) => v.beginDate).sort()[0];
    const hasta = ventanas.map((v) => v.endDate).sort().slice(-1)[0];
    const diagnostico = {
      actualizadoEn: new Date(),
      beginDate: desde,
      endDate: hasta,
      reportId: settlementReport.report?.id != null ? String(settlementReport.report.id) : ventanas[0]?.reportId || null,
      esperados: conciliacion.esperados,
      conciliados: conciliacion.conciliados,
      faltantes: conciliacion.faltantes.length,
      montoEsperado: conciliacion.montoEsperado,
      validado: conciliacion.ok,
      motivo: conciliacion.ok
        ? null
        : `Faltan en el ledger ${conciliacion.faltantes.length} retiros: ${conciliacion.faltantes
            .slice(0, 5)
            .map((f) => f.id)
            .join(', ')}`
    };

    if (!conciliacion.ok) {
      return { validado: false, cobertura: coberturaActual, diagnostico, motivo: diagnostico.motivo, conciliacion };
    }

    // Segunda fuente (opcional): una discrepancia con el reporte de liberaciones bloquea la
    // validación; si no se pudo verificar, queda anotado y se valida solo por settlement.
    const release = await this.validarConRelease({
      accessToken,
      bankConnection,
      desde,
      hasta,
      retiros: retiros.filter((r) => !r.cancel)
    });
    if (release) diagnostico.release = release;
    if (release?.ok === false) {
      diagnostico.validado = false;
      diagnostico.motivo = `El reporte de liberaciones no coincide: ${release.motivo}`;
      return { validado: false, cobertura: coberturaActual, diagnostico, motivo: diagnostico.motivo, conciliacion };
    }

    let cobertura = coberturaActual;
    for (const v of ventanas) {
      cobertura = agregarCobertura(cobertura, {
        beginDate: v.beginDate,
        endDate: v.endDate,
        reportId: v.reportId || diagnostico.reportId,
        fuente: v.fuente || 'settlement',
        validadoEn: new Date(),
        releaseValidado: release?.ok === true
      });
    }
    return { validado: true, cobertura, diagnostico, conciliacion };
  }

  // Sincronizar transacciones usando MercadoPago (wallet personal AR)
  async sincronizarConMercadoPago(bankConnection, options = {}) {
    try {
      console.log(`Sincronizando con MercadoPago para conexión: ${bankConnection.nombre}`);

      let userAccessToken = this.decrypt(bankConnection.credenciales.accessToken);
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

      let userInfo;
      try {
        userInfo = await mpAdapter.getUserInfo();
      } catch (error) {
        if (!/expirado o inválido/i.test(String(error?.message || ''))) throw error;
        console.warn('[MP] Access token vencido; renovando con refresh_token');
        userAccessToken = await this.refrescarTokenMercadoPago(bankConnection);
        mpAdapter.accessToken = userAccessToken;
        userInfo = await mpAdapter.getUserInfo();
      }
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
      const historialMode = options.mode === 'historial';
      let historyChunk = null;
      let fechaDesde = dailySyncSince();
      let fechaHasta = new Date();
      let inicioActividadIso = null;

      if (historialMode) {
        const storedHist = bankConnection.mercadopago?.historial || {};
        const objetivo = options.since || storedHist.objetivo;
        let parsed = parseHistorySince(objetivo);
        if (!parsed) {
          return { exito: false, error: 'Indicá desde cuándo traer el historial' };
        }
        // Acotar el objetivo a la fecha de alta de la cuenta en MP (/users/me registration_date)
        // para no pedir años anteriores a que la cuenta existiera.
        const regDate = userInfo?.registration_date ? parseHistorySince(userInfo.registration_date) : null;
        if (regDate && regDate.getTime() > parsed.getTime()) {
          parsed = regDate;
          inicioActividadIso = regDate.toISOString();
        } else if (storedHist.inicioActividad) {
          inicioActividadIso = storedHist.inicioActividad;
        }
        // Antes de seguir hacia atrás, volver a pedir los tramos ya importados cuyas salidas a CBU
        // nunca se validaron (fuera de la cobertura registrada).
        const revision = this.siguienteTramoSinCoberturaMp(bankConnection, storedHist, { minDesde: parsed });
        historyChunk = revision
          ? {
            objetivo: parsed.toISOString(),
            beginDate: revision.beginDate,
            endDate: revision.endDate,
            mesLabel: revision.mesLabel,
            quedaHistorial: storedHist.quedaHistorial ?? true,
            revision: true,
          }
          : nextHistoryChunk({
            targetSince: parsed.toISOString(),
            coveredUntil: storedHist.cubiertoHasta || null,
            pendingRange: storedHist.pendiente ? storedHist.ultimoMes : null,
          });
        if (!historyChunk) {
          const historial = {
            objetivo: parsed.toISOString(),
            cubiertoHasta: storedHist.cubiertoHasta || null,
            ultimoMes: storedHist.ultimoMes || null,
            mesLabel: storedHist.mesLabel || null,
            pendiente: false,
            cuotaAgotada: false,
            quedaHistorial: false,
            completo: true,
            tramosVacios: storedHist.tramosVacios || 0,
            inicioActividad: inicioActividadIso,
            actualizadoEn: new Date(),
            revisados: revisadosDe(storedHist),
          };
          bankConnection.mercadopago = {
            ...(bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {}),
            historial,
          };
          await bankConnection.save();
          return {
            exito: true,
            historialCompleto: true,
            transaccionesNuevas: 0,
            transaccionesActualizadas: 0,
            historial,
          };
        }
        fechaDesde = new Date(historyChunk.beginDate);
        fechaHasta = new Date(historyChunk.endDate);
      }

      const rememberHistory = ({
        pendiente = false,
        cuotaAgotada = false,
        sinMovimientos = false,
      } = {}) => {
        if (!historialMode || !historyChunk) return null;
        const storedHist = bankConnection.mercadopago?.historial || {};
        const revisadosPrev = revisadosDe(storedHist);
        if (historyChunk.revision) {
          // Una revisión no mueve el cursor del recorrido; solo se anota cuando salió completa.
          const tramo = { beginDate: historyChunk.beginDate, endDate: historyChunk.endDate };
          const historial = {
            objetivo: historyChunk.objetivo,
            cubiertoHasta: storedHist.cubiertoHasta || null,
            ultimoMes: storedHist.ultimoMes?.beginDate
              ? { beginDate: storedHist.ultimoMes.beginDate, endDate: storedHist.ultimoMes.endDate }
              : null,
            mesLabel: `revisión ${historyChunk.mesLabel}`,
            // Si el recorrido normal tenía un tramo pendiente, se recalcula desde cubiertoHasta.
            pendiente,
            cuotaAgotada,
            quedaHistorial: storedHist.quedaHistorial ?? true,
            completo: Boolean(storedHist.completo),
            tramosVacios: Number(storedHist.tramosVacios) || 0,
            inicioActividad: inicioActividadIso || storedHist.inicioActividad || null,
            actualizadoEn: new Date(),
            revisados: pendiente ? revisadosPrev : [...revisadosPrev, { ...tramo, revisadoEn: new Date() }],
            revision: { ...tramo, mesLabel: historyChunk.mesLabel, pendiente, cuotaAgotada },
          };
          const current = bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {};
          bankConnection.mercadopago = { ...current, historial };
          return historial;
        }
        const prev = storedHist.cubiertoHasta || null;
        const prevVacios = Number(storedHist.tramosVacios) || 0;
        const tramosVacios = pendiente ? prevVacios : (sinMovimientos ? prevVacios + 1 : 0);
        // 3 tramos seguidos (~6 meses) completamente vacíos sin errores = llegamos al inicio real de actividad.
        const alcanzoInicio = !pendiente && tramosVacios >= 3;
        const quedaHistorial = pendiente ? true : (alcanzoInicio ? false : historyChunk.quedaHistorial);
        const historial = {
          objetivo: historyChunk.objetivo,
          cubiertoHasta: pendiente ? prev : historyChunk.beginDate,
          ultimoMes: {
            beginDate: historyChunk.beginDate,
            endDate: historyChunk.endDate,
          },
          mesLabel: historyChunk.mesLabel,
          pendiente,
          cuotaAgotada,
          quedaHistorial,
          completo: !pendiente && !quedaHistorial,
          tramosVacios,
          inicioActividad: inicioActividadIso || storedHist.inicioActividad || null,
          actualizadoEn: new Date(),
          revisados: revisadosPrev,
        };
        const current = bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {};
        bankConnection.mercadopago = { ...current, historial };
        return historial;
      };

      let pagos = [];
      let movimientos = [];
      let totalCsvRows = 0;
      const errores = [];

      try {
        pagos = await mpAdapter.getAllPayments({
          since: fechaDesde.toISOString(),
          until: fechaHasta.toISOString(),
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
      let settlementReport = null;
      try {
        const reportService = new MercadoPagoReportService({
          accessToken: userAccessToken,
          userId
        });
        // Sync rápida: si la cobertura validada ya llega casi hasta ahora, el reporte pide solo la
        // cola (con un día de solape) en vez de 90 días. Pagos y movimientos de cuenta mantienen
        // la ventana completa.
        const beginDate = historialMode
          ? fechaDesde.toISOString()
          : inicioSettlementRapido(bankConnection.mercadopago?.coberturaRetiros || [], {
              windowBegin: fechaDesde,
              now: fechaHasta
            });
        const endDate = fechaHasta.toISOString();
        const storedPending = bankConnection.mercadopago?.reportePendiente;
        const pending = pendingInsideWindow(storedPending, beginDate, endDate);
        // Un solo reporte por request. Mercado Pago arma como máximo 60 días,
        // y el histórico ya llega cortado de a un mes. Volver a partir el rango
        // y esperar cada parte hace que el request no vuelva y la pantalla quede cargando.
        const report = await reportService.fetchSettlementMovements(beginDate, endDate, {
          pending,
          ...(historialMode
            ? { pollOptions: { maxPollAttempts: 20, pollIntervalMs: 3000 } }
            : { reuseMaxAgeMs: getSettlementRapidoReuseMaxAgeMs() }),
        });

        settlementReport = report;
        totalCsvRows = report.total || report.rows?.length || 0;

        if (report.quotaExceeded) {
          rememberHistory({ pendiente: true, cuotaAgotada: true });
          movimientos = report.rows || [];
          const missingW = report.missingWithdrawals !== false;
          const quotaMsg = missingW
            ? 'Cupo de reportes MP agotado: no hay un reporte con salidas a CBU que cubra este tramo (los reutilizados pueden no incluirlas). Reintentá mañana: el tramo queda sin validar.'
            : movimientos.length > 0
              ? `Cupo de reportes MP agotado: se reutilizaron ${movimientos.length} movimientos ya generados. Podés importar CSV o reintentar más tarde.`
              : 'Cupo de reportes MP agotado (máximo de reportes). Importá el CSV desde Mercado Pago o reintentá más tarde.';
          bankConnection.mercadopago = {
            ...(bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {}),
            syncParcial: true,
            // No se pierde el reporte que MP ya está generando: la próxima sync lo completa.
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
          rememberHistory({ pendiente: true, cuotaAgotada: false });
          movimientos = report.rows || [];
          bankConnection.mercadopago = {
            ...(bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {}),
            syncParcial: true,
            reportePendiente: {
              beginDate: report.beginDate || beginDate,
              endDate: report.endDate || endDate,
              solicitadoEn: pending?.solicitadoEn || new Date(),
              reportId: report.reportId || pending?.reportId || undefined
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
          // Solo un reporte de confianza valida las salidas a CBU del tramo. Cualquier otro caso
          // (reporte sin retiros, reuso viejo) se importa pero el tramo queda sin validar.
          const sinRetiros = report.trusted !== true;
          const partialMsg = sinRetiros
            ? 'Settlement sin validar: el reporte usado no garantiza las salidas a CBU. El tramo queda sin validar.'
            : 'Settlement parcial: se reutilizaron reportes existentes.';
          const cur = bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {};
          bankConnection.mercadopago = {
            ...cur,
            syncParcial: Boolean(report.partial) || sinRetiros,
            ultimoErrorSettlement: report.partial || sinRetiros ? partialMsg : undefined,
            // Solo se descarta el puntero si esta corrida lo resolvió (o venció).
            ...(pending ? { reportePendiente: undefined } : {})
          };
          await bankConnection.save();
          if (sinRetiros) {
            errores.push({ tipo: 'settlement_report', error: partialMsg, missingWithdrawals: true });
          }
          console.log(`✅ Movimientos del reporte Account Money: ${movimientos.length}`);
        }
      } catch (error) {
        console.warn('⚠️ Reporte settlement no disponible:', error.message);
        rememberHistory({ pendiente: true, cuotaAgotada: false });
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
          until: fechaHasta.toISOString(),
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
      const settlementBlocked = errores.some((e) => e.tipo === 'settlement_report');
      // activities_withdraw ya no está en el camino crítico: las salidas a CBU salen del settlement
      // de confianza y se concilian contra el ledger. Queda opt-in (MP_ACTIVITIES_WITHDRAW=true)
      // solo para enriquecer con el CBU destino.
      const runActivitiesWithdraw = process.env.MP_ACTIVITIES_WITHDRAW === 'true';
      if (!runActivitiesWithdraw) {
        if (settlementBlocked) {
          console.warn('[MP] Historial: settlement pendiente/error; el tramo queda pendiente.');
        }
      } else {
      try {
        const activitiesService = new MercadoPagoActivitiesService({
          accessToken: userAccessToken,
          userId: mpUserId
        });
        const withdrawReport = await activitiesService.fetchWithdrawMovements(
          fechaDesde.toISOString(),
          fechaHasta.toISOString(),
          { pollOptions: { maxPollAttempts: historialMode ? 10 : 16 } }
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

      const balance = historialMode
        ? { available: 0, unavailable: 0, ok: false }
        : await mpAdapter.getAccountBalance();

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

      // Salidas a CBU: conciliar reporte de confianza vs ledger y registrar el tramo validado.
      let validacionRetiros = { validado: false, cobertura: [], motivo: 'Sin reporte de confianza' };
      try {
        validacionRetiros = await this.conciliarYRegistrarRetiros({
          bankConnection,
          cuenta,
          settlementReport,
          movimientos,
          movimientosMerged,
          mpUserId,
          accessToken: userAccessToken
        });
      } catch (error) {
        console.error('⚠️ Conciliación de retiros falló:', error.message);
        validacionRetiros = { validado: false, cobertura: [], motivo: error.message };
      }
      if (validacionRetiros.validado) {
        console.log('✅ Salidas a CBU validadas:', {
          desde: validacionRetiros.diagnostico?.beginDate,
          hasta: validacionRetiros.diagnostico?.endDate,
          retiros: validacionRetiros.conciliacion?.esperados
        });
      } else {
        console.warn('⚠️ Salidas a CBU sin validar:', validacionRetiros.motivo);
      }

      // Solo actualizar el saldo reportado de la cuenta en sync rápido cuando la API
      // de balance responde OK. Nunca pisarlo con sumas parciales de ventana ni en sync histórico.
      if (!historialMode && balance.ok) {
        try {
          await Cuentas.findByIdAndUpdate(bankConnection.cuenta, {
            saldo: balance.available || 0,
            'mercadopago.disponibleRetiro': balance.available || 0,
            'mercadopago.disponiblePendiente': balance.unavailable || 0,
            'mercadopago.saldoActualizadoEn': new Date()
          });
        } catch (error) {
          console.error('Error actualizando balances:', error);
        }
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
          operationType: m.payment?.operation_type,
          exchange_operation: m.payment?.exchange_operation,
          amounts: m.payment?.amounts,
          point_of_interaction: m.payment?.point_of_interaction,
          businessBranch: m.payment?.point_of_interaction?.business_info?.branch,
        }).movementKind;
        acc[kind] = (acc[kind] || 0) + 1;
        return acc;
      }, {});
      for (const pago of pagos) {
        const kind = clasificarMovimientoEconomicoMp({
          operationType: pago.operation_type,
          description: pago.description,
          paymentMethod: pago.payment_method?.type,
          exchange_operation: pago.exchange_operation,
          amounts: pago.amounts,
          point_of_interaction: pago.point_of_interaction,
          businessBranch: pago.point_of_interaction?.business_info?.branch,
        }).movementKind;
        movementKinds[kind] = (movementKinds[kind] || 0) + 1;
      }

      // Reconciliación: saldo MP vs sumatoria de txs no internas (detecta P2P faltantes)
      let saldoLedger = null;
      let gapSaldo = null;
      try {
        const ledger = await Transacciones.getBalance(bankConnection.cuenta, { estado: 'PAGADO', ledger: 'flujo' });
        saldoLedger = Number(ledger?.balance) || 0;
        // Sin balance OK no hay saldo MP real: calcular el gap contra 0 daría un hueco falso.
        if (balance.ok) {
          const saldoMp = Number(balance.available) || 0;
          gapSaldo = Math.round((saldoMp - saldoLedger) * 100) / 100;
        }
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
      const coberturaBancarias = settlementHasBankOut || transferenciasActivities > 0 || validacionRetiros.validado
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

      // Ancla de saldo real: la brecha contra el ledger a esa fecha delata movimientos faltantes.
      let anclaGap = bankConnection.mercadopago?.diagnostico?.anclaGap || null;
      const ancla = bankConnection.mercadopago?.anclaSaldo;
      if (ancla?.dineroEnCuenta != null && ancla?.fecha) {
        try {
          const calculada = await calcularAnclaGap({
            usuarioId: bankConnection.usuario,
            cuentaId: bankConnection.cuenta,
            ancla: ancla.toObject?.() || ancla
          });
          if (calculada) anclaGap = calculada;
        } catch (error) {
          console.warn('⚠️ No se pudo calcular la brecha del ancla de saldo:', error.message);
        }
      }
      const anclaDesalineada = Boolean(anclaGap && anclaGap.ok === false);

      const syncParcial =
        settlementPending ||
        errores.some((e) => e.tipo === 'settlement_report') ||
        (coberturaP2P === 'VACIA' && gapSaldo != null && Math.abs(gapSaldo) >= 50) ||
        !validacionRetiros.validado ||
        anclaDesalineada;

      let ultimoError = bankConnection.mercadopago?.ultimoErrorSettlement;
      if (!validacionRetiros.validado && !ultimoError) {
        ultimoError = `Salidas a CBU sin validar en este tramo: ${validacionRetiros.motivo || 'sin detalle'}.`;
      }
      if (anclaDesalineada && !ultimoError) {
        ultimoError = `El ledger difiere ${anclaGap.gap} del saldo real anclado al ${new Date(anclaGap.fecha).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}.`;
      }
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

      // El cursor no avanza si el tramo no quedó validado por un reporte de confianza:
      // activities_withdraw ya no "recupera" un tramo, solo el settlement de confianza lo valida.
      const blockCursor =
        historialMode &&
        (settlementPending ||
          errores.some((e) => e.tipo === 'pagos' || e.tipo === 'settlement_report' || e.quotaExceeded));
      const sinMovimientosEnTramo =
        !blockCursor && pagos.length === 0 && movimientosMerged.length === 0;
      const historialGuardado = rememberHistory({
        pendiente: blockCursor,
        cuotaAgotada: errores.some((e) => e.quotaExceeded),
        sinMovimientos: sinMovimientosEnTramo,
      });

      const mpActual = bankConnection.mercadopago?.toObject?.() || bankConnection.mercadopago || {};
      const diagPrev = mpActual.diagnostico || {};
      bankConnection.mercadopago = {
        ...mpActual,
        syncParcial,
        ultimoErrorSettlement: syncParcial ? ultimoError : undefined,
        ...(validacionRetiros.validado ? { coberturaRetiros: validacionRetiros.cobertura } : {}),
        diagnostico: {
          ...(anclaGap ? { anclaGap } : {}),
          retiros:
            validacionRetiros.diagnostico ||
            {
              ...(diagPrev.retiros || {}),
              actualizadoEn: new Date(),
              validado: false,
              motivo: validacionRetiros.motivo || null
            },
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
        historial: historialGuardado,
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
          retiros: validacionRetiros.diagnostico || null,
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
      // activities_withdraw trae bank_account (CVU→CBU); no perderlo aunque settlement ya diga WITHDRAWAL.
      // Un crédito ya firmado (CBU → CVU, neto positivo) no se reetiqueta como retiro.
      if (row.source === 'activities_withdraw') {
        const bankAccount =
          row.raw?.METADATA?.bank_account ||
          row.raw?.BANK_ACCOUNT ||
          row.raw?.bank_account ||
          null;
        const existingType = String(existing.transactionType || '').toUpperCase();
        const existingIsCredit =
          Number(existing.netAmount) > 0 &&
          !['WITHDRAWAL', 'PAYOUT', 'PAYOUTS'].includes(existingType);
        if (
          !existingIsCredit &&
          (
            !existing.transactionType ||
            existing.transactionType === 'SETTLEMENT' ||
            (bankAccount && existing.transactionType !== 'BANK_TRANSFER')
          )
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
    const contactoCache = createContactoSyncCache();

    // MP emite dos payments por una misma suscripción a FCI (orden y liquidación) con igual operation_id.
    const { pagos: pagosUnicos, duplicadosPorCanonico } = deduplicarPagosInversionMp(pagos);

    for (const pago of pagosUnicos) {
      try {
        const comisiones = calcularComisiones(pago);
        const monto = Math.abs(pago.transaction_amount || 0);
        const contraparte = extraerContrapartePago(pago, userId);
        let descripcion = formatearDescripcionPago(pago, userId);
        const isTransfer = esTransferenciaPago(pago);
        const businessBranch = pago.point_of_interaction?.business_info?.branch || null;
        let tipoPago = determinarTipoPago(pago, userId);
        const netReceivedRaw = Number(pago.transaction_details?.net_received_amount);
        const montoNeto =
          tipoPago === 'INGRESO' &&
          pago.transaction_details?.net_received_amount != null &&
          Number.isFinite(netReceivedRaw) &&
          netReceivedRaw >= 0
            ? Math.abs(netReceivedRaw)
            : Math.max(0, monto - comisiones.total);
        const nuevoEstado = mapearEstadoPago(pago.status);
        const economic = clasificarMovimientoEconomicoMp({
          operationType: pago.operation_type,
          description: pago.description,
          paymentMethod: pago.payment_method?.type || pago.payment_method_id,
          paymentMethodType: pago.payment_type_id || pago.payment_method?.type,
          paymentMethodId: pago.payment_method_id,
          businessBranch,
          currency: pago.currency_id,
          counter_currency: pago.counter_currency,
          transaction_amount: pago.transaction_amount,
          exchange_operation: pago.exchange_operation,
          amounts: pago.amounts,
          userIsPayer: String(pago.payer_id ?? pago.payer?.id ?? '') === String(userId),
          point_of_interaction: pago.point_of_interaction,
          metadata: { ...(pago.metadata || {}), businessBranch },
          netAmount: tipoPago === 'INGRESO'
            ? Math.abs(pago.transaction_amount || 0)
            : -Math.abs(pago.transaction_amount || 0)
        });

        if (economic.potName) descripcion = `${descripcion} · desde ${economic.potName}`;
        const investmentOperationId = investmentOperationIdDePago(pago);
        const paymentMeta = {
          potId: economic.potId || null,
          potName: economic.potName || null,
          paymentId: pago.id,
          ...(investmentOperationId ? { investmentOperationId } : {}),
          status: pago.status,
          statusDetail: pago.status_detail,
          paymentMethod: pago.payment_method?.type,
          paymentMethodId: pago.payment_method_id,
          ...camposCuotas(pago),
          operationType: pago.operation_type || null,
          externalReference: pago.external_reference || null,
          ...camposCambioUsd(pago),
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
          counterpartyEmail: contraparte?.email || null,
          businessBranch
        };

        // Solo por id de pago: la referencia externa puede compartirla un pago distinto
        // (p. ej. "Lomitas"), y eso devolvía otra transacción y generaba copias.
        let transaccionExistente = await findTransaccionMp(bankConnection.cuenta, [pago.id]);
        if (transaccionExistente) {
          const propios = idsMp(
            transaccionExistente.origen?.transaccionId,
            transaccionExistente.origen?.metadata?.paymentId
          );
          // La referencia externa a veces la comparten dos pagos distintos.
          if (!propios.includes(String(pago.id))) transaccionExistente = null;
        }
        // Si es una inversión ya guardada bajo el otro paymentId del mismo operation_id, reusarla.
        if (!transaccionExistente && investmentOperationId) {
          transaccionExistente = await Transacciones.findOne({
            cuenta: bankConnection.cuenta,
            'origen.tipo': { $in: MP_ORIGEN_TIPOS },
            'origen.metadata.investmentOperationId': investmentOperationId,
          });
        }
        const extraDupIds = duplicadosPorCanonico.get(String(pago.id)) || [];
        const fxTipo = tipoDeCambioUsd(economic.movementKind);
        if (fxTipo) tipoPago = fxTipo;

        if (transaccionExistente) {
          const prevMeta =
            transaccionExistente.origen?.metadata?.toObject?.() ||
            transaccionExistente.origen?.metadata ||
            {};
          const prevName = prevMeta.counterpartyName;
          const incomingBranch = businessBranch;
          const partition = String(pago.operation_type || '').toLowerCase() === 'partition_transfer';
          const keepDirection =
            !incomingBranch &&
            ((prevMeta.businessBranch && isInversionesMovementKind(prevMeta.movementKind)) ||
              (partition &&
                (transaccionExistente.tipo === 'EGRESO' ||
                  prevMeta.movementKind === 'RESERVE_LOCK')));
          if (keepDirection) {
            const branch =
              prevMeta.businessBranch ||
              (transaccionExistente.tipo === 'EGRESO'
                ? 'AM-to-POT - Partition Transfer'
                : 'POT-to-AM-Partition Transfer');
            const kept = clasificarMovimientoEconomicoMp({
              operationType: pago.operation_type,
              description: pago.description,
              paymentMethod: pago.payment_method?.type || pago.payment_method_id,
              businessBranch: branch,
              metadata: { ...(pago.metadata || {}), businessBranch: branch },
              netAmount: transaccionExistente.tipo === 'EGRESO'
                ? -Math.abs(pago.transaction_amount || 0)
                : Math.abs(pago.transaction_amount || 0)
            });
            Object.assign(economic, kept);
            Object.assign(paymentMeta, {
              movementKind: kept.movementKind,
              statsExclude: kept.statsExclude,
              isInternal: kept.isInternal,
              businessBranch: branch
            });
            tipoPago = transaccionExistente.tipo;
          }
          const keptUsd = conservarClasificacionUsd(prevMeta, {
            ...economic,
            usdAmount: paymentMeta.usdAmount,
            exchangeRate: paymentMeta.exchangeRate,
            exchangeOperation: paymentMeta.exchangeOperation,
            payerCurrency: paymentMeta.payerCurrency,
            collectorCurrency: paymentMeta.collectorCurrency,
          });
          if (keptUsd.movementKind !== economic.movementKind) {
            economic.movementKind = keptUsd.movementKind;
            economic.statsExclude = true;
            economic.isInternal = false;
            economic.label = keptUsd.label;
            Object.assign(paymentMeta, {
              movementKind: keptUsd.movementKind,
              statsExclude: true,
              isInternal: false,
              usdAmount: keptUsd.usdAmount,
              exchangeRate: keptUsd.exchangeRate,
              exchangeOperation: keptUsd.exchangeOperation,
              payerCurrency: keptUsd.payerCurrency,
              collectorCurrency: keptUsd.collectorCurrency,
            });
          }
          const keptCard = conservarClasificacionTarjeta(prevMeta, {
            ...economic,
            installments: paymentMeta.installments,
            installmentAmount: paymentMeta.installmentAmount,
            paymentMethod: paymentMeta.paymentMethod,
            paymentMethodType: paymentMeta.paymentMethodType,
          });
          if (keptCard.movementKind !== economic.movementKind) {
            economic.movementKind = keptCard.movementKind;
            economic.statsExclude = true;
            economic.isInternal = false;
            economic.label = keptCard.label;
            Object.assign(paymentMeta, {
              movementKind: keptCard.movementKind,
              statsExclude: true,
              isInternal: false,
              installments: keptCard.installments,
              installmentAmount: keptCard.installmentAmount,
              paymentMethod: keptCard.paymentMethod,
              paymentMethodType: keptCard.paymentMethodType,
            });
          }
          const keptTipo = tipoDeCambioUsd(economic.movementKind);
          if (keptTipo) tipoPago = keptTipo;
          const prevKind = prevMeta.movementKind;
          const ledgerLabel = economic.isInternal || libroConEtiqueta(economic.movementKind);
          const mergedMetaForContact = { ...prevMeta, ...paymentMeta };
          const senalesContacto = extraerSenalesContraparteMp({
            metadata: mergedMetaForContact,
            descripcion,
            economic,
          });
          let contactoResuelto = null;
          if (!transaccionExistente.contacto && senalesContacto) {
            const resContacto = await resolverOCrearContactoMp({
              usuarioId: bankConnection.usuario,
              senales: senalesContacto,
              cache: contactoCache,
            });
            contactoResuelto = resContacto.contacto;
          } else if (transaccionExistente.contacto && typeof transaccionExistente.contacto === 'object') {
            contactoResuelto = transaccionExistente.contacto;
          }
          const catAutoExistente =
            transaccionExistente.categoria === 'Otro' && !transaccionExistente.categoriaManual
              ? resolverCategoriaDeContacto(contactoResuelto, tipoPago)
              : null;
          const needsContactLink = Boolean(!transaccionExistente.contacto && contactoResuelto);
          const needsAutoCategory = Boolean(catAutoExistente && catAutoExistente !== 'Otro');
          const shouldUpdate =
            needsContactLink ||
            needsAutoCategory ||
            (contraparte?.name && (!prevName || !limpiarNombreContraparte(prevName))) ||
            !prevKind ||
            prevKind !== economic.movementKind ||
            transaccionExistente.tipo !== tipoPago ||
            transaccionExistente.estado !== nuevoEstado ||
            transaccionExistente.montoNeto !== montoNeto ||
            (transaccionExistente.comisiones?.total || 0) !== comisiones.total ||
            (Number(paymentMeta.usdAmount) > 0 &&
              Number(prevMeta.usdAmount) !== Number(paymentMeta.usdAmount)) ||
            (Number(paymentMeta.installments) > 0 &&
              Number(prevMeta.installments) !== Number(paymentMeta.installments)) ||
            (Number(paymentMeta.installmentAmount) > 0 &&
              Number(prevMeta.installmentAmount) !== Number(paymentMeta.installmentAmount)) ||
            (investmentOperationId && prevMeta.investmentOperationId !== investmentOperationId);
          if (shouldUpdate) {
            if (needsContactLink) {
              transaccionExistente.contacto = contactoResuelto._id;
            }
            if (needsAutoCategory) {
              transaccionExistente.categoria = catAutoExistente;
            }
            if (transaccionExistente.tipo !== tipoPago) {
              transaccionExistente.tipo = tipoPago;
            }
            if (transaccionExistente.estado !== nuevoEstado) {
              transaccionExistente.estado = nuevoEstado;
            }
            transaccionExistente.montoNeto = montoNeto;
            transaccionExistente.comisiones = comisiones;
            if (contraparte?.name || ledgerLabel || economic.isTransfer) {
              transaccionExistente.descripcion = ledgerLabel
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
          await dejarUnaSolaMp(bankConnection.cuenta, transaccionExistente, [
            pago.id,
            transaccionExistente.origen?.transaccionId,
            paymentMeta.paymentId,
            ...extraDupIds,
          ]);
          continue;
        }

        const descripcionFinal = economic.isInternal || libroConEtiqueta(economic.movementKind)
          ? `MercadoPago - ${economic.label}`
          : descripcion;

        const senalesContactoNuevo = extraerSenalesContraparteMp({
          metadata: paymentMeta,
          descripcion: descripcionFinal,
          economic,
        });
        const { contacto: contactoNuevo } = senalesContactoNuevo
          ? await resolverOCrearContactoMp({
              usuarioId: bankConnection.usuario,
              senales: senalesContactoNuevo,
              cache: contactoCache,
            })
          : { contacto: null };

        const categoriaFallback = bankConnection.configuracion?.categorizacionAutomatica
          ? this.categorizarTransaccion(descripcionFinal)
          : 'Otro';
        const categoriaFinal =
          resolverCategoriaDeContacto(contactoNuevo, tipoPago) || categoriaFallback;

        const nuevaTransaccion = new Transacciones({
          descripcion: descripcionFinal,
          monto,
          montoNeto,
          fecha: new Date(pago.date_created),
          categoria: categoriaFinal,
          estado: mapearEstadoPago(pago.status),
          tipo: tipoPago,
          usuario: bankConnection.usuario,
          cuenta: bankConnection.cuenta,
          moneda: cuenta.moneda,
          contacto: contactoNuevo?._id || null,
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
            }
          }
        });

        await nuevaTransaccion.save();
        nuevas++;
        await dejarUnaSolaMp(bankConnection.cuenta, nuevaTransaccion, [pago.id, ...extraDupIds]);
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
    const contactoCache = createContactoSyncCache();

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
        const businessBranch =
          mov.payment?.point_of_interaction?.business_info?.branch ||
          mov.businessBranch ||
          null;
        const economic = clasificarMovimientoEconomicoMp({
          ...rowSource,
          transactionType: mov.transactionType,
          operationType: mov.payment?.operation_type || mov.raw?.OPERATION_TYPE,
          exchange_operation: mov.payment?.exchange_operation,
          amounts: mov.payment?.amounts,
          userIsPayer: mov.payment && userId != null
            ? String(mov.payment.payer_id ?? mov.payment.payer?.id ?? '') === String(userId)
            : undefined,
          point_of_interaction: mov.payment?.point_of_interaction,
          description: mov.description || mov.payment?.description || mov.raw?.DESCRIPTION,
          paymentMethod: mov.paymentMethod || mov.payment?.payment_type_id,
          paymentMethodType: mov.paymentMethodType || mov.payment?.payment_type_id || mov.raw?.PAYMENT_METHOD_TYPE,
          paymentMethodId: mov.payment?.payment_method_id || mov.raw?.PAYMENT_METHOD,
          businessBranch,
          currency: mov.payment?.currency_id || mov.currency || mov.raw?.CURRENCY,
          counter_currency: mov.payment?.counter_currency,
          transaction_amount: mov.payment?.transaction_amount ?? mov.amount,
          netAmount: mov.netAmount,
          metadata: {
            ...(mov.raw?.METADATA || mov.payment?.metadata || {}),
            businessBranch
          },
          raw: mov.raw
        });
        const isTransfer =
          economic.isTransfer ||
          esTipoTransferenciaMovimiento(mov.transactionType) ||
          esTransferenciaPago(mov.payment || {});
        let tipoMovimiento = determinarTipoMovimientoMp(mov, userId);
        const fxTipo = tipoDeCambioUsd(economic.movementKind);
        if (fxTipo) tipoMovimiento = fxTipo;

        let descripcion = mov.payment && userId != null && !economic.isInternal
          ? formatearDescripcionPago(mov.payment, userId)
          : formatearDescripcionMovimiento(rowSource);
        if (economic.isInternal || libroConEtiqueta(economic.movementKind)) {
          descripcion = `MercadoPago - ${economic.label}`;
        } else if (economic.isTransfer && !contraparte?.name) {
          descripcion = `MercadoPago - ${economic.label}`;
        }
        if (economic.potName) {
          const base = mov.payment ? formatearDescripcionPago(mov.payment, userId) : economic.label;
          descripcion = `${base} · desde ${economic.potName}`;
        }

        const metadataPatch = {
          transactionType: mov.transactionType,
          description: mov.description || mov.payment?.description || null,
          paymentMethod: mov.paymentMethod || mov.payment?.payment_type_id || null,
          paymentMethodType: mov.paymentMethodType || mov.payment?.payment_type_id || null,
          paymentMethodId: mov.payment?.payment_method_id || null,
          ...camposCuotas(mov.payment),
          operationType: mov.payment?.operation_type || mov.raw?.OPERATION_TYPE || null,
          ...camposCambioUsd({
            ...(mov.payment || {}),
            currency_id: mov.payment?.currency_id || mov.currency || mov.raw?.CURRENCY,
            counter_currency: mov.payment?.counter_currency,
          }),
          paymentId: mov.payment?.id || mov.raw?.payment_id || mov.raw?.reference_id || null,
          externalReference: mov.externalReference || mov.payment?.external_reference || null,
          currency: mov.currency,
          // Pot de la Reserva: nombre si el pago lo trae; si es una transferencia
          // disponible ↔ reserva, el ID del pot viene en externalReference (POTS3_<uuid>_...).
          potId:
            economic.potId ||
            String(mov.externalReference || '').match(/^POTS\d*_([0-9a-f-]{36})_/i)?.[1] ||
            null,
          potName: economic.potName || null,
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
          counterpartyEmail: contraparte?.email || null,
          businessBranch
        };

        const primaryIds = [
          transaccionId,
          mov.payment?.id,
          mov.raw?.payment_id,
          mov.raw?.reference_id,
          mov.raw?.REFERENCE_ID,
          mov.raw?.SOURCE_ID,
        ];
        const hasOperationId = idsOperacionMp(primaryIds).length > 0;
        let transaccionExistente = await findTransaccionMp(
          bankConnection.cuenta,
          hasOperationId
            ? primaryIds
            : [...primaryIds, mov.externalReference, mov.payment?.external_reference]
        );
        if (transaccionExistente && hasOperationId) {
          const propios = idsMp(
            transaccionExistente.origen?.transaccionId,
            transaccionExistente.origen?.metadata?.paymentId
          );
          const buscados = idsMp(primaryIds);
          if (!propios.some((id) => buscados.includes(id))) {
            transaccionExistente = null;
          }
        }

        const monto = Math.abs(mov.amount || mov.netAmount || 0);
        const feeTotal = Math.abs(mov.feeAmount || 0);
        const montoNeto =
          mov.netAmount != null && Number.isFinite(Number(mov.netAmount))
            ? Math.abs(Number(mov.netAmount))
            : Math.max(0, monto - feeTotal);

        if (transaccionExistente) {
          const prevMeta =
            transaccionExistente.origen?.metadata?.toObject?.() ||
            transaccionExistente.origen?.metadata ||
            {};
          const prevName = prevMeta.counterpartyName;
          const keepReserve =
            !businessBranch &&
            prevMeta.businessBranch &&
            isInversionesMovementKind(prevMeta.movementKind);
          const keepReservePayment =
            prevMeta.movementKind === 'RESERVE_PAYMENT' &&
            !mov.payment?.amounts;
          const prevYield =
            prevMeta.movementKind === 'INVESTMENT_YIELD' || prevMeta.movementKind === 'YIELD';
          const sinComercio =
            !limpiarNombreContraparte(metadataPatch.counterpartyName) &&
            !String(metadataPatch.itemTitle || '').trim() &&
            !String(metadataPatch.statementDescriptor || '').trim();
          const keepYield = prevYield && sinComercio && economic.movementKind === 'PAYMENT';
          if (keepReserve) {
            metadataPatch.businessBranch = prevMeta.businessBranch;
            metadataPatch.movementKind = prevMeta.movementKind;
            metadataPatch.statsExclude = prevMeta.statsExclude;
            metadataPatch.isInternal = prevMeta.isInternal;
          } else if (keepReservePayment) {
            metadataPatch.movementKind = 'RESERVE_PAYMENT';
            metadataPatch.statsExclude = false;
            metadataPatch.isInternal = false;
            metadataPatch.potId = metadataPatch.potId || prevMeta.potId || null;
            metadataPatch.potName = metadataPatch.potName || prevMeta.potName || null;
          } else if (keepYield) {
            metadataPatch.movementKind = 'INVESTMENT_YIELD';
            metadataPatch.statsExclude = true;
            metadataPatch.isInternal = false;
            descripcion = 'MercadoPago - Rendimiento';
          }
          const keptUsd = conservarClasificacionUsd(prevMeta, metadataPatch);
          if (keptUsd.movementKind !== metadataPatch.movementKind) {
            metadataPatch.movementKind = keptUsd.movementKind;
            metadataPatch.statsExclude = true;
            metadataPatch.isInternal = false;
            metadataPatch.usdAmount = keptUsd.usdAmount;
            metadataPatch.exchangeRate = keptUsd.exchangeRate;
            metadataPatch.exchangeOperation = keptUsd.exchangeOperation;
            metadataPatch.payerCurrency = keptUsd.payerCurrency;
            metadataPatch.collectorCurrency = keptUsd.collectorCurrency;
            descripcion = `MercadoPago - ${keptUsd.label}`;
            tipoMovimiento = tipoDeCambioUsd(keptUsd.movementKind) || tipoMovimiento;
          }
          const keptCard = conservarClasificacionTarjeta(prevMeta, metadataPatch);
          if (keptCard.movementKind !== metadataPatch.movementKind) {
            metadataPatch.movementKind = keptCard.movementKind;
            metadataPatch.statsExclude = true;
            metadataPatch.isInternal = false;
            metadataPatch.installments = keptCard.installments;
            metadataPatch.installmentAmount = keptCard.installmentAmount;
            metadataPatch.paymentMethod = keptCard.paymentMethod;
            metadataPatch.paymentMethodType = keptCard.paymentMethodType;
          }
          const nextTipo = keepReserve ? transaccionExistente.tipo : tipoMovimiento;
          const nextComisiones = feeTotal > 0
            ? {
                mercadopago: feeTotal,
                financieras: 0,
                envio: 0,
                total: feeTotal
              }
            : transaccionExistente.comisiones;
          const mergedMetaMov = { ...prevMeta, ...metadataPatch };
          const senalesMov = extraerSenalesContraparteMp({
            metadata: mergedMetaMov,
            descripcion,
            economic,
            raw: mov.raw,
          });
          let contactoMov = null;
          if (!transaccionExistente.contacto && senalesMov) {
            const resContacto = await resolverOCrearContactoMp({
              usuarioId: bankConnection.usuario,
              senales: senalesMov,
              cache: contactoCache,
            });
            contactoMov = resContacto.contacto;
          } else if (transaccionExistente.contacto && typeof transaccionExistente.contacto === 'object') {
            contactoMov = transaccionExistente.contacto;
          }
          const catAutoMov =
            transaccionExistente.categoria === 'Otro' && !transaccionExistente.categoriaManual
              ? resolverCategoriaDeContacto(contactoMov, nextTipo)
              : null;
          const needsContactLinkMov = Boolean(!transaccionExistente.contacto && contactoMov);
          const needsAutoCategoryMov = Boolean(catAutoMov && catAutoMov !== 'Otro');
          const shouldEnrich =
            needsContactLinkMov ||
            needsAutoCategoryMov ||
            (contraparte?.name && (!prevName || !limpiarNombreContraparte(prevName))) ||
            (isTransfer && !prevMeta.isTransfer) ||
            prevMeta.movementKind !== metadataPatch.movementKind ||
            (prevMeta.potId || null) !== (metadataPatch.potId || null) ||
            Boolean(prevMeta.statsExclude) !== Boolean(metadataPatch.statsExclude) ||
            transaccionExistente.tipo !== nextTipo ||
            transaccionExistente.montoNeto !== montoNeto ||
            (feeTotal > 0 && (transaccionExistente.comisiones?.total || 0) !== feeTotal) ||
            (Number(metadataPatch.installments) > 0 &&
              Number(prevMeta.installments) !== Number(metadataPatch.installments)) ||
            (Number(metadataPatch.installmentAmount) > 0 &&
              Number(prevMeta.installmentAmount) !== Number(metadataPatch.installmentAmount));

          if (shouldEnrich) {
            if (needsContactLinkMov) {
              transaccionExistente.contacto = contactoMov._id;
            }
            if (needsAutoCategoryMov) {
              transaccionExistente.categoria = catAutoMov;
            }
            if (transaccionExistente.tipo !== nextTipo) {
              transaccionExistente.tipo = nextTipo;
            }
            transaccionExistente.montoNeto = montoNeto;
            if (nextComisiones) {
              transaccionExistente.comisiones = nextComisiones;
            }
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
          await dejarUnaSolaMp(bankConnection.cuenta, transaccionExistente, [
            transaccionId,
            mov.payment?.id,
            mov.raw?.payment_id,
            mov.raw?.reference_id,
            mov.raw?.SOURCE_ID,
            transaccionExistente.origen?.transaccionId,
            transaccionExistente.origen?.metadata?.paymentId,
          ]);
          continue;
        }

        const senalesMovNuevo = extraerSenalesContraparteMp({
          metadata: metadataPatch,
          descripcion,
          economic,
          raw: mov.raw,
        });
        const { contacto: contactoMovNuevo } = senalesMovNuevo
          ? await resolverOCrearContactoMp({
              usuarioId: bankConnection.usuario,
              senales: senalesMovNuevo,
              cache: contactoCache,
            })
          : { contacto: null };

        const categoriaMovFallback = bankConnection.configuracion?.categorizacionAutomatica
          ? this.categorizarTransaccion(descripcion)
          : 'Otro';
        const categoriaMovFinal =
          resolverCategoriaDeContacto(contactoMovNuevo, tipoMovimiento) || categoriaMovFallback;

        const transaccion = new Transacciones({
          descripcion,
          monto,
          montoNeto,
          fecha: new Date(mov.date),
          categoria: categoriaMovFinal,
          estado: 'COMPLETADA',
          tipo: tipoMovimiento,
          usuario: bankConnection.usuario,
          cuenta: bankConnection.cuenta,
          moneda: cuenta.moneda,
          contacto: contactoMovNuevo?._id || null,
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
        await dejarUnaSolaMp(bankConnection.cuenta, transaccion, [
          transaccionId,
          mov.payment?.id,
          mov.raw?.payment_id,
          mov.raw?.reference_id,
          mov.raw?.SOURCE_ID,
        ]);
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

    const userId = this.decrypt(bankConnection.credenciales.userId);
    const reportService = new MercadoPagoReportService({
      accessToken: this.decrypt(bankConnection.credenciales.accessToken),
      userId
    });

    const movimientos = reportService.parseCsvContent(csvContent);
    const result = await this.procesarMovimientosReporte(movimientos, bankConnection, cuenta, userId);

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
  async sincronizarConexion(bankConnection, options = {}) {
    try {
      switch (bankConnection.tipo) {
        case 'PLAID':
          return await this.sincronizarConPlaid(bankConnection);
        case 'OPEN_BANKING':
          return await this.sincronizarConOpenBanking(bankConnection);
        case 'API_DIRECTA':
          return await this.sincronizarConAPIDirecta(bankConnection);
        case 'MERCADOPAGO':
          return await this.sincronizarConMercadoPago(bankConnection, options);
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
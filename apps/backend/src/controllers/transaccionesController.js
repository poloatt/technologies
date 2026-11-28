import { BaseController } from './BaseController.js';
import { Transacciones, Cuentas, Contactos, BankConnection } from '../models/index.js';
import { resumenCoberturaRetiros } from '../services/mercadoPagoRetiros.js';
import mongoose from 'mongoose';
import { arMonthBounds, formatArDateKey, parseArDay } from '../utils/arDate.js';
import { buildEstadoFilter } from '../utils/transaccionEstado.js';
import { addCalendarMonths, arDateKey, cuotaEnRangoClave, expandirCuotas } from '../../../shared/utils/cuotasCredito.js';
import {
  MP_CREDITOS_KINDS,
  MP_EXTERNAL_FUNDING_METHODS,
  MP_FLUJO_EXCLUDED_KINDS,
  SALDOS_YIELD_CUENTA_SOURCE,
  SALDOS_YIELD_INVERSION_SOURCE,
  acumularBucketDolares,
  acumularBucketInversiones,
  calcularSaldosMercadoPago,
  construirPorDiaDolares,
  construirPorDiaInversiones,
  rendimientosDelPeriodo,
  resolverDineroEnCuenta,
  applyMovementKindFilter,
  applyYieldSideFilter,
  buildLedgerMatch,
  buildListLedgerMatch,
  resultadoFci,
} from '../services/mercadoPagoUtils.js';
import {
  ESTRATEGIA_GENERICA,
  calcularSaldosGenericos,
  calcularSaldosGenericosPorMoneda,
  resolverEstrategiaSaldos,
} from '../services/saldos/estrategiasSaldos.js';
import { esCuentaMultimoneda, getEnabledMonedasForUser } from '../services/efectivoAccountService.js';
import {
  CAMPOS_ALTA_MANUAL,
  CAMPOS_EDICION_EXTERNO,
  CAMPOS_EDICION_MANUAL,
  TIPOS_TRANSACCION,
  clampPagination,
  esTransaccionManual,
  normalizarEstadoManual,
  parseFechaManual,
  parseMontoManual,
  pick,
} from '../utils/transaccionManual.js';

const STATS_TZ = 'America/Argentina/Buenos_Aires';

const MSG_CUENTA_MP_MANUAL = 'Las cuentas de Mercado Pago se actualizan solo por sincronización o importación de CSV';

/** Busca la cuenta del usuario. Devuelve `{ cuenta }` o `{ status, message }`. */
async function buscarCuentaDelUsuario(cuentaId, userId) {
  if (!cuentaId || !mongoose.Types.ObjectId.isValid(cuentaId)) {
    return { status: 400, message: 'ID de cuenta inválido' };
  }
  const cuenta = await Cuentas.findOne({ _id: cuentaId, usuario: userId });
  if (!cuenta) {
    return { status: 404, message: 'La cuenta seleccionada no existe o no pertenece al usuario' };
  }
  return { cuenta };
}

/**
 * En cuentas multimoneda la moneda elegida debe estar habilitada para el usuario.
 * Devuelve un mensaje de error o null.
 */
async function validarMonedaMultimoneda(cuenta, monedaId, userId) {
  if (!esCuentaMultimoneda(cuenta) || !monedaId) return null;
  const monedaStr = String(monedaId?._id || monedaId?.id || monedaId);
  if (!mongoose.Types.ObjectId.isValid(monedaStr)) return 'Moneda inválida';
  const habilitadas = await getEnabledMonedasForUser(userId);
  if (!habilitadas.some((m) => m.id === monedaStr)) {
    return 'La moneda no está habilitada para esta cuenta';
  }
  return null;
}

function respuestaError(res, error) {
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Error de validación',
      errors: Object.values(error.errors).map((e) => e.message),
    });
  }
  return res.status(500).json({ message: error.message });
}

/** Aplica un rango inclusivo de días Argentina. Devuelve un mensaje si el rango es inválido. */
function applyFechaRange(query, fechaInicio, fechaFin) {
  if (!fechaInicio && !fechaFin) return null;
  const range = {};
  if (fechaInicio) {
    const inicio = parseArDay(fechaInicio);
    if (!inicio || Number.isNaN(inicio.getTime())) return 'Fecha de inicio inválida';
    range.$gte = inicio;
  }
  if (fechaFin) {
    const fin = parseArDay(fechaFin, true);
    if (!fin || Number.isNaN(fin.getTime())) return 'Fecha de fin inválida';
    range.$lte = fin;
  }
  query.fecha = range;
  return null;
}

function normalizeLedger(raw) {
  if (raw === 'inversiones' || raw === 'dolares' || raw === 'creditos') return raw;
  return 'flujo';
}

/**
 * Una compra de septiembre puede tener cuotas en diciembre. El listado trae
 * las compras cuyo calendario puede pisar el período; la UI deja solo esas cuotas.
 */
function applyCreditosFechaRange(query, fechaInicio, fechaFin) {
  if (!fechaInicio && !fechaFin) return null;
  const range = {};
  if (fechaInicio) {
    const inicio = parseArDay(fechaInicio);
    if (!inicio || Number.isNaN(inicio.getTime())) return 'Fecha de inicio inválida';
    range.$gte = addCalendarMonths(inicio, -36);
  }
  if (fechaFin) {
    const fin = parseArDay(fechaFin, true);
    if (!fin || Number.isNaN(fin.getTime())) return 'Fecha de fin inválida';
    range.$lte = fin;
  }
  query.fecha = range;
  return null;
}

function applyLedgerFechaRange(query, ledger, fechaInicio, fechaFin) {
  if (ledger === 'creditos') return applyCreditosFechaRange(query, fechaInicio, fechaFin);
  return applyFechaRange(query, fechaInicio, fechaFin);
}

function applyCuentaFilter(query, cuenta) {
  if (!cuenta) return null;
  if (!mongoose.Types.ObjectId.isValid(cuenta)) return 'ID de cuenta inválido';
  query.cuenta = new mongoose.Types.ObjectId(cuenta);
  return null;
}

class TransaccionesController extends BaseController {
  constructor() {
    super(Transacciones, {
      searchFields: ['descripcion', 'categoria']
    });

    // Bind de los métodos al contexto de la instancia
    this.getStats = this.getStats.bind(this);
    this.getSaldos = this.getSaldos.bind(this);
    this.getSaldosTotales = this.getSaldosTotales.bind(this);
    this.getBalance = this.getBalance.bind(this);
    this.getByCuenta = this.getByCuenta.bind(this);
    this.create = this.create.bind(this);
    this.updateEstado = this.updateEstado.bind(this);
    this.getResumen = this.getResumen.bind(this);
  }

  async statsCreditos({ query, inicio, fin, estado, cuenta, kindsRaw, ledger }) {
    const widened = {
      ...query,
      fecha: { $gte: addCalendarMonths(inicio, -36), $lte: fin },
    };
    const docs = await this.Model.find(widened).populate('moneda').lean();
    const inicioClave = formatArDateKey(inicio);
    const finClave = formatArDateKey(fin);
    const porMonedaMap = new Map();
    let cuotas = 0;
    // Devoluciones de tarjeta del período: bajan la deuda, no son una cuota nueva.
    const reembolsos = await this.Model.find({
      ...query,
      fecha: { $gte: inicio, $lte: fin },
      'origen.metadata.movementKind': 'REFUND',
      'origen.metadata.paymentMethodType': 'credit_card',
    }).select('monto fecha moneda').populate('moneda').lean();
    const pagado = reembolsos.reduce((acc, doc) => acc + (Number(doc.monto) || 0), 0);

    const pagosResumen = await this.Model.find({
      usuario: query.usuario,
      estado: query.estado,
      fecha: { $gte: inicio, $lte: fin },
      tipo: 'EGRESO',
      'origen.metadata.movementKind': { $nin: ['CARD_PURCHASE', 'RESERVE_LOCK', 'RESERVE_RELEASE'] },
      $or: [
        { descripcion: /\btarjeta\b/i },
        { 'origen.metadata.description': /\btarjeta\b/i },
      ],
    }).select('monto').lean();
    const pagadoResumen = pagosResumen.reduce((acc, doc) => acc + (Number(doc.monto) || 0), 0);
    // El resumen del mes en curso ya está pago. Una cuota cuenta como pagada
    // si su mes es el corriente o uno anterior; los meses siguientes siguen en gastado.
    const mesCorriente = formatArDateKey(new Date()).slice(0, 7);
    let cuotasPagadas = 0;

    const ensureMoneda = (doc) => {
      const monedaDoc = doc.moneda && doc.moneda.codigo ? doc.moneda : null;
      const monedaId = (monedaDoc?._id || doc.moneda)?.toString?.() || 'sin-moneda';
      if (!porMonedaMap.has(monedaId)) {
        porMonedaMap.set(monedaId, {
          monedaId,
          codigo: monedaDoc?.codigo || '—',
          simbolo: monedaDoc?.simbolo || '$',
          color: monedaDoc?.color || '#5C6BC0',
          ingresos: 0,
          egresos: 0,
          cuotas: 0,
          pagado: 0,
          balance: 0,
          dias: new Map(),
        });
      }
      return porMonedaMap.get(monedaId);
    };

    const addDia = (entry, fecha, campo, monto) => {
      if (!fecha || !monto) return;
      if (!entry.dias.has(fecha)) entry.dias.set(fecha, { fecha, ingresos: 0, egresos: 0 });
      entry.dias.get(fecha)[campo] += monto;
    };

    for (const doc of docs) {
      const partes = expandirCuotas({
        fecha: doc.fecha,
        monto: doc.monto,
        installments: doc.origen?.metadata?.installments,
        installmentAmount: doc.origen?.metadata?.installmentAmount,
      }).filter((cuota) => cuotaEnRangoClave(cuota.due, inicioClave, finClave));
      const suma = partes.reduce((acc, cuota) => acc + (Number(cuota.amount) || 0), 0);
      cuotasPagadas += partes.reduce((acc, cuota) => (
        arDateKey(cuota.due).slice(0, 7) <= mesCorriente ? acc + (Number(cuota.amount) || 0) : acc
      ), 0);
      if (!suma) continue;
      cuotas += suma;
      const entry = ensureMoneda(doc);
      entry.egresos += suma;
      entry.cuotas += suma;
      entry.balance -= suma;
      for (const cuota of partes) {
        addDia(entry, arDateKey(cuota.due), 'egresos', Number(cuota.amount) || 0);
      }
    }

    for (const doc of reembolsos) {
      const monto = Number(doc.monto) || 0;
      if (!monto || !doc.fecha) continue;
      const entry = ensureMoneda(doc);
      addDia(entry, formatArDateKey(doc.fecha), 'ingresos', monto);
    }

    const porMoneda = [...porMonedaMap.values()].map(({ dias, ...rest }) => ({
      ...rest,
      porDia: [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    }));
    const porDia = porMoneda.flatMap((m) => m.porDia.map((day) => ({
      monedaId: m.monedaId,
      ...day,
    })));
    const pagadoTotal = pagado + pagadoResumen + cuotasPagadas;
    if (pagadoTotal && porMoneda[0]) porMoneda[0].pagado = pagadoTotal;
    return {
      ingresos: pagadoTotal,
      egresos: cuotas,
      balance: pagadoTotal - cuotas,
      cuotas,
      pagado: pagadoTotal,
      enviado: 0,
      rescatado: 0,
      ingresado: 0,
      rescatadoInversion: 0,
      rendimientos: 0,
      usdVendido: 0,
      usdComprado: 0,
      pesosVenta: 0,
      pesosCompra: 0,
      neto: 0,
      ledger,
      fechaInicio: inicioClave,
      fechaFin: finClave,
      estado,
      cuenta: cuenta || null,
      kinds: kindsRaw || null,
      yieldSide: null,
      porMoneda,
      porDia,
      ingresosMensuales: 0,
      egresosMensuales: cuotas,
      balanceTotal: -cuotas,
    };
  }

  // GET /api/transacciones/stats?fechaInicio&fechaFin&estado&cuenta
  async getStats(req, res) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const {
        fechaInicio,
        fechaFin,
        estado = 'PAGADO',
        cuenta,
        ledger: ledgerRaw,
        kinds: kindsRaw,
        yieldSide,
      } = req.query;
      const ledger = normalizeLedger(ledgerRaw);
      const defaults = arMonthBounds();
      const inicio = fechaInicio ? parseArDay(fechaInicio) : defaults.inicio;
      const fin = fechaFin ? parseArDay(fechaFin, true) : defaults.fin;
      if (!inicio || !fin || Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
        return res.status(400).json({ error: 'Rango de fechas inválido' });
      }

      const query = {
        usuario: new mongoose.Types.ObjectId(req.user.id),
        fecha: { $gte: inicio, $lte: fin },
        ...buildLedgerMatch(ledger),
      };
      if (cuenta) {
        if (!mongoose.Types.ObjectId.isValid(cuenta)) {
          return res.status(400).json({ error: 'ID de cuenta inválido' });
        }
        query.cuenta = new mongoose.Types.ObjectId(cuenta);
      }
      const estadoFilter = buildEstadoFilter(estado);
      if (estadoFilter) query.estado = estadoFilter;
      applyMovementKindFilter(query, ledger, kindsRaw);
      applyYieldSideFilter(query, yieldSide);

      if (ledger === 'creditos') {
        const payload = await this.statsCreditos({
          query, inicio, fin, estado, cuenta, kindsRaw, ledger,
        });
        return res.json(payload);
      }

      const kindPromise = ledger === 'inversiones' || ledger === 'dolares'
        ? this.Model.aggregate([
          { $match: query },
          {
            $group: {
              _id: {
                kind: '$origen.metadata.movementKind',
                tipo: '$tipo',
                moneda: '$moneda',
                fecha: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$fecha',
                    timezone: STATS_TZ,
                  },
                },
                compraventa: { $eq: ['$origen.metadata.compraventa', true] },
                yieldSide: {
                  $cond: [
                    { $in: ['$origen.metadata.movementKind', ['INVESTMENT_YIELD', 'YIELD']] },
                    {
                      $cond: [
                        {
                          $regexMatch: {
                            input: {
                              $concat: [
                                { $ifNull: ['$descripcion', ''] },
                                ' ',
                                { $ifNull: ['$origen.metadata.description', ''] },
                                ' ',
                                { $ifNull: ['$origen.metadata.operationType', ''] },
                              ],
                            },
                            regex: 'asset_management|inversi|\\bfci\\b|investment',
                            options: 'i',
                          },
                        },
                        'inversion',
                        'reserva',
                      ],
                    },
                    null,
                  ],
                },
              },
              total: { $sum: { $ifNull: ['$monto', 0] } },
              usd: {
                $sum: {
                  $convert: {
                    input: '$origen.metadata.usdAmount',
                    to: 'double',
                    onError: 0,
                    onNull: 0,
                  },
                },
              },
              // Cantidad en dólares por fila: usdAmount si existe, si no el monto (las filas USD ya vienen en USD).
              face: {
                $sum: {
                  $let: {
                    vars: {
                      u: {
                        $convert: {
                          input: '$origen.metadata.usdAmount',
                          to: 'double',
                          onError: 0,
                          onNull: 0,
                        },
                      },
                    },
                    in: { $cond: [{ $gt: ['$$u', 0] }, '$$u', { $ifNull: ['$monto', 0] }] },
                  },
                },
              },
            },
          },
        ])
        : Promise.resolve([]);

      const [resultados, dias, kinds] = await Promise.all([
        this.Model.aggregate([
          { $match: query },
          {
            $group: {
              _id: { tipo: '$tipo', moneda: '$moneda' },
              total: { $sum: { $ifNull: ['$monto', 0] } },
            },
          },
          {
            $lookup: {
              from: 'monedas',
              localField: '_id.moneda',
              foreignField: '_id',
              as: 'monedaDoc',
            },
          },
          { $unwind: { path: '$monedaDoc', preserveNullAndEmptyArrays: true } },
        ]),
        this.Model.aggregate([
          { $match: query },
          {
            $group: {
              _id: {
                tipo: '$tipo',
                moneda: '$moneda',
                fecha: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$fecha',
                    timezone: STATS_TZ,
                  },
                },
              },
              total: { $sum: { $ifNull: ['$monto', 0] } },
            },
          },
        ]),
        kindPromise,
      ]);

      let ingresos = 0;
      let egresos = 0;
      const porMonedaMap = new Map();

      const ensureMoneda = (monedaId, monedaDoc) => {
        if (!porMonedaMap.has(monedaId)) {
          porMonedaMap.set(monedaId, {
            monedaId,
            codigo: monedaDoc?.codigo || '—',
            simbolo: monedaDoc?.simbolo || '$',
            color: monedaDoc?.color || '#4CAF50',
            ingresos: 0,
            egresos: 0,
            enviado: 0,
            rescatado: 0,
            ingresado: 0,
            rescatadoInversion: 0,
            rendimientosReserva: 0,
            rendimientosInversion: 0,
            usdVendido: 0,
            usdComprado: 0,
            usdRecibido: 0,
            usdEnviado: 0,
            usdPagado: 0,
            usdRendimientos: 0,
            pesosVenta: 0,
            pesosCompra: 0,
            dias: new Map(),
          });
        }
        return porMonedaMap.get(monedaId);
      };

      for (const row of resultados) {
        const monto = row.total || 0;
        const tipo = row._id?.tipo;
        const monedaId = row._id?.moneda?.toString?.() || row._id?.moneda || 'sin-moneda';

        if (tipo === 'INGRESO') ingresos += monto;
        else if (tipo === 'EGRESO') egresos += monto;

        const entry = ensureMoneda(monedaId, row.monedaDoc);
        if (tipo === 'INGRESO') entry.ingresos += monto;
        else if (tipo === 'EGRESO') entry.egresos += monto;
      }

      for (const row of dias) {
        const monto = row.total || 0;
        const tipo = row._id?.tipo;
        const fecha = row._id?.fecha;
        if (!fecha) continue;
        const monedaId = row._id?.moneda?.toString?.() || row._id?.moneda || 'sin-moneda';
        const entry = ensureMoneda(monedaId);
        if (!entry.dias.has(fecha)) {
          entry.dias.set(fecha, { fecha, ingresos: 0, egresos: 0 });
        }
        const day = entry.dias.get(fecha);
        if (tipo === 'INGRESO') day.ingresos += monto;
        else if (tipo === 'EGRESO') day.egresos += monto;
      }

      let enviado = 0;
      let rescatado = 0;
      let ingresado = 0;
      let rescatadoInversion = 0;
      let rendimientosReserva = 0;
      let rendimientosInversion = 0;
      let usdVendido = 0;
      let usdComprado = 0;
      let usdRecibido = 0;
      let usdEnviado = 0;
      let usdPagado = 0;
      let usdRendimientos = 0;
      let pesosVenta = 0;
      let pesosCompra = 0;
      for (const row of kinds) {
        const monto = row.total || 0;
        const tipo = row._id?.tipo;
        const kind = row._id?.kind;
        const monedaId = row._id?.moneda?.toString?.() || row._id?.moneda || 'sin-moneda';
        const entry = ensureMoneda(monedaId);
        const dolares = acumularBucketDolares(kind, monto, row.usd, row.face, row._id?.compraventa === true);
        entry.usdVendido += dolares.usdVendido || 0;
        entry.usdComprado += dolares.usdComprado || 0;
        entry.usdRecibido += dolares.usdRecibido || 0;
        entry.usdEnviado += dolares.usdEnviado || 0;
        entry.usdPagado += dolares.usdPagado || 0;
        entry.usdRendimientos += dolares.usdRendimientos || 0;
        entry.pesosVenta += dolares.pesosVenta || 0;
        entry.pesosCompra += dolares.pesosCompra || 0;
        usdVendido += dolares.usdVendido || 0;
        usdComprado += dolares.usdComprado || 0;
        usdRecibido += dolares.usdRecibido || 0;
        usdEnviado += dolares.usdEnviado || 0;
        usdPagado += dolares.usdPagado || 0;
        usdRendimientos += dolares.usdRendimientos || 0;
        pesosVenta += dolares.pesosVenta || 0;
        pesosCompra += dolares.pesosCompra || 0;
        const bucket = acumularBucketInversiones(kind, tipo, monto, row._id?.yieldSide);
        entry.enviado += bucket.enviado || 0;
        entry.rescatado += bucket.rescatado || 0;
        entry.ingresado += bucket.ingresado || 0;
        entry.rescatadoInversion += bucket.rescatadoInversion || 0;
        entry.rendimientosReserva += bucket.rendimientosReserva || 0;
        entry.rendimientosInversion += bucket.rendimientosInversion || 0;
        enviado += bucket.enviado || 0;
        rescatado += bucket.rescatado || 0;
        ingresado += bucket.ingresado || 0;
        rescatadoInversion += bucket.rescatadoInversion || 0;
        rendimientosReserva += bucket.rendimientosReserva || 0;
        rendimientosInversion += bucket.rendimientosInversion || 0;
      }
      const rendimientos = rendimientosReserva + rendimientosInversion;

      const porDiaUsd = ledger === 'dolares' ? construirPorDiaDolares(kinds) : [];
      const porDiaInversiones = ledger === 'inversiones' ? construirPorDiaInversiones(kinds) : null;

      const porMoneda = [...porMonedaMap.values()]
        .map((m) => {
          const porDia = ledger === 'inversiones'
            ? (porDiaInversiones?.[m.monedaId] || [])
            : [...m.dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
          const neto = resultadoFci(m);
          return {
            monedaId: m.monedaId,
            codigo: m.codigo,
            simbolo: m.simbolo,
            color: m.color,
            ingresos: m.ingresos,
            egresos: m.egresos,
            balance: ledger === 'inversiones' ? neto : m.ingresos - m.egresos,
            enviado: m.enviado,
            rescatado: m.rescatado,
            ingresado: m.ingresado,
            rescatadoInversion: m.rescatadoInversion,
            rendimientosReserva: m.rendimientosReserva,
            rendimientosInversion: m.rendimientosInversion,
            usdVendido: m.usdVendido,
            usdComprado: m.usdComprado,
            usdRecibido: m.usdRecibido,
            usdEnviado: m.usdEnviado,
            usdPagado: m.usdPagado,
            usdRendimientos: m.usdRendimientos,
            pesosVenta: m.pesosVenta,
            pesosCompra: m.pesosCompra,
            rendimientos: (m.rendimientosReserva || 0) + (m.rendimientosInversion || 0),
            neto,
            porDia,
          };
        })
        .sort((a, b) => (b.ingresos + b.egresos) - (a.ingresos + a.egresos));

      const porDia = porMoneda.flatMap((m) => m.porDia.map((day) => ({
        monedaId: m.monedaId,
        ...day,
      })));

      const netoInversiones = resultadoFci({
        enviado,
        rescatado,
        ingresado,
        rescatadoInversion,
        rendimientosReserva,
        rendimientosInversion,
      });
      res.json({
        ingresos,
        egresos,
        balance: ledger === 'inversiones' ? netoInversiones : ingresos - egresos,
        enviado,
        rescatado,
        ingresado,
        rescatadoInversion,
        rendimientos,
        usdVendido,
        usdComprado,
        usdRecibido,
        usdEnviado,
        usdPagado,
        usdRendimientos,
        pesosVenta,
        pesosCompra,
        neto: netoInversiones,
        ledger,
        fechaInicio: formatArDateKey(inicio),
        fechaFin: formatArDateKey(fin),
        estado,
        cuenta: cuenta || null,
        kinds: kindsRaw || null,
        yieldSide: yieldSide || null,
        porMoneda,
        porDia,
        porDiaUsd,
        // Compatibilidad con consumidores antiguos
        ingresosMensuales: ingresos,
        egresosMensuales: egresos,
        balanceTotal: ingresos - egresos,
      });
    } catch (error) {
      console.error('Error en getStats transacciones:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Deuda de tarjeta pendiente al cierre de `asOf` (o hoy): cuotas de todas las
   * compras hasta esa fecha cuyo mes todavía no cerró (el mes de corte se da por pagado).
   */
  async saldoCreditoPendiente({ usuario, estadoFilter, cuenta, asOf = null }) {
    const hoy = new Date();
    const corte = asOf && !Number.isNaN(asOf.getTime()) && asOf.getTime() < hoy.getTime()
      ? asOf
      : hoy;
    const query = {
      usuario,
      fecha: { $gte: addCalendarMonths(corte, -60), $lte: corte },
      'origen.metadata.movementKind': { $in: [...MP_CREDITOS_KINDS] },
    };
    if (estadoFilter) query.estado = estadoFilter;
    if (cuenta) query.cuenta = cuenta;
    const docs = await this.Model.find(query).select('fecha monto origen.metadata').lean();
    const mesCorte = formatArDateKey(corte).slice(0, 7);
    let pendiente = 0;
    for (const doc of docs) {
      const cuotas = expandirCuotas({
        fecha: doc.fecha,
        monto: doc.monto,
        installments: doc.origen?.metadata?.installments,
        installmentAmount: doc.origen?.metadata?.installmentAmount,
      });
      for (const cuota of cuotas) {
        if (arDateKey(cuota.due).slice(0, 7) > mesCorte) pendiente += Number(cuota.amount) || 0;
      }
    }
    return Math.round(pendiente * 100) / 100;
  }

  // GET /api/transacciones/saldos?cuenta&fechaInicio&fechaFin
  // Saldos acumulados de la cuenta Mercado Pago al cierre del período (<= fechaFin):
  // dinero en cuenta, reservado, invertido, rendimientos, dólares y deuda de crédito.
  async getSaldos(req, res) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }
      const { fechaInicio, fechaFin } = req.query;
      const usuario = new mongoose.Types.ObjectId(req.user.id);
      const estadoFilter = buildEstadoFilter('PAGADO');
      const query = { usuario };
      if (estadoFilter) query.estado = estadoFilter;

      // Los saldos son fotos de stock al cierre del período (<= fechaFin):
      // cortar por fechaInicio perdería depósitos anteriores y generaría saldos negativos falsos.
      const fechaError = applyFechaRange(query, null, fechaFin);
      if (fechaError) return res.status(400).json({ error: fechaError });
      const fechaCorte = fechaFin ? parseArDay(fechaFin, true) : null;
      // Inicio del período: solo marca filas para `rendimientosPeriodo`, no recorta los saldos.
      const inicioPeriodo = fechaInicio ? parseArDay(fechaInicio) : null;
      if (fechaInicio && !inicioPeriodo) {
        return res.status(400).json({ error: 'Fecha de inicio inválida' });
      }

      let cuentaId = null;
      if (req.query.cuenta) {
        if (!mongoose.Types.ObjectId.isValid(req.query.cuenta)) {
          return res.status(400).json({ error: 'ID de cuenta inválido' });
        }
        cuentaId = new mongoose.Types.ObjectId(req.query.cuenta);
      }

      const cuentaMp = await Cuentas.findOne(
        cuentaId ? { _id: cuentaId, usuario } : { usuario, tipo: 'MERCADO_PAGO' },
      ).lean();
      if (!cuentaId && cuentaMp?._id) {
        cuentaId = cuentaMp._id;
      }
      if (cuentaId) {
        query.cuenta = cuentaId;
      }
      const monedaPesosId = cuentaMp?.moneda?._id ?? cuentaMp?.moneda ?? null;

      // Cuentas que no son Mercado Pago: saldo y flujo con ingresos/egresos de la cuenta.
      if (resolverEstrategiaSaldos(cuentaMp?.tipo) === ESTRATEGIA_GENERICA) {
        const filasGenericas = await this.Model.aggregate([
          { $match: query },
          {
            $group: {
              _id: {
                tipo: '$tipo',
                moneda: '$moneda',
                enPeriodo: inicioPeriodo ? { $gte: ['$fecha', inicioPeriodo] } : { $literal: true },
              },
              total: { $sum: { $ifNull: ['$monto', 0] } },
            },
          },
        ]);
        // Multimoneda (p. ej. Efectivo): un saldo por moneda, sin sumar monedas distintas.
        // Los campos de nivel superior son solo los de la moneda principal.
        const multimoneda = esCuentaMultimoneda(cuentaMp);
        let porMoneda = [];
        if (multimoneda) {
          const habilitadas = await getEnabledMonedasForUser(req.user.id);
          porMoneda = calcularSaldosGenericosPorMoneda(filasGenericas, {
            monedasIds: habilitadas.map((moneda) => moneda.id),
          });
        }
        const monedaCuenta = monedaPesosId
          ? String(monedaPesosId)
          : (porMoneda[0]?.monedaId ?? null);
        // Sin moneda principal no hay nada que informar arriba: evita sumar todas las monedas.
        const saldosGenericos = multimoneda && !monedaCuenta
          ? calcularSaldosGenericos([])
          : calcularSaldosGenericos(filasGenericas, { monedaId: monedaCuenta });
        return res.json({
          ...saldosGenericos,
          multimoneda,
          porMoneda,
          dineroEnCuentaLedger: saldosGenericos.dineroEnCuenta,
          dineroEnCuentaFuente: 'ledger',
          dineroEnCuentaActualizadoEn: null,
          tipo: cuentaMp.tipo,
          fechaInicio: fechaInicio || null,
          fechaFin: fechaFin || null,
          cuenta: { id: cuentaMp._id, nombre: cuentaMp.nombre },
          monedaId: monedaCuenta,
        });
      }

      const kindField = '$origen.metadata.movementKind';
      const usdAmount = {
        $convert: { input: '$origen.metadata.usdAmount', to: 'double', onError: 0, onNull: 0 },
      };
      // Neto real de cuenta (descuenta comisiones/retenciones); fallback a monto - comisiones.
      const montoEfectivo = {
        $cond: [
          { $in: [{ $type: '$montoNeto' }, ['double', 'int', 'long', 'decimal']] },
          { $abs: '$montoNeto' },
          {
            $max: [
              0,
              {
                $subtract: [
                  { $abs: { $ifNull: ['$monto', 0] } },
                  { $abs: { $ifNull: ['$comisiones.total', 0] } },
                ],
              },
            ],
          },
        ],
      };
      const textoRendimiento = {
        $concat: [
          { $ifNull: ['$descripcion', ''] },
          ' ',
          { $ifNull: ['$origen.metadata.description', ''] },
          ' ',
          { $ifNull: ['$origen.metadata.operationType', ''] },
        ],
      };
      // Egresos pagados con medios externos (débito bancario, Rapipago/PagoFácil, validaciones)
      // no salen del dinero en cuenta de Mercado Pago.
      const esEgresoExterno = {
        $and: [
          { $eq: ['$tipo', 'EGRESO'] },
          {
            $or: [
              { $eq: [{ $toLower: { $ifNull: ['$origen.metadata.operationType', ''] } }, 'card_validation'] },
              { $in: [{ $toLower: { $ifNull: ['$origen.metadata.paymentMethodType', ''] } }, [...MP_EXTERNAL_FUNDING_METHODS]] },
              { $in: [{ $toLower: { $ifNull: ['$origen.metadata.paymentMethodId', ''] } }, [...MP_EXTERNAL_FUNDING_METHODS]] },
              { $in: [{ $toLower: { $ifNull: ['$origen.metadata.paymentMethod', ''] } }, [...MP_EXTERNAL_FUNDING_METHODS]] },
            ],
          },
        ],
      };
      // Un retiro cancelado devuelve la plata al dinero en cuenta aunque tenga statsExclude.
      const esWithdrawalCancel = {
        $eq: [{ $toUpper: { $ifNull: ['$origen.metadata.transactionType', ''] } }, 'WITHDRAWAL_CANCEL'],
      };
      const esFlujo = {
        $or: [
          esWithdrawalCancel,
          {
            $and: [
              { $ne: ['$origen.metadata.statsExclude', true] },
              { $ne: ['$origen.metadata.isInternal', true] },
              { $not: [{ $in: [kindField, [...MP_FLUJO_EXCLUDED_KINDS]] }] },
              { $not: [esEgresoExterno] },
            ],
          },
        ],
      };

      const creditoPromise = this.saldoCreditoPendiente({
        usuario,
        estadoFilter,
        cuenta: cuentaId,
        asOf: fechaCorte,
      }).then((pendiente) => -pendiente);

      const [rows, creditoSaldo] = await Promise.all([
        this.Model.aggregate([
          { $match: query },
          {
            $group: {
              _id: {
                kind: kindField,
                tipo: '$tipo',
                moneda: '$moneda',
                compraventa: { $eq: ['$origen.metadata.compraventa', true] },
                flujo: esFlujo,
                enPeriodo: inicioPeriodo ? { $gte: ['$fecha', inicioPeriodo] } : { $literal: true },
                side: {
                  $switch: {
                    branches: [
                      {
                        case: { $regexMatch: { input: textoRendimiento, regex: SALDOS_YIELD_INVERSION_SOURCE, options: 'i' } },
                        then: 'inversion',
                      },
                      {
                        case: { $regexMatch: { input: textoRendimiento, regex: SALDOS_YIELD_CUENTA_SOURCE, options: 'i' } },
                        then: 'cuenta',
                      },
                    ],
                    default: 'reserva',
                  },
                },
              },
              total: { $sum: montoEfectivo },
              usd: { $sum: usdAmount },
              face: {
                $sum: {
                  $let: {
                    vars: { u: usdAmount },
                    in: { $cond: [{ $gt: ['$$u', 0] }, '$$u', montoEfectivo] },
                  },
                },
              },
            },
          },
        ]),
        creditoPromise,
      ]);

      const saldos = calcularSaldosMercadoPago(rows, { monedaPesosId });

      // "Dinero en cuenta" debe ser el saldo real de MP cuando se puede leer.
      // El ledger solo lo reconstruye y falla si faltan movimientos (p. ej. CBU).
      // El saldo real vale para el período actual (fechaFin hoy o sin fecha) y si es reciente.
      const dineroEnCuenta = resolverDineroEnCuenta({
        cuenta: cuentaMp,
        ledger: saldos.dineroEnCuenta,
        fechaCorte,
      });

      // Salidas a CBU del período (siempre incluidas en el flujo) + qué parte del historial
      // tiene esas salidas validadas. No se ocultan números: el aviso acompaña a los saldos.
      let salidasBancarias = null;
      let cobertura = null;
      if (cuentaId) {
        try {
          const matchSalidas = {
            ...query,
            tipo: 'EGRESO',
            'origen.metadata.movementKind': 'EXTERNAL_TRANSFER',
          };
          if (inicioPeriodo) matchSalidas.fecha = { ...(query.fecha || {}), $gte: inicioPeriodo };
          const [salidas] = await this.Model.aggregate([
            { $match: matchSalidas },
            { $group: { _id: null, total: { $sum: montoEfectivo }, cantidad: { $sum: 1 } } },
          ]);
          salidasBancarias = {
            total: Math.round((salidas?.total || 0) * 100) / 100,
            cantidad: salidas?.cantidad || 0,
          };
          const conexionMp = await BankConnection.findOne({
            cuenta: cuentaId,
            usuario,
            tipo: 'MERCADOPAGO',
          })
            .select({ mercadopago: 1 })
            .lean();
          if (conexionMp) cobertura = resumenCoberturaRetiros(conexionMp.mercadopago || {});
        } catch (error) {
          console.warn('No se pudo calcular cobertura de salidas a CBU:', error.message);
        }
      }

      res.json({
        ...saldos,
        salidasBancarias,
        cobertura,
        dineroEnCuenta: dineroEnCuenta.valor,
        dineroEnCuentaLedger: dineroEnCuenta.ledger,
        dineroEnCuentaFuente: dineroEnCuenta.fuente,
        dineroEnCuentaActualizadoEn: dineroEnCuenta.actualizadoEn,
        rendimientosPeriodo: rendimientosDelPeriodo(rows, { monedaPesosId }),
        credito: creditoSaldo,
        // Sin cuenta, el cálculo legacy es el de Mercado Pago.
        tipo: cuentaMp?.tipo ?? 'MERCADO_PAGO',
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null,
        cuenta: cuentaMp ? { id: cuentaMp._id, nombre: cuentaMp.nombre } : null,
        monedaId: monedaPesosId ? String(monedaPesosId) : null,
      });
    } catch (error) {
      console.error('Error en getSaldos transacciones:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/transacciones/saldos-totales?fechaFin
  // Saldo real por moneda sumando todas las cuentas del usuario (incluido Efectivo) al cierre
  // del período. Mercado Pago aporta dinero en cuenta (saldo real si hay lectura reciente),
  // reservado e invertido en pesos y sus dólares; el crédito (tarjeta) no se resta porque
  // todavía no salió del dinero. Devuelve las monedas habilitadas en el orden del usuario.
  async getSaldosTotales(req, res) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }
      const { fechaFin } = req.query;
      const usuario = new mongoose.Types.ObjectId(req.user.id);
      const [cuentas, monedas] = await Promise.all([
        Cuentas.find({ usuario, activo: { $ne: false } }).lean(),
        getEnabledMonedasForUser(req.user.id),
      ]);
      const usdId = monedas.find((moneda) => String(moneda.codigo).toUpperCase() === 'USD')?.id ?? null;

      const totales = new Map();
      const sumar = (monedaId, valor) => {
        if (!monedaId) return;
        const key = String(monedaId);
        totales.set(key, (totales.get(key) || 0) + (Number(valor) || 0));
      };

      for (const cuenta of cuentas) {
        let status = 200;
        let saldos = null;
        const captura = {
          status(code) { status = code; return captura; },
          json(body) { saldos = body; return captura; },
        };
        await this.getSaldos(
          { user: { id: req.user.id }, query: { cuenta: String(cuenta._id), fechaFin } },
          captura,
        );
        if (status !== 200 || !saldos) {
          if (status === 400) return res.status(400).json(saldos);
          continue;
        }

        if (resolverEstrategiaSaldos(cuenta.tipo) === ESTRATEGIA_GENERICA) {
          if (saldos.multimoneda) {
            for (const item of saldos.porMoneda || []) sumar(item.monedaId, item.dineroEnCuenta);
          } else {
            sumar(saldos.monedaId, saldos.dineroEnCuenta);
          }
        } else {
          sumar(
            saldos.monedaId,
            (saldos.dineroEnCuenta || 0) + (saldos.reservado || 0) + (saldos.invertido || 0),
          );
          sumar(usdId, saldos.dolares);
        }
      }

      const porMoneda = monedas.map((moneda) => ({
        monedaId: moneda.id,
        codigo: moneda.codigo,
        simbolo: moneda.simbolo,
        color: moneda.color,
        balance: Math.round((totales.get(moneda.id) || 0) * 100) / 100,
      }));

      res.json({ fechaFin: fechaFin || null, porMoneda });
    } catch (error) {
      console.error('Error en getSaldosTotales transacciones:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/transacciones/balance/:cuentaId?estado&fechaFin
  getBalance = async (req, res) => {
    try {
      const { estado = 'PAGADO', fechaFin } = req.query;
      const propia = await buscarCuentaDelUsuario(req.params.cuentaId, req.user?.id);
      if (!propia.cuenta) return res.status(propia.status).json({ error: propia.message });
      const balance = await this.Model.getBalance(req.params.cuentaId, { estado, fechaFin });
      res.json(balance);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // GET /api/transacciones/by-cuenta/:cuentaId
  getByCuenta = async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        sort = '-fecha',
        estado,
        tipo,
        categoria,
        fechaInicio,
        fechaFin,
        ledger: ledgerRaw,
        kinds: kindsRaw,
      } = req.query;

      const propia = await buscarCuentaDelUsuario(req.params.cuentaId, req.user?.id);
      if (!propia.cuenta) return res.status(propia.status).json({ error: propia.message });

      const ledger = normalizeLedger(ledgerRaw);
      const query = {
        cuenta: propia.cuenta._id,
        ...buildListLedgerMatch(ledger),
      };
      applyMovementKindFilter(query, ledger, kindsRaw);
      applyYieldSideFilter(query, req.query.yieldSide);

      if (estado) query.estado = buildEstadoFilter(estado);
      if (tipo) query.tipo = tipo;
      if (categoria) query.categoria = categoria;
      const fechaError = applyLedgerFechaRange(query, ledger, fechaInicio, fechaFin);
      if (fechaError) return res.status(400).json({ error: fechaError });

      const options = {
        ...clampPagination({ page, limit }, { defaultLimit: 10, maxLimit: 500 }),
        // Desempate por _id: sin él, fechas iguales se paginan de forma inestable y se repiten filas.
        sort: sort === '-fecha' ? { fecha: -1, _id: -1 } : sort,
        populate: [
          'moneda',
          { path: 'contacto', select: 'nombre tipo categoriaDefault categoriaIngreso categoriaEgreso origen' },
        ]
      };

      const result = await this.Model.paginate(query, options);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Valida id de ruta y devuelve la transacción del usuario (o responde 400/404).
  async buscarPropia(req, res) {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'ID de transacción inválido' });
      return null;
    }
    const transaccion = await this.Model.findOne({ _id: id, usuario: req.user.id });
    if (!transaccion) {
      res.status(404).json({ message: 'Transacción no encontrada' });
      return null;
    }
    return transaccion;
  }

  // GET /api/transacciones/:id
  getById = async (req, res) => {
    try {
      const transaccion = await this.buscarPropia(req, res);
      if (!transaccion) return undefined;
      return res.json(transaccion);
    } catch (error) {
      console.error('Error en getById transacciones:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // POST /api/transacciones
  create = async (req, res) => {
    try {
      const body = req.body || {};

      const propia = await buscarCuentaDelUsuario(body.cuenta, req.user.id);
      if (!propia.cuenta) return res.status(propia.status).json({ message: propia.message });
      const { cuenta } = propia;
      if (cuenta.tipo === 'MERCADO_PAGO') {
        return res.status(400).json({ message: MSG_CUENTA_MP_MANUAL });
      }

      // Solo campos del alta manual: `usuario`, `origen`, comisiones, etc. no vienen del cliente.
      const datos = pick(body, CAMPOS_ALTA_MANUAL);

      if (typeof datos.descripcion !== 'string' || !datos.descripcion.trim()) {
        return res.status(400).json({ message: 'La descripción es obligatoria' });
      }
      if (!TIPOS_TRANSACCION.includes(datos.tipo)) {
        return res.status(400).json({ message: 'El tipo debe ser INGRESO o EGRESO' });
      }

      const monto = parseMontoManual(datos.monto);
      if (monto.error) return res.status(400).json({ message: monto.error });
      datos.monto = monto.value;

      if (datos.fecha !== undefined) {
        const fecha = parseFechaManual(datos.fecha);
        if (fecha.error) return res.status(400).json({ message: fecha.error });
        datos.fecha = fecha.value;
      }

      const estado = normalizarEstadoManual(datos.estado, 'PENDIENTE');
      if (!estado) return res.status(400).json({ message: 'Estado no válido' });
      datos.estado = estado;

      const errorMoneda = await validarMonedaMultimoneda(cuenta, datos.moneda, req.user.id);
      if (errorMoneda) return res.status(400).json({ message: errorMoneda });

      // `moneda` es requerida y la validación corre antes del middleware: se resuelve acá.
      // Cuenta monomoneda: siempre la de la cuenta. Multimoneda: la elegida (ya validada) o la principal.
      const monedaCuenta = cuenta.moneda?._id || cuenta.moneda;
      if (!esCuentaMultimoneda(cuenta) || !datos.moneda) {
        if (monedaCuenta) datos.moneda = monedaCuenta;
        else delete datos.moneda;
      }

      if (datos.contacto !== undefined) {
        if (!datos.contacto) {
          datos.contacto = null;
        } else {
          const contactoId = String(datos.contacto?._id || datos.contacto?.id || datos.contacto);
          if (!mongoose.Types.ObjectId.isValid(contactoId)) {
            return res.status(400).json({ message: 'ID de contacto inválido' });
          }
          const contactoValido = await Contactos.findOne({ _id: contactoId, usuario: req.user.id }).select('_id');
          if (!contactoValido) {
            return res.status(404).json({ message: 'Contacto no encontrado' });
          }
          datos.contacto = contactoValido._id;
        }
      }

      // El middleware respeta la moneda en cuentas multimoneda y asigna la de la cuenta en las demás.
      const transaccion = new this.Model({
        ...datos,
        categoriaManual: Boolean(datos.categoria),
        origen: { tipo: 'MANUAL' },
        usuario: req.user.id,
        cuenta: cuenta._id,
      });

      await transaccion.save();
      await transaccion.populate([
        'moneda',
        'cuenta',
        { path: 'contacto', select: 'nombre tipo categoriaDefault categoriaIngreso categoriaEgreso origen' },
      ]);

      return res.status(201).json(transaccion);
    } catch (error) {
      console.error('Error al crear transacción:', error);
      return respuestaError(res, error);
    }
  };

  // PUT /api/transacciones/:id
  update = async (req, res) => {
    try {
      const transaccion = await this.buscarPropia(req, res);
      if (!transaccion) return undefined;

      const body = req.body || {};

      // Movimientos sincronizados (Mercado Pago, bancos): solo se permite recategorizar o vincular contacto.
      if (!esTransaccionManual(transaccion)) {
        const permitidos = new Set(CAMPOS_EDICION_EXTERNO);
        const extra = Object.keys(body).filter((key) => !permitidos.has(key));
        if (extra.length > 0 || (body.categoria === undefined && body.contacto === undefined)) {
          return res.status(403).json({
            message: 'Los movimientos sincronizados solo permiten cambiar la categoría o el contacto',
          });
        }
        const patch = {};
        if (body.categoria !== undefined) {
          patch.categoria = body.categoria;
          patch.categoriaManual = true;
        }
        if (body.contacto !== undefined) {
          if (!body.contacto) {
            patch.contacto = null;
          } else {
            const contactoId = String(body.contacto?._id || body.contacto?.id || body.contacto);
            if (!mongoose.Types.ObjectId.isValid(contactoId)) {
              return res.status(400).json({ message: 'ID de contacto inválido' });
            }
            const contactoValido = await Contactos.findOne({ _id: contactoId, usuario: req.user.id }).select('_id');
            if (!contactoValido) {
              return res.status(404).json({ message: 'Contacto no encontrado' });
            }
            patch.contacto = contactoValido._id;
          }
        }
        transaccion.set(patch);
        await transaccion.save();
        await transaccion.populate([
          'moneda',
          'cuenta',
          { path: 'contacto', select: 'nombre tipo categoriaDefault categoriaIngreso categoriaEgreso origen' },
        ]);
        return res.json(transaccion);
      }

      const datos = pick(body, CAMPOS_EDICION_MANUAL);
      const updates = {};

      if (datos.descripcion !== undefined) {
        if (typeof datos.descripcion !== 'string' || !datos.descripcion.trim()) {
          return res.status(400).json({ message: 'La descripción es obligatoria' });
        }
        updates.descripcion = datos.descripcion;
      }
      if (datos.categoria !== undefined) {
        updates.categoria = datos.categoria;
        updates.categoriaManual = true;
      }
      if (datos.contacto !== undefined) {
        if (!datos.contacto) {
          updates.contacto = null;
        } else {
          const contactoId = String(datos.contacto?._id || datos.contacto?.id || datos.contacto);
          if (!mongoose.Types.ObjectId.isValid(contactoId)) {
            return res.status(400).json({ message: 'ID de contacto inválido' });
          }
          const contactoValido = await Contactos.findOne({ _id: contactoId, usuario: req.user.id }).select('_id');
          if (!contactoValido) {
            return res.status(404).json({ message: 'Contacto no encontrado' });
          }
          updates.contacto = contactoValido._id;
        }
      }
      if (datos.tipo !== undefined) {
        if (!TIPOS_TRANSACCION.includes(datos.tipo)) {
          return res.status(400).json({ message: 'El tipo debe ser INGRESO o EGRESO' });
        }
        updates.tipo = datos.tipo;
      }
      if (datos.monto !== undefined) {
        const monto = parseMontoManual(datos.monto);
        if (monto.error) return res.status(400).json({ message: monto.error });
        updates.monto = monto.value;
      }
      if (datos.fecha !== undefined) {
        const fecha = parseFechaManual(datos.fecha);
        if (fecha.error) return res.status(400).json({ message: fecha.error });
        updates.fecha = fecha.value;
      }
      if (datos.estado !== undefined) {
        const estado = normalizarEstadoManual(datos.estado);
        if (!estado) return res.status(400).json({ message: 'Estado no válido' });
        updates.estado = estado;
      }

      // Cuenta final: la nueva (validada) o la actual. La moneda siempre sale de la cuenta final.
      const cuentaActualId = String(transaccion.cuenta?._id || transaccion.cuenta);
      const cuentaNuevaId = datos.cuenta ? String(datos.cuenta?._id || datos.cuenta?.id || datos.cuenta) : null;
      const cambiaCuenta = Boolean(cuentaNuevaId) && cuentaNuevaId !== cuentaActualId;

      const propia = await buscarCuentaDelUsuario(cambiaCuenta ? cuentaNuevaId : cuentaActualId, req.user.id);
      if (!propia.cuenta) return res.status(propia.status).json({ message: propia.message });
      const cuentaFinal = propia.cuenta;
      if (cambiaCuenta) {
        if (cuentaFinal.tipo === 'MERCADO_PAGO') {
          return res.status(400).json({ message: MSG_CUENTA_MP_MANUAL });
        }
        updates.cuenta = cuentaFinal._id;
      }

      if (esCuentaMultimoneda(cuentaFinal)) {
        const monedaExistente = transaccion.moneda?._id || transaccion.moneda;
        const monedaElegida = datos.moneda ?? (cambiaCuenta ? null : monedaExistente);
        if (monedaElegida) {
          const errorMoneda = await validarMonedaMultimoneda(cuentaFinal, monedaElegida, req.user.id);
          if (errorMoneda) return res.status(400).json({ message: errorMoneda });
          updates.moneda = monedaElegida?._id || monedaElegida?.id || monedaElegida;
        } else if (cuentaFinal.moneda?._id) {
          updates.moneda = cuentaFinal.moneda._id;
        }
      } else if (cuentaFinal.moneda?._id) {
        updates.moneda = cuentaFinal.moneda._id;
      }

      transaccion.set(updates);
      // save() (no findByIdAndUpdate) para que corran validaciones y el middleware de moneda.
      await transaccion.save();
      await transaccion.populate([
        'moneda',
        'cuenta',
        { path: 'contacto', select: 'nombre tipo categoriaDefault categoriaIngreso categoriaEgreso origen' },
      ]);

      return res.json(transaccion);
    } catch (error) {
      console.error('Error al actualizar transacción:', error);
      return respuestaError(res, error);
    }
  };

  // DELETE /api/transacciones/:id
  delete = async (req, res) => {
    try {
      const transaccion = await this.buscarPropia(req, res);
      if (!transaccion) return undefined;

      if (!esTransaccionManual(transaccion)) {
        return res.status(403).json({
          message: 'Los movimientos sincronizados no se pueden eliminar. Se corrigen en el próximo sync.',
        });
      }

      await this.Model.deleteOne({ _id: transaccion._id });
      return res.json({ message: 'Transacción eliminada correctamente' });
    } catch (error) {
      console.error('Error al eliminar transacción:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // PATCH /api/transacciones/:id/estado
  updateEstado = async (req, res) => {
    try {
      const estado = normalizarEstadoManual(req.body?.estado, null);
      if (!estado) {
        return res.status(400).json({ message: 'Estado no válido' });
      }

      const transaccion = await this.buscarPropia(req, res);
      if (!transaccion) return undefined;

      if (!esTransaccionManual(transaccion)) {
        return res.status(403).json({
          message: 'El estado de los movimientos sincronizados lo define la fuente',
        });
      }

      transaccion.estado = estado;
      await transaccion.save();
      await transaccion.populate(['moneda', 'cuenta']);
      return res.json(transaccion);
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      return respuestaError(res, error);
    }
  };

  // GET /api/transacciones/resumen
  getResumen = async (req, res) => {
    try {
      const { fechaInicio, fechaFin } = req.query;
      // En aggregate Mongoose no castea: el usuario debe ser ObjectId.
      const query = {
        usuario: new mongoose.Types.ObjectId(req.user.id),
        ...buildLedgerMatch('flujo'),
      };
      const estadoFilter = buildEstadoFilter('PAGADO');
      if (estadoFilter) query.estado = estadoFilter;

      const fechaError = applyFechaRange(query, fechaInicio, fechaFin);
      if (fechaError) return res.status(400).json({ error: fechaError });

      const resumen = await this.Model.aggregate([
        { $match: query },
        { $group: {
          _id: {
            tipo: '$tipo',
            categoria: '$categoria',
            moneda: '$moneda'
          },
          total: { $sum: '$monto' },
          cantidad: { $sum: 1 }
        }},
        { $group: {
          _id: '$_id.moneda',
          categorias: {
            $push: {
              tipo: '$_id.tipo',
              categoria: '$_id.categoria',
              total: '$total',
              cantidad: '$cantidad'
            }
          }
        }},
        { $lookup: {
          from: 'monedas',
          localField: '_id',
          foreignField: '_id',
          as: 'moneda'
        }},
        { $unwind: '$moneda' }
      ]);

      res.json(resumen);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Sobrescribimos el método getAll del BaseController
  getAll = async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        sort = '-fecha',
        estado,
        tipo,
        categoria,
        fechaInicio,
        fechaFin,
        cuenta,
        contacto,
        ledger: ledgerRaw,
        kinds: kindsRaw,
        yieldSide,
      } = req.query;

      const ledger = normalizeLedger(ledgerRaw);
      const query = {
        usuario: req.user.id,
        ...buildListLedgerMatch(ledger),
      };
      applyMovementKindFilter(query, ledger, kindsRaw);
      applyYieldSideFilter(query, yieldSide);

      if (estado) query.estado = buildEstadoFilter(estado);
      if (tipo) query.tipo = tipo;
      if (categoria) query.categoria = categoria;
      if (contacto) {
        if (!mongoose.Types.ObjectId.isValid(contacto)) {
          return res.status(400).json({ error: 'ID de contacto inválido' });
        }
        query.contacto = new mongoose.Types.ObjectId(contacto);
      }
      const fechaError = applyLedgerFechaRange(query, ledger, fechaInicio, fechaFin);
      if (fechaError) return res.status(400).json({ error: fechaError });
      const cuentaError = applyCuentaFilter(query, cuenta);
      if (cuentaError) return res.status(400).json({ error: cuentaError });

      const options = {
        ...clampPagination({ page, limit }, { defaultLimit: 10, maxLimit: 200 }),
        // Desempate por _id: sin él, fechas iguales se paginan de forma inestable y se repiten filas.
        sort: sort === '-fecha' ? { fecha: -1, _id: -1 } : sort,
        populate: [
          'moneda',
          'cuenta',
          { path: 'contacto', select: 'nombre tipo categoriaDefault categoriaIngreso categoriaEgreso origen' },
        ],
        lean: true, // Para mejor rendimiento
        leanWithId: true, // Agrega 'id' además de '_id'
      };

      const result = await this.Model.paginate(query, options);
      
      // Transformar los IDs en la respuesta
      const transformedDocs = result.docs.map(doc => ({
        ...doc,
        id: doc._id.toString(),
        moneda: doc.moneda ? {
          ...doc.moneda,
          id: doc.moneda._id.toString()
        } : null,
        cuenta: doc.cuenta ? {
          ...doc.cuenta,
          id: doc.cuenta._id.toString()
        } : null,
        contacto: doc.contacto ? {
          ...doc.contacto,
          id: doc.contacto._id.toString()
        } : null
      }));

      res.json({
        ...result,
        docs: transformedDocs
      });
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({ error: error.message });
    }
  };
}

export const transaccionesController = new TransaccionesController(); 
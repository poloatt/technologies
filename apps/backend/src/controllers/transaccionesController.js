import { BaseController } from './BaseController.js';
import { Transacciones, Cuentas } from '../models/index.js';
import mongoose from 'mongoose';
import { arMonthBounds, formatArDateKey, parseArDay } from '../utils/arDate.js';
import { buildEstadoFilter } from '../utils/transaccionEstado.js';
import { addCalendarMonths, arDateKey, cuotaEnRangoClave, expandirCuotas } from '../../../shared/utils/cuotasCredito.js';
import {
  MP_CREDITOS_KINDS,
  MP_FLUJO_EXCLUDED_KINDS,
  SALDOS_YIELD_INVERSION_SOURCE,
  SALDOS_YIELD_RESERVA_SOURCE,
  acumularBucketDolares,
  acumularBucketInversiones,
  calcularSaldosMercadoPago,
  applyMovementKindFilter,
  applyYieldSideFilter,
  buildLedgerMatch,
  buildListLedgerMatch,
  resultadoFci,
} from '../services/mercadoPagoUtils.js';

const STATS_TZ = 'America/Argentina/Buenos_Aires';

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
    }).select('monto').lean();
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
          porDia: [],
        });
      }
      const entry = porMonedaMap.get(monedaId);
      entry.egresos += suma;
      entry.cuotas += suma;
      entry.balance -= suma;
    }

    const porMoneda = [...porMonedaMap.values()];
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
      porMoneda,
      porDia: [],
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

      const { fechaInicio, fechaFin, estado = 'PAGADO', cuenta, ledger: ledgerRaw, kinds: kindsRaw } = req.query;
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

      const porMoneda = [...porMonedaMap.values()]
        .map((m) => {
          const porDia = [...m.dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
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
        porMoneda,
        porDia,
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
   * Deuda de tarjeta pendiente: cuotas de todas las compras cuyo mes ya pasó el
   * mes corriente (el resumen del mes en curso se da por pagado).
   */
  async saldoCreditoPendiente({ usuario, estadoFilter, cuenta }) {
    const hoy = new Date();
    const query = {
      usuario,
      fecha: { $gte: addCalendarMonths(hoy, -60), $lte: hoy },
      'origen.metadata.movementKind': { $in: [...MP_CREDITOS_KINDS] },
    };
    if (estadoFilter) query.estado = estadoFilter;
    if (cuenta) query.cuenta = cuenta;
    const docs = await this.Model.find(query).select('fecha monto origen.metadata').lean();
    const mesCorriente = formatArDateKey(hoy).slice(0, 7);
    let pendiente = 0;
    for (const doc of docs) {
      const cuotas = expandirCuotas({
        fecha: doc.fecha,
        monto: doc.monto,
        installments: doc.origen?.metadata?.installments,
        installmentAmount: doc.origen?.metadata?.installmentAmount,
      });
      for (const cuota of cuotas) {
        if (arDateKey(cuota.due).slice(0, 7) > mesCorriente) pendiente += Number(cuota.amount) || 0;
      }
    }
    return Math.round(pendiente * 100) / 100;
  }

  // GET /api/transacciones/saldos?cuenta
  // Saldos acumulados de la cuenta Mercado Pago, sin período: dinero en cuenta,
  // reservado, invertido, dólares y crédito pendiente.
  async getSaldos(req, res) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }
      const usuario = new mongoose.Types.ObjectId(req.user.id);
      const estadoFilter = buildEstadoFilter('PAGADO');
      const query = { usuario };
      if (estadoFilter) query.estado = estadoFilter;
      let cuentaId = null;
      if (req.query.cuenta) {
        if (!mongoose.Types.ObjectId.isValid(req.query.cuenta)) {
          return res.status(400).json({ error: 'ID de cuenta inválido' });
        }
        cuentaId = new mongoose.Types.ObjectId(req.query.cuenta);
        query.cuenta = cuentaId;
      }

      const cuentaMp = await Cuentas.findOne(
        cuentaId ? { _id: cuentaId, usuario } : { usuario, tipo: 'MERCADO_PAGO' },
      ).lean();
      const monedaPesosId = cuentaMp?.moneda?._id ?? cuentaMp?.moneda ?? null;

      const kindField = '$origen.metadata.movementKind';
      const usdAmount = {
        $convert: { input: '$origen.metadata.usdAmount', to: 'double', onError: 0, onNull: 0 },
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
      const esFlujo = {
        $and: [
          { $ne: ['$origen.metadata.statsExclude', true] },
          { $ne: ['$origen.metadata.isInternal', true] },
          { $not: [{ $in: [kindField, [...MP_FLUJO_EXCLUDED_KINDS]] }] },
        ],
      };

      const [rows, creditoPendiente] = await Promise.all([
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
                side: {
                  $switch: {
                    branches: [
                      {
                        case: { $regexMatch: { input: textoRendimiento, regex: SALDOS_YIELD_INVERSION_SOURCE, options: 'i' } },
                        then: 'inversion',
                      },
                      {
                        case: { $regexMatch: { input: textoRendimiento, regex: SALDOS_YIELD_RESERVA_SOURCE, options: 'i' } },
                        then: 'reserva',
                      },
                    ],
                    default: 'cuenta',
                  },
                },
              },
              total: { $sum: { $ifNull: ['$monto', 0] } },
              usd: { $sum: usdAmount },
              face: {
                $sum: {
                  $let: {
                    vars: { u: usdAmount },
                    in: { $cond: [{ $gt: ['$$u', 0] }, '$$u', { $ifNull: ['$monto', 0] }] },
                  },
                },
              },
            },
          },
        ]),
        this.saldoCreditoPendiente({ usuario, estadoFilter, cuenta: cuentaId }),
      ]);

      const saldos = calcularSaldosMercadoPago(rows, { monedaPesosId });
      res.json({
        ...saldos,
        // La deuda baja el patrimonio: se informa con signo negativo.
        credito: -creditoPendiente,
        cuenta: cuentaMp ? { id: cuentaMp._id, nombre: cuentaMp.nombre } : null,
        monedaId: monedaPesosId ? String(monedaPesosId) : null,
      });
    } catch (error) {
      console.error('Error en getSaldos transacciones:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/transacciones/balance/:cuentaId?estado&fechaFin
  getBalance = async (req, res) => {
    try {
      const { estado = 'PAGADO', fechaFin } = req.query;
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

      const ledger = normalizeLedger(ledgerRaw);
      const query = {
        cuenta: req.params.cuentaId,
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
        page: parseInt(page),
        limit: parseInt(limit),
        // Desempate por _id: sin él, fechas iguales se paginan de forma inestable y se repiten filas.
        sort: sort === '-fecha' ? { fecha: -1, _id: -1 } : sort,
        populate: ['moneda']
      };

      const result = await this.Model.paginate(query, options);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // POST /api/transacciones
  create = async (req, res) => {
    try {
      console.log('Creando transacción con datos:', req.body);
      
      // Validar que el ID de la cuenta sea válido
      if (!mongoose.Types.ObjectId.isValid(req.body.cuenta)) {
        return res.status(400).json({ message: 'ID de cuenta inválido' });
      }

      // Validar que la cuenta exista y pertenezca al usuario
      const cuenta = await Cuentas.findOne({
        _id: req.body.cuenta,
        usuario: req.user.id
      });

      if (!cuenta) {
        console.error('Cuenta no encontrada:', {
          cuentaId: req.body.cuenta,
          userId: req.user.id
        });
        return res.status(404).json({ message: 'La cuenta seleccionada no existe o no pertenece al usuario' });
      }

      // Crear la transacción - el middleware se encargará de asignar la moneda
      const transaccion = new this.Model({
        ...req.body,
        usuario: req.user.id,
        cuenta: cuenta._id
        // No asignamos moneda aquí - lo hace el middleware
      });

      await transaccion.save();
      await transaccion.populate(['moneda', 'cuenta']);
      
      res.status(201).json(transaccion);
    } catch (error) {
      console.error('Error al crear transacción:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({ 
          message: 'Error de validación', 
          errors: Object.values(error.errors).map(e => e.message)
        });
      }
      res.status(500).json({ message: error.message });
    }
  };

  // PATCH /api/transacciones/:id/estado
  updateEstado = async (req, res) => {
    try {
      const { estado } = req.body;
      
      if (!['PENDIENTE', 'COMPLETADA', 'CANCELADA'].includes(estado)) {
        return res.status(400).json({ message: 'Estado no válido' });
      }

      const transaccion = await this.Model.findOneAndUpdate(
        { _id: req.params.id, usuario: req.user.id },
        { estado },
        { new: true, runValidators: true }
      );

      if (!transaccion) {
        return res.status(404).json({ message: 'Transacción no encontrada' });
      }

      res.json(transaccion);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  // GET /api/transacciones/resumen
  getResumen = async (req, res) => {
    try {
      const { fechaInicio, fechaFin } = req.query;
      const query = { 
        usuario: req.user.id,
        estado: 'COMPLETADA',
        ...buildLedgerMatch('flujo'),
      };

      if (fechaInicio || fechaFin) {
        query.fecha = {};
        if (fechaInicio) query.fecha.$gte = new Date(fechaInicio);
        if (fechaFin) query.fecha.$lte = new Date(fechaFin);
      }

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
      const fechaError = applyLedgerFechaRange(query, ledger, fechaInicio, fechaFin);
      if (fechaError) return res.status(400).json({ error: fechaError });
      const cuentaError = applyCuentaFilter(query, cuenta);
      if (cuentaError) return res.status(400).json({ error: cuentaError });

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        // Desempate por _id: sin él, fechas iguales se paginan de forma inestable y se repiten filas.
        sort: sort === '-fecha' ? { fecha: -1, _id: -1 } : sort,
        populate: ['moneda', 'cuenta'],
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
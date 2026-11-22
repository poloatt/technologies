import { BaseController } from './BaseController.js';
import { Transacciones, Cuentas } from '../models/index.js';
import mongoose from 'mongoose';
import { buildEstadoFilter } from '../utils/transaccionEstado.js';
import {
  acumularBucketInversiones,
  buildLedgerMatch,
  buildListLedgerMatch,
} from '../services/mercadoPagoUtils.js';

const STATS_TZ = 'America/Argentina/Buenos_Aires';

/** YYYY-MM-DD de un instante en el calendario de Argentina. */
function formatArDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STATS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Interpreta un YYYY-MM-DD como día calendario en Argentina.
 * `new Date('YYYY-MM-DD')` es medianoche UTC y corre el rango 3 horas.
 */
function parseArDay(value, endOfDay = false) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
  return new Date(`${match[1]}-${match[2]}-${match[3]}T${time}-03:00`);
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

function applyCuentaFilter(query, cuenta) {
  if (!cuenta) return null;
  if (!mongoose.Types.ObjectId.isValid(cuenta)) return 'ID de cuenta inválido';
  query.cuenta = new mongoose.Types.ObjectId(cuenta);
  return null;
}

function arMonthBounds(now = new Date()) {
  const key = formatArDateKey(now);
  const [year, month] = key.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return {
    inicio: parseArDay(`${year}-${mm}-01`),
    fin: parseArDay(`${year}-${mm}-${String(lastDay).padStart(2, '0')}`, true),
  };
}

class TransaccionesController extends BaseController {
  constructor() {
    super(Transacciones, {
      searchFields: ['descripcion', 'categoria']
    });

    // Bind de los métodos al contexto de la instancia
    this.getStats = this.getStats.bind(this);
    this.getBalance = this.getBalance.bind(this);
    this.getByCuenta = this.getByCuenta.bind(this);
    this.create = this.create.bind(this);
    this.updateEstado = this.updateEstado.bind(this);
    this.getResumen = this.getResumen.bind(this);
  }

  // GET /api/transacciones/stats?fechaInicio&fechaFin&estado&cuenta
  async getStats(req, res) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const { fechaInicio, fechaFin, estado = 'PAGADO', cuenta, ledger: ledgerRaw } = req.query;
      const ledger = ledgerRaw === 'inversiones' ? 'inversiones' : 'flujo';
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

      const kindPromise = ledger === 'inversiones'
        ? this.Model.aggregate([
          { $match: query },
          {
            $group: {
              _id: {
                kind: '$origen.metadata.movementKind',
                tipo: '$tipo',
                moneda: '$moneda',
              },
              total: { $sum: { $ifNull: ['$monto', 0] } },
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
            rendimientos: 0,
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
      let rendimientos = 0;
      for (const row of kinds) {
        const monto = row.total || 0;
        const tipo = row._id?.tipo;
        const kind = row._id?.kind;
        const monedaId = row._id?.moneda?.toString?.() || row._id?.moneda || 'sin-moneda';
        const entry = ensureMoneda(monedaId);
        const bucket = acumularBucketInversiones(kind, tipo, monto);
        entry.enviado += bucket.enviado || 0;
        entry.rescatado += bucket.rescatado || 0;
        entry.rendimientos += bucket.rendimientos || 0;
        enviado += bucket.enviado || 0;
        rescatado += bucket.rescatado || 0;
        rendimientos += bucket.rendimientos || 0;
      }

      const porMoneda = [...porMonedaMap.values()]
        .map((m) => {
          const porDia = [...m.dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
          const neto = m.rescatado + m.rendimientos - m.enviado;
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
            rendimientos: m.rendimientos,
            neto,
            porDia,
          };
        })
        .sort((a, b) => (b.ingresos + b.egresos) - (a.ingresos + a.egresos));

      const porDia = porMoneda.flatMap((m) => m.porDia.map((day) => ({
        monedaId: m.monedaId,
        ...day,
      })));

      const netoInversiones = rescatado + rendimientos - enviado;
      res.json({
        ingresos,
        egresos,
        balance: ledger === 'inversiones' ? netoInversiones : ingresos - egresos,
        enviado,
        rescatado,
        rendimientos,
        neto: netoInversiones,
        ledger,
        fechaInicio: formatArDateKey(inicio),
        fechaFin: formatArDateKey(fin),
        estado,
        cuenta: cuenta || null,
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
      } = req.query;

      const ledger = ledgerRaw === 'inversiones' ? 'inversiones' : 'flujo';
      const query = {
        cuenta: req.params.cuentaId,
        ...buildListLedgerMatch(ledger),
      };

      if (estado) query.estado = buildEstadoFilter(estado);
      if (tipo) query.tipo = tipo;
      if (categoria) query.categoria = categoria;
      const fechaError = applyFechaRange(query, fechaInicio, fechaFin);
      if (fechaError) return res.status(400).json({ error: fechaError });

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
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
      } = req.query;

      const ledger = ledgerRaw === 'inversiones' ? 'inversiones' : 'flujo';
      const query = {
        usuario: req.user.id,
        ...buildListLedgerMatch(ledger),
      };

      if (estado) query.estado = buildEstadoFilter(estado);
      if (tipo) query.tipo = tipo;
      if (categoria) query.categoria = categoria;
      const fechaError = applyFechaRange(query, fechaInicio, fechaFin);
      if (fechaError) return res.status(400).json({ error: fechaError });
      const cuentaError = applyCuentaFilter(query, cuenta);
      if (cuentaError) return res.status(400).json({ error: cuentaError });

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
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
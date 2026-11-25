/**
 * Importador de la actividad de la cuenta en dólares de Mercado Pago.
 *
 * MP no expone la actividad en USD por API (movements/search da 404/403 y el
 * reporte de liquidación sólo trae pesos). La fuente disponible es la pantalla
 * de movimientos de MP, que se puede copiar como texto. Este módulo:
 *
 *  1. parsea ese texto (enlaces a cada movimiento, hora, título, monto con signo
 *     y encabezados "<día> de <mes> Saldo del día US$…");
 *  2. clasifica cada movimiento en su tipo de libro dólares;
 *  3. inserta sólo los que no existen, usando el ID de movimiento de MP
 *     (`origen.transaccionId`) como clave de deduplicación.
 *
 * Re-pegar la misma lista no duplica nada.
 */
import {
  MP_MOVEMENT_KINDS,
} from './mercadoPagoUtils.js';

export const USD_ACTIVITY_SOURCE = 'usd_activity_import';
const ORIGEN_TIPO = 'MERCADOPAGO_MOVIMIENTO';
const TZ_OFFSET = '-03:00';

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};
// Sin \b: el texto pegado viene pegado ("24 de noviembreSaldo del día", "HoyDisponible US$…").
const RE_FECHA = new RegExp(`^(\\d{1,2})\\s+de\\s+(${Object.keys(MESES).join('|')})`, 'i');
const RE_HOY = /^hoy/i;
const RE_MOVIMIENTO = /^-?\s*\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)\s*$/;
const RE_HORA = /^(\d{1,2}):(\d{2})$/;
const RE_MONTO = /^([+\-\u2212])\s*US\$\s*([\d.]+(?:,\d{1,2})?)$/;

const normalizar = (texto) => String(texto || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

/** Convierte "2.990" → 2990 y "0,02" → 0.02 (formato argentino). */
export function parsearMontoUsd(texto) {
  const limpio = String(texto || '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Título de MP → kind del libro dólares. null si no se reconoce (no se inventa). */
export function clasificarMovimientoUsd(titulo) {
  const t = normalizar(titulo);
  if (/^rendimientos?\b/.test(t)) return MP_MOVEMENT_KINDS.USD_YIELD;
  if (/^tarjeta de credito/.test(t)) return MP_MOVEMENT_KINDS.USD_PAYMENT;
  if (/^venta de dolar/.test(t)) return MP_MOVEMENT_KINDS.USD_OUT;
  if (/^(devolucion de dinero|cancelacion de venta)/.test(t)) return MP_MOVEMENT_KINDS.USD_IN;
  if (/^transferencia recibida/.test(t)) return MP_MOVEMENT_KINDS.USD_IN;
  return null;
}

/**
 * Lado USD de una compraventa MEP (venta, devolución o cancelación de venta).
 * Su peso ya está en FX_SELL del reporte de pesos, así que el libro dólares no lo suma otra vez.
 */
export function esCompraventaMepUsd(titulo) {
  const t = normalizar(titulo);
  return /venta de dolar|venta mep/.test(t);
}

const ymdDesdeIso = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
};

const fechaYmd = ({ y, m, d }) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Parsea el texto copiado de la pantalla de movimientos en dólares.
 *
 * @param {string} texto  Texto pegado (una línea por dato).
 * @param {object} [opciones]
 * @param {string} [opciones.hoy]  Fecha de "Hoy" en formato YYYY-MM-DD (obligatoria si el texto tiene "Hoy").
 * @returns {{ movimientos: Array<{id, fecha: Date, monto: number, titulo: string, movementKind: string}>,
 *             omitidos: Array<{id: string|null, titulo: string, motivo: string}> }}
 */
export function parsearActividadUsd(texto, { hoy = null } = {}) {
  const hoyYmd = ymdDesdeIso(hoy);
  const lineas = String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const bloques = [];
  let diaActual = null;
  let bloque = null;

  const cerrarBloque = () => {
    if (bloque) bloques.push(bloque);
    bloque = null;
  };

  for (const linea of lineas) {
    const hdr = RE_FECHA.exec(linea);
    if (hdr) {
      cerrarBloque();
      diaActual = { d: Number(hdr[1]), m: MESES[hdr[2].toLowerCase()] };
      continue;
    }
    if (RE_HOY.test(linea)) {
      cerrarBloque();
      if (!hoyYmd) throw new Error('El texto tiene "Hoy": pasá la fecha con la opción hoy (YYYY-MM-DD)');
      diaActual = { d: hoyYmd.d, m: hoyYmd.m, y: hoyYmd.y };
      continue;
    }
    const mov = RE_MOVIMIENTO.exec(linea);
    if (mov) {
      cerrarBloque();
      const idMatch = /\/movements\/([A-Za-z0-9]+)/.exec(mov[2]);
      bloque = { id: idMatch ? idMatch[1] : null, titulo: mov[1].trim(), dia: diaActual, hora: null, monto: null };
      continue;
    }
    if (!bloque) continue;
    const hora = RE_HORA.exec(linea);
    if (hora && bloque.hora === null) {
      bloque.hora = { h: Number(hora[1]), mi: Number(hora[2]) };
      continue;
    }
    const monto = RE_MONTO.exec(linea);
    if (monto && bloque.monto === null) {
      const valor = parsearMontoUsd(monto[2]);
      const signo = monto[1] === '+' ? 1 : -1;
      bloque.monto = valor === null ? null : signo * valor;
    }
  }
  cerrarBloque();

  const movimientos = [];
  const omitidos = [];
  for (const b of bloques) {
    if (!b.id) {
      omitidos.push({ id: null, titulo: b.titulo, motivo: 'sin ID de movimiento en el enlace' });
      continue;
    }
    if (b.monto === null) {
      omitidos.push({ id: b.id, titulo: b.titulo, motivo: 'sin monto en el texto' });
      continue;
    }
    const kind = clasificarMovimientoUsd(b.titulo);
    if (!kind) {
      omitidos.push({ id: b.id, titulo: b.titulo, motivo: 'tipo de movimiento no reconocido' });
      continue;
    }
    if (!b.dia) {
      omitidos.push({ id: b.id, titulo: b.titulo, motivo: 'sin fecha (falta encabezado de día)' });
      continue;
    }
    const hh = b.hora ? b.hora.h : 12;
    const mm = b.hora ? b.hora.mi : 0;
    const dia = b.dia;
    const ymd = { y: dia.y ?? (hoyYmd?.y ?? new Date().getFullYear()), m: dia.m, d: dia.d };
    // Sin año en el encabezado: si el día cae después de "hoy", es del año anterior.
    if (!dia.y && hoyYmd && (ymd.m > hoyYmd.m || (ymd.m === hoyYmd.m && ymd.d > hoyYmd.d))) ymd.y -= 1;
    const hhmm = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    movimientos.push({
      id: b.id,
      fecha: new Date(`${fechaYmd(ymd)}T${hhmm}:00${TZ_OFFSET}`),
      monto: b.monto,
      titulo: b.titulo,
      movementKind: kind,
      compraventa: esCompraventaMepUsd(b.titulo),
    });
  }

  return { movimientos, omitidos };
}

/**
 * Inserta los movimientos que no existen todavía en la cuenta.
 *
 * @param {import('mongodb').Collection} collection  Colección `transacciones` (driver nativo;
 *        evita el hook pre-save de Mongoose que necesita el modelo Cuentas registrado).
 * @param {object} params
 * @param {object} params.cuenta       ObjectId de la cuenta.
 * @param {object} params.usuario      ObjectId del usuario.
 * @param {object} params.conexionId   ObjectId de la conexión MP.
 * @param {Array}  params.movimientos  Salida de parsearActividadUsd().movimientos.
 * @param {boolean} [params.dryRun]
 * @returns {Promise<{insertados: number, yaExistian: number, nuevos: Array, dryRun: boolean}>}
 */
export async function importarActividadUsd(collection, {
  cuenta, usuario, conexionId, movimientos, monedaUsdId = null, dryRun = false,
}) {
  const ids = movimientos.map((m) => m.id);
  const existentes = await collection.find(
    { cuenta, 'origen.tipo': ORIGEN_TIPO, 'origen.transaccionId': { $in: ids } },
    { projection: { 'origen.transaccionId': 1 } }
  ).toArray();
  const yaSet = new Set(existentes.map((x) => x.origen.transaccionId));

  // Categoría se copia de una fila USD existente. La moneda es la de USD (monedaUsdId), no la de la fila de referencia.
  const referencia = await collection.findOne({ cuenta, 'origen.metadata.currencyId': 'USD' });
  if (!referencia && movimientos.length) {
    throw new Error('La cuenta no tiene filas en USD de referencia (categoría)');
  }
  const moneda = monedaUsdId || referencia?.moneda;

  const nuevos = [];
  const vistos = new Set();
  for (const mov of movimientos) {
    if (yaSet.has(mov.id) || vistos.has(mov.id)) continue;
    vistos.add(mov.id);
    nuevos.push(mov);
  }

  if (!dryRun) {
    const ahora = new Date();
    for (const mov of nuevos) {
      await collection.insertOne({
        descripcion: `MercadoPago - ${mov.titulo}`,
        monto: Math.abs(mov.monto),
        montoNeto: Math.abs(mov.monto),
        fecha: mov.fecha,
        categoria: referencia?.categoria || 'Otro',
        estado: 'COMPLETADA',
        tipo: mov.monto >= 0 ? 'INGRESO' : 'EGRESO',
        usuario,
        cuenta,
        moneda,
        comisiones: { total: 0 },
        origen: {
          tipo: ORIGEN_TIPO,
          conexionId,
          transaccionId: mov.id,
          metadata: {
            movementKind: mov.movementKind,
            currencyId: 'USD',
            statsExclude: false,
            isInternal: false,
            description: mov.titulo,
            compraventa: mov.compraventa,
            source: USD_ACTIVITY_SOURCE,
          },
        },
        createdAt: ahora,
        updatedAt: ahora,
        __v: 0,
      });
    }
  }

  return { insertados: dryRun ? 0 : nuevos.length, yaExistian: yaSet.size, nuevos, dryRun };
}

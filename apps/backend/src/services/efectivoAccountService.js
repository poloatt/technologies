import mongoose from 'mongoose';
import { Cuentas, Monedas, COLORES_MONEDA } from '../models/index.js';

const DEFAULT_COLOR = COLORES_MONEDA.CELESTE_ARGENTINA;

function toMonedaDto(moneda) {
  if (!moneda) return null;
  const raw = typeof moneda.toJSON === 'function' ? moneda.toJSON() : moneda;
  const id = String(raw.id || raw._id);
  return {
    id,
    _id: id,
    codigo: raw.codigo || '',
    nombre: raw.nombre || '',
    simbolo: raw.simbolo || '$',
    color: raw.color || DEFAULT_COLOR,
    activa: raw.activa !== false,
    orden: raw.orden ?? 0,
  };
}

/**
 * Devuelve las monedas habilitadas (activa: true) configuradas por el usuario
 * (incluyendo monedas globales o sin usuario asignado), respetando el orden.
 */
export async function getEnabledMonedasForUser(userId) {
  const filter = { activa: true };
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    const uid = new mongoose.Types.ObjectId(userId);
    filter.$or = [
      { usuario: uid },
      { usuario: { $exists: false } },
      { usuario: null },
      { esGlobal: true },
    ];
  }

  const docs = await Monedas.find(filter)
    .sort({ orden: 1, codigo: 1 })
    .lean();

  return docs.map(toMonedaDto).filter(Boolean);
}

/**
 * Garantiza de forma idempotente que el usuario tenga su cuenta "Efectivo"
 * por defecto (multimoneda, vinculada a las monedas habilitadas del usuario).
 */
export async function ensureEfectivoAccount(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  const uid = new mongoose.Types.ObjectId(userId);
  const monedasHabilitadas = await getEnabledMonedasForUser(uid);
  const primaryMonedaId = monedasHabilitadas[0]?._id
    ? new mongoose.Types.ObjectId(monedasHabilitadas[0]._id)
    : undefined;

  let cuenta = await Cuentas.findOne({
    usuario: uid,
    esDefault: true,
    tipo: 'EFECTIVO',
  });

  if (!cuenta) {
    // Si el usuario ya tenía una cuenta llamada "Efectivo" de tipo EFECTIVO, promoverla sin duplicar.
    cuenta = await Cuentas.findOne({
      usuario: uid,
      tipo: 'EFECTIVO',
      nombre: /^efectivo$/i,
    });
  }

  if (cuenta) {
    let dirty = false;
    if (!cuenta.esDefault) {
      cuenta.esDefault = true;
      dirty = true;
    }
    if (!cuenta.multimoneda) {
      cuenta.multimoneda = true;
      dirty = true;
    }
    if (!cuenta.activo) {
      cuenta.activo = true;
      dirty = true;
    }

    const currentMonedaId = cuenta.moneda?._id
      ? String(cuenta.moneda._id)
      : (cuenta.moneda ? String(cuenta.moneda) : null);
    const hasValidActivePrimary = currentMonedaId
      && monedasHabilitadas.some((m) => m.id === currentMonedaId);

    if (!hasValidActivePrimary && primaryMonedaId) {
      cuenta.moneda = primaryMonedaId;
      dirty = true;
    }

    if (dirty) {
      await cuenta.save();
    }
    return cuenta;
  }

  cuenta = new Cuentas({
    nombre: 'Efectivo',
    numero: 'EFECTIVO',
    tipo: 'EFECTIVO',
    saldo: 0,
    usuario: uid,
    ...(primaryMonedaId ? { moneda: primaryMonedaId } : {}),
    activo: true,
    esDefault: true,
    multimoneda: true,
  });

  await cuenta.save();
  return cuenta;
}

/**
 * Una cuenta es multimoneda si lo declara o si es la cuenta Efectivo por defecto.
 */
export function esCuentaMultimoneda(cuenta) {
  return Boolean(cuenta?.multimoneda || (cuenta?.esDefault && cuenta?.tipo === 'EFECTIVO'));
}

/**
 * Adjunta el listado de monedas habilitadas (con símbolo y color) a las cuentas multimoneda.
 */
export function attachMonedasToCuentaJson(cuentaDoc, monedasHabilitadas = []) {
  if (!cuentaDoc) return cuentaDoc;
  const obj = typeof cuentaDoc.toJSON === 'function' ? cuentaDoc.toJSON() : { ...cuentaDoc };
  const isMultimoneda = esCuentaMultimoneda(obj);

  if (isMultimoneda) {
    obj.multimoneda = true;
    obj.monedas = monedasHabilitadas;
    if (!obj.moneda && monedasHabilitadas.length > 0) {
      obj.moneda = monedasHabilitadas[0];
    }
  }

  return obj;
}

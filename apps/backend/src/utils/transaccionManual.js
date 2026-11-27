import { parseArDay } from './arDate.js';

/** Tope razonable para un registro manual (evita typos como 1e15). */
export const MONTO_MANUAL_MAX = 1_000_000_000_000;

export const TIPOS_TRANSACCION = ['INGRESO', 'EGRESO'];

/** Campos que el usuario puede enviar al crear un registro manual. */
export const CAMPOS_ALTA_MANUAL = [
  'descripcion',
  'monto',
  'fecha',
  'categoria',
  'estado',
  'tipo',
  'moneda',
  'contrato',
  'contacto',
];

/** Campos editables en un registro manual. */
export const CAMPOS_EDICION_MANUAL = [
  'descripcion',
  'monto',
  'fecha',
  'categoria',
  'estado',
  'tipo',
  'cuenta',
  'moneda',
  'contacto',
];

/** Campos editables en un registro que viene de una fuente externa (Mercado Pago, bancos). */
export const CAMPOS_EDICION_EXTERNO = ['categoria', 'contacto'];

/** Un registro sin `origen.tipo` (legacy) cuenta como manual. */
export function esTransaccionManual(transaccion) {
  const tipo = transaccion?.origen?.tipo;
  return !tipo || tipo === 'MANUAL';
}

/**
 * PAGADO es el vocabulario del front; en base se guarda COMPLETADA.
 * `buildEstadoFilter` sigue leyendo ambos para los registros viejos.
 */
export function normalizarEstadoManual(estado, fallback = 'COMPLETADA') {
  if (estado == null || estado === '') return fallback;
  const value = String(estado).toUpperCase();
  if (value === 'PAGADO' || value === 'COMPLETADA') return 'COMPLETADA';
  if (value === 'PENDIENTE') return 'PENDIENTE';
  if (value === 'CANCELADA' || value === 'CANCELADO') return 'CANCELADA';
  return null;
}

/**
 * Convierte el monto del request a número positivo con 2 decimales.
 * Devuelve `{ value }` o `{ error }`.
 */
export function parseMontoManual(raw) {
  if (raw === '' || raw == null) return { error: 'El monto es obligatorio' };
  const numeric = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(numeric)) return { error: 'El monto no es válido' };
  if (numeric <= 0) return { error: 'El monto debe ser mayor a cero' };
  if (numeric > MONTO_MANUAL_MAX) return { error: 'El monto es demasiado grande' };
  return { value: Math.round(numeric * 100) / 100 };
}

/**
 * `YYYY-MM-DD` se guarda al mediodía de Argentina para que no cambie de día por UTC.
 * Cualquier otro formato (ISO completo) se respeta. Devuelve `{ value }` o `{ error }`.
 */
export function parseFechaManual(raw) {
  if (raw == null || raw === '') return { error: 'La fecha es obligatoria' };
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const dayStart = parseArDay(raw);
    if (!dayStart || Number.isNaN(dayStart.getTime())) return { error: 'La fecha no es válida' };
    return { value: new Date(dayStart.getTime() + 12 * 60 * 60 * 1000) };
  }
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return { error: 'La fecha no es válida' };
  return { value: date };
}

/** Copia solo las claves permitidas. */
export function pick(source = {}, keys = []) {
  const out = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/** Acota `limit` y `page` de los listados. */
export function clampPagination({ page, limit }, { defaultLimit = 10, maxLimit = 200 } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || defaultLimit));
  return { page: pageNum, limit: limitNum };
}

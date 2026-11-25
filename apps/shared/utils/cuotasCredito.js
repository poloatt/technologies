const AR_TZ = 'America/Argentina/Buenos_Aires';

function arParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

/** Día calendario de Argentina, con el día recortado al largo del mes. */
export function arDate(year, month, day) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clamped = Math.min(Math.max(1, day), last);
  const mm = String(month).padStart(2, '0');
  const dd = String(clamped).padStart(2, '0');
  return new Date(`${year}-${mm}-${dd}T12:00:00.000-03:00`);
}

export function addCalendarMonths(value, count) {
  const parts = arParts(value);
  if (!parts) return null;
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1 + count, 1));
  return arDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, parts.day);
}

export function arDateKey(value) {
  const parts = arParts(value);
  if (!parts) return '';
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/**
 * La cuota 1 cae el día de la compra. Las siguientes, el mismo día de los meses
 * que siguen. Si Mercado Pago trae el importe de la cuota, se usa ese; si no,
 * el total se reparte en partes iguales.
 */
export function expandirCuotas({ fecha, monto, installments, installmentAmount } = {}) {
  const parts = arParts(fecha);
  if (!parts) return [];
  const total = Math.abs(Number(monto) || 0);
  const count = Math.max(1, Math.min(60, Math.round(Number(installments) || 1)));
  const given = Number(installmentAmount);
  const hasGiven = Number.isFinite(given) && given > 0;
  const even = Math.round((total / count) * 100) / 100;
  const cuotas = [];
  for (let index = 0; index < count; index += 1) {
    let amount;
    if (hasGiven) amount = Math.round(given * 100) / 100;
    else if (index === count - 1) amount = Math.round((total - even * (count - 1)) * 100) / 100;
    else amount = even;
    const due = addCalendarMonths(fecha, index);
    if (!due || !amount) continue;
    cuotas.push({ index: index + 1, count, due, amount });
  }
  return cuotas;
}

/** `inicio` y `fin` son claves YYYY-MM-DD inclusive, en el calendario de Argentina. */
export function cuotaEnRangoClave(due, inicio, fin) {
  const key = arDateKey(due);
  if (!key) return false;
  if (inicio && key < inicio) return false;
  if (fin && key > fin) return false;
  return true;
}

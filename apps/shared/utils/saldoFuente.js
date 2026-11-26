const AR_TZ = 'America/Argentina/Buenos_Aires';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Clave YYYY-MM-DD del día en Argentina. */
function arDayKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function arHora(date) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: AR_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** "30 sep" a partir de YYYY-MM-DD. */
function diaCorto(key) {
  const [, month, day] = String(key || '').split('-').map(Number);
  if (!day || !month) return '';
  return `${day} ${MESES[month - 1]}`;
}

/**
 * De dónde sale "Dinero en cuenta":
 * - `mercadopago`: "MP · hoy 11:02" o "MP · 25 nov 18:40".
 * - `ledger`: "Estimado al 30 sep" (reconstruido con movimientos, puede no coincidir con MP).
 */
export function formatSaldoFuente(fuente, actualizadoEn, fechaFin, now = new Date()) {
  if (fuente === 'mercadopago' && actualizadoEn) {
    const fecha = new Date(actualizadoEn);
    if (!Number.isNaN(fecha.getTime())) {
      const dia = arDayKey(fecha) === arDayKey(now) ? 'hoy' : diaCorto(arDayKey(fecha));
      return `MP · ${dia} ${arHora(fecha)}`;
    }
  }
  const corte = diaCorto(fechaFin);
  return corte ? `Estimado al ${corte}` : 'Estimado';
}

/** "Saldos hoy" si el período llega a hoy; si no, "Saldos al 30 sep". */
export function formatSaldosCorte(fechaFin, now = new Date()) {
  if (!fechaFin || fechaFin >= arDayKey(now)) return 'Saldos hoy';
  return `Saldos al ${diaCorto(fechaFin)}`;
}

/**
 * Ancla de saldo real de Mercado Pago.
 *
 * La API de balance de MP no responde (403), así que el ledger no tiene una verdad externa
 * continua. Cargar a mano el saldo real de un día da un punto fijo: la diferencia entre ese
 * saldo y lo que reconstruye el ledger a esa fecha delata movimientos faltantes (p. ej. salidas
 * a CBU nunca importadas) sin esperar a que el saldo de hoy se vea mal.
 */

export const ANCLA_TOLERANCIA_DEFAULT = 1000;

export function getAnclaTolerancia(env = process.env) {
  const value = Number(env.MP_ANCLA_TOLERANCIA);
  return Number.isFinite(value) && value >= 0 ? value : ANCLA_TOLERANCIA_DEFAULT;
}

/** Día calendario argentino (YYYY-MM-DD) de una fecha. */
export function diaAr(fecha) {
  // "YYYY-MM-DD" ya es un día calendario: new Date() lo leería como medianoche UTC (día anterior en AR).
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) {
    const d = new Date(`${fecha.trim()}T12:00:00-03:00`);
    return Number.isNaN(d.getTime()) ? null : fecha.trim();
  }
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

/** Valida y normaliza el ancla que llega por API. Devuelve `{ error }` si no sirve. */
export function normalizarAncla(input = {}, { now = new Date() } = {}) {
  const dia = diaAr(input.fecha);
  if (!dia) return { error: 'La fecha del ancla es inválida' };
  if (new Date(`${dia}T00:00:00-03:00`).getTime() > now.getTime()) {
    return { error: 'La fecha del ancla no puede ser futura' };
  }
  const dineroEnCuenta = Number(input.dineroEnCuenta);
  if (!Number.isFinite(dineroEnCuenta)) return { error: 'Indicá el dinero en cuenta real' };
  const opcional = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  };
  const reservado = opcional(input.reservado);
  const invertido = opcional(input.invertido);
  if (Number.isNaN(reservado) || Number.isNaN(invertido)) {
    return { error: 'Reservado e invertido deben ser números' };
  }
  return {
    ancla: {
      fecha: new Date(`${dia}T23:59:59.999-03:00`),
      dineroEnCuenta: Math.round(dineroEnCuenta * 100) / 100,
      ...(reservado !== undefined ? { reservado: Math.round(reservado * 100) / 100 } : {}),
      ...(invertido !== undefined ? { invertido: Math.round(invertido * 100) / 100 } : {}),
      cargadoEn: now
    }
  };
}

/** Brecha entre el saldo real anclado y el ledger a esa fecha. */
export function evaluarAncla(ancla, ledger, { tolerancia = getAnclaTolerancia() } = {}) {
  const real = Number(ancla?.dineroEnCuenta);
  const led = Number(ledger);
  if (!Number.isFinite(real) || !Number.isFinite(led)) return null;
  const gap = Math.round((real - led) * 100) / 100;
  return {
    fecha: ancla.fecha,
    dineroEnCuenta: real,
    ledger: Math.round(led * 100) / 100,
    gap,
    ok: Math.abs(gap) <= tolerancia
  };
}

/**
 * Calcula el ledger "dinero en cuenta" al cierre del día del ancla reutilizando `getSaldos`
 * (misma lógica que ve el usuario) y devuelve la brecha. null si no se puede calcular.
 */
export async function calcularAnclaGap({ usuarioId, cuentaId, ancla, tolerancia } = {}) {
  if (!ancla?.fecha || ancla.dineroEnCuenta == null || !cuentaId || !usuarioId) return null;
  const fechaFin = diaAr(ancla.fecha);
  if (!fechaFin) return null;
  // Import dinámico: el controlador importa servicios, no al revés.
  const { transaccionesController } = await import('../controllers/transaccionesController.js');
  let status = 200;
  let body = null;
  const captura = {
    status(code) {
      status = code;
      return captura;
    },
    json(payload) {
      body = payload;
      return captura;
    }
  };
  await transaccionesController.getSaldos(
    { user: { id: String(usuarioId) }, query: { cuenta: String(cuentaId), fechaFin } },
    captura
  );
  if (status !== 200 || !body) return null;
  const ledger = body.dineroEnCuentaLedger ?? body.dineroEnCuenta;
  return evaluarAncla(ancla, ledger, { tolerancia });
}

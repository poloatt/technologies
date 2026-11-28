/**
 * Salidas CVU→CBU de Mercado Pago (PAYOUTS / WITHDRAWAL): cobertura, confianza y conciliación.
 *
 * Todo acá es puro (sin red ni base): se testea con fixtures.
 *
 * Idea: un rango de fechas solo está "validado" cuando se importó un reporte de confianza
 * (generado con include_withdraw) y todas sus salidas quedaron en el ledger. Los reportes
 * diarios automáticos de MP (`created_from: schedule`) nunca traen retiros y no cuentan.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const RETIRO_TRANSACTION_TYPES = ['WITHDRAWAL', 'WITHDRAWAL_CANCEL', 'PAYOUT', 'PAYOUTS'];

/**
 * Los reportes manuales anteriores a esta fecha salieron sin retiros (medido contra los
 * reportes del 24–27 de nov: 0 de 0 completos antes del 22/11, 100% completos desde el 24/11).
 */
export const RETIROS_TRUSTED_SINCE_DEFAULT = '2026-11-24T00:00:00.000Z';

/** Tolerancia para unir tramos contiguos (los reportes terminan a las 02:59:59Z y el siguiente empieza 03:00:00Z). */
export const COBERTURA_TOLERANCIA_MS = 2000;

/** Largo máximo de un reporte que MP arma sin problemas. */
export const RETIROS_CHUNK_DAYS = 58;

export function esTipoRetiro(transactionType) {
  return RETIRO_TRANSACTION_TYPES.includes(String(transactionType || '').toUpperCase());
}

export function getRetirosTrustedSince(env = process.env) {
  const raw = env?.MP_RETIROS_TRUSTED_SINCE;
  const parsed = raw ? new Date(raw) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  return new Date(RETIROS_TRUSTED_SINCE_DEFAULT);
}

function aMs(value) {
  if (value == null || value === '') return NaN;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/**
 * Un reporte es de confianza si lo generó la app con retiros activados:
 * `manual` y creado desde `trustedSince`, o con id explícitamente confiable.
 * Los `schedule` nunca: MP no les incluye retiros.
 */
export function esReporteConfiable(report, { trustedSince = getRetirosTrustedSince(), trustedIds = [] } = {}) {
  if (!report) return false;
  if ((trustedIds || []).map(String).includes(String(report.id))) return true;
  if (String(report.created_from || '').toLowerCase() !== 'manual') return false;
  const generado = aMs(report.date_created || report.generation_date || report.last_modified);
  const desde = aMs(trustedSince);
  return Number.isFinite(generado) && Number.isFinite(desde) && generado >= desde;
}

/**
 * Une tramos solapados o contiguos. Devuelve ISO ordenados.
 * Metadatos del tramo más reciente en el borde final; `releaseValidado` solo si todos lo tienen.
 */
export function fusionarCobertura(tramos = [], { toleranciaMs = COBERTURA_TOLERANCIA_MS } = {}) {
  const lista = (tramos || [])
    .map((t) => ({ ...t, _b: aMs(t?.beginDate), _e: aMs(t?.endDate) }))
    .filter((t) => Number.isFinite(t._b) && Number.isFinite(t._e) && t._e > t._b)
    .sort((a, b) => a._b - b._b);

  const salida = [];
  for (const t of lista) {
    const ultimo = salida[salida.length - 1];
    if (ultimo && t._b <= ultimo._e + toleranciaMs) {
      ultimo.releaseValidado = Boolean(ultimo.releaseValidado) && Boolean(t.releaseValidado);
      if (t._e > ultimo._e) {
        ultimo._e = t._e;
        ultimo.reportId = t.reportId ?? ultimo.reportId;
        ultimo.fuente = t.fuente ?? ultimo.fuente;
      }
      if (aMs(t.validadoEn) > aMs(ultimo.validadoEn) || !Number.isFinite(aMs(ultimo.validadoEn))) {
        ultimo.validadoEn = t.validadoEn ?? ultimo.validadoEn;
      }
    } else {
      salida.push({ ...t, releaseValidado: Boolean(t.releaseValidado) });
    }
  }
  return salida.map(({ _b, _e, ...resto }) => ({
    ...resto,
    beginDate: new Date(_b).toISOString(),
    endDate: new Date(_e).toISOString(),
  }));
}

/** Suma un tramo validado a la cobertura existente (ya fusionada). */
export function agregarCobertura(cobertura = [], tramo = {}, options = {}) {
  return fusionarCobertura([...(cobertura || []), tramo], options);
}

/** ¿Un único tramo de la cobertura cubre todo `[begin, end]`? */
export function coberturaCubre(cobertura = [], begin, end, {
  toleranciaMs = COBERTURA_TOLERANCIA_MS,
  toleranciaInicioMs = toleranciaMs,
  toleranciaFinMs = toleranciaMs,
} = {}) {
  const b = aMs(begin);
  const e = aMs(end);
  if (!Number.isFinite(b) || !Number.isFinite(e)) return false;
  return fusionarCobertura(cobertura).some(
    (t) => aMs(t.beginDate) <= b + toleranciaInicioMs && aMs(t.endDate) >= e - toleranciaFinMs
  );
}

function formatDia(ms) {
  return new Date(ms).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

/**
 * Rangos de `[desde, hasta]` sin cobertura validada, partidos en partes iguales de hasta
 * `chunkDays`. Ignora huecos menores a `minGapMs` (bordes de reporte). Más reciente primero.
 */
export function tramosSinCobertura(cobertura = [], {
  desde,
  hasta = new Date(),
  chunkDays = RETIROS_CHUNK_DAYS,
  minGapMs = DAY_MS,
} = {}) {
  const inicio = aMs(desde);
  const fin = aMs(hasta);
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) return [];

  const cubiertos = fusionarCobertura(cobertura)
    .map((t) => ({ b: aMs(t.beginDate), e: aMs(t.endDate) }))
    .filter((t) => t.e > inicio && t.b < fin);

  const huecos = [];
  let cursor = inicio;
  for (const t of cubiertos) {
    if (t.b > cursor) huecos.push([cursor, Math.min(t.b, fin)]);
    cursor = Math.max(cursor, t.e);
    if (cursor >= fin) break;
  }
  if (cursor < fin) huecos.push([cursor, fin]);

  const span = Math.max(1, chunkDays) * DAY_MS;
  const tramos = [];
  for (const [b, e] of huecos) {
    if (e - b < minGapMs) continue;
    const partes = Math.ceil((e - b) / span);
    const paso = Math.ceil((e - b) / partes);
    for (let begin = b; begin < e; begin += paso) {
      const end = Math.min(e, begin + paso);
      tramos.push({
        beginDate: new Date(begin).toISOString(),
        endDate: new Date(end).toISOString(),
        mesLabel: `${formatDia(begin)} – ${formatDia(end)}`,
      });
    }
  }
  return tramos.reverse();
}

/**
 * Inicio del reporte de la sync rápida: si la cobertura ya llega hasta casi ahora desde el
 * inicio de la ventana, solo se pide la cola (con un día de solape) en vez de 90 días.
 * Un reporte chico se genera rápido y evita el timeout que dejaba tramos sin retiros.
 */
export function inicioSettlementRapido(cobertura = [], { windowBegin, now = new Date(), solapeMs = DAY_MS } = {}) {
  const b = aMs(windowBegin);
  const n = aMs(now);
  if (!Number.isFinite(b)) return windowBegin;
  const tramo = fusionarCobertura(cobertura).find(
    (t) => aMs(t.beginDate) <= b + COBERTURA_TOLERANCIA_MS && aMs(t.endDate) > b
  );
  if (!tramo) return new Date(b).toISOString();
  const desde = Math.max(b, aMs(tramo.endDate) - solapeMs);
  if (Number.isFinite(n) && desde >= n) return new Date(Math.max(b, n - solapeMs)).toISOString();
  return new Date(desde).toISOString();
}

/** Filas de retiro de un reporte (ya parseado) listas para conciliar. */
export function extraerRetiros(rows = []) {
  return (rows || [])
    .filter((row) => esTipoRetiro(row?.transactionType ?? row?.TRANSACTION_TYPE))
    .map((row) => {
      const type = String(row.transactionType ?? row.TRANSACTION_TYPE).toUpperCase();
      const monto = Math.abs(Number(row.netAmount ?? row.amount ?? 0)) || Math.abs(Number(row.amount ?? 0));
      return {
        id: String(row.sourceId || row.id || ''),
        type,
        cancel: type === 'WITHDRAWAL_CANCEL',
        amount: Math.round(monto * 100) / 100,
        date: row.date || row.TRANSACTION_DATE || null,
      };
    })
    .filter((r) => r.id);
}

export function resumenRetiros(retiros = []) {
  const salidas = (retiros || []).filter((r) => !r.cancel);
  return {
    n: salidas.length,
    monto: Math.round(salidas.reduce((s, r) => s + r.amount, 0) * 100) / 100,
    cancelados: (retiros || []).length - salidas.length,
  };
}

/**
 * Compara los retiros esperados (reporte) con los ids que quedaron en el ledger.
 * `idsEnLedger`: iterable de ids (transaccionId o paymentId) presentes en la base.
 */
export function conciliarRetiros(retiros = [], idsEnLedger = []) {
  const presentes = new Set(Array.from(idsEnLedger || [], String));
  const faltantes = (retiros || []).filter((r) => !presentes.has(String(r.id)));
  const resumen = resumenRetiros(retiros);
  return {
    ok: faltantes.length === 0,
    esperados: (retiros || []).length,
    montoEsperado: resumen.monto,
    conciliados: (retiros || []).length - faltantes.length,
    faltantes: faltantes.map((r) => ({ id: r.id, amount: r.amount, date: r.date, type: r.type })),
  };
}

/** Ventana efectiva validada por un reporte: hasta cuando se generó, nunca más allá de su fin. */
export function ventanaValidada(report, { fallbackBegin, fallbackEnd, now = Date.now() } = {}) {
  const begin = aMs(report?.begin_date) || aMs(fallbackBegin);
  const finReporte = aMs(report?.end_date) || aMs(fallbackEnd);
  const generado = aMs(report?.date_created || report?.generation_date || report?.last_modified);
  const topes = [finReporte, Number.isFinite(generado) ? generado : NaN, Number(now)].filter(Number.isFinite);
  const end = topes.length ? Math.min(...topes) : NaN;
  if (!Number.isFinite(begin) || !Number.isFinite(end) || end <= begin) return null;
  return { beginDate: new Date(begin).toISOString(), endDate: new Date(end).toISOString() };
}

/**
 * Resumen de la cobertura de salidas a CBU para mostrar en reportes (`getSaldos`).
 * `mp`: objeto `bankConnection.mercadopago` (plano). No oculta nada: solo describe qué parte
 * del historial tiene las salidas validadas y qué parte no.
 */
export function resumenCoberturaRetiros(mp = {}, { now = new Date() } = {}) {
  const cobertura = fusionarCobertura(mp?.coberturaRetiros || []);
  const hist = mp?.historial || {};
  const desdeStr = hist.inicioActividad || hist.objetivo || cobertura[0]?.beginDate || null;
  const sinValidar = desdeStr
    ? tramosSinCobertura(cobertura, { desde: desdeStr, hasta: now })
    : [];
  const validadoHasta = cobertura.length ? cobertura[cobertura.length - 1].endDate : null;
  const retiros = mp?.diagnostico?.retiros || null;
  const ancla = mp?.diagnostico?.anclaGap || null;
  const sinCobertura = cobertura.length === 0;
  const completa = !sinCobertura && sinValidar.length === 0 && Boolean(desdeStr);

  const avisos = [];
  if (sinCobertura) {
    avisos.push('Las salidas a CBU todavía no se validaron: corré Sincronizar y luego Histórico.');
  } else if (sinValidar.length) {
    avisos.push(
      `Hay ${sinValidar.length} tramo${sinValidar.length === 1 ? '' : 's'} sin validar (salidas a CBU posiblemente incompletas); el más reciente termina el ${formatDia(aMs(sinValidar[0].endDate))}.`
    );
  }
  if (retiros && retiros.validado === false && retiros.motivo) {
    avisos.push(`Última conciliación fallida: ${retiros.motivo}`);
  }
  if (ancla && ancla.ok === false) {
    avisos.push(
      `El ledger difiere ${ancla.gap} del saldo real cargado al ${formatDia(aMs(ancla.fecha))}.`
    );
  }
  if (mp?.reportePendiente?.beginDate) {
    avisos.push('Hay un reporte de Mercado Pago en generación; se completa en la próxima sincronización.');
  }

  return {
    completa,
    validadoHasta,
    desde: desdeStr,
    tramosSinValidar: sinValidar.slice(0, 12),
    totalTramosSinValidar: sinValidar.length,
    ultimaConciliacion: retiros
      ? {
          actualizadoEn: retiros.actualizadoEn || null,
          validado: retiros.validado ?? null,
          esperados: retiros.esperados ?? null,
          conciliados: retiros.conciliados ?? null,
          faltantes: retiros.faltantes ?? null,
          release: retiros.release || null,
        }
      : null,
    ancla: ancla
      ? { fecha: ancla.fecha, dineroEnCuenta: ancla.dineroEnCuenta, ledger: ancla.ledger, gap: ancla.gap, ok: ancla.ok }
      : null,
    avisos,
    advertencia: avisos.length > 0,
  };
}

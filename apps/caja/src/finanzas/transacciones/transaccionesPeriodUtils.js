/** Cortes de gestión. El id viaja al hook; el label es el de la UI. */
export const YEAR_PRESETS = [
  { id: 'ytd', label: 'YTD', hint: 'Año a la fecha' },
  { id: 'ytg', label: 'YTG', hint: 'Resto del año' },
];

export const QUARTER_PRESETS = [
  { id: 'q1', label: 'Q1', hint: 'Primer trimestre' },
  { id: 'q2', label: 'Q2', hint: 'Segundo trimestre' },
  { id: 'q3', label: 'Q3', hint: 'Tercer trimestre' },
  { id: 'q4', label: 'Q4', hint: 'Cuarto trimestre' },
];

export const PERIOD_PRESETS = [...YEAR_PRESETS, ...QUARTER_PRESETS];

export const DEFAULT_PERIOD_PRESET = 'ytd';

function pad(n) {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD en calendario local, sin pasar por UTC. */
export function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Clave de calendario local para un ISO o Date de transacción. */
export function toLocalDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatDateKey(date);
}

function monthEnd(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0);
}

/** Trimestre calendario 1–4 del año en curso. */
export function getCurrentQuarter(now = new Date()) {
  return Math.floor(now.getMonth() / 3) + 1;
}

function quarterBounds(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(year, startMonth, 1),
    end: monthEnd(year, startMonth + 2),
  };
}

/**
 * Rango inclusivo del preset, en claves YYYY-MM-DD del calendario local.
 * YTD es el año hasta hoy. YTG es desde mañana hasta el 31 de diciembre.
 * Q1–Q4 son el trimestre calendario completo, aunque todavía no haya cerrado.
 */
export function getPeriodRange(preset = DEFAULT_PERIOD_PRESET, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  let start;
  let end;

  switch (preset) {
    case 'ytg': {
      start = new Date(year, month, now.getDate() + 1);
      end = new Date(year, 11, 31);
      if (start > end) {
        start = end;
      }
      break;
    }
    case 'q1':
    case 'q2':
    case 'q3':
    case 'q4': {
      const bounds = quarterBounds(year, Number(preset.slice(1)));
      start = bounds.start;
      end = bounds.end;
      break;
    }
    case 'ytd':
    default:
      start = new Date(year, 0, 1);
      end = now;
      break;
  }

  return {
    fechaInicio: formatDateKey(start),
    fechaFin: formatDateKey(end),
    estado: 'PAGADO',
  };
}

/** Rango del mes calendario actual (YYYY-MM-DD). */
export function getCurrentMonthRange(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  return {
    fechaInicio: formatDateKey(new Date(year, month, 1)),
    fechaFin: formatDateKey(monthEnd(year, month)),
    estado: 'PAGADO',
  };
}

export function getPeriodLabel(preset = DEFAULT_PERIOD_PRESET) {
  return PERIOD_PRESETS.find((item) => item.id === preset)?.label || 'YTD';
}

const SPAN_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "1 ene – 18 nov" para el corte activo. */
export function formatPeriodSpan(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return '';
  const short = (key) => {
    const parts = key.split('-').map(Number);
    const day = parts[2];
    const month = parts[1];
    if (!day || !month) return key;
    return `${day} ${SPAN_MONTHS[month - 1]}`;
  };
  return `${short(fechaInicio)} – ${short(fechaFin)}`;
}

/** Días inclusivos entre dos claves YYYY-MM-DD. */
export function eachDateKey(inicio, fin) {
  if (!inicio || !fin) return [];
  const [ys, ms, ds] = inicio.split('-').map(Number);
  const [ye, me, de] = fin.split('-').map(Number);
  if (![ys, ms, ds, ye, me, de].every(Number.isFinite)) return [];
  const cursor = new Date(ys, ms - 1, ds);
  const end = new Date(ye, me - 1, de);
  const keys = [];
  while (cursor <= end && keys.length < 400) {
    keys.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/**
 * Serie continua de neto diario. Los días sin movimientos quedan en cero
 * para que el spark no salte de un pico al siguiente.
 */
export function fillDailySeries(porDia, fechaInicio, fechaFin) {
  const byDate = new Map((porDia || []).map((day) => [day.fecha, day]));
  return eachDateKey(fechaInicio, fechaFin).map((fecha) => {
    const day = byDate.get(fecha);
    const ingresos = day?.ingresos || 0;
    const egresos = day?.egresos || 0;
    return { fecha, ingresos, egresos, neto: ingresos - egresos };
  });
}

export function formatMonto(monto, simbolo, showValues) {
  if (!showValues) return '****';
  const sign = monto < 0 ? '−' : '';
  const abs = Math.abs(monto).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${sign}${simbolo} ${abs}`;
}

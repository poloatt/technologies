/** Cortes de gestión. El id viaja al hook; el label es el de la UI.
 * YTD/YTG, el mes en curso y Q1–Q4 usan el año calendario local (1 ene–31 dic), no rolling 365 días.
 */
export const YEAR_PRESETS = [
  { id: 'ytd', label: 'YTD', hint: '1 ene → hoy (año calendario)' },
  { id: 'ytg', label: 'YTG', hint: 'Mañana → 31 dic (año calendario)' },
];

export const MONTH_PRESET = {
  id: 'month',
  label: 'Mensual',
  hint: 'Un mes calendario. Las flechas recorren otros meses.',
};

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const QUARTER_PRESETS = [
  { id: 'q1', label: 'Q1', hint: 'Ene–mar (año calendario)' },
  { id: 'q2', label: 'Q2', hint: 'Abr–jun (año calendario)' },
  { id: 'q3', label: 'Q3', hint: 'Jul–sep (año calendario)' },
  { id: 'q4', label: 'Q4', hint: 'Oct–dic (año calendario)' },
];

export const PERIOD_PRESETS = [...YEAR_PRESETS, MONTH_PRESET, ...QUARTER_PRESETS];

export const DEFAULT_PERIOD_PRESET = 'ytd';

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Id de un mes calendario: `month:2026-11`. `month` solo sigue siendo el mes en curso. */
export function monthPresetId(date = new Date()) {
  return `month:${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function parseMonthPreset(preset, now = new Date()) {
  if (preset === 'month') {
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }
  if (typeof preset !== 'string') return null;
  const match = /^month:(\d{4})-(\d{2})$/.exec(preset);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) return null;
  return { year, monthIndex };
}

export function isMonthPreset(preset) {
  return parseMonthPreset(preset) != null;
}

export function shiftMonthPreset(preset, delta, now = new Date()) {
  const parsed = parseMonthPreset(preset, now) ?? {
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  };
  return monthPresetId(new Date(parsed.year, parsed.monthIndex + delta, 1));
}

/** Nombre del mes. El año se agrega solo cuando no es el año en curso. */
export function formatMonthPresetLabel(preset, now = new Date()) {
  const parsed = parseMonthPreset(preset, now);
  if (!parsed) return 'Mensual';
  const name = MONTH_NAMES[parsed.monthIndex];
  if (parsed.year === now.getFullYear()) return name;
  return `${name} ${parsed.year}`;
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
 * Mensual es un mes calendario completo (`month` = el mes en curso, `month:AAAA-MM` = ese mes).
 * Q1–Q4 son el trimestre calendario completo, aunque todavía no haya cerrado.
 */
export function getPeriodRange(preset = DEFAULT_PERIOD_PRESET, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  let start;
  let end;

  const selectedMonth = parseMonthPreset(preset, now);
  if (selectedMonth) {
    start = new Date(selectedMonth.year, selectedMonth.monthIndex, 1);
    end = monthEnd(selectedMonth.year, selectedMonth.monthIndex);
  } else switch (preset) {
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

/**
 * En créditos el mes no se parte. YTD llega al último día del mes en curso
 * e YTG arranca el 1 del mes siguiente, incluyendo cuotas del año que viene.
 */
export function getCreditosPeriodRange(preset = DEFAULT_PERIOD_PRESET, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  if (preset === 'ytd') {
    return {
      fechaInicio: formatDateKey(new Date(year, 0, 1)),
      fechaFin: formatDateKey(monthEnd(year, month)),
      estado: 'PAGADO',
    };
  }
  if (preset === 'ytg') {
    const start = new Date(year, month + 1, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 36, 0);
    return {
      fechaInicio: formatDateKey(start),
      fechaFin: formatDateKey(end),
      estado: 'PAGADO',
    };
  }
  return getPeriodRange(preset, now);
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
  if (isMonthPreset(preset)) return formatMonthPresetLabel(preset);
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

/** YTG de créditos no cierra el 31 de diciembre: sigue con las cuotas posteriores. */
export function formatCreditosPeriodSpan(preset, fechaInicio, fechaFin) {
  if (preset === 'ytg' && fechaInicio) {
    const parts = fechaInicio.split('-').map(Number);
    const day = parts[2];
    const month = parts[1];
    if (day && month) return `${day} ${SPAN_MONTHS[month - 1]} en adelante`;
  }
  return formatPeriodSpan(fechaInicio, fechaFin);
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

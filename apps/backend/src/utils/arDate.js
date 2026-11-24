const STATS_TZ = 'America/Argentina/Buenos_Aires';

/** YYYY-MM-DD de un instante en el calendario de Argentina. */
export function formatArDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STATS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Interpreta un YYYY-MM-DD como día calendario en Argentina.
 * `new Date('YYYY-MM-DD')` es medianoche UTC y deja afuera el día local.
 */
export function parseArDay(value, endOfDay = false) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
  return new Date(`${match[1]}-${match[2]}-${match[3]}T${time}-03:00`);
}

export function arMonthBounds(now = new Date()) {
  const key = formatArDateKey(now);
  const [year, month] = key.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return {
    inicio: parseArDay(`${year}-${mm}-01`),
    fin: parseArDay(`${year}-${mm}-${String(lastDay).padStart(2, '0')}`, true),
  };
}

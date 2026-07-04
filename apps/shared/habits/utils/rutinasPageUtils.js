import { addDays, format, isAfter, startOfDay, subDays } from 'date-fns';
import { es } from '../../utils/localeEs.js';
import { formatDateForAPI, getNormalizedToday, parseAPIDate } from '../../utils/dateUtils.js';
import { calculateCompletionPercentage, calculateVisibleItems } from '../../utils/rutinaCalculations.js';

export { getRutinaDayMode, isRutinaHistorical, isRutinaToday } from '../../utils/rutinaDayMode.js';

export function formatRutinaDayLabel(fecha) {
  if (!fecha) return '';
  try {
    return format(parseAPIDate(fecha), 'EEE d MMM yy', { locale: es });
  } catch {
    return '';
  }
}

export function formatRutinaDaySubtitle({ fecha, percentage }) {
  const dateLabel = formatRutinaDayLabel(fecha);
  const pctLabel = typeof percentage === 'number' ? `${percentage}%` : '—';
  return [dateLabel, pctLabel].filter(Boolean).join(' · ');
}

export function getRutinaCompletionStats(rutina, customHabits = null) {
  if (!rutina) {
    return { percentage: 0, completed: 0, total: 0 };
  }
  const percentage = calculateCompletionPercentage(rutina, customHabits);
  const { visibleItems, completedItems } = calculateVisibleItems(rutina, {}, customHabits);
  return {
    percentage,
    completed: completedItems.length,
    total: visibleItems.length,
  };
}

export function findRutinaByDateStr(rutinas = [], dateStr) {
  if (!dateStr || !Array.isArray(rutinas)) return null;
  return rutinas.find((r) => {
    try {
      return formatDateForAPI(parseAPIDate(r.fecha)) === dateStr;
    } catch {
      return false;
    }
  }) ?? null;
}

export function normalizeRutinaNavigateDate(date) {
  if (!date) return formatDateForAPI(getNormalizedToday());
  try {
    return formatDateForAPI(parseAPIDate(date));
  } catch {
    return formatDateForAPI(getNormalizedToday());
  }
}

function getActiveDateStr({ activeDate, activeRutinaId, rutinas = [] }) {
  if (activeDate) return normalizeRutinaNavigateDate(activeDate);
  if (activeRutinaId) {
    const active = rutinas.find((r) => r._id === activeRutinaId);
    if (active?.fecha) {
      try {
        return formatDateForAPI(parseAPIDate(active.fecha));
      } catch {
        // fall through
      }
    }
  }
  return formatDateForAPI(getNormalizedToday());
}

export function resolveHabitConfigApplyFrom(rutinaOrDate, today = getNormalizedToday()) {
  const fallback = formatDateForAPI(today);
  if (!rutinaOrDate) return fallback;
  const raw = rutinaOrDate?.fecha ?? rutinaOrDate;
  try {
    return formatDateForAPI(parseAPIDate(raw));
  } catch {
    return fallback;
  }
}

export function isForwardConfigScope(scope) {
  const normalized = (scope || 'forward').toString().toLowerCase();
  return normalized === 'forward' || normalized === 'today';
}

export function resolveRutinaNavigateTarget({
  direction,
  date,
  rutinas = [],
  activeRutinaId,
  activeDate,
  today = getNormalizedToday(),
}) {
  const todayStart = startOfDay(today);

  if (direction === 'today' || direction === 'pick') {
    const targetStr = normalizeRutinaNavigateDate(date);
    const cached = findRutinaByDateStr(rutinas, targetStr);
    if (cached?._id) {
      return { type: 'select', rutinaId: cached._id, date: targetStr };
    }
    const targetDay = startOfDay(parseAPIDate(targetStr));
    if (isAfter(targetDay, todayStart)) {
      return { type: 'preview', date: targetStr };
    }
    return { type: 'ensure', date: targetStr };
  }

  if (direction === 'prev' || direction === 'next') {
    const activeStr = getActiveDateStr({ activeDate, activeRutinaId, rutinas });
    const activeDay = startOfDay(parseAPIDate(activeStr));
    const shifted = direction === 'prev' ? subDays(activeDay, 1) : addDays(activeDay, 1);
    const targetStr = formatDateForAPI(shifted);
    const cached = findRutinaByDateStr(rutinas, targetStr);
    if (cached?._id) {
      return { type: 'select', rutinaId: cached._id, date: targetStr };
    }
    if (isAfter(shifted, todayStart)) {
      return { type: 'preview', date: targetStr };
    }
    return { type: 'ensure', date: targetStr };
  }

  return { type: 'noop' };
}

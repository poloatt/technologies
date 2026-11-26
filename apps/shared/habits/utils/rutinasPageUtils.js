import { addDays, format, isAfter, startOfDay, subDays } from 'date-fns';
import { es } from '../../utils/localeEs.js';
import { formatDateForAPI, getNormalizedToday, parseAPIDate } from '../../utils/dateUtils.js';
import { normalizeTimeOfDay, VALID_TIME_OF_DAY } from '../../utils/timeOfDayUtils.js';
import { groupRutinaHabitsByCadence } from '../desktop/rutinaCadenceUtils.js';
import {
  isHabitHorarioCompleted,
  isHabitMarkedCompleteForConfig,
  isHabitValueObject,
} from '../domain/habitCompletionUtils.js';
import { isHabitCompletedOnRutinaDay } from '../desktop/rutinaDesktopUtils.js';
import { isHabitHiddenByDeferral } from './rutinaPostponeUtils.js';
import { getRutinaDayMode } from '../../utils/rutinaDayMode.js';

export {
  getRutinaDayMode,
  isRutinaHistorical,
  isRutinaToday,
  isRutinaFuturePreview,
} from '../../utils/rutinaDayMode.js';

function isDailyCadenceConfig(config = {}) {
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();
  return tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
}

function resolveEffectiveDailyHorarios(config = {}, itemValue) {
  const fromConfig = normalizeTimeOfDay(config?.horarios);
  if (fromConfig.length > 0) return fromConfig;
  if (isHabitValueObject(itemValue)) {
    return VALID_TIME_OF_DAY.filter((h) => Object.prototype.hasOwnProperty.call(itemValue, h));
  }
  return [];
}

/**
 * Ítems/franjas visibles vinculados al día (hoy e histórico).
 * - Cuenta por franja (slot) en hábitos diarios multi-franja.
 * - Excluye hábitos/franjas diferidos (pospuestos, empujados o ignorados).
 * - Excluye cuotas periódicas cumplidas en otros días (doneByQuota).
 */
export function calculateDayLinkedVisibleItems(
  rutina,
  customHabits = null,
  habitsPreferences = {},
  options = {},
) {
  if (!rutina) {
    return { visibleItems: [], completedItems: [], deferredCount: 0 };
  }

  const { customSections = [], allRutinas = [] } = options || {};

  const buckets = groupRutinaHabitsByCadence({
    rutina,
    habits: customHabits,
    habitsPreferences,
    customSections,
    iconsMap: null,
  });

  const visibleItems = [];
  const completedItems = [];
  const seen = new Set();
  let deferredCount = 0;

  buckets.forEach((bucket) => {
    const taggedEntries = [
      ...(bucket.today || []).map((entry) => ({ entry, fromDone: false })),
      ...(bucket.done || []).map((entry) => ({ entry, fromDone: true })),
    ];

    taggedEntries.forEach(({ entry, fromDone }) => {
      const key = `${entry.section}:${entry.itemId}`;
      if (seen.has(key)) return;
      seen.add(key);

      const itemValue = rutina?.[entry.section]?.[entry.itemId];
      const isDaily = isDailyCadenceConfig(entry.config);
      const dailyHorarios = isDaily
        ? resolveEffectiveDailyHorarios(entry.config, itemValue)
        : [];

      const markedOnDay = dailyHorarios.length > 0
        ? dailyHorarios.some((h) => isHabitHorarioCompleted(itemValue, h))
        : isHabitCompletedOnRutinaDay({
          config: entry.config,
          itemValue,
          itemId: entry.itemId,
          section: entry.section,
          rutina,
        });

      // Excluir hábitos en bucket.done cuya cuota se cerró otro día sin marca en esta fecha.
      if (fromDone && !markedOnDay) {
        return;
      }

      if (dailyHorarios.length > 0) {
        dailyHorarios.forEach((franja) => {
          const isCompleted = isHabitHorarioCompleted(itemValue, franja);
          if (
            !isCompleted
            && isHabitHiddenByDeferral({
              rutina,
              section: entry.section,
              itemId: entry.itemId,
              franja,
              allRutinas,
            })
          ) {
            deferredCount += 1;
            return;
          }

          visibleItems.push({
            section: entry.section,
            itemId: entry.itemId,
            franjaKey: franja,
            isCompleted,
          });
          if (isCompleted) {
            completedItems.push({
              section: entry.section,
              itemId: entry.itemId,
              franjaKey: franja,
            });
          }
        });
        return;
      }

      const isCompleted = isHabitMarkedCompleteForConfig(entry.config, itemValue);
      if (
        !isCompleted
        && isHabitHiddenByDeferral({
          rutina,
          section: entry.section,
          itemId: entry.itemId,
          allRutinas,
        })
      ) {
        deferredCount += 1;
        return;
      }

      visibleItems.push({ section: entry.section, itemId: entry.itemId, isCompleted });
      if (isCompleted) {
        completedItems.push({ section: entry.section, itemId: entry.itemId });
      }
    });
  });

  return { visibleItems, completedItems, deferredCount };
}

export function getRutinaCompletionStats(
  rutina,
  customHabits = null,
  habitsPreferences = {},
  options = {},
) {
  if (!rutina) {
    return { percentage: 0, completed: 0, total: 0, deferredCount: 0 };
  }

  const dayMode = options?.today !== undefined
    ? getRutinaDayMode(rutina.fecha, options.today)
    : getRutinaDayMode(rutina.fecha);

  if (dayMode === 'future' || rutina.isPreview) {
    return { percentage: 0, completed: 0, total: 0, deferredCount: 0 };
  }

  const { visibleItems, completedItems, deferredCount } = calculateDayLinkedVisibleItems(
    rutina,
    customHabits,
    habitsPreferences,
    options,
  );
  const total = visibleItems.length;
  const completed = completedItems.length;
  const percentage = total > 0
    ? Math.min(100, Math.max(0, Math.round((completed / total) * 100)))
    : 0;

  return {
    percentage,
    completed,
    total,
    deferredCount,
  };
}

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

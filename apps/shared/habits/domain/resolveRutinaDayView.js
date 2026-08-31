/**
 * Vista focalizada de rutinas: cuota única por día y preview futuro (Node-safe).
 */
import { addDays, differenceInDays, isAfter, isBefore, isSameDay, startOfDay } from 'date-fns';
import { formatDateForAPI, getNormalizedToday, parseAPIDate } from '../../utils/dateUtils.js';
import { getRutinaDayMode } from '../../utils/rutinaDayMode.js';
import {
  contarCompletadosEnPeriodo,
  debesMostrarHabitoEnFecha,
  getScheduledDatesInPeriod,
  isIntervalCadenceResting,
  isPersonalizedIntervalConfig,
  isScheduledCadenciaDay,
  obtenerHistorialCompletados,
  obtenerUltimaCompletacion,
  resolvePersonalizedIntervalDays,
} from '../utils/cadenciaUtils.js';
import { resolveRutinaItemConfig } from './resolveRutinaItemConfig.js';
import { getHabitSectionItemIds, getHabitSectionKeys } from './habitSectionIds.js';
import { isHabitCompletedForHistorial } from './habitCompletionUtils.js';
import { isFlexiblePeriodic, resolveFlexiblePeriodicPlan } from '../engine/habitVisibilityEngine.js';

function normalizeCadenciaDate(targetDate) {
  const fecha = targetDate instanceof Date ? new Date(targetDate) : parseAPIDate(targetDate);
  if (!fecha) return startOfDay(new Date());
  fecha.setHours(12, 0, 0, 0);
  return fecha;
}

function isDailyConfig(config = {}) {
  const tipo = (config.tipo || 'DIARIO').toUpperCase();
  const periodo = (config.periodo || 'CADA_DIA').toUpperCase();
  return tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
}

function isFixedPeriodicConfig(config = {}) {
  const tipo = (config.tipo || 'DIARIO').toUpperCase();
  const periodo = (config.periodo || 'CADA_DIA').toUpperCase();
  if (isDailyConfig(config)) return false;
  const diasSemana = Array.isArray(config.diasSemana) ? config.diasSemana : [];
  const diasMes = Array.isArray(config.diasMes) ? config.diasMes : [];
  return (
    (tipo === 'SEMANAL' && diasSemana.length > 0)
    || (tipo === 'MENSUAL' && diasMes.length > 0)
    || (tipo === 'PERSONALIZADO' && periodo === 'CADA_SEMANA' && diasSemana.length > 0)
    || (tipo === 'PERSONALIZADO' && periodo === 'CADA_MES' && diasMes.length > 0)
  );
}

function countPeriodCompletions(fechaObjetivo, config, historialCompletado = []) {
  const tipo = (config.tipo || 'DIARIO').toUpperCase();
  const periodo = config.periodo || 'CADA_DIA';
  return contarCompletadosEnPeriodo(
    normalizeCadenciaDate(fechaObjetivo),
    tipo,
    periodo,
    historialCompletado,
  );
}

/**
 * Cuota activa para un día concreto (máx. 1 slot accionable/día).
 * @returns {{ show: boolean, quotaSlot: number|null, reason: 'scheduled'|'debt'|null }}
 */
export function resolveActiveQuotaForDay(fechaObjetivo, config, historialCompletado = []) {
  if (!config || config.activo === false) {
    return { show: false, quotaSlot: null, reason: null };
  }

  const fecha = normalizeCadenciaDate(fechaObjetivo);
  const frecuencia = Number(config.frecuencia || 1);

  if (isDailyConfig(config)) {
    if (isIntervalCadenceResting(fecha, config, historialCompletado)) {
      return { show: false, quotaSlot: null, reason: null };
    }

    if (isPersonalizedIntervalConfig(config)) {
      const ultima = obtenerUltimaCompletacion(historialCompletado);
      if (ultima) {
        const diasIntervalo = resolvePersonalizedIntervalDays(config);
        if (differenceInDays(fecha, ultima) >= diasIntervalo) {
          return { show: true, quotaSlot: null, reason: 'debt' };
        }
      }
    }

    return { show: true, quotaSlot: null, reason: 'scheduled' };
  }

  const completados = countPeriodCompletions(fecha, config, historialCompletado);
  if (completados >= frecuencia) {
    return { show: false, quotaSlot: null, reason: null };
  }

  const quotaSlot = completados + 1;

  if (isFixedPeriodicConfig(config)) {
    const scheduledDates = getScheduledDatesInPeriod(fecha, config).map(normalizeCadenciaDate);
    const isScheduledToday = scheduledDates.some((day) => isSameDay(day, fecha));

    if (isScheduledToday) {
      return { show: true, quotaSlot, reason: 'scheduled' };
    }

    const openSlotIndex = completados;
    const idealDay = scheduledDates[openSlotIndex];
    if (!idealDay || !isBefore(idealDay, fecha)) {
      return { show: false, quotaSlot: null, reason: null };
    }

    // N×/semana con N>2: deuda salta al próximo día programado, no rueda en días intermedios.
    if (frecuencia > 2) {
      return { show: false, quotaSlot: null, reason: null };
    }

    // 1–2×/semana: deuda rueda día a día hasta el próximo programado.
    const nextScheduled = scheduledDates.find((day) => isAfter(day, idealDay));
    let cursor = addDays(idealDay, 1);
    while (isBefore(cursor, fecha) || isSameDay(cursor, fecha)) {
      if (nextScheduled && isAfter(cursor, nextScheduled) && !isSameDay(cursor, nextScheduled)) {
        break;
      }
      if (isSameDay(cursor, fecha)) {
        return { show: true, quotaSlot, reason: 'debt' };
      }
      if (nextScheduled && isSameDay(cursor, nextScheduled)) {
        break;
      }
      cursor = addDays(cursor, 1);
    }

    return { show: false, quotaSlot: null, reason: null };
  }

  return { show: false, quotaSlot: null, reason: null };
}

/**
 * Flexible periodic: usa plan repartido por día (sin proyecciones en Luego de hoy).
 */
export function resolveFlexibleQuotaForDay(fechaObjetivo, config, rutinaForPlan, section, itemId) {
  if (!config || config.activo === false || !isFlexiblePeriodic(config)) {
    return { show: false, quotaSlot: null, reason: null };
  }

  if (!rutinaForPlan || !section || !itemId) {
    return { show: false, quotaSlot: null, reason: null };
  }

  const fecha = normalizeCadenciaDate(fechaObjetivo);
  const rutinaAtDate = {
    ...rutinaForPlan,
    fecha: formatDateForAPI(fecha),
  };

  const plan = resolveFlexiblePeriodicPlan(config, rutinaAtDate, section, itemId);
  if (!plan || plan.remainingQuota <= 0 || !plan.showToday) {
    return { show: false, quotaSlot: null, reason: null };
  }

  return {
    show: true,
    quotaSlot: plan.todayQuotaSlot ?? null,
    reason: 'scheduled',
  };
}

/** Historial recortado al día que se está evaluando (sin completados futuros). */
function clipHistorialCompletado(historialCompletado = [], fechaObjetivo) {
  const end = normalizeCadenciaDate(fechaObjetivo);
  return (historialCompletado || []).filter((fecha) => {
    const d = normalizeCadenciaDate(fecha);
    return !isAfter(d, end);
  });
}

const HIDDEN_DAY_LINK = {
  visible: false,
  quotaSlot: null,
  linkReason: null,
  isCadenciaDebt: false,
};

/** Cuota/deuda abierta anclada al «hoy» real (una sola superficie activa). */
function resolveOpenQuotaAtAnchor(
  config,
  historialCompletado,
  anchorDate,
  rutinaForPlan,
  section,
  itemId,
) {
  const anchor = normalizeCadenciaDate(anchorDate);
  const historialAtAnchor = clipHistorialCompletado(historialCompletado, anchor);

  if (isFlexiblePeriodic(config) && rutinaForPlan && section && itemId) {
    const rutinaAtAnchor = {
      ...rutinaForPlan,
      fecha: formatDateForAPI(anchor),
    };
    const plan = resolveFlexiblePeriodicPlan(config, rutinaAtAnchor, section, itemId);
    const show = Boolean(plan?.showToday && (plan?.remainingQuota ?? 0) > 0);
    return { show, quotaSlot: plan?.todayQuotaSlot ?? null, reason: show ? 'scheduled' : null };
  }

  return resolveActiveQuotaForDay(anchor, config, historialAtAnchor);
}

/** Si la cuota/deuda está abierta en el ancla, no se repite en otros días. */
function shouldSuppressForSingleActiveSurface(
  fechaObjetivo,
  anchorDate,
  openOnAnchor,
  dayMode,
  config,
) {
  if (!openOnAnchor?.show) return false;
  const fecha = normalizeCadenciaDate(fechaObjetivo);
  const anchor = normalizeCadenciaDate(anchorDate);
  if (isSameDay(fecha, anchor)) return false;

  if (dayMode === 'historical') {
    if (isDailyConfig(config)) {
      return openOnAnchor.reason === 'debt';
    }
    if (isFlexiblePeriodic(config)) {
      return true;
    }
    return openOnAnchor.reason === 'debt';
  }
  if (dayMode === 'future') {
    return openOnAnchor.reason === 'debt';
  }
  return false;
}

/**
 * ¿El hábito está vinculado al día del registro (vista focalizada)?
 * @param {Date|string|null} [anchorDate] — «hoy» real; default getNormalizedToday()
 */
export function resolveDayLinkedQuota({
  fechaObjetivo,
  config,
  historialCompletado = [],
  rutinaForPlan = null,
  section = null,
  itemId = null,
  dayMode = 'today',
  anchorDate = null,
}) {
  if (!config || config.activo === false) {
    return HIDDEN_DAY_LINK;
  }

  const anchorToday = normalizeCadenciaDate(anchorDate || getNormalizedToday());
  const fecha = normalizeCadenciaDate(fechaObjetivo);
  const historialAtView = clipHistorialCompletado(historialCompletado, fecha);
  const historialAtAnchor = clipHistorialCompletado(historialCompletado, anchorToday);

  const openOnAnchor = resolveOpenQuotaAtAnchor(
    config,
    historialCompletado,
    anchorToday,
    rutinaForPlan,
    section,
    itemId,
  );
  const suppressed = shouldSuppressForSingleActiveSurface(
    fecha,
    anchorToday,
    openOnAnchor,
    dayMode,
    config,
  );

  if (dayMode === 'historical') {
    if (suppressed) {
      return HIDDEN_DAY_LINK;
    }

    if (isFlexiblePeriodic(config) && rutinaForPlan && section && itemId) {
      const rutinaAtDate = {
        ...rutinaForPlan,
        fecha: formatDateForAPI(fecha),
      };
      const plan = resolveFlexiblePeriodicPlan(config, rutinaAtDate, section, itemId);
      const visible = Boolean(plan?.showToday);
      return {
        visible,
        quotaSlot: null,
        linkReason: visible ? 'scheduled' : null,
        isCadenciaDebt: false,
      };
    }

    if (isPersonalizedIntervalConfig(config)) {
      const visible = debesMostrarHabitoEnFecha(fecha, config, historialAtView);
      return {
        visible,
        quotaSlot: null,
        linkReason: visible ? 'scheduled' : null,
        isCadenciaDebt: false,
      };
    }

    const quotaAtView = resolveActiveQuotaForDay(fecha, config, historialAtView);
    const visible = isScheduledCadenciaDay(fecha, config)
      || (quotaAtView.show && quotaAtView.reason === 'scheduled');
    return {
      visible,
      quotaSlot: visible ? quotaAtView.quotaSlot : null,
      linkReason: visible ? 'scheduled' : null,
      isCadenciaDebt: false,
    };
  }

  if (dayMode === 'future' && suppressed) {
    return HIDDEN_DAY_LINK;
  }

  if (isFlexiblePeriodic(config) && rutinaForPlan && section && itemId) {
    const flex = resolveFlexibleQuotaForDay(fechaObjetivo, config, rutinaForPlan, section, itemId);
    return {
      visible: flex.show,
      quotaSlot: flex.quotaSlot,
      linkReason: flex.reason,
      isCadenciaDebt: flex.reason === 'debt',
    };
  }

  const historialForQuota = dayMode === 'today'
    ? historialAtAnchor
    : historialAtView;
  const quota = resolveActiveQuotaForDay(fecha, config, historialForQuota);
  return {
    visible: quota.show,
    quotaSlot: quota.quotaSlot,
    linkReason: quota.reason,
    isCadenciaDebt: quota.reason === 'debt',
  };
}

/** Merge historial de logs pasados hasta la fecha preview. */
export function mergeHistorialUpToDate(rutinas = [], targetDate, sections = []) {
  const target = normalizeCadenciaDate(parseAPIDate(targetDate) || targetDate);
  const merged = {};

  (rutinas || []).forEach((rutina) => {
    if (!rutina?.historial) return;
    const rutinaDate = parseAPIDate(rutina.fecha);
    if (!rutinaDate || isAfter(normalizeCadenciaDate(rutinaDate), target)) return;

    sections.forEach((section) => {
      const sectionHist = rutina.historial[section];
      if (!sectionHist) return;
      if (!merged[section]) merged[section] = {};

      Object.entries(sectionHist).forEach(([itemId, dates]) => {
        if (!merged[section][itemId]) merged[section][itemId] = {};
        if (typeof dates === 'object' && !Array.isArray(dates)) {
          Object.entries(dates).forEach(([dateKey, value]) => {
            if (value === true) merged[section][itemId][dateKey] = true;
          });
        }
      });
    });
  });

  return merged;
}

/**
 * Stub de rutina para preview futuro (sin persistir).
 */
export function buildPreviewRutinaForDate({
  date,
  habits = null,
  habitsPreferences = {},
  rutinas = [],
  customSections = [],
} = {}) {
  const fechaStr = formatDateForAPI(parseAPIDate(date) || date);
  if (!fechaStr) return null;

  const sections = getHabitSectionKeys(habits).length > 0
    ? getHabitSectionKeys(habits)
    : ['bodyCare', 'nutricion', 'ejercicio', 'cleaning'];

  const config = {};
  const historial = mergeHistorialUpToDate(rutinas, fechaStr, sections);
  const rutina = {
    fecha: fechaStr,
    isPreview: true,
    config,
    historial,
  };

  sections.forEach((section) => {
    rutina[section] = {};
    config[section] = {};
    const itemIds = getHabitSectionItemIds(section, habits);
    itemIds.forEach((itemId) => {
      const itemConfig = resolveRutinaItemConfig(section, itemId, rutina, habitsPreferences);
      config[section][itemId] = itemConfig;
      rutina[section][itemId] = false;
    });
  });

  return rutina;
}

/**
 * Resuelve rutina efectiva: log real o preview futuro.
 */
export function resolveEffectiveRutinaView({
  rutina,
  viewDate,
  habits = null,
  habitsPreferences = {},
  rutinas = [],
  customSections = [],
} = {}) {
  const dayMode = getRutinaDayMode(rutina?.fecha ?? viewDate);
  if (rutina?._id) {
    return {
      rutina,
      dayMode: getRutinaDayMode(rutina.fecha),
      isPreview: false,
      readOnly: false,
    };
  }

  if (getRutinaDayMode(viewDate) === 'future') {
    const preview = buildPreviewRutinaForDate({
      date: viewDate,
      habits,
      habitsPreferences,
      rutinas,
      customSections,
    });
    return {
      rutina: preview,
      dayMode: 'future',
      isPreview: true,
      readOnly: true,
    };
  }

  return { rutina: null, dayMode, isPreview: false, readOnly: false };
}

/** Historial como array de Date para un ítem. */
export function getHistorialDatesForItem(itemId, section, rutina) {
  return [...obtenerHistorialCompletados(itemId, section, rutina)];
}

/** ¿Entrada pendiente vinculada al día (post cuota única)? */
export function isEntryDayLinked(entry, rutina, rutinaForVisibility, dayMode = 'today') {
  if (!entry || !rutina) return false;

  const { config, itemId, section, itemValue, isCompleted } = entry;
  if (isCompleted || isHabitCompletedForHistorial(itemValue)) {
    return true;
  }

  const fechaRutina = parseAPIDate(rutina.fecha) || new Date();
  const historialDates = getHistorialDatesForItem(itemId, section, rutinaForVisibility);

  const link = resolveDayLinkedQuota({
    fechaObjetivo: fechaRutina,
    config,
    historialCompletado: historialDates,
    rutinaForPlan: rutinaForVisibility,
    section,
    itemId,
    dayMode,
  });

  return link.visible;
}

export function shouldHideNotTodayBucket(dayMode) {
  return dayMode === 'today' || dayMode === 'future';
}

export function shouldHideFlexibleLuegoProjections(dayMode) {
  return dayMode === 'today' || dayMode === 'future' || dayMode === 'historical';
}

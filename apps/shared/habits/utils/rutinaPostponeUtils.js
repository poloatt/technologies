import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isBefore,
  isSameDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  formatDateForAPI,
  getNormalizedToday,
  parseAPIDate,
  areSameDay,
} from '../../utils/dateUtils.js';
import { getRutinaDayMode } from '../../utils/rutinaDayMode.js';
import { getCurrentTimeOfDay, normalizeTimeOfDay, VALID_TIME_OF_DAY } from '../../utils/timeOfDayUtils.js';
import {
  obtenerHistorialCompletados,
  CADENCIA_WEEK_STARTS_ON,
} from './cadenciaUtils.js';
import { resolveActiveQuotaForDay } from '../domain/resolveRutinaDayView.js';
import {
  isHabitHorarioCompleted,
  isHabitCompletedForHistorial,
  isHabitFullyCompletedToday,
} from '../domain/habitCompletionUtils.js';
import { getNextPendingHorario } from '../utils/habitTimeLogic.js';

export const HABIT_DEFERRAL_ACTION = {
  POSTPONE: 'postpone',
  PUSH: 'push',
  IGNORE: 'ignore',
};

function isViewingRutinaToday(rutina) {
  if (!rutina?.fecha) return false;
  return getRutinaDayMode(rutina.fecha) === 'today';
}

function isDailyConfig(config = {}) {
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();
  return tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
}

function normalizeFranja(franja) {
  return franja ? String(franja).toUpperCase() : null;
}

function formatDeferralDayLabel(dateStr, referenceToday = getNormalizedToday()) {
  const d = parseAPIDate(dateStr);
  if (!d) return null;
  const tomorrow = addDays(referenceToday, 1);
  if (isSameDay(d, tomorrow)) return 'mañana';
  if (isSameDay(d, referenceToday)) return 'hoy';
  return format(d, "EEEE d 'de' MMMM", { locale: es });
}

/** @deprecated use habitDeferrals */
export function getPostponedFranjasForItem(rutina, section, itemId) {
  const postponed = rutina?.postponedFranjas?.[section]?.[itemId];
  if (!Array.isArray(postponed)) return [];
  return postponed.map((franja) => String(franja).toUpperCase());
}

/** @deprecated use getHabitDeferral / isHabitHiddenByDeferral */
export function isFranjaPostponed(rutina, section, itemId, franja) {
  if (isHabitHiddenByDeferral({ rutina, section, itemId, franja })) return true;
  const normalized = normalizeFranja(franja);
  if (!normalized) return false;
  return getPostponedFranjasForItem(rutina, section, itemId).includes(normalized);
}

/** @deprecated use buildHabitDeferralUpdate */
export function buildPostponedFranjasUpdate(rutina, section, itemId, franja) {
  const normalized = normalizeFranja(franja);
  const current = getPostponedFranjasForItem(rutina, section, itemId);
  if (current.includes(normalized)) {
    return rutina?.postponedFranjas || {};
  }

  return {
    ...(rutina?.postponedFranjas || {}),
    [section]: {
      ...(rutina?.postponedFranjas?.[section] || {}),
      [itemId]: [...current, normalized],
    },
  };
}

export function getHabitDeferral(rutina, section, itemId, franja = null) {
  const record = rutina?.habitDeferrals?.[section]?.[itemId];
  if (!record) return null;
  const recordFranja = normalizeFranja(record.franja);
  const focusFranja = normalizeFranja(franja);
  if (recordFranja && focusFranja && recordFranja !== focusFranja) return null;
  return record;
}

export function buildHabitDeferralUpdate(rutina, section, itemId, deferral) {
  const { action, franja, targetDate, activeUntil } = deferral;
  const record = {
    action,
    ...(franja ? { franja: normalizeFranja(franja) } : {}),
    ...(targetDate ? { targetDate } : {}),
    ...(activeUntil ? { activeUntil } : {}),
  };

  return {
    ...(rutina?.habitDeferrals || {}),
    [section]: {
      ...(rutina?.habitDeferrals?.[section] || {}),
      [itemId]: record,
    },
  };
}

/**
 * Empuje activo desde rutinas anteriores del mismo ítem (persiste entre días).
 */
export function resolveActivePushUntil({ rutina, section, itemId, allRutinas = [] }) {
  const viewDate = parseAPIDate(rutina?.fecha);
  if (!viewDate) return null;

  const candidates = [...(allRutinas || [])];
  if (rutina && !candidates.some((r) => r?._id === rutina._id)) {
    candidates.push(rutina);
  }

  let latestUntil = null;
  candidates.forEach((candidate) => {
    const deferral = candidate?.habitDeferrals?.[section]?.[itemId];
    if (!deferral || deferral.action !== HABIT_DEFERRAL_ACTION.PUSH || !deferral.activeUntil) return;

    const setOn = parseAPIDate(candidate.fecha);
    const until = parseAPIDate(deferral.activeUntil);
    if (!setOn || !until) return;
    if (isBefore(viewDate, setOn)) return;
    if (isBefore(viewDate, until)) {
      if (!latestUntil || isBefore(parseAPIDate(latestUntil), until)) {
        latestUntil = deferral.activeUntil;
      }
    }
  });

  return latestUntil;
}

function findPushDeferralForItem({ rutina, section, itemId, allRutinas = [] }) {
  const candidates = [...(allRutinas || [])];
  if (rutina && !candidates.some((r) => r?._id === rutina._id)) {
    candidates.push(rutina);
  }

  let latest = null;
  candidates.forEach((candidate) => {
    const deferral = candidate?.habitDeferrals?.[section]?.[itemId];
    if (!deferral || deferral.action !== HABIT_DEFERRAL_ACTION.PUSH) return;
    const setOn = parseAPIDate(candidate.fecha);
    if (!latest || (setOn && parseAPIDate(latest.fecha) && isBefore(parseAPIDate(latest.fecha), setOn))) {
      latest = { ...deferral, fecha: candidate.fecha };
    }
  });
  return latest;
}

export function isHabitHiddenByDeferral({
  rutina,
  section,
  itemId,
  franja = null,
  allRutinas = [],
}) {
  if (!rutina || !section || !itemId) return false;

  const pushUntil = resolveActivePushUntil({ rutina, section, itemId, allRutinas });
  const viewDate = parseAPIDate(rutina.fecha);
  if (pushUntil && viewDate && isBefore(viewDate, parseAPIDate(pushUntil))) {
    const pushDeferral = findPushDeferralForItem({ rutina, section, itemId, allRutinas });
    const focusFranja = normalizeFranja(franja);
    if (!pushDeferral?.franja || !focusFranja || pushDeferral.franja === focusFranja) {
      return true;
    }
  }

  const deferral = getHabitDeferral(rutina, section, itemId, franja);
  if (!deferral) {
    const legacyFranja = normalizeFranja(franja);
    if (legacyFranja && getPostponedFranjasForItem(rutina, section, itemId).includes(legacyFranja)) {
      return true;
    }
    return false;
  }

  if (
    deferral.action === HABIT_DEFERRAL_ACTION.IGNORE
    || deferral.action === HABIT_DEFERRAL_ACTION.POSTPONE
  ) {
    return true;
  }

  if (deferral.action === HABIT_DEFERRAL_ACTION.PUSH && deferral.activeUntil && viewDate) {
    return isBefore(viewDate, parseAPIDate(deferral.activeUntil));
  }

  return false;
}

export function resolvePostponeTargetDay({
  rutina,
  config,
  section,
  itemId,
}) {
  const today = parseAPIDate(rutina?.fecha) || getNormalizedToday();
  const historial = obtenerHistorialCompletados(itemId, section, rutina);

  for (let offset = 1; offset <= 60; offset += 1) {
    const candidate = addDays(today, offset);
    const quota = resolveActiveQuotaForDay(candidate, config, historial);
    if (quota.show) {
      return formatDateForAPI(candidate);
    }
  }

  return formatDateForAPI(addDays(today, 1));
}

export function resolvePushTargetDay({ rutina, config }) {
  const today = parseAPIDate(rutina?.fecha) || getNormalizedToday();
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();

  if (isDailyConfig(config)) {
    return formatDateForAPI(addDays(today, 1));
  }

  if (tipo === 'SEMANAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_SEMANA')) {
    const weekStart = startOfWeek(today, { weekStartsOn: CADENCIA_WEEK_STARTS_ON });
    return formatDateForAPI(addWeeks(weekStart, 1));
  }

  if (tipo === 'MENSUAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_MES')) {
    return formatDateForAPI(startOfMonth(addMonths(today, 1)));
  }

  return formatDateForAPI(addDays(today, 1));
}

export function getPostponeActionLabel(targetDate, referenceToday = getNormalizedToday()) {
  if (!targetDate) return null;
  const dayLabel = formatDeferralDayLabel(targetDate, referenceToday);
  return dayLabel ? `Posponer a ${dayLabel}` : null;
}

export function getEmpujarActionLabel(targetDate, config, referenceToday = getNormalizedToday()) {
  if (!targetDate) return null;
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();

  if (tipo === 'SEMANAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_SEMANA')) {
    return 'Empujar a la semana que viene';
  }
  if (tipo === 'MENSUAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_MES')) {
    return 'Empujar al próximo mes';
  }

  const dayLabel = formatDeferralDayLabel(targetDate, referenceToday);
  return dayLabel ? `Empujar a ${dayLabel}` : null;
}

/** @deprecated use getPostponeActionLabel */
export function getPostponeMenuLabel(nextFranja) {
  if (!nextFranja) return null;
  return `Posponer a ${nextFranja}`;
}

export function resolvePostponeTargetFranja({
  config,
  itemValue,
  focusHorario,
  currentTimeOfDay,
}) {
  const horarios = Array.isArray(config?.horarios) ? config.horarios : [];
  const franja = focusHorario || currentTimeOfDay;
  return getNextPendingHorario(horarios, franja, itemValue);
}

/** @deprecated use canDeferHabit */
export function canPostponeHabitFranja({
  rutina,
  section,
  itemId,
  config,
  itemValue,
  focusHorario,
  currentTimeOfDay,
  readOnly = false,
  allowPostpone = false,
}) {
  if (!canDeferHabit({
    rutina, section, itemId, config, itemValue, focusHorario, readOnly, allowPostpone,
  })) {
    return false;
  }

  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();
  const isDaily = tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
  if (!isDaily) return true;

  const horarios = Array.isArray(config?.horarios) ? config.horarios : [];
  const resolvedFocusHorario = focusHorario
    ? String(focusHorario).toUpperCase()
    : (horarios.length === 1 ? String(horarios[0]).toUpperCase() : null);
  const franja = resolvedFocusHorario || currentTimeOfDay;
  if (!franja) return false;

  return Boolean(resolvePostponeTargetDay({ rutina, config, section, itemId }));
}

export function isOverdueDailyFranja(rutina, config, focusHorario) {
  if (!isDailyConfig(config) || !isViewingRutinaToday(rutina)) return false;
  const franja = normalizeFranja(focusHorario);
  if (!franja || !VALID_TIME_OF_DAY.includes(franja)) return false;
  const activeFranja = String(getCurrentTimeOfDay()).toUpperCase();
  const franjaIdx = VALID_TIME_OF_DAY.indexOf(franja);
  const activeIdx = VALID_TIME_OF_DAY.indexOf(activeFranja);
  return franjaIdx >= 0 && activeIdx >= 0 && franjaIdx < activeIdx;
}

export function canDeferHabit({
  rutina,
  section,
  itemId,
  config,
  itemValue,
  focusHorario = null,
  readOnly = false,
  allowPostpone = false,
}) {
  if (readOnly || !allowPostpone || !isViewingRutinaToday(rutina)) return false;
  if (!config || config.activo === false) return false;

  const franja = normalizeFranja(focusHorario);
  const horarios = normalizeTimeOfDay(config?.horarios);

  if (franja && horarios.length > 0) {
    if (isHabitHorarioCompleted(itemValue, franja)) return false;
  } else if (horarios.length > 0) {
    if (isHabitFullyCompletedToday(itemValue, horarios)) return false;
  } else if (isHabitCompletedForHistorial(itemValue)) {
    return false;
  }

  if (isHabitHiddenByDeferral({ rutina, section, itemId, franja })) return false;

  return true;
}

export function resolveHabitDeferralMenuOptions({
  rutina,
  section,
  itemId,
  config,
  itemValue,
  focusHorario = null,
  readOnly = false,
  allowPostpone = false,
}) {
  const canDefer = canDeferHabit({
    rutina,
    section,
    itemId,
    config,
    itemValue,
    focusHorario,
    readOnly,
    allowPostpone,
  });

  if (!canDefer) {
    return {
      canDefer: false,
      canPostpone: false,
      canEmpujar: false,
      postponeLabel: null,
      empujarLabel: null,
      postponeTargetDate: null,
      pushTargetDate: null,
      franja: normalizeFranja(focusHorario),
    };
  }

  const postponeTargetDate = resolvePostponeTargetDay({ rutina, config, section, itemId });
  const pushTargetDate = resolvePushTargetDay({ rutina, config });
  const referenceToday = parseAPIDate(rutina?.fecha) || getNormalizedToday();
  const overdueFranja = isOverdueDailyFranja(rutina, config, focusHorario);
  const canPostpone = !overdueFranja && Boolean(postponeTargetDate);
  const canEmpujar = !overdueFranja && Boolean(pushTargetDate);

  return {
    canDefer: true,
    canPostpone,
    canEmpujar,
    postponeLabel: canPostpone
      ? getPostponeActionLabel(postponeTargetDate, referenceToday)
      : null,
    empujarLabel: canEmpujar
      ? getEmpujarActionLabel(pushTargetDate, config, referenceToday)
      : null,
    postponeTargetDate: canPostpone ? postponeTargetDate : null,
    pushTargetDate: canEmpujar ? pushTargetDate : null,
    franja: normalizeFranja(focusHorario),
  };
}

export function buildDeferralPayload(action, {
  franja,
  postponeTargetDate,
  pushTargetDate,
}) {
  if (action === HABIT_DEFERRAL_ACTION.IGNORE) {
    return { action, franja };
  }
  if (action === HABIT_DEFERRAL_ACTION.POSTPONE) {
    return { action, franja, targetDate: postponeTargetDate };
  }
  if (action === HABIT_DEFERRAL_ACTION.PUSH) {
    return { action, franja, activeUntil: pushTargetDate };
  }
  return null;
}

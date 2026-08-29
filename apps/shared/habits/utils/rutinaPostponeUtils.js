import { getNextPendingHorario } from '../utils/habitTimeLogic.js';
import { isHabitHorarioCompleted } from '../domain/habitCompletionUtils.js';
import { getTimeOfDayLabel } from '../../utils/timeOfDayUtils.js';
import { getRutinaDayMode } from '../../utils/rutinaDayMode.js';
import { parseAPIDate } from '../../utils/dateUtils.js';

function isViewingRutinaToday(rutina) {
  if (!rutina?.fecha) return false;
  return getRutinaDayMode(rutina.fecha) === 'today';
}

export function getPostponedFranjasForItem(rutina, section, itemId) {
  const postponed = rutina?.postponedFranjas?.[section]?.[itemId];
  if (!Array.isArray(postponed)) return [];
  return postponed.map((franja) => String(franja).toUpperCase());
}

export function isFranjaPostponed(rutina, section, itemId, franja) {
  if (!franja) return false;
  const normalized = String(franja).toUpperCase();
  return getPostponedFranjasForItem(rutina, section, itemId).includes(normalized);
}

export function buildPostponedFranjasUpdate(rutina, section, itemId, franja) {
  const normalized = String(franja).toUpperCase();
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
  if (readOnly || !allowPostpone || !isViewingRutinaToday(rutina)) return false;

  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();
  const isDaily = tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
  if (!isDaily) return false;

  const horarios = Array.isArray(config?.horarios) ? config.horarios : [];
  const resolvedFocusHorario = focusHorario
    ? String(focusHorario).toUpperCase()
    : (horarios.length === 1 ? String(horarios[0]).toUpperCase() : null);

  const franja = resolvedFocusHorario || currentTimeOfDay;
  if (!franja || isHabitHorarioCompleted(itemValue, franja)) return false;
  if (isFranjaPostponed(rutina, section, itemId, franja)) return false;

  return Boolean(resolvePostponeTargetFranja({
    config,
    itemValue,
    focusHorario: franja,
    currentTimeOfDay,
  }));
}

export function getPostponeMenuLabel(nextFranja) {
  if (!nextFranja) return null;
  const label = getTimeOfDayLabel(nextFranja);
  return `Posponer a ${label}`;
}

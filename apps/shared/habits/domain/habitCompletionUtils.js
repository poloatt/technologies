/**
 * Utilidades compartidas para el estado de completitud de hábitos.
 * Soporta formato legacy (boolean) y formato por horario ({ MAÑANA: true, ... }).
 */
import { normalizeTimeOfDay } from '../../utils/timeOfDayUtils.js';

function isDailyCadence(config = {}) {
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();
  return tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
}

function normalizeHorarios(horarios) {
  return normalizeTimeOfDay(horarios);
}

/** Valor inicial de completado según config (boolean o objeto por franja). */
export function buildEmptyHabitCompletionValue(config = {}) {
  const horarios = normalizeHorarios(config.horarios);

  if (isDailyCadence(config) && horarios.length > 0) {
    return horarios.reduce((acc, horario) => {
      acc[horario] = false;
      return acc;
    }, {});
  }

  return false;
}

/**
 * Alinea el valor guardado al formato esperado cuando hay franjas configuradas.
 * Migra boolean legacy → objeto por franja.
 */
export function ensureHabitCompletionShape(itemValue, config = {}) {
  const horarios = normalizeHorarios(config.horarios);

  if (!isDailyCadence(config) || horarios.length === 0) {
    return itemValue;
  }

  if (isHabitValueObject(itemValue)) {
    const next = { ...itemValue };
    horarios.forEach((horario) => {
      if (!(horario in next)) next[horario] = false;
    });
    return next;
  }

  if (typeof itemValue === 'boolean') {
    return horarios.reduce((acc, horario) => {
      acc[horario] = itemValue === true;
      return acc;
    }, {});
  }

  return buildEmptyHabitCompletionValue(config);
}

/** Cantidad de unidades de completado para métricas (franjas o 1). */
export function getHabitCompletionSlotCount(itemValue, config = {}) {
  if (isHabitValueObject(itemValue)) {
    return Object.keys(itemValue).length;
  }

  const horarios = normalizeHorarios(config.horarios);
  if (isDailyCadence(config) && horarios.length > 0) {
    return horarios.length;
  }

  return 1;
}

/** Cantidad de franjas completadas para métricas. */
export function getHabitCompletedSlotCount(itemValue, config = {}) {
  if (isHabitValueObject(itemValue)) {
    return Object.values(itemValue).filter(Boolean).length;
  }

  if (typeof itemValue === 'boolean') {
    const horarios = normalizeHorarios(config.horarios);
    if (isDailyCadence(config) && horarios.length > 0) {
      return itemValue === true ? horarios.length : 0;
    }
    return itemValue === true ? 1 : 0;
  }

  return 0;
}

export function getHabitItemValue(rutina, section, itemId, localData = null) {
  if (localData && localData[itemId] !== undefined) return localData[itemId];
  return rutina?.[section]?.[itemId];
}

export function rutinaItemValuesDiffer(left, right) {
  if (typeof left === 'object' && left !== null && !Array.isArray(left)) {
    return JSON.stringify(left) !== JSON.stringify(right);
  }
  return left !== right;
}

export function isHabitValueObject(itemValue) {
  return typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue);
}

/** ¿Marcado según las franjas configuradas (ignora claves huérfanas en el snapshot)? */
export function isHabitMarkedCompleteForConfig(config = {}, itemValue) {
  if (itemValue === undefined || itemValue === null || itemValue === false) return false;
  if (typeof itemValue === 'boolean') return itemValue === true;

  const horarios = normalizeHorarios(config.horarios);
  if (isHabitValueObject(itemValue)) {
    if (horarios.length > 0) {
      return horarios.every((h) => itemValue[h] === true);
    }
    return isHabitFullyCompletedToday(itemValue, []);
  }

  return false;
}

/** ¿El hábito cuenta como completado hoy para historial / cuotas? */
export function isHabitCompletedForHistorial(itemValue) {
  if (itemValue === undefined || itemValue === null || itemValue === false) return false;
  if (itemValue === true) return true;
  if (isHabitValueObject(itemValue)) {
    return Object.values(itemValue).some(Boolean);
  }
  return false;
}

/** ¿Un horario concreto está completado? */
export function isHabitHorarioCompleted(itemValue, horario) {
  if (itemValue === undefined || itemValue === null) return false;
  if (typeof itemValue === 'boolean') return itemValue === true;
  if (isHabitValueObject(itemValue)) {
    const key = String(horario || '').toUpperCase();
    return itemValue[key] === true;
  }
  return false;
}

/** ¿El hábito está totalmente completado hoy (sin pendientes)? */
export function isHabitFullyCompletedToday(itemValue, horarios = []) {
  if (itemValue === undefined || itemValue === null || itemValue === false) return false;
  if (typeof itemValue === 'boolean') return itemValue === true;

  if (!isHabitValueObject(itemValue)) return false;

  const normalizedHorarios = Array.isArray(horarios)
    ? horarios.map((h) => String(h).toUpperCase()).filter(Boolean)
    : [];

  if (normalizedHorarios.length === 0) {
    const values = Object.values(itemValue);
    if (values.length === 0) return false;
    return values.every(Boolean);
  }

  return normalizedHorarios.every((h) => itemValue[h] === true);
}

/** ¿Alguna franja completada pero aún quedan pendientes hoy? */
export function isHabitPartiallyCompletedToday(itemValue, horarios = []) {
  if (!isHabitCompletedForHistorial(itemValue)) return false;
  return !isHabitFullyCompletedToday(itemValue, horarios);
}

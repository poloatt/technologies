/** Toggle de completitud (boolean legacy y objeto multi-horario). */

import { VALID_TIME_OF_DAY } from '../../utils/timeOfDayUtils.js';
import { isHabitFullyCompletedToday } from './habitCompletionUtils.js';

/**
 * Última franja completada (NOCHE → TARDE → MAÑANA) para desmarcar desde Hecho cerrado.
 */
export function resolveLastCompletedFranja(itemValue, horariosConfig = []) {
  const horarios = (Array.isArray(horariosConfig) ? horariosConfig : [])
    .map((h) => String(h).toUpperCase())
    .filter(Boolean);
  const order = VALID_TIME_OF_DAY.filter((h) => horarios.includes(h));
  const ranked = order.length > 0 ? order : VALID_TIME_OF_DAY;
  for (let i = ranked.length - 1; i >= 0; i -= 1) {
    const horario = ranked[i];
    if (isFranjaCompleted(itemValue, horario)) return horario;
  }
  return null;
}
export function habitRequiresExpandedCarouselToggle(config = {}) {
  const tipo = (config.tipo || 'DIARIO').toUpperCase();
  const periodo = (config.periodo || 'CADA_DIA').toUpperCase();
  const isDaily = tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
  if (!isDaily) return false;

  const frecuencia = Number(config.frecuencia || 1);
  const horarios = Array.isArray(config.horarios) ? config.horarios.filter(Boolean) : [];
  return frecuencia > 1 || horarios.length > 1;
}

export function isFranjaCompleted(itemValue, normalizedHorario) {
  if (itemValue === undefined || itemValue === null || itemValue === false) return false;
  if (typeof itemValue === 'boolean') return itemValue === true;
  if (typeof itemValue === 'object' && !Array.isArray(itemValue)) {
    return itemValue[String(normalizedHorario).toUpperCase()] === true;
  }
  return false;
}

export function computeFranjaToggleValue({
  itemValue,
  horariosConfig = [],
  normalizedHorario,
}) {
  const horarios = horariosConfig.map((h) => String(h).toUpperCase());
  const horario = String(normalizedHorario).toUpperCase();
  const isObjectFormat = typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue);
  const isBooleanFormat = typeof itemValue === 'boolean';

  if (isObjectFormat) {
    return {
      ...itemValue,
      [horario]: !isFranjaCompleted(itemValue, horario),
    };
  }

  const nextCompleted = !isFranjaCompleted(itemValue, horario);
  const newObject = {};

  if (isBooleanFormat && itemValue === true) {
    horarios.forEach((h) => {
      newObject[h] = h === horario ? nextCompleted : true;
    });
    return newObject;
  }

  horarios.forEach((h) => {
    if (h === horario) {
      newObject[h] = nextCompleted;
    } else {
      newObject[h] = isFranjaCompleted(itemValue, h);
    }
  });
  return newObject;
}

export function computeNextHabitValue({
  itemValue,
  itemConfig = {},
  horario = null,
  currentTimeOfDay = null,
  isCompletedForHorario = () => false,
}) {
  const isObjectFormat = typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue);
  const isBooleanFormat = typeof itemValue === 'boolean';
  const horariosConfig = Array.isArray(itemConfig.horarios) ? itemConfig.horarios : [];
  const hasMultipleHorarios = horariosConfig.length > 1;

  if (horario && horariosConfig.length > 0) {
    return computeFranjaToggleValue({
      itemValue,
      horariosConfig,
      normalizedHorario: String(horario).toUpperCase(),
    });
  }

  if (hasMultipleHorarios) {
    return computeFranjaToggleValue({
      itemValue,
      horariosConfig,
      normalizedHorario: String(currentTimeOfDay || horario).toUpperCase(),
    });
  }

  if (isObjectFormat) {
    const allCompleted = Object.values(itemValue).every(Boolean);
    return !allCompleted;
  }

  return !isCompletedForHorario();
}

/**
 * Toggle para carrusel / checklist.
 * Con franja explícita siempre muta por slot (1 o N franjas) — no volver a boolean.
 */
export function computeCarouselToggleValue({
  itemValue,
  horariosConfig = [],
  normalizedHorario,
}) {
  const isObjectFormat = typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue);
  const isBooleanFormat = typeof itemValue === 'boolean';
  const horarios = (Array.isArray(horariosConfig) ? horariosConfig : [])
    .map((h) => String(h).toUpperCase())
    .filter(Boolean);

  if (normalizedHorario) {
    const slots = horarios.length > 0
      ? horarios
      : (isObjectFormat ? Object.keys(itemValue).map((k) => String(k).toUpperCase()) : []);
    return computeFranjaToggleValue({
      itemValue,
      horariosConfig: slots.length > 0 ? slots : [String(normalizedHorario).toUpperCase()],
      normalizedHorario,
    });
  }

  // Hecho cerrado (todas las franjas): desmarcar la última completada → vuelve a Sin marcar.
  const slotsForDone = horarios.length > 0
    ? horarios
    : (isObjectFormat ? Object.keys(itemValue).map((k) => String(k).toUpperCase()) : []);
  if (
    slotsForDone.length > 1
    && isHabitFullyCompletedToday(itemValue, slotsForDone)
  ) {
    const lastFranja = resolveLastCompletedFranja(itemValue, slotsForDone);
    if (lastFranja) {
      return computeFranjaToggleValue({
        itemValue,
        horariosConfig: slotsForDone,
        normalizedHorario: lastFranja,
      });
    }
  }

  // Multi-franja parcial sin horario explícito: no-op (evita colapsar a boolean).
  if (horarios.length > 1 || (isObjectFormat && Object.keys(itemValue).length > 1)) {
    return itemValue;
  }

  const prev = isBooleanFormat
    ? itemValue
    : (isObjectFormat ? Object.values(itemValue).some(Boolean) : false);
  return !prev;
}

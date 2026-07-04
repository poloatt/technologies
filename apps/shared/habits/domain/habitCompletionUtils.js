/**
 * Utilidades compartidas para el estado de completitud de hábitos.
 * Soporta formato legacy (boolean) y formato por horario ({ MAÑANA: true, ... }).
 */

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

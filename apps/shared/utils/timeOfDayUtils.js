import { getUserTimezone } from './dateUtils.js';

// Rangos de horarios fijos
export const TIME_RANGES = {
  MAÑANA: { start: 6, end: 12 },
  TARDE: { start: 12, end: 18 },
  NOCHE: { start: 18, end: 6 } // Cruza medianoche: 18:00 - 6:00
};

// Valores válidos de horarios
export const VALID_TIME_OF_DAY = ['MAÑANA', 'TARDE', 'NOCHE'];

/**
 * Hora actual (0-23) en el timezone del usuario.
 */
function getCurrentHourInUserTimezone(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: getUserTimezone(),
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatter.format(date), 10);
  } catch {
    return date.getHours();
  }
}

/**
 * Determina el horario del día actual según la hora (timezone del usuario)
 * @param {Date} date - Fecha a evaluar (opcional, por defecto es ahora)
 * @returns {string} - 'MAÑANA', 'TARDE' o 'NOCHE'
 */
export const getCurrentTimeOfDay = (date = new Date()) => {
  const hour = getCurrentHourInUserTimezone(date);
  
  // Rango nocturno cruza medianoche (18:00 - 6:00)
  if (hour >= TIME_RANGES.NOCHE.start || hour < TIME_RANGES.NOCHE.end) {
    return 'NOCHE';
  }
  
  // Mañana: 6:00 - 12:00
  if (hour >= TIME_RANGES.MAÑANA.start && hour < TIME_RANGES.MAÑANA.end) {
    return 'MAÑANA';
  }
  
  // Tarde: 12:00 - 18:00
  if (hour >= TIME_RANGES.TARDE.start && hour < TIME_RANGES.TARDE.end) {
    return 'TARDE';
  }
  
  // Fallback (no debería llegar aquí)
  return 'MAÑANA';
};

/**
 * Verifica si un hábito debe mostrarse según su configuración de horarios
 * @param {Array<string>|undefined} horarios - Array de horarios configurados (ej: ['MAÑANA', 'TARDE'])
 * @param {string} currentTimeOfDay - Horario actual ('MAÑANA', 'TARDE' o 'NOCHE')
 * @returns {boolean} - true si el hábito debe mostrarse, false en caso contrario
 * @deprecated Usar shouldShowHabitByTimeOfDay para lógica acumulativa
 */
export const isTimeOfDayActive = (horarios, currentTimeOfDay) => {
  // Si no hay horarios configurados, mostrar siempre (comportamiento por defecto)
  if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
    return true;
  }
  
  // Normalizar horarios a mayúsculas
  const normalizedHorarios = horarios.map(h => String(h).toUpperCase());
  
  // Verificar si el horario actual está en la lista de horarios configurados
  return normalizedHorarios.includes(currentTimeOfDay);
};

/**
 * Verifica si un hábito debe mostrarse según su configuración de horarios con lógica acumulativa
 * 
 * Lógica acumulativa:
 * - MAÑANA: muestra hábitos sin horario + hábitos con horario "MAÑANA"
 * - TARDE: muestra hábitos sin horario + hábitos con horario "MAÑANA" (no completados) + hábitos con horario "TARDE"
 * - NOCHE: muestra hábitos sin horario + hábitos con horario "MAÑANA" (no completados) + hábitos con horario "TARDE" (no completados) + hábitos con horario "NOCHE"
 * 
 * @param {Array<string>|undefined} horarios - Array de horarios configurados (ej: ['MAÑANA', 'TARDE'])
 * @param {string} currentTimeOfDay - Horario actual ('MAÑANA', 'TARDE' o 'NOCHE')
 * @param {boolean} isCompleted - Si el hábito ya fue completado hoy
 * @returns {boolean} - true si el hábito debe mostrarse, false en caso contrario
 */
export const shouldShowHabitByTimeOfDay = (horarios, currentTimeOfDay, isCompleted = false) => {
  // Si no hay horarios configurados, mostrar siempre (comportamiento por defecto)
  if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
    return true;
  }
  
  // Normalizar horarios a mayúsculas
  const normalizedHorarios = horarios.map(h => String(h).toUpperCase());
  const normalizedTimeOfDay = String(currentTimeOfDay).toUpperCase();
  
  // Lógica acumulativa según el horario actual
  switch (normalizedTimeOfDay) {
    case 'MAÑANA':
      // Mañana: mostrar si incluye "MAÑANA"
      return normalizedHorarios.includes('MAÑANA');
      
    case 'TARDE':
      // Tarde: mostrar si incluye "TARDE" O si incluye "MAÑANA" y no está completado
      if (normalizedHorarios.includes('TARDE')) {
        return true;
      }
      if (normalizedHorarios.includes('MAÑANA') && !isCompleted) {
        return true;
      }
      return false;
      
    case 'NOCHE':
      // Noche: mostrar si incluye "NOCHE" O si incluye "TARDE" y no está completado O si incluye "MAÑANA" y no está completado
      if (normalizedHorarios.includes('NOCHE')) {
        return true;
      }
      if (normalizedHorarios.includes('TARDE') && !isCompleted) {
        return true;
      }
      if (normalizedHorarios.includes('MAÑANA') && !isCompleted) {
        return true;
      }
      return false;
      
    default:
      // Fallback: usar lógica simple si el horario no es reconocido
      return normalizedHorarios.includes(normalizedTimeOfDay);
  }
};

/**
 * Retorna etiqueta legible para un horario
 * @param {string} horario - Horario en mayúsculas ('MAÑANA', 'TARDE', 'NOCHE')
 * @returns {string} - Etiqueta legible ('Mañana', 'Tarde', 'Noche')
 */
export const getTimeOfDayLabel = (horario) => {
  const normalized = String(horario).toUpperCase();
  
  switch (normalized) {
    case 'MAÑANA':
      return 'Mañana';
    case 'TARDE':
      return 'Tarde';
    case 'NOCHE':
      return 'Noche';
    default:
      return horario;
  }
};

/**
 * Retorna etiquetas legibles para múltiples horarios
 * @param {Array<string>} horarios - Array de horarios
 * @returns {string} - Etiquetas separadas por comas (ej: 'Mañana, Tarde')
 */
export const getTimeOfDayLabels = (horarios) => {
  if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
    return '';
  }
  
  return normalizeTimeOfDay(horarios).map(getTimeOfDayLabel).join(', ');
};

/**
 * Valida que un array de horarios contenga solo valores válidos
 * @param {Array<string>} horarios - Array de horarios a validar
 * @returns {boolean} - true si todos los horarios son válidos
 */
export const validateTimeOfDay = (horarios) => {
  if (!horarios || !Array.isArray(horarios)) {
    return false;
  }
  
  return horarios.every(h => VALID_TIME_OF_DAY.includes(String(h).toUpperCase()));
};

/**
 * Normaliza un array de horarios a formato estándar (mayúsculas, sin duplicados)
 * @param {Array<string>|string|undefined} horarios - Horarios a normalizar
 * @returns {Array<string>} - Array normalizado de horarios
 */
export const normalizeTimeOfDay = (horarios) => {
  if (!horarios) {
    return [];
  }
  
  // Si es string, convertir a array
  if (typeof horarios === 'string') {
    horarios = [horarios];
  }
  
  // Si no es array, retornar array vacío
  if (!Array.isArray(horarios)) {
    return [];
  }
  
  // Normalizar a mayúsculas, eliminar duplicados y ordenar: MAÑANA → TARDE → NOCHE
  const normalized = horarios
    .map(h => String(h).toUpperCase())
    .filter(h => VALID_TIME_OF_DAY.includes(h));

  return [...new Set(normalized)].sort(
    (a, b) => VALID_TIME_OF_DAY.indexOf(a) - VALID_TIME_OF_DAY.indexOf(b),
  );
};

export default {
  getCurrentTimeOfDay,
  isTimeOfDayActive,
  shouldShowHabitByTimeOfDay,
  getTimeOfDayLabel,
  getTimeOfDayLabels,
  validateTimeOfDay,
  normalizeTimeOfDay,
  TIME_RANGES,
  VALID_TIME_OF_DAY
};


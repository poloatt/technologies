/**
 * Utilidades para la lógica de horarios de hábitos
 *
 * Un hábito solo es visible en las ventanas configuradas (MAÑANA, TARDE, NOCHE).
 * Dentro de cada ventana, se oculta si ese horario ya fue completado hoy.
 */

import { isHabitHorarioCompleted } from '../domain/habitCompletionUtils.js';
import { VALID_TIME_OF_DAY } from '../../utils/timeOfDayUtils.js';

const HORARIOS_ORDER = VALID_TIME_OF_DAY;

function normalizeHorarios(horarios) {
  if (!horarios || !Array.isArray(horarios)) return [];
  return horarios.map((h) => String(h).toUpperCase());
}

function getCurrentHorarioIndex(currentTimeOfDay) {
  return HORARIOS_ORDER.indexOf(String(currentTimeOfDay).toUpperCase());
}

/** Alguna franja configurada ya pasó hoy (sin incluir la ventana actual). */
export function hasConfiguredHorarioPassed(horarios, currentTimeOfDay) {
  const normalizedHorarios = normalizeHorarios(horarios);
  if (normalizedHorarios.length === 0) return false;

  const currentIndex = getCurrentHorarioIndex(currentTimeOfDay);
  if (currentIndex < 0) return false;
  if (normalizedHorarios.includes(HORARIOS_ORDER[currentIndex])) return false;

  for (let i = 0; i < currentIndex; i += 1) {
    if (normalizedHorarios.includes(HORARIOS_ORDER[i])) return true;
  }
  return false;
}

/**
 * Próximo horario configurado pendiente después del horario actual (para carrusel "Luego").
 */
export const getNextPendingHorario = (horarios, currentTimeOfDay, isCompletedToday = false) => {
  if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
    return null;
  }

  const normalizedHorarios = normalizeHorarios(horarios);
  const currentIndex = getCurrentHorarioIndex(currentTimeOfDay);
  if (currentIndex < 0) return null;

  for (let i = currentIndex + 1; i < HORARIOS_ORDER.length; i += 1) {
    const horario = HORARIOS_ORDER[i];
    if (normalizedHorarios.includes(horario) && !isHabitHorarioCompleted(isCompletedToday, horario)) {
      return horario;
    }
  }

  return null;
};

/**
 * Horario a mostrar/marcar en el carrusel según modo Ahora/Luego.
 * - ahora: ventana actual configurada y pendiente
 * - luego: próxima ventana futura pendiente
 */
export const getHorarioForCarousel = (
  mode,
  horarios,
  currentTimeOfDay,
  isCompletedToday = false,
) => {
  if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
    return null;
  }

  const normalizedHorarios = normalizeHorarios(horarios);
  const normalizedTimeOfDay = String(currentTimeOfDay).toUpperCase();

  if (mode === 'ahora') {
    if (!normalizedHorarios.includes(normalizedTimeOfDay)) return null;
    if (isHabitHorarioCompleted(isCompletedToday, normalizedTimeOfDay)) return null;
    return normalizedTimeOfDay;
  }

  if (mode === 'luego') {
    return getNextPendingHorario(horarios, currentTimeOfDay, isCompletedToday);
  }

  return null;
};

/**
 * Franjas pendientes para carrusel "Ahora" (retrasadas + ventana actual).
 * Sin horarios: un solo icono si sigue pendiente hoy.
 * Con 2+ franjas: puede devolver retrasada + actual el mismo día.
 * frecuencia > 1 con una sola franja: máximo un icono en Ahora.
 */
export const getDailyCarouselAhoraHorarios = (
  horarios,
  currentTimeOfDay,
  itemValue,
) => {
  if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
    if (typeof itemValue === 'boolean' && itemValue === true) return [];
    return [null];
  }

  const normalizedHorarios = normalizeHorarios(horarios);
  const currentIndex = getCurrentHorarioIndex(currentTimeOfDay);
  if (currentIndex < 0) return [];

  const slots = [];

  for (let i = 0; i < currentIndex; i += 1) {
    const horario = HORARIOS_ORDER[i];
    if (normalizedHorarios.includes(horario) && !isHabitHorarioCompleted(itemValue, horario)) {
      slots.push(horario);
    }
  }

  const currentHorario = HORARIOS_ORDER[currentIndex];
  if (
    normalizedHorarios.includes(currentHorario)
    && !isHabitHorarioCompleted(itemValue, currentHorario)
  ) {
    slots.push(currentHorario);
  }

  if (slots.length === 0) return [];

  const multiFranja = normalizedHorarios.length >= 2;
  if (multiFranja) return slots;

  return slots.slice(0, 1);
};

/**
 * Próximas franjas futuras pendientes para carrusel "Luego" (solo hoy, no retrasadas).
 */
export const getDailyCarouselLuegoHorarios = (
  horarios,
  currentTimeOfDay,
  itemValue,
) => {
  if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
    return [];
  }

  const normalizedHorarios = normalizeHorarios(horarios);
  const currentIndex = getCurrentHorarioIndex(currentTimeOfDay);
  if (currentIndex < 0) return [];

  const slots = [];
  for (let i = currentIndex + 1; i < HORARIOS_ORDER.length; i += 1) {
    const horario = HORARIOS_ORDER[i];
    if (normalizedHorarios.includes(horario) && !isHabitHorarioCompleted(itemValue, horario)) {
      slots.push(horario);
    }
  }
  return slots;
};

/**
 * ¿Un hábito diario multi-horario debe aparecer en el carrusel "Luego"?
 * @deprecated Usar getDailyCarouselLuegoHorarios
 */
export const shouldShowDailyInCarouselLuego = (horarios, currentTimeOfDay, isCompletedToday = false) => (
  getDailyCarouselLuegoHorarios(horarios, currentTimeOfDay, isCompletedToday).length > 0
);

/**
 * Determina si un hábito debe mostrarse según el horario actual.
 * Solo devuelve true si el horario actual está configurado y pendiente.
 */
export const shouldShowHabitForCurrentTime = (horarios, currentTimeOfDay, isCompletedToday = false, tipo = 'DIARIO', frecuencia = 1) => {
  if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
    return true;
  }

  const normalizedHorarios = horarios.map(h => String(h).toUpperCase());
  const normalizedTimeOfDay = String(currentTimeOfDay).toUpperCase();

  const isObjectFormat = typeof isCompletedToday === 'object' && isCompletedToday !== null && !Array.isArray(isCompletedToday);
  const isBooleanFormat = typeof isCompletedToday === 'boolean';

  if (!normalizedHorarios.includes(normalizedTimeOfDay)) {
    return false;
  }

  if (isObjectFormat) {
    return isCompletedToday[normalizedTimeOfDay] !== true;
  }
  if (isBooleanFormat) {
    return !isCompletedToday;
  }
  return true;
};

export const getCurrentTimeOfDayHabit = (horarios, currentTimeOfDay) => {
  if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
    return null;
  }

  const normalizedHorarios = horarios.map(h => String(h).toUpperCase());
  const normalizedTimeOfDay = String(currentTimeOfDay).toUpperCase();

  if (normalizedHorarios.includes(normalizedTimeOfDay)) {
    return normalizedTimeOfDay;
  }

  return null;
};

export const getHorarioToShow = (horarios, currentTimeOfDay, isCompletedToday = false, tipo = 'DIARIO', frecuencia = 1) => {
  return getHorarioForCarousel('ahora', horarios, currentTimeOfDay, isCompletedToday);
};

export const getActiveHabitForTimeOfDay = (habits, currentTimeOfDay, getHorarios = (habit) => habit?.config?.horarios) => {
  if (!Array.isArray(habits)) {
    return [];
  }

  return habits.filter(habit => {
    const horarios = getHorarios(habit);
    return shouldShowHabitForCurrentTime(horarios, currentTimeOfDay);
  });
};

export default {
  shouldShowHabitForCurrentTime,
  getCurrentTimeOfDayHabit,
  getActiveHabitForTimeOfDay,
  getHorarioToShow,
  getHorarioForCarousel,
  getNextPendingHorario,
  getDailyCarouselAhoraHorarios,
  getDailyCarouselLuegoHorarios,
  hasConfiguredHorarioPassed,
};

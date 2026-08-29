/**
 * Terminología unificada para Ahora/Luego en tareas y hábitos.
 * Glosario analítico: ver AGENDA_GLOSSARY.
 */

export const AGENDA_GLOSSARY = `
TAREAS (horizonte de fechas) — agendaRules.js
  taskHorizon.ahora / luego: filtro por fecha de vencimiento/inicio.
  isInAhora, getBucketAhora, getBucketLuego.

HÁBITOS DIARIOS — habitTimeLogic / habitVisibilityEngine
  Ahora: sin franja o franja actual; franjas retrasadas del mismo día.
  Luego: franjas futuras de hoy. Multi-franja (2+): puede haber 2 iconos en Ahora.
  Una sola franja: máximo 1 icono en Ahora (sin acumular por frecuencia).
  Repetición diaria = franja horaria (MAÑANA/TARDE/NOCHE). frecuencia define cuántas
  franjas puede tener el hábito; cada franja es un completado independiente en rutina.
  Carrusel y página Rutinas muestran badge de franja por repetición pendiente.

HÁBITOS PERIÓDICOS — habitVisibilityEngine.js / cadenciaUtils.js
  Deuda de cadencia: cuota del período pendiente tras día programado pasado (carry-over).
  Catch-up: completar en día no programado cuenta cuota; no altera diasSemana/diasMes.
  frecuencia === 1: Luego (no urgente); Ahora solo si isUrgentToday + ventana activa.
  Deuda en día no programado: siempre Luego en carrusel; Pendientes/Atrasados en Rutinas.
  frecuencia > 1: Ahora si ventana activa (adelanto); Luego si pasó ventana sin marcar hoy.

TRACKER / RUTINA — cadenciaUtils.debesMostrarHabitoEnFecha
  Grupos del desplegable por sección: "Hoy" (programados para el registro del día:
  pendientes/atrasados primero, completados después) y "No toca hoy" (sin cadencia hoy).
`;

/** Grupos del listado expandido en /rutinas (registro diario). */
export const RUTINA_DAY_GROUP_COPY = {
  today: 'Hoy',
  notToday: 'No toca hoy',
  done: 'Hecho',
};

/** Configuración y runtime de rutinas encadenadas. */
export const HABIT_CHAIN_COPY = {
  sectionTitle: 'Encadenamiento',
  stackButton: 'Apilar',
  noRoutine: 'Sin rutina',
  newRoutine: 'Nueva rutina',
  stackHint: 'Agrupa hábitos que suelen hacerse juntos',
  pickLabel: 'Hábitos de la rutina',
  noHabitsAvailable: 'No hay otros hábitos disponibles para apilar.',
  emptySection: 'No hay hábitos en este grupo',
  selectedCount: (n) => `${n} seleccionado${n === 1 ? '' : 's'}`,
  lockedTooltip: (prevLabel) => `Completa ${prevLabel} primero`,
  nextSnackbar: (label) => `Siguiente: ${label}`,
  stepProgress: (current, total) => `${current}/${total}`,
};

export const TASK_HORIZON_COPY = {
  ahora: {
    label: 'Ahora',
    ariaLabel: 'Horizonte de tareas: ahora',
  },
  luego: {
    label: 'Luego',
    ariaLabel: 'Horizonte de tareas: luego',
  },
};

export const HABIT_SLOT_COPY = {
  ahora: {
    label: 'Ahora',
    ariaLabel: 'Hábitos para ahora',
    regionAriaLabel: 'Hábitos para ahora',
  },
  luego: {
    label: 'Luego',
    ariaLabel: 'Hábitos para más tarde',
    regionAriaLabel: 'Hábitos para más tarde',
  },
};

export const HABIT_CAROUSEL_EMPTY_COPY = {
  ahora: 'Todo al día',
  luego: 'Nada pendiente para más tarde hoy',
};

export const HABIT_PERIODIC_COPY = {
  flexible: (n) => `Sin días fijos: completá ${n} veces cuando quieras esta semana`,
  flexibleHint: (n) => `Sin días elegidos: completá ${n} veces cuando quieras esta semana (una por día).`,
  fixed: 'Días fijos: solo los días elegidos',
  ahoraFlexible: 'Pendiente hoy en esta franja',
  luegoFlexible: 'Pendiente hoy, franja ya pasó',
  cadenciaDebt: 'Pendiente de este período (atrasado)',
};

export function getTaskHorizonCopy(view) {
  return TASK_HORIZON_COPY[view] || TASK_HORIZON_COPY.ahora;
}

export function getHabitSlotCopy(mode) {
  return HABIT_SLOT_COPY[mode] || HABIT_SLOT_COPY.ahora;
}

export function getHabitCarouselEmptyCopy(mode) {
  return HABIT_CAROUSEL_EMPTY_COPY[mode] || HABIT_CAROUSEL_EMPTY_COPY.ahora;
}

export function getPeriodicCarouselCopy(mode, { isCadenciaDebt } = {}) {
  if (isCadenciaDebt) return HABIT_PERIODIC_COPY.cadenciaDebt;
  if (mode === 'ahora') return HABIT_PERIODIC_COPY.ahoraFlexible;
  if (mode === 'luego') return HABIT_PERIODIC_COPY.luegoFlexible;
  return '';
}

export const TASK_HORIZON_GROUP_ARIA = 'Horizonte de tareas';

/**
 * Presentación canónica de iconos de hábito (feature Hábitos).
 * Rutinas y otros consumidores solo aplican este contrato; no redefinen estilos.
 *
 * Pendientes:
 * - Franja/slot activo → outline + borde circular (invitar a marcar).
 * - Franja anterior (sinHacer) → outline plano.
 * - Luego / diferido → outline plano con menos brillo (no tienta el click).
 *
 * Hechos:
 * - Siempre filled planos (sin borde circular).
 * - Hecho hoy → brillo pleno.
 * - Hecho antes (cuota del período aún vigente) → filled con brillo más sutil.
 */

/** Slots de carrusel: pendiente plano sin borde (sinHacer u overdue visible). */
export const HABIT_ICON_PLAIN_PENDING_SLOTS = Object.freeze([
  'sinHacer',
]);

/** Slots diferidos: outline plano + brillo bajo (Luego / no toca hoy). */
export const HABIT_ICON_DEFERRED_PENDING_SLOTS = Object.freeze([
  'luego',
  'notToday',
  'inactiveFranja',
]);

/** Tonos de hábito completado. */
export const HABIT_ICON_DONE_TONE = Object.freeze({
  TODAY: 'today',
  BEFORE: 'before',
});

/**
 * @param {string|null|undefined} carouselSlot
 * @param {{ isScheduled?: boolean }} [opts]
 */
export function isHabitIconDeferredPendingSlot(carouselSlot, { isScheduled = true } = {}) {
  if (carouselSlot && HABIT_ICON_DEFERRED_PENDING_SLOTS.includes(carouselSlot)) return true;
  if (!carouselSlot && !isScheduled) return true;
  return false;
}

/**
 * @param {string|null|undefined} carouselSlot
 */
export function isHabitIconPlainPendingSlot(carouselSlot) {
  return Boolean(carouselSlot && HABIT_ICON_PLAIN_PENDING_SLOTS.includes(carouselSlot));
}

/**
 * @param {string|null|undefined} doneTone
 * @returns {'today'|'before'|null}
 */
export function normalizeHabitIconDoneTone(doneTone) {
  if (doneTone === HABIT_ICON_DONE_TONE.BEFORE || doneTone === 'before') {
    return HABIT_ICON_DONE_TONE.BEFORE;
  }
  if (doneTone === HABIT_ICON_DONE_TONE.TODAY || doneTone === 'today') {
    return HABIT_ICON_DONE_TONE.TODAY;
  }
  return null;
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.isCompleted]
 * @param {boolean} [opts.plainPending] — franja anterior (sinHacer) en lista
 * @param {boolean} [opts.deferredPending] — Luego / diferido en lista
 * @param {string|null} [opts.carouselSlot]
 * @param {boolean} [opts.isScheduled]
 * @param {boolean} [opts.preferOutlineWhenPending] — false solo en carrusel de Tareas
 * @param {boolean} [opts.forcePlainPending] — preview futuro: outline plano sin borde para todos
 * @param {'today'|'before'|null} [opts.doneTone]
 * @returns {{
 *   outline: boolean,
 *   hideBorder: boolean,
 *   variant: 'completedToday'|'completedBefore'|'activePending'|'plainPending'|'deferredPending',
 *   doneTone: 'today'|'before'|null,
 * }}
 */
export function resolveHabitIconPresentation({
  isCompleted = false,
  plainPending = false,
  deferredPending = false,
  carouselSlot = null,
  isScheduled = true,
  preferOutlineWhenPending = true,
  forcePlainPending = false,
  doneTone = null,
} = {}) {
  const normalizedDoneTone = normalizeHabitIconDoneTone(doneTone);
  const completed = Boolean(isCompleted) || normalizedDoneTone != null;
  const resolvedDoneTone = completed
    ? (normalizedDoneTone || HABIT_ICON_DONE_TONE.TODAY)
    : null;

  if (completed) {
    const isBefore = resolvedDoneTone === HABIT_ICON_DONE_TONE.BEFORE;
    return {
      outline: false,
      hideBorder: true,
      variant: isBefore ? 'completedBefore' : 'completedToday',
      doneTone: resolvedDoneTone,
    };
  }

  if (forcePlainPending) {
    return {
      outline: Boolean(preferOutlineWhenPending),
      hideBorder: true,
      variant: 'plainPending',
      doneTone: null,
    };
  }

  const isDeferred = Boolean(deferredPending)
    || isHabitIconDeferredPendingSlot(carouselSlot, { isScheduled });
  if (isDeferred) {
    return {
      outline: Boolean(preferOutlineWhenPending),
      hideBorder: true,
      variant: 'deferredPending',
      doneTone: null,
    };
  }

  const isPlain = Boolean(plainPending)
    || isHabitIconPlainPendingSlot(carouselSlot);

  return {
    outline: Boolean(preferOutlineWhenPending),
    hideBorder: isPlain,
    variant: isPlain ? 'plainPending' : 'activePending',
    doneTone: null,
  };
}

/**
 * Color/opacity/outline del badge (cuota o franja) alineado a la presentación del icono.
 * @param {{ variant?: string, outline?: boolean, doneTone?: string|null }} presentation
 */
export function resolveHabitBadgeChrome(presentation = {}) {
  const variant = presentation.variant || 'activePending';
  switch (variant) {
    case 'completedToday':
      return { outline: false, colorToken: 'primary.main', opacity: 1 };
    case 'completedBefore':
      return { outline: false, colorToken: 'primary.main', opacity: 0.45 };
    case 'deferredPending':
      return { outline: true, colorToken: 'text.disabled', opacity: 0.4 };
    case 'plainPending':
      return { outline: true, colorToken: 'text.secondary', opacity: 0.78 };
    case 'activePending':
    default:
      return {
        outline: presentation.outline !== false,
        colorToken: 'text.secondary',
        opacity: 1,
      };
  }
}

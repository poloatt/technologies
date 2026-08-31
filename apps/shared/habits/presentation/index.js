/**
 * Presentación canónica Node-safe (sin MUI / React).
 * Glyphs outline/filled: importar desde `@shared/utils/habitOutlineIcons` o `iconConfig`.
 */
export {
  HABIT_ICON_PLAIN_PENDING_SLOTS,
  HABIT_ICON_DEFERRED_PENDING_SLOTS,
  HABIT_ICON_DONE_TONE,
  isHabitIconPlainPendingSlot,
  isHabitIconDeferredPendingSlot,
  normalizeHabitIconDoneTone,
  resolveHabitIconPresentation,
  resolveHabitBadgeChrome,
} from './habitIconPresentation.js';

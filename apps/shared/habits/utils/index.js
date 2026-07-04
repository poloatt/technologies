/**
 * @shared/habits/utils — cadencia, visibilidad y helpers de horario.
 */
export { default as shouldShowItem } from './shouldShowItem.js';

export { shouldShowItemSync, getVisibleItemIds } from './visibilityUtils.js';

export {
  formatRutinaDayLabel,
  formatRutinaDaySubtitle,
  getRutinaCompletionStats,
  findRutinaByDateStr,
  normalizeRutinaNavigateDate,
  resolveHabitConfigApplyFrom,
  isForwardConfigScope,
  resolveRutinaNavigateTarget,
  getRutinaDayMode,
  isRutinaHistorical,
  isRutinaToday,
} from './rutinasPageUtils.js';

export {
  debesMostrarHabitoEnFecha,
  contarCompletadosEnPeriodo,
  obtenerHistorialCompletados,
  getPeriodInterval,
  getFrecuenciaLabel,
  hasCadenciaDebt,
  isScheduledCadenciaDay,
  getCadenciaWeekRange,
  DIAS_SEMANA,
  CADENCIA_WEEK_STARTS_ON,
} from './cadenciaUtils.js';

export {
  shouldShowHabitForCurrentTime,
  getHorarioForCarousel,
} from './habitTimeLogic.js';

export {
  sortSectionHabitsByFixedOrder,
  sortSectionCarouselBySlot,
  resolveSectionCarouselSlot,
  SECTION_CAROUSEL_SLOTS,
  RUTINA_SECTION_LABELS,
  RUTINA_DAY_GROUP_LABELS,
  categorizeSectionHabits,
  groupSectionHabitsByDaySchedule,
  getSectionCarouselItems,
  getDefaultSelectedSection,
} from '../desktop/rutinaDesktopUtils.js';

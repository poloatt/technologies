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
  isHabitQuotaOrDayDone,
  resolveRutinaScheduleBucket,
} from '../desktop/rutinaDesktopUtils.js';

export {
  RUTINA_CADENCE_BUCKETS,
  resolveHabitCadenceBucket,
  getCadenceBucketLabel,
  compareCadenceBuckets,
} from './habitCadenceBuckets.js';

export { groupRutinaHabitsByCadence } from '../desktop/rutinaCadenceUtils.js';
export {
  getCadenceBucketCarouselItems,
  getCadenceBucketCompletionStats,
  getDefaultSelectedCadenceBucket,
  groupDailyCadenceByFranja,
  resolveActiveDailyFranja,
  isViewingRutinaToday,
  entryHasConfiguredDailyFranjas,
  resolveEntryFranjaFocusHorario,
  DAILY_CADENCE_FRANJA_ORDER,
  CADENCE_BUCKET_ICON_KEYS,
} from '../desktop/rutinaCadenceUtils.js';

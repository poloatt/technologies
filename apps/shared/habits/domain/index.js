/**
 * @shared/habits/domain — lógica pura (Node-safe).
 */
export { getRutinaFranjaItems } from './getRutinaFranjaItems.js';
export { resolveRutinaForDate } from './resolveRutinaForDate.js';
export { toPlainRutinaSnapshot, plainCloneDeep } from './plainRutinaSnapshot.js';
export { computeRutinaToggleValue } from './toggleHabitCompletion.js';
export { persistRutinaItemToggle } from './persistRutinaItemToggle.js';
export {
  computeCarouselToggleValue,
  computeFranjaToggleValue,
  computeNextHabitValue,
  isFranjaCompleted,
  habitRequiresExpandedCarouselToggle,
} from './habitToggleUtils.js';
export {
  getHabitItemValue,
  isHabitValueObject,
  rutinaItemValuesDiffer,
  isHabitCompletedForHistorial,
  isHabitHorarioCompleted,
  isHabitFullyCompletedToday,
  isHabitPartiallyCompletedToday,
  buildEmptyHabitCompletionValue,
  ensureHabitCompletionShape,
  getHabitCompletionSlotCount,
  getHabitCompletedSlotCount,
} from './habitCompletionUtils.js';

export {
  resolveCarouselItemConfig,
  resolveRutinaItemConfig,
  resolveEffectiveDailyHorarios,
} from './resolveRutinaItemConfig.js';

export {
  getHabitId,
  habitIdsMatch,
  findHabitIndexInSection,
  HABIT_SECTIONS,
  getHabitSectionItemIds,
  getCarouselSectionItemIds,
  findUserHabit,
  hasCustomHabitsStructure,
  getHabitSectionKeys,
  LEGACY_HABIT_SECTION_ITEM_IDS,
  DEFAULT_HABIT_ITEM_CONFIG,
} from './habitSectionIds.js';

export { getHabitDisplayLabel, LEGACY_HABIT_TOOLTIPS } from './habitDisplayLabels.js';

export {
  resolveItemVisibility,
  resolveItemVisibilityByCadence,
  shouldShowRutinaItem,
} from './resolveItemVisibility.js';

export { buildHistoricalFranjaMigrationPayload } from './migrateHistoricalRutinaFranjas.js';
export { buildHabitSectionLabelsMap } from './buildHabitSectionLabelsMap.js';
export {
  resolveHabitSections,
  resolveSectionLabel,
  resolveSectionIconKey,
  isCustomHabitSection,
} from './resolveHabitSections.js';
export { getRutinaPeriodStart, getRutinaPeriodEnd } from './rutinaPeriodBounds.js';

export {
  HABIT_CHAIN_TYPES,
  normalizeHabitStep,
  stepsEqual,
  generateChainId,
  findChainForHabit,
  getChainStepIndex,
  getPreviousStep,
  getNextStep,
  isStepCompletedToday,
  isChainStepLocked,
  resolveHabitChainContext,
  enrichEntryWithChainContext,
  buildManagerHabitListItems,
  groupHabitsIntoDisplayRows,
  groupEntriesIntoDisplayRows,
  getRutinaStackSortableId,
  resolveDisplayRowSortableId,
  reorderFlatEntriesByDisplayRowDnD,
  removeHabitFromChains,
  applyChainFormSave,
  buildChainFormState,
  listAllUserHabits,
  getChainDisplayLabel,
  resolveStackRoutineLabel,
  buildChainSelectOptions,
  updateHabitChainLabel,
  NEW_HABIT_CHAIN_VALUE,
  validateHabitChains,
  resolveNextActionableStep,
  shouldBlockChainToggle,
} from './habitChainUtils.js';

export {
  getCarouselItemsForMode,
  getCarouselAhoraItems,
  getCarouselLuegoItems,
  getCarouselCompletedTodayItems,
  isFlexiblePeriodic,
  getPeriodicCarouselMode,
  shouldShowInTracker,
} from '../engine/habitVisibilityEngine.js';

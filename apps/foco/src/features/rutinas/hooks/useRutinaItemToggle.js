import { useCallback } from 'react';
import {
  computeRutinaToggleValue,
  getHabitItemValue,
  persistRutinaItemToggle,
  rutinaItemValuesDiffer,
  isHabitCompletedForHistorial,
  resolveHabitChainContext,
  shouldBlockChainToggle,
  isStepCompletedToday,
  getHabitDisplayLabel,
} from '@shared/habits';
import { getCurrentTimeOfDay } from '@shared/utils/timeOfDayUtils';

/**
 * Toggle de completitud de un ítem con persistencia centralizada.
 * Opcionalmente sincroniza estado local vía callbacks.
 */
export default function useRutinaItemToggle({
  rutina,
  habits = null,
  habitsPreferences = {},
  habitChains = [],
  markItemComplete,
  patchRutinaSection,
  readOnly = false,
  getSectionOverrides,
  getLocalDataBySection,
  onOptimisticValue,
  onRevertValue,
  onServerValue,
  onChainStepComplete,
}) {
  return useCallback(async (section, itemId, horario = null, event = null) => {
    event?.stopPropagation?.();

    if (readOnly || !markItemComplete || !rutina?._id) return undefined;

    const overrides = getSectionOverrides?.(section) || {};
    const localDataBySection = getLocalDataBySection?.() || null;
    const previousValue = getHabitItemValue(rutina, section, itemId, overrides);
    const rutinaForToggle = {
      ...rutina,
      [section]: { ...(rutina[section] || {}), ...overrides },
    };
    const newValue = computeRutinaToggleValue({
      section,
      itemId,
      rutina: rutinaForToggle,
      habitsPreferences,
      horario,
      currentTimeOfDay: getCurrentTimeOfDay(),
    });

    const wasCompleted = isHabitCompletedForHistorial(previousValue);
    const willComplete = isHabitCompletedForHistorial(newValue) && !wasCompleted;
    const chainContext = resolveHabitChainContext(
      habitChains,
      section,
      itemId,
      rutinaForToggle,
      localDataBySection,
    );

    if (willComplete && shouldBlockChainToggle(chainContext)) {
      return undefined;
    }

    onOptimisticValue?.(section, itemId, newValue);

    try {
      const response = await persistRutinaItemToggle({
        rutinaId: rutina._id,
        section,
        itemId,
        newValue,
        previousValue,
        markItemComplete,
        patchRutinaSection,
      });

      const serverValue = response?.[section]?.[itemId];
      if (serverValue !== undefined && rutinaItemValuesDiffer(serverValue, newValue)) {
        onServerValue?.(section, itemId, serverValue);
      }

      if (willComplete && chainContext?.nextStep) {
        const { nextStep } = chainContext;
        const nextPending = !isStepCompletedToday(
          rutinaForToggle,
          nextStep.section,
          nextStep.habitId,
          localDataBySection,
        );
        if (nextPending) {
          const nextLabel = getHabitDisplayLabel(nextStep.section, nextStep.habitId, habits);
          onChainStepComplete?.({
            chainContext,
            completedStep: { section, habitId: itemId },
            nextStep,
            nextLabel,
          });
        }
      }

      return response;
    } catch (error) {
      onRevertValue?.(section, itemId, previousValue);
      throw error;
    }
  }, [
    rutina,
    habits,
    habitsPreferences,
    habitChains,
    markItemComplete,
    patchRutinaSection,
    readOnly,
    getSectionOverrides,
    getLocalDataBySection,
    onOptimisticValue,
    onRevertValue,
    onServerValue,
    onChainStepComplete,
  ]);
}

import { useCallback } from 'react';
import {
  computeRutinaToggleValue,
  getHabitItemValue,
  persistRutinaItemToggle,
  rutinaItemValuesDiffer,
} from '@shared/habits';
import { getCurrentTimeOfDay } from '@shared/utils/timeOfDayUtils';

/**
 * Toggle de completitud de un ítem con persistencia centralizada.
 * Opcionalmente sincroniza estado local vía callbacks.
 */
export default function useRutinaItemToggle({
  rutina,
  habitsPreferences = {},
  markItemComplete,
  patchRutinaSection,
  readOnly = false,
  getSectionOverrides,
  onOptimisticValue,
  onRevertValue,
  onServerValue,
}) {
  return useCallback(async (section, itemId, horario = null, event = null) => {
    event?.stopPropagation?.();

    if (readOnly || !markItemComplete || !rutina?._id) return undefined;

    const overrides = getSectionOverrides?.(section) || {};
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

      return response;
    } catch (error) {
      onRevertValue?.(section, itemId, previousValue);
      throw error;
    }
  }, [
    rutina,
    habitsPreferences,
    markItemComplete,
    patchRutinaSection,
    readOnly,
    getSectionOverrides,
    onOptimisticValue,
    onRevertValue,
    onServerValue,
  ]);
}

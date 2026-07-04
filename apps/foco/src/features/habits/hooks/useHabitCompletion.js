import { useCallback } from 'react';
import { computeNextHabitValue, isHabitCompletedForHistorial } from '@shared/habits';

/**
 * Hook para calcular el siguiente valor al togglear un hábito en el tracker.
 */
export default function useHabitCompletion({ localData, config, getItemCompleted }) {
  const computeToggle = useCallback((itemId, horario = null, currentTimeOfDay = null) => {
    const itemValue = localData[itemId];
    const itemConfig = config?.[itemId] || {};

    const isCompletedForHorario = (normalizedHorario) => {
      if (typeof getItemCompleted === 'function') {
        return getItemCompleted(itemId, normalizedHorario);
      }
      if (normalizedHorario && typeof itemValue === 'object' && itemValue !== null) {
        return itemValue[normalizedHorario] === true;
      }
      return isHabitCompletedForHistorial(itemValue);
    };

    return computeNextHabitValue({
      itemValue,
      itemConfig,
      horario,
      currentTimeOfDay,
      isCompletedForHorario,
    });
  }, [localData, config, getItemCompleted]);

  return { computeToggle };
}

import { useMemo, useCallback } from 'react';
import { useHabits, useRutinas } from '@shared/context';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import { groupRutinaHabitsByCadence } from '@shared/habits';
import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';
import useRutinaItemToggle from './useRutinaItemToggle';

/** Estado compartido para el layout plano de cadencia (fuente única: RutinasContext). */
export default function useRutinaCadenceBucketController({ rutina, readOnly = false }) {
  const { habits, customSections } = useHabits();
  const { habitsPreferences, habitChains, prefsReady } = useHabitsPreferences();
  const { markItemComplete } = useRutinas();
  const habitPrefs = prefsReady ? (habitsPreferences || {}) : {};
  const resolvedHabitChains = prefsReady ? habitChains : [];

  const habitIconsMap = useMemo(
    () => buildHabitSectionIconsMap(habits).iconsMap,
    [habits],
  );

  const cadenceBuckets = useMemo(
    () => groupRutinaHabitsByCadence({
      rutina,
      habits,
      habitsPreferences: habitPrefs,
      habitChains: resolvedHabitChains,
      customSections,
      iconsMap: habitIconsMap,
    }),
    [rutina, habits, habitPrefs, resolvedHabitChains, customSections, habitIconsMap],
  );

  const toggleItem = useRutinaItemToggle({
    rutina,
    habitsPreferences: habitPrefs,
    markItemComplete,
    readOnly,
  });

  const handleItemClick = useCallback((section, itemId, event, horario = null) => {
    toggleItem(section, itemId, horario, event);
  }, [toggleItem]);

  const handleDoneToggle = useCallback((entrySection, itemId, horario) => {
    handleItemClick(entrySection, itemId, null, horario);
  }, [handleItemClick]);

  return {
    habits,
    customSections,
    habitPrefs,
    cadenceBuckets,
    handleItemClick,
    handleDoneToggle,
  };
}

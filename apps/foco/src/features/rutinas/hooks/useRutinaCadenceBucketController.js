import { useMemo, useCallback } from 'react';
import { useHabits, useRutinas } from '@shared/context';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import { groupRutinaHabitsByCadence, resolveHabitSections } from '@shared/habits';
import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';
import useRutinaItemToggle from './useRutinaItemToggle';
import useRutinaBucketLocalData from './useRutinaBucketLocalData';

/** Estado compartido para layouts de vista cadencia (flat mobile + nav desktop). */
export default function useRutinaCadenceBucketController({ rutina, readOnly = false }) {
  const { habits, customSections, reorderHabits } = useHabits();
  const { habitsPreferences, habitChains, prefsReady } = useHabitsPreferences();
  const { markItemComplete, patchRutinaSection } = useRutinas();
  const habitPrefs = prefsReady ? (habitsPreferences || {}) : {};
  const resolvedHabitChains = prefsReady ? habitChains : [];

  const allSections = useMemo(
    () => resolveHabitSections(customSections),
    [customSections],
  );

  const [localDataBySection, setLocalDataBySection] = useRutinaBucketLocalData(allSections, rutina);

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
      localDataBySection,
    }),
    [rutina, habits, habitPrefs, resolvedHabitChains, customSections, habitIconsMap, localDataBySection],
  );

  const toggleItem = useRutinaItemToggle({
    rutina,
    habits,
    habitsPreferences: habitPrefs,
    habitChains: resolvedHabitChains,
    markItemComplete,
    patchRutinaSection,
    readOnly,
    getSectionOverrides: (section) => localDataBySection[section] || {},
    getLocalDataBySection: () => localDataBySection,
    onOptimisticValue: (section, itemId, newValue) => {
      setLocalDataBySection((prev) => ({
        ...prev,
        [section]: { ...(prev[section] || {}), [itemId]: newValue },
      }));
    },
    onRevertValue: (section, itemId, previousValue) => {
      setLocalDataBySection((prev) => ({
        ...prev,
        [section]: { ...(prev[section] || {}), [itemId]: previousValue },
      }));
    },
    onServerValue: (section, itemId, serverValue) => {
      setLocalDataBySection((prev) => ({
        ...prev,
        [section]: { ...(prev[section] || {}), [itemId]: serverValue },
      }));
    },
  });

  const handleItemClick = useCallback((section, itemId, event, horario = null) => {
    toggleItem(section, itemId, horario, event);
  }, [toggleItem]);

  const handleDoneToggle = useCallback((entrySection, itemId, horario) => {
    handleItemClick(entrySection, itemId, null, horario);
  }, [handleItemClick]);

  const handleReorderSection = useCallback(async (section, habitIds) => {
    if (!habitIds?.length || !section) return;
    try {
      await reorderHabits(section, habitIds);
    } catch {
      // feedback en HabitsContext
    }
  }, [reorderHabits]);

  return {
    habits,
    customSections,
    habitPrefs,
    localDataBySection,
    cadenceBuckets,
    handleItemClick,
    handleDoneToggle,
    handleReorderSection,
  };
}

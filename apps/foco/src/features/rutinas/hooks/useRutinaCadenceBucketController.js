import { useMemo, useCallback } from 'react';
import { useHabits, useRutinas } from '@shared/context';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import { groupRutinaHabitsByCadence, resolveHabitSections } from '@shared/habits';
import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';
import useRutinaItemToggle from './useRutinaItemToggle';
import useRutinaBucketLocalData from './useRutinaBucketLocalData';

/** Estado compartido para el layout plano de cadencia. */
export default function useRutinaCadenceBucketController({ rutina, readOnly = false }) {
  const { habits, customSections } = useHabits();
  const { habitsPreferences, habitChains, prefsReady } = useHabitsPreferences();
  // Solo markItemComplete: el optimismo vive en localDataBySection.
  // Pasar también patchRutinaSection duplicaba writes (local + context) y reorganizaba 2–3 veces por click.
  const { markItemComplete } = useRutinas();
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
    habitsPreferences: habitPrefs,
    markItemComplete,
    readOnly,
    getSectionOverrides: (section) => localDataBySection[section] || {},
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
    // onServerValue omitido a propósito: useRutinaBucketLocalData ya sincroniza
    // desde `rutina` tras markItemComplete (evita un segundo rewrite de localData).
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
    localDataBySection,
    cadenceBuckets,
    handleItemClick,
    handleDoneToggle,
  };
}

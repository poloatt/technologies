import React, { useMemo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { useHabits, useRutinas } from '@shared/context';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import {
  groupRutinaHabitsByCadence,
  groupDailyCadenceByFranja,
  groupWeeklyCadenceByWeekday,
  resolveHabitSections,
} from '@shared/habits';
import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';
import useRutinaItemToggle from '../../hooks/useRutinaItemToggle';
import useRutinaBucketLocalData from '../../hooks/useRutinaBucketLocalData';
import RutinaDailyCadenceFranjaLayout from './RutinaDailyCadenceFranjaLayout';
import RutinaWeeklyCadenceDayLayout from './RutinaWeeklyCadenceDayLayout';
import RutinaCadenceBucketList from './RutinaCadenceBucketList';
import RutinaDoneSection from '../section/RutinaDoneSection';

function dedupeDoneEntries(items = []) {
  const seen = new Set();
  return items.filter((entry) => {
    const key = `${entry.section}:${entry.itemId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Vista cadencia plana: Mañana → Tarde → Noche → Hecho → Lunes → … */
export default function RutinaCadenceFlatLayout({
  rutina,
  readOnly = false,
}) {
  const { habits, customSections, reorderHabits } = useHabits();
  const { habitsPreferences, habitChains, prefsReady } = useHabitsPreferences();
  const { markItemComplete } = useRutinas();
  const habitPrefs = prefsReady ? (habitsPreferences || {}) : {};

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
      habitChains: prefsReady ? habitChains : [],
      customSections,
      iconsMap: habitIconsMap,
      localDataBySection,
    }),
    [rutina, habits, habitPrefs, habitChains, prefsReady, customSections, habitIconsMap, localDataBySection],
  );

  const diarioBucket = useMemo(
    () => cadenceBuckets.find((bucket) => bucket.id === 'DIARIO') || null,
    [cadenceBuckets],
  );

  const semanalBucket = useMemo(
    () => cadenceBuckets.find((bucket) => bucket.id === 'SEMANAL') || null,
    [cadenceBuckets],
  );

  const otherBuckets = useMemo(
    () => cadenceBuckets.filter((bucket) => bucket.id !== 'DIARIO' && bucket.id !== 'SEMANAL'),
    [cadenceBuckets],
  );

  const mergedDoneItems = useMemo(() => {
    const dailyDone = diarioBucket
      ? groupDailyCadenceByFranja(diarioBucket, rutina).flatMap((group) => group.done)
      : [];
    const weeklyDone = semanalBucket
      ? groupWeeklyCadenceByWeekday(semanalBucket, rutina).flatMap((group) => group.done)
      : [];
    const otherDone = otherBuckets.flatMap((bucket) => bucket.done || []);
    return dedupeDoneEntries([...dailyDone, ...weeklyDone, ...otherDone]);
  }, [diarioBucket, semanalBucket, otherBuckets, rutina]);

  const hasContentAboveDone = useMemo(() => {
    const dailyPending = diarioBucket
      ? groupDailyCadenceByFranja(diarioBucket, rutina).some(
        (group) => group.today.length > 0 || group.notToday.length > 0,
      )
      : false;
    const weeklyPending = semanalBucket
      ? groupWeeklyCadenceByWeekday(semanalBucket, rutina).some((group) => group.pending.length > 0)
      : false;
    const otherPending = otherBuckets.some(
      (bucket) => (bucket.today?.length || 0) > 0 || (bucket.notToday?.length || 0) > 0,
    );
    return dailyPending || weeklyPending || otherPending;
  }, [diarioBucket, semanalBucket, otherBuckets, rutina]);

  const toggleItem = useRutinaItemToggle({
    rutina,
    habits,
    habitsPreferences: habitPrefs,
    habitChains: prefsReady ? habitChains : [],
    markItemComplete,
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

  if (cadenceBuckets.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No hay hábitos activos para mostrar
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      {diarioBucket && (
        <RutinaDailyCadenceFranjaLayout
          bucket={diarioBucket}
          rutina={rutina}
          readOnly={readOnly}
          onItemClick={handleItemClick}
          habits={habits}
          habitsPreferences={habitPrefs}
          localDataBySection={localDataBySection}
          includeDoneSection={false}
          useShortFranjaLabels
          onReorderSection={handleReorderSection}
        />
      )}

      <RutinaDoneSection
        items={mergedDoneItems}
        rutina={rutina}
        habitsPreferences={habitPrefs}
        readOnly={readOnly}
        onToggle={handleDoneToggle}
        showDivider={hasContentAboveDone}
      />

      {semanalBucket && (
        <RutinaWeeklyCadenceDayLayout
          bucket={semanalBucket}
          rutina={rutina}
          readOnly={readOnly}
          onItemClick={handleItemClick}
          habits={habits}
          habitsPreferences={habitPrefs}
          localDataBySection={localDataBySection}
          includeDoneSection={false}
          onReorderSection={handleReorderSection}
        />
      )}

      {otherBuckets.map((bucket) => (
        <Box key={bucket.id}>
          <RutinaCadenceBucketList
            bucket={bucket}
            rutina={rutina}
            readOnly={readOnly}
            sortable
            habits={habits}
            habitsPreferences={habitPrefs}
            localDataBySection={localDataBySection}
            onItemClick={handleItemClick}
            onReorderSection={handleReorderSection}
          />
        </Box>
      ))}
    </Box>
  );
}

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Box } from '@mui/material';
import { useHabits, useRutinas } from '@shared/context';
import { getCurrentTimeOfDay } from '@shared/utils/timeOfDayUtils';
import {
  groupRutinaHabitsByCadence,
  getDefaultSelectedCadenceBucket,
} from '@shared/habits';
import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';
import useHabitCarouselToggle from '@foco/features/habits/carousel/useHabitCarouselToggle';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import useRutinaItemToggle from '@foco/features/habits/hooks/useRutinaItemToggle';
import RutinaCadenceNav from './RutinaCadenceNav';
import RutinaCadenceDetailPanel from './RutinaCadenceDetailPanel';

/** Layout master-detail para vista por cadencia en desktop (paridad con RutinaDesktopLayout). */
export default function RutinaCadenceDesktopLayout({
  rutina,
  readOnly = false,
}) {
  const { habits, customSections } = useHabits();
  const { habitsPreferences, habitChains, prefsReady } = useHabitsPreferences();
  const { markItemComplete, patchRutinaSection } = useRutinas();
  const dragRef = useRef({ moved: false });
  const prefs = prefsReady ? (habitsPreferences || {}) : {};

  const habitIconsMap = useMemo(
    () => buildHabitSectionIconsMap(habits).iconsMap,
    [habits],
  );

  const cadenceBuckets = useMemo(
    () => groupRutinaHabitsByCadence({
      rutina,
      habits,
      habitsPreferences: prefs,
      habitChains: prefsReady ? habitChains : [],
      customSections,
      iconsMap: habitIconsMap,
    }),
    [rutina, habits, prefs, habitChains, prefsReady, customSections, habitIconsMap],
  );

  const [selectedBucket, setSelectedBucket] = useState(() =>
    getDefaultSelectedCadenceBucket(cadenceBuckets),
  );

  useEffect(() => {
    if (!prefsReady) return;
    const buckets = groupRutinaHabitsByCadence({
      rutina,
      habits,
      habitsPreferences: prefs,
      habitChains: prefsReady ? habitChains : [],
      customSections,
      iconsMap: habitIconsMap,
    });
    setSelectedBucket((prev) => (
      buckets.some((b) => b.id === prev)
        ? prev
        : getDefaultSelectedCadenceBucket(buckets)
    ));
  }, [rutina?._id, habits, prefsReady, habitsPreferences, habitChains, customSections, habitIconsMap]);

  const handleToggle = useHabitCarouselToggle({
    mode: 'ahora',
    interactive: !readOnly,
    dragRef,
    rutinaHoy: rutina,
    markItemComplete,
    patchRutinaSection,
    currentTimeOfDay: getCurrentTimeOfDay(),
    habitsPreferences: prefs,
  });

  const toggleItem = useRutinaItemToggle({
    rutina,
    habitsPreferences: prefs,
    markItemComplete,
    patchRutinaSection,
    readOnly,
  });

  const handleItemClick = useCallback((section, itemId, event, horario = null) => {
    toggleItem(section, itemId, horario, event);
  }, [toggleItem]);

  if (cadenceBuckets.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        width: '100%',
        minHeight: 0,
        alignItems: 'flex-start',
      }}
    >
      <RutinaCadenceNav
        rutina={rutina}
        habits={habits}
        habitsPreferences={prefs}
        customSections={customSections}
        selectedBucket={selectedBucket}
        onSelectBucket={setSelectedBucket}
      />
      <RutinaCadenceDetailPanel
        bucketId={selectedBucket}
        rutina={rutina}
        habits={habits}
        habitsPreferences={prefs}
        customSections={customSections}
        readOnly={readOnly}
        onItemClick={handleItemClick}
        onToggle={handleToggle}
      />
    </Box>
  );
}

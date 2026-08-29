import React, { useMemo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { useHabits } from '@shared/context';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import RutinaCadenceBucketList from './RutinaCadenceBucketList';
import { groupRutinaHabitsByCadence } from '@shared/habits';
import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';

/** Panel de detalle para un bucket de cadencia (paridad con RutinaSectionDetailPanel). */
export default function RutinaCadenceDetailPanel({
  bucketId,
  rutina,
  habits,
  habitsPreferences = {},
  customSections = [],
  readOnly = false,
  onItemClick,
}) {
  const { reorderHabits } = useHabits();
  const { habitChains, prefsReady } = useHabitsPreferences();

  const habitIconsMap = useMemo(
    () => buildHabitSectionIconsMap(habits).iconsMap,
    [habits],
  );

  const bucket = useMemo(() => {
    const buckets = groupRutinaHabitsByCadence({
      rutina,
      habits,
      habitsPreferences,
      habitChains: prefsReady ? habitChains : [],
      customSections,
      iconsMap: habitIconsMap,
    });
    return buckets.find((b) => b.id === bucketId) || null;
  }, [bucketId, rutina, habits, habitsPreferences, habitChains, prefsReady, customSections, habitIconsMap]);

  const handleReorderSection = useCallback(async (section, habitIds) => {
    if (!habitIds?.length || !section) return;
    try {
      await reorderHabits(section, habitIds);
    } catch {
      // feedback en HabitsContext
    }
  }, [reorderHabits]);

  const handleBucketItemClick = useCallback((section, itemId, event, horario) => {
    onItemClick?.(section, itemId, event, horario);
  }, [onItemClick]);

  if (!bucket) {
    return (
      <Box sx={{ flex: 1, minWidth: 0, py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No hay hábitos en esta cadencia
        </Typography>
      </Box>
    );
  }

  const hasAny = bucket.today.length > 0 || bucket.done.length > 0 || bucket.notToday.length > 0;

  if (!hasAny) {
    return (
      <Box sx={{ flex: 1, minWidth: 0, py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No hay hábitos en esta cadencia
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      role="region"
      aria-label="Detalle de hábitos por cadencia"
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <RutinaCadenceBucketList
        bucket={bucket}
        rutina={rutina}
        readOnly={readOnly}
        sortable
        habits={habits}
        habitsPreferences={habitsPreferences}
        onItemClick={handleBucketItemClick}
        onReorderSection={handleReorderSection}
      />
    </Box>
  );
}

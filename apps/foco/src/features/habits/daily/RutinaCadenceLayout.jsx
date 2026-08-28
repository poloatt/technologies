import React, { useMemo } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { useHabits } from '@shared/context';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import useResponsive from '@shared/hooks/useResponsive';
import { groupRutinaHabitsByCadence } from '@shared/habits';
import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';
import {
  rutinaGridContainerSx,
  rutinaGridItemSx,
} from '@shared/styles/rutinaPageStyles';
import RutinaCadenceCard from './RutinaCadenceCard';
import RutinaCadenceDesktopLayout from './RutinaCadenceDesktopLayout';

/** Vista de rutinas agrupada por cadencia (Diario, Semanal, …). */
export default function RutinaCadenceLayout({
  rutina,
  readOnly = false,
  variant = 'mobile',
  expandedCadence = null,
  onExpandedCadenceChange,
}) {
  const { habits, customSections } = useHabits();
  const { habitsPreferences, prefsReady } = useHabitsPreferences();
  const habitPrefs = prefsReady ? (habitsPreferences || {}) : {};
  const { isDesktop } = useResponsive();

  const habitIconsMap = useMemo(
    () => buildHabitSectionIconsMap(habits).iconsMap,
    [habits],
  );

  const cadenceBuckets = useMemo(
    () => groupRutinaHabitsByCadence({
      rutina,
      habits,
      habitsPreferences: habitPrefs,
      customSections,
      iconsMap: habitIconsMap,
    }),
    [rutina, habits, habitPrefs, customSections, habitIconsMap],
  );

  if (cadenceBuckets.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No hay hábitos activos para mostrar
        </Typography>
      </Box>
    );
  }

  const useDesktopLayout = variant === 'desktop' || isDesktop;

  if (useDesktopLayout) {
    return (
      <RutinaCadenceDesktopLayout
        rutina={rutina}
        readOnly={readOnly}
      />
    );
  }

  return (
    <Grid container spacing={1} sx={rutinaGridContainerSx}>
      {cadenceBuckets.map((bucket) => (
        <Grid item xs={12} md={6} sx={rutinaGridItemSx} key={bucket.id}>
          <RutinaCadenceCard
            bucket={bucket}
            rutina={rutina}
            readOnly={readOnly}
            expandedCadence={expandedCadence}
            onExpandedCadenceChange={onExpandedCadenceChange}
          />
        </Grid>
      ))}
    </Grid>
  );
}

import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { DynamicIcon } from '@shared/components/common/DynamicIcon';
import {
  groupRutinaHabitsByCadence,
  getCadenceBucketCompletionStats,
  CADENCE_BUCKET_ICON_KEYS,
} from '@shared/habits';
import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import { hubSectionBg } from '@shared/styles/hubSectionStyles';

const navItemSx = (selected) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  px: 1,
  py: 0.5,
  borderRadius: 1.5,
  cursor: 'pointer',
  bgcolor: selected ? 'action.selected' : hubSectionBg,
  border: '1px solid',
  borderColor: selected ? 'primary.main' : 'divider',
  transition: 'border-color 0.15s, background-color 0.15s',
  '&:hover': {
    bgcolor: selected ? 'action.selected' : 'action.hover',
  },
});

/** Sidebar de navegación por bucket de cadencia (paridad con RutinaSectionNav). */
export default function RutinaCadenceNav({
  rutina,
  habits,
  habitsPreferences = {},
  customSections = [],
  localDataBySection = {},
  selectedBucket,
  onSelectBucket,
}) {
  const { habitChains, prefsReady } = useHabitsPreferences();
  const habitIconsMap = useMemo(
    () => buildHabitSectionIconsMap(habits).iconsMap,
    [habits],
  );

  const cadenceBuckets = useMemo(
    () => groupRutinaHabitsByCadence({
      rutina,
      habits,
      habitsPreferences,
      habitChains: prefsReady ? habitChains : [],
      customSections,
      iconsMap: habitIconsMap,
      localDataBySection,
    }),
    [rutina, habits, habitsPreferences, habitChains, prefsReady, customSections, habitIconsMap, localDataBySection],
  );

  return (
    <Box
      component="nav"
      aria-label="Cadencias de hábitos"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        minWidth: 220,
        maxWidth: 260,
        flexShrink: 0,
      }}
    >
      {cadenceBuckets.map((bucket) => {
        const { completed, total } = getCadenceBucketCompletionStats(bucket);
        const iconKey = CADENCE_BUCKET_ICON_KEYS[bucket.id] || 'repeat';

        return (
          <Box
            key={bucket.id}
            role="button"
            tabIndex={0}
            aria-pressed={selectedBucket === bucket.id}
            onClick={() => onSelectBucket(bucket.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectBucket(bucket.id);
              }
            }}
            sx={navItemSx(selectedBucket === bucket.id)}
          >
            <DynamicIcon
              iconKey={iconKey}
              size="small"
              sx={{ color: 'text.secondary', flexShrink: 0 }}
            />
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                flex: 1,
                minWidth: 0,
                fontSize: '0.8125rem',
                lineHeight: 1.25,
              }}
            >
              {bucket.label}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              {completed}/{total}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

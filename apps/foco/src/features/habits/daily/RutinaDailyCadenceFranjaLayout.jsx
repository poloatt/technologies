import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import {
  groupDailyCadenceByFranja,
  resolveActiveDailyFranja,
  isViewingRutinaToday,
  DAILY_CADENCE_FRANJA_ORDER,
} from '@shared/habits';
import RutinaDayGroupList from './RutinaDayGroupList';
import RutinaFranjaIconCarousel from './RutinaFranjaIconCarousel';
import RutinaDoneSection from './RutinaDoneSection';

const TIME_FRANJA_ORDER = DAILY_CADENCE_FRANJA_ORDER.filter((key) => key !== 'GENERAL');

const FRANJA_HEADING_SX = {
  px: 0.5,
  py: 0.5,
  display: 'block',
  fontWeight: 600,
  color: 'text.secondary',
  letterSpacing: '0.02em',
  fontSize: '0.75rem',
};

/**
 * Bucket Diario: Mañana → Tarde → Noche → Hecho.
 * Hoy: franja activa en lista; histórico/futuro: todas en carrusel horizontal.
 */
export default function RutinaDailyCadenceFranjaLayout({
  bucket,
  rutina,
  readOnly,
  onItemClick,
  onEditHabit,
  habitsPreferences = {},
  localDataBySection = {},
}) {
  const franjaGroups = useMemo(
    () => groupDailyCadenceByFranja(bucket, rutina),
    [bucket, rutina],
  );

  const activeFranja = useMemo(() => resolveActiveDailyFranja(rutina), [rutina]);
  const isViewingToday = useMemo(() => isViewingRutinaToday(rutina), [rutina]);

  const groupsByKey = useMemo(
    () => Object.fromEntries(franjaGroups.map((group) => [group.franjaKey, group])),
    [franjaGroups],
  );

  const allDoneItems = useMemo(() => {
    const seen = new Set();
    return franjaGroups.flatMap((group) => group.done).filter((entry) => {
      const key = `${entry.section}:${entry.itemId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [franjaGroups]);

  const handleCarouselToggle = (entrySection, itemId, horario) => {
    onItemClick(entrySection, itemId, null, horario);
  };

  const handleDoneToggle = (entrySection, itemId, horario) => {
    onItemClick(entrySection, itemId, null, horario);
  };

  const renderDayGroup = (group) => (
    <RutinaDayGroupList
      today={group.today}
      done={group.done}
      notToday={group.notToday}
      rutina={rutina}
      readOnly={readOnly}
      sortable={false}
      multiSection
      hideDone
      useFranjaHeadings
      sectionLabel={group.franjaLabel}
      habitsPreferences={habitsPreferences}
      localDataBySection={localDataBySection}
      rowKeyPrefix={group.franjaKey}
      onItemClick={(itemId, event, horario, entrySection) => {
        onItemClick(entrySection, itemId, event, horario);
      }}
      onDoneToggle={(entrySection, itemId, event, horario) => {
        onItemClick(entrySection, itemId, event, horario);
      }}
      onEditHabit={onEditHabit}
    />
  );

  const hasFranjaPending = (group) => group
    && (group.today.length > 0 || group.notToday.length > 0);

  const hasContentAboveDone = TIME_FRANJA_ORDER.some((key) => hasFranjaPending(groupsByKey[key]));

  const renderTimeFranja = (franjaKey) => {
    const group = groupsByKey[franjaKey];
    if (!hasFranjaPending(group)) return null;

    const isActive = franjaKey === activeFranja;
    const useStackedList = isViewingToday && isActive;

    if (useStackedList) {
      return (
        <Box key={franjaKey} sx={{ mb: 1 }}>
          {renderDayGroup(group)}
        </Box>
      );
    }

    const carouselItems = isViewingToday
      ? group.today
      : [...group.today, ...group.notToday];

    return (
      <Box key={franjaKey} sx={{ mb: 1 }}>
        <Typography variant="caption" sx={FRANJA_HEADING_SX}>
          {group.franjaLabel}
        </Typography>
        <RutinaFranjaIconCarousel
          pending={carouselItems}
          franjaKey={group.franjaKey}
          activeFranjaKey={activeFranja}
          rutina={rutina}
          habitsPreferences={habitsPreferences}
          readOnly={readOnly}
          onToggle={handleCarouselToggle}
        />
      </Box>
    );
  };

  return (
    <Box>
      {TIME_FRANJA_ORDER.map(renderTimeFranja)}

      <RutinaDoneSection
        items={allDoneItems}
        rutina={rutina}
        habitsPreferences={habitsPreferences}
        readOnly={readOnly}
        onToggle={handleDoneToggle}
        showDivider={hasContentAboveDone}
      />
    </Box>
  );
}

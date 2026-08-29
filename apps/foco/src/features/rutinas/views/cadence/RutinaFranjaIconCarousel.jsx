import React, { useMemo, useCallback } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { isSameDay, startOfDay } from 'date-fns';
import { getNormalizedToday, parseAPIDate } from '@shared/utils/dateUtils';
import { getCurrentTimeOfDay, VALID_TIME_OF_DAY } from '@shared/utils/timeOfDayUtils';
import { resolveRutinaItemConfig, resolveEntryFranjaFocusHorario, groupEntriesIntoDisplayRows, resolveStackRoutineLabel } from '@shared/habits';
import HabitCarouselIconButton from '@shared/components/habits/HabitCarouselIconButton';
import HabitCarouselScrollTrack from '@shared/components/habits/HabitCarouselScrollTrack';
import { RoutineCarouselStackCluster } from '@shared/components/habits/routines';
import useHorizontalDragScroll from '@shared/hooks/useHorizontalDragScroll';
import useResponsive from '@shared/hooks/useResponsive';
import { getHabitCarouselSurface } from '@shared/styles/habitCarouselStyles';
import { hubSectionBg } from '@shared/styles/hubSectionStyles';

function resolveEntryHorario(entry) {
  const focusHorario = resolveEntryFranjaFocusHorario(entry);
  if (focusHorario) return focusHorario;
  const horarios = Array.isArray(entry?.config?.horarios) ? entry.config.horarios : [];
  if (horarios.length === 1) return String(horarios[0]).toUpperCase();
  return null;
}

function resolveCarouselMode(franjaKey, activeFranjaKey) {
  const activeIdx = VALID_TIME_OF_DAY.indexOf(activeFranjaKey);
  const franjaIdx = VALID_TIME_OF_DAY.indexOf(franjaKey);
  if (franjaIdx > activeIdx) return 'luego';
  return 'ahora';
}

function resolveViewingTimeOfDay(rutina) {
  if (!rutina?.fecha) return getCurrentTimeOfDay();
  try {
    const rutinaDate = startOfDay(parseAPIDate(rutina.fecha));
    return isSameDay(rutinaDate, getNormalizedToday()) ? getCurrentTimeOfDay() : 'MAÑANA';
  } catch {
    return getCurrentTimeOfDay();
  }
}

/** Carrusel compacto de iconos para franjas no activas (solo pendientes). */
export default function RutinaFranjaIconCarousel({
  pending = [],
  franjaKey,
  activeFranjaKey,
  rutina,
  habitsPreferences = {},
  readOnly = false,
  onToggle,
}) {
  const theme = useTheme();
  const { isMobileOrTablet } = useResponsive();
  const carouselMode = resolveCarouselMode(franjaKey, activeFranjaKey);
  const currentTimeOfDay = resolveViewingTimeOfDay(rutina);

  const displayRows = useMemo(
    () => groupEntriesIntoDisplayRows(pending),
    [pending],
  );

  const { size, bg, hoverBg, rail, iconFontSize } = getHabitCarouselSurface(theme, {
    dense: !isMobileOrTablet,
    mobile: isMobileOrTablet,
  });

  const { scrollRef, isDragging, bind, dragRef } = useHorizontalDragScroll({
    enabled: !readOnly,
  });

  const scrollTrackSx = useMemo(() => ({
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: isMobileOrTablet ? 0.5 : 0.25,
    overflowX: 'auto',
    overflowY: 'hidden',
    touchAction: 'pan-x',
    overscrollBehaviorX: 'contain',
    WebkitOverflowScrolling: 'touch',
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    minHeight: size + 4,
    py: 0.25,
    width: '100%',
    '&::-webkit-scrollbar': { display: 'none' },
  }), [isDragging, isMobileOrTablet, size]);

  const handleToggle = useCallback((section, itemId, horario) => {
    if (dragRef.current.moved) return;
    onToggle?.(section, itemId, horario);
  }, [dragRef, onToggle]);

  const renderEntryIcon = useCallback((entry) => {
    const section = entry.section;
    const { itemId, label, Icon } = entry;
    if (!Icon || !section) return null;

    const itemConfig = resolveRutinaItemConfig(section, itemId, rutina, habitsPreferences);
    const itemValue = rutina?.[section]?.[itemId];
    const displayHorario = resolveEntryHorario(entry);
    const carouselKey = `${section}-${itemId}-${displayHorario || 'none'}`;
    const isNotToday = entry.isScheduled === false;
    const isActiveFranja = franjaKey === activeFranjaKey;
    const carouselSlot = isNotToday
      ? 'notToday'
      : (isActiveFranja ? 'ahora' : 'inactiveFranja');

    return (
      <Box key={carouselKey} sx={{ display: 'inline-flex', flex: '0 0 auto', flexShrink: 0 }}>
        <HabitCarouselIconButton
          section={section}
          itemId={itemId}
          Icon={Icon}
          label={label}
          itemConfig={itemConfig}
          itemValue={itemValue}
          currentTimeOfDay={currentTimeOfDay}
          rutinaHoy={rutina}
          mode={carouselMode}
          displayHorario={displayHorario}
          carouselSlot={carouselSlot}
          isScheduled={!isNotToday}
          dense={!isMobileOrTablet}
          interactive={!readOnly}
          showCompletionState
          bg={bg}
          hoverBg={hoverBg}
          rail={rail}
          size={size}
          iconFontSize={iconFontSize}
          onToggle={handleToggle}
        />
      </Box>
    );
  }, [
    activeFranjaKey,
    bg,
    carouselMode,
    currentTimeOfDay,
    franjaKey,
    habitsPreferences,
    hoverBg,
    iconFontSize,
    isMobileOrTablet,
    rail,
    readOnly,
    rutina,
    size,
    handleToggle,
  ]);

  if (!displayRows.length) return null;

  return (
    <HabitCarouselScrollTrack
      itemCount={displayRows.length}
      fadeColor={hubSectionBg}
      theme={theme}
      scrollTrackSx={scrollTrackSx}
      enableDragScroll={!readOnly}
      centerWhenFits={isMobileOrTablet}
      bind={bind}
      mergeScrollRef={(node) => {
        scrollRef.current = node;
      }}
    >
      {displayRows.map((row) => {
        if (row.kind === 'stack') {
          const stackLabel = resolveStackRoutineLabel(row.entries[0]?.chain);
          return (
            <RoutineCarouselStackCluster key={`stack-${row.chainId}`} chainId={row.chainId} label={stackLabel}>
              {row.entries.map((entry) => renderEntryIcon({ ...entry, label: stackLabel }))}
            </RoutineCarouselStackCluster>
          );
        }
        return renderEntryIcon(row.entry);
      })}
    </HabitCarouselScrollTrack>
  );
}

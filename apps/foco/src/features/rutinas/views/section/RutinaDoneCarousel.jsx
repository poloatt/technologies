import React, { useMemo, useCallback } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { getCurrentTimeOfDay } from '@shared/utils/timeOfDayUtils';
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

/** Carrusel horizontal de hábitos completados / cuota satisfecha. */
export default function RutinaDoneCarousel({
  items = [],
  rutina,
  habitsPreferences = {},
  readOnly = false,
  onToggle,
  centerWhenFits: centerWhenFitsProp,
}) {
  const theme = useTheme();
  const { isMobileOrTablet } = useResponsive();
  const centerWhenFits = centerWhenFitsProp ?? isMobileOrTablet;
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

  const displayRows = useMemo(
    () => groupEntriesIntoDisplayRows(items),
    [items],
  );

  const handleToggle = useCallback((section, itemId, horario) => {
    if (dragRef.current.moved) return;
    onToggle?.(section, itemId, horario);
  }, [dragRef, onToggle]);

  if (!displayRows.length) return null;

  const renderEntryIcon = (entry) => {
    const section = entry.section;
    const { itemId, label, Icon } = entry;
    if (!Icon || !section) return null;

    const itemConfig = resolveRutinaItemConfig(section, itemId, rutina, habitsPreferences);
    const itemValue = rutina?.[section]?.[itemId];
    const displayHorario = resolveEntryHorario(entry);
    const carouselKey = `${section}-${itemId}-${displayHorario || 'none'}`;

    return (
      <Box key={carouselKey} sx={{ display: 'inline-flex', flex: '0 0 auto', flexShrink: 0 }}>
        <HabitCarouselIconButton
          section={section}
          itemId={itemId}
          Icon={Icon}
          label={label}
          itemConfig={itemConfig}
          itemValue={itemValue}
          currentTimeOfDay={getCurrentTimeOfDay()}
          rutinaHoy={rutina}
          mode="ahora"
          displayHorario={displayHorario}
          carouselSlot="ahora"
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
  };

  return (
    <Box
      role="region"
      aria-label="Hábitos hechos"
      sx={{
        width: '100%',
        minWidth: 0,
      }}
    >
      <HabitCarouselScrollTrack
        itemCount={displayRows.length}
        fadeColor={hubSectionBg}
        theme={theme}
        scrollTrackSx={scrollTrackSx}
        enableDragScroll={!readOnly}
        centerWhenFits={centerWhenFits}
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
    </Box>
  );
}

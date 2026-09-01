import React, { useMemo, useCallback } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { getCurrentTimeOfDay } from '@shared/utils/timeOfDayUtils';
import {
  resolveRutinaItemConfig,
  resolveEntryFranjaFocusHorario,
  groupEntriesIntoDisplayRows,
  resolveStackRoutineLabel,
  resolveHabitDoneTone,
} from '@shared/habits';
import HabitCarouselIconButton from '@shared/components/habits/HabitCarouselIconButton';
import HabitCarouselScrollTrack from '@shared/components/habits/HabitCarouselScrollTrack';
import { RoutineCarouselStackCluster } from '@shared/components/habits/routines';
import useHorizontalDragScroll from '@shared/hooks/useHorizontalDragScroll';
import useResponsive from '@shared/hooks/useResponsive';
import { getRutinaHabitCarouselSurface } from '@shared/styles/habitCarouselStyles';
import { hubSectionBg } from '@shared/styles/hubSectionStyles';

function resolveEntryHorario(entry) {
  const focusHorario = resolveEntryFranjaFocusHorario(entry);
  if (focusHorario) return focusHorario;
  const horarios = Array.isArray(entry?.config?.horarios) ? entry.config.horarios : [];
  if (horarios.length === 1) return String(horarios[0]).toUpperCase();
  return null;
}

function resolveCarouselItemValue(entry, rutina) {
  if (entry?.itemValue !== undefined) return entry.itemValue;
  const section = entry?.section;
  const itemId = entry?.itemId;
  if (!section || !itemId) return undefined;
  return rutina?.[section]?.[itemId];
}

/** Carrusel horizontal de hábitos completados / cuota satisfecha. */
export default function RutinaDoneCarousel({
  items = [],
  rutina,
  habitsPreferences = {},
  readOnly = false,
  onToggle,
  centerWhenFits: centerWhenFitsProp,
  /** 'today' | 'before' — fuerza tono del grupo (Hecho hoy / Hecho antes). */
  doneTone = null,
}) {
  const theme = useTheme();
  const { isMobileOrTablet } = useResponsive();
  const centerWhenFits = centerWhenFitsProp ?? false;
  const { size, iconFontSize } = getRutinaHabitCarouselSurface(theme, {
    mobile: isMobileOrTablet,
  });

  const { scrollRef, isDragging, bind, dragRef } = useHorizontalDragScroll({
    enabled: !readOnly,
  });

  const scrollTrackSx = useMemo(() => ({
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 0.5,
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
  }), [isDragging, size]);

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
    const itemValue = resolveCarouselItemValue(entry, rutina);
    const displayHorario = resolveEntryHorario(entry);
    const carouselKey = `${section}-${itemId}-${displayHorario || 'none'}`;
    const resolvedTone = resolveHabitDoneTone({
      config: itemConfig,
      itemValue,
      itemId,
      section,
      rutina,
    });
    // Preferir tono por entrada; el del grupo solo como fallback de sección homogénea.
    const entryDoneTone = resolvedTone || doneTone || 'today';

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
          dense={false}
          interactive={!readOnly}
          showCompletionState
          consolidateDoneFranjas
          doneTone={entryDoneTone}
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

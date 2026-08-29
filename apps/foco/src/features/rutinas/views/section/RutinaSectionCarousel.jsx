/**
 * @deprecated Vista por grupo retirada de la UI (ago 2026). RutinaTable usa solo cadencia.
 * Pendiente: eliminar o readaptar este carrusel por sección (la cadencia usa sus propios carruseles).
 */
import React, { useMemo, useCallback } from 'react';

import { Box } from '@mui/material';

import { useTheme } from '@mui/material/styles';

import { isSameDay, startOfDay } from 'date-fns';

import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';

import { getNormalizedToday, parseAPIDate } from '@shared/utils/dateUtils';

import { getCurrentTimeOfDay } from '@shared/utils/timeOfDayUtils';

import { getHabitDisplayLabel, resolveRutinaItemConfig, getSectionCarouselItems, habitRequiresExpandedCarouselToggle, groupEntriesIntoDisplayRows, resolveStackRoutineLabel } from '@shared/habits';

import HabitCarouselIconButton from '@shared/components/habits/HabitCarouselIconButton';

import HabitCarouselScrollTrack from '@shared/components/habits/HabitCarouselScrollTrack';

import { RoutineCarouselStackCluster } from '@shared/components/habits/routines';

import useHorizontalDragScroll from '@shared/hooks/useHorizontalDragScroll';

import useResponsive from '@shared/hooks/useResponsive';

import { getRutinaHabitCarouselSurface } from '@shared/styles/habitCarouselStyles';

import { hubSectionBg } from '@shared/styles/hubSectionStyles';



/**

 * Fila de carrusel horizontal con todos los hábitos de una sección.

 * Usa el mismo carril compartido: centrado si cabe, bordes inicio/fin y drag con el dedo.

 */

export default function RutinaSectionCarousel({

  section,

  rutina,

  habits,

  habitsPreferences = {},

  habitChains = [],

  localData = null,

  onToggle,

  interactive = true,

  dense,

  mobile: mobileProp,

  showDividers = true,

  enableDragScroll = true,

  embedInHeader = false,

  onRequireExpand,

}) {

  const theme = useTheme();

  const { isMobileOrTablet } = useResponsive();

  const isMobile = mobileProp ?? isMobileOrTablet;

  const { size, bg, hoverBg, rail, dividerColor, iconFontSize } = getRutinaHabitCarouselSurface(theme, {
    mobile: isMobile,
  });

  const { scrollRef, isDragging, bind, dragRef } = useHorizontalDragScroll({
    enabled: enableDragScroll && interactive,
  });



  const rutinaDate = useMemo(() => {

    if (!rutina?.fecha) return getNormalizedToday();

    try {

      return startOfDay(parseAPIDate(rutina.fecha));

    } catch {

      return getNormalizedToday();

    }

  }, [rutina?.fecha]);



  const isViewingToday = isSameDay(rutinaDate, getNormalizedToday());

  const currentTimeOfDay = isViewingToday ? getCurrentTimeOfDay() : 'MAÑANA';

  const sectionIconsMap = useMemo(() => buildHabitSectionIconsMap(habits).iconsMap, [habits]);



  const carouselItems = useMemo(

    () => getSectionCarouselItems({

      section,

      rutina,

      habits,

      habitsPreferences,

      iconsMap: sectionIconsMap,

      currentTimeOfDay,

      localData,

      habitChains,

    }),

    [section, rutina, habits, habitsPreferences, sectionIconsMap, currentTimeOfDay, localData, habitChains],

  );

  const displayRows = useMemo(
    () => groupEntriesIntoDisplayRows(carouselItems),
    [carouselItems],
  );



  const scrollTrackSx = useMemo(() => ({

    display: 'flex',

    flexWrap: 'nowrap',

    alignItems: 'center',

    justifyContent: 'flex-start',

    gap: 0.5,

    overflowX: 'auto',

    overflowY: 'hidden',

    touchAction: 'pan-x',

    overscrollBehaviorX: 'contain',

    WebkitOverflowScrolling: 'touch',

    cursor: enableDragScroll ? (isDragging ? 'grabbing' : 'grab') : 'auto',

    userSelect: enableDragScroll ? 'none' : 'auto',

    scrollbarWidth: 'none',

    msOverflowStyle: 'none',

    minHeight: size + 4,

    py: isMobile ? 0.25 : 0,

    '&::-webkit-scrollbar': { display: 'none' },

  }), [enableDragScroll, isDragging, isMobile, size]);



  const handleToggle = useCallback((sec, itemId, horario) => {

    if (dragRef.current.moved) return;

    onToggle?.(sec, itemId, horario);

  }, [dragRef, onToggle]);



  if (!displayRows.length) return null;



  const fadeColor = hubSectionBg;



  return (

    <Box

      role="region"

      aria-label="Hábitos de la sección"

      sx={{

        display: 'flex',

        alignItems: 'stretch',

        width: '100%',

        minWidth: 0,

        py: embedInHeader ? 0 : (isMobile ? 0.375 : 0.5),
        mb: showDividers ? 0.5 : 0,
        px: embedInHeader ? 0.5 : (isMobile ? 0.75 : 0),

        bgcolor: isMobile ? hubSectionBg : 'transparent',

        ...(showDividers && {

          borderBottom: '1px solid',

          borderColor: dividerColor,

        }),

      }}

    >

      <HabitCarouselScrollTrack

        itemCount={displayRows.length}

        fadeColor={fadeColor}

        theme={theme}

        scrollTrackSx={scrollTrackSx}

        enableDragScroll={enableDragScroll && interactive}

        bind={bind}

        mergeScrollRef={(node) => {

          scrollRef.current = node;

        }}

      >

        {displayRows.map((row) => {
          const renderItem = ({ itemId, label, Icon, isCadenciaDebt, isScheduled, carouselSlot, section: entrySection }) => {
            const resolvedSection = entrySection || section;
            if (!Icon) return null;

            const displayLabel = label || getHabitDisplayLabel(resolvedSection, itemId, habits);

            const itemConfig = resolveRutinaItemConfig(resolvedSection, itemId, rutina, habitsPreferences);

            const itemValue = rutina?.[resolvedSection]?.[itemId];

            const requireExpand = embedInHeader && habitRequiresExpandedCarouselToggle(itemConfig);

            return (

              <Box key={`${resolvedSection}-${itemId}`} sx={{ display: 'inline-flex', flex: '0 0 auto', flexShrink: 0 }}>

                <HabitCarouselIconButton

                  section={resolvedSection}

                  itemId={itemId}

                  Icon={Icon}

                  label={displayLabel}

                  itemConfig={itemConfig}

                  itemValue={itemValue}

                  currentTimeOfDay={currentTimeOfDay}

                  rutinaHoy={rutina}

                  mode="ahora"

                  isCadenciaDebt={Boolean(isCadenciaDebt)}

                  dense={false}

                  interactive={interactive}

                  requireExpand={requireExpand}

                  onRequireExpand={onRequireExpand}

                  showCompletionState

                  isScheduled={isScheduled}

                  carouselSlot={carouselSlot}

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

          if (row.kind === 'stack') {
            const stackLabel = resolveStackRoutineLabel(row.entries[0]?.chain);
            return (
              <RoutineCarouselStackCluster key={`stack-${row.chainId}`} chainId={row.chainId} label={stackLabel}>
                {row.entries.map((entry) => renderItem({ ...entry, label: stackLabel }))}
              </RoutineCarouselStackCluster>
            );
          }

          return renderItem(row.entry);
        })}

      </HabitCarouselScrollTrack>

    </Box>

  );

}



import React, { useCallback, useMemo } from 'react';
import { Box, useTheme } from '@mui/material';
import HabitCarouselScrollTrack from './HabitCarouselScrollTrack.jsx';
import useHorizontalDragScroll from '../../hooks/useHorizontalDragScroll.js';
import { RUTINA_HABIT_ICON_SIZE } from '../../styles/rutinaIconTokens';

/**
 * Fila horizontal de iconos de hábito con scroll (misma UX que el carrusel de Tareas).
 * Ocupa el ancho disponible; si los iconos no caben, drag scroll + fades laterales.
 *
 * @param {(guardClick: () => boolean) => React.ReactNode} [children] — render prop opcional
 */
export default function HabitIconScrollRow({
  itemCount = 0,
  iconSize = RUTINA_HABIT_ICON_SIZE.desktop,
  gap = 0.35,
  enableDragScroll = true,
  fadeColor = null,
  centerWhenFits = false,
  sx = {},
  children,
}) {
  const theme = useTheme();
  const { scrollRef, isDragging, bind, dragRef } = useHorizontalDragScroll({
    enabled: enableDragScroll,
  });

  const guardClick = useCallback(() => dragRef.current.moved, [dragRef]);

  const scrollTrackSx = useMemo(() => ({
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap,
    overflowX: 'auto',
    overflowY: 'hidden',
    touchAction: 'pan-x',
    overscrollBehaviorX: 'contain',
    WebkitOverflowScrolling: 'touch',
    cursor: enableDragScroll ? (isDragging ? 'grabbing' : 'grab') : 'auto',
    userSelect: enableDragScroll ? 'none' : 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    minHeight: iconSize + 4,
    '&::-webkit-scrollbar': { display: 'none' },
  }), [gap, enableDragScroll, isDragging, iconSize]);

  const content = typeof children === 'function' ? children(guardClick) : children;

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        maxWidth: '100%',
        ...sx,
      }}
    >
      <HabitCarouselScrollTrack
        itemCount={itemCount}
        fadeColor={fadeColor || theme.palette.background.paper}
        scrollTrackSx={scrollTrackSx}
        enableDragScroll={enableDragScroll}
        centerWhenFits={centerWhenFits}
        bind={bind}
        mergeScrollRef={(node) => {
          scrollRef.current = node;
        }}
      >
        {content}
      </HabitCarouselScrollTrack>
    </Box>
  );
}

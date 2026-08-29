import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { alpha, useTheme } from '@mui/material/styles';
import { RUTINA_HABIT_ICON_SIZE } from '../../styles/rutinaIconTokens';
import useHorizontalDragScroll from '../../hooks/useHorizontalDragScroll.js';

const SCROLL_STEP_RATIO = 0.75;

function EdgeArrowBar({ direction, onClick, theme }) {
  const isLeft = direction === 'left';
  const Icon = isLeft ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        alignSelf: 'stretch',
        flexShrink: 0,
        px: 0.1,
        zIndex: 2,
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.88 : 0.94),
        borderLeft: isLeft ? 'none' : '1px solid',
        borderRight: isLeft ? '1px solid' : 'none',
        borderColor: 'divider',
      }}
    >
      <IconButton
        size="small"
        aria-label={isLeft ? 'Desplazar iconos a la izquierda' : 'Desplazar iconos a la derecha'}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        sx={{
          p: 0.25,
          color: 'text.secondary',
          '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
        }}
      >
        <Icon sx={{ fontSize: '1.1rem' }} />
      </IconButton>
    </Box>
  );
}

/**
 * Fila horizontal de iconos de hábito con scroll por arrastre y flechas laterales.
 * @param {(guardClick: () => boolean) => React.ReactNode} [children] — render prop opcional
 */
export default function HabitIconScrollRow({
  itemCount = 0,
  iconSize = RUTINA_HABIT_ICON_SIZE.desktop,
  gap = 0.35,
  maxVisibleIcons = 2.5,
  onOverflowChange = null,
  sx = {},
  children,
}) {
  const theme = useTheme();
  const edgeRef = useRef(null);
  const { scrollRef, isDragging, bind, dragRef } = useHorizontalDragScroll({ enabled: true });
  const [edgeState, setEdgeState] = useState({
    hasOverflow: false,
    atStart: true,
    atEnd: true,
  });

  const mergeScrollRef = useCallback((node) => {
    edgeRef.current = node;
    scrollRef.current = node;
  }, [scrollRef]);

  const updateEdgeState = useCallback(() => {
    const node = edgeRef.current;
    if (!node) return;
    const { scrollLeft, scrollWidth, clientWidth } = node;
    const hasOverflow = scrollWidth > clientWidth + 2;
    setEdgeState((prev) => {
      const next = {
        hasOverflow,
        atStart: scrollLeft <= 4,
        atEnd: scrollLeft >= scrollWidth - clientWidth - 4,
      };
      if (
        prev.hasOverflow === next.hasOverflow
        && prev.atStart === next.atStart
        && prev.atEnd === next.atEnd
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const node = edgeRef.current;
    if (!node) return undefined;
    updateEdgeState();
    node.addEventListener('scroll', updateEdgeState, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateEdgeState())
      : null;
    ro?.observe(node);
    return () => {
      node.removeEventListener('scroll', updateEdgeState);
      ro?.disconnect();
    };
  }, [itemCount, updateEdgeState]);

  useEffect(() => {
    onOverflowChange?.(edgeState.hasOverflow);
  }, [edgeState.hasOverflow, onOverflowChange]);

  const scrollByStep = useCallback((direction) => {
    const node = edgeRef.current;
    if (!node) return;
    const delta = node.clientWidth * SCROLL_STEP_RATIO * direction;
    node.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  const guardClick = useCallback(() => dragRef.current.moved, [dragRef]);

  const itemStride = iconSize + theme.spacing(gap);
  const maxWidth = itemStride * maxVisibleIcons + theme.spacing(0.5);

  const content = typeof children === 'function' ? children(guardClick) : children;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        maxWidth,
        minWidth: 0,
        borderRadius: 1,
        border: edgeState.hasOverflow ? '1px solid' : 'none',
        borderColor: 'divider',
        overflow: 'hidden',
        ...sx,
      }}
    >
      {edgeState.hasOverflow && !edgeState.atStart && (
        <EdgeArrowBar direction="left" theme={theme} onClick={() => scrollByStep(-1)} />
      )}

      <Box
        ref={mergeScrollRef}
        {...bind}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap,
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          py: 0.15,
          px: edgeState.hasOverflow ? 0.25 : 0,
          touchAction: 'pan-x',
          overscrollBehaviorX: 'contain',
          WebkitOverflowScrolling: 'touch',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {content}
      </Box>

      {edgeState.hasOverflow && !edgeState.atEnd && (
        <EdgeArrowBar direction="right" theme={theme} onClick={() => scrollByStep(1)} />
      )}
    </Box>
  );
}

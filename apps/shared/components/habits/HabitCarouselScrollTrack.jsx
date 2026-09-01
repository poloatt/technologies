import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

/**
 * Carril horizontal con bordes de inicio/fin, fades y centrado cuando cabe.
 */
export default function HabitCarouselScrollTrack({
  itemCount,
  fadeColor,
  theme: themeProp,
  scrollTrackSx,
  enableDragScroll = true,
  bind = {},
  mergeScrollRef,
  observeKey = '',
  centerWhenFits = false,
  children,
}) {
  const themeFromHook = useTheme();
  const theme = themeProp || themeFromHook;
  const edgeFadeRef = useRef(null);
  const [edgeState, setEdgeState] = useState({
    hasOverflow: false,
    atStart: true,
    atEnd: true,
    hintLeft: false,
    hintRight: false,
  });

  const updateEdgeState = useCallback(() => {
    const node = edgeFadeRef.current;
    if (!node) return;
    const { scrollLeft, scrollWidth, clientWidth } = node;
    const hasOverflow = scrollWidth > clientWidth + 2;
    const atStart = scrollLeft <= 4;
    const atEnd = scrollLeft >= scrollWidth - clientWidth - 4;
    setEdgeState({
      hasOverflow,
      atStart,
      atEnd,
      hintLeft: hasOverflow && !atStart,
      hintRight: hasOverflow && !atEnd,
    });
  }, []);

  useEffect(() => {
    const node = edgeFadeRef.current;
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
  }, [itemCount, observeKey, updateEdgeState]);

  const showStartCap = edgeState.hasOverflow && edgeState.atStart;
  const showEndCap = edgeState.hasOverflow && edgeState.atEnd;

  const trackSx = useMemo(() => ({
    ...scrollTrackSx,
    justifyContent: centerWhenFits && !edgeState.hasOverflow ? 'center' : 'flex-start',
  }), [scrollTrackSx, centerWhenFits, edgeState.hasOverflow]);

  const resolvedFadeColor = fadeColor || theme.palette.background.default;

  return (
    <Box
      sx={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        borderLeft: showStartCap ? `2px solid ${alpha(theme.palette.primary.main, 0.45)}` : 'none',
        borderRight: showEndCap ? `2px solid ${alpha(theme.palette.text.disabled, 0.35)}` : 'none',
        borderRadius: (showStartCap || showEndCap) ? 0.5 : 0,
        pl: showStartCap ? 0.5 : 0,
        pr: showEndCap ? 0.5 : 0,
        transition: 'border-color 0.15s ease, padding 0.15s ease',
      }}
    >
      {edgeState.hintLeft && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 20,
            zIndex: 2,
            pointerEvents: 'none',
            background: `linear-gradient(to right, ${resolvedFadeColor}, transparent)`,
          }}
        />
      )}
      {edgeState.hintRight && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 20,
            zIndex: 2,
            pointerEvents: 'none',
            background: `linear-gradient(to left, ${resolvedFadeColor}, transparent)`,
          }}
        />
      )}
      <Box
        sx={trackSx}
        ref={(node) => {
          edgeFadeRef.current = node;
          mergeScrollRef?.(node);
        }}
        {...(enableDragScroll ? bind : {})}
      >
        {children}
      </Box>
    </Box>
  );
}

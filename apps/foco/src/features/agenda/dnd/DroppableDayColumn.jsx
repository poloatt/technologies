import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { dayDropId } from '@shared/utils/calendar/calendarDragUtils';
import { useCalendarDragPreview } from './CalendarDragPreviewContext';

function TimedDropPreview({ preview }) {
  const theme = useTheme();
  if (!preview || preview.zone !== 'timed' || preview.allDay) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        left: 2,
        right: 2,
        top: preview.topPx,
        height: Math.max(14, preview.heightPx),
        zIndex: 5,
        pointerEvents: 'none',
        borderRadius: '4px',
        border: `2px dashed ${theme.palette.primary.main}`,
        bgcolor: alpha(theme.palette.primary.main, 0.18),
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'flex-start',
        px: 0.5,
        pt: 0.15,
      }}
    >
      <Typography
        sx={{
          fontSize: '0.65rem',
          fontWeight: 700,
          color: theme.palette.primary.main,
          lineHeight: 1.2,
          bgcolor: alpha(theme.palette.background.paper, 0.85),
          px: 0.4,
          borderRadius: 0.5,
        }}
      >
        {preview.startLabel}
        {preview.endLabel && preview.endLabel !== preview.startLabel
          ? ` – ${preview.endLabel}`
          : ''}
      </Typography>
    </Box>
  );
}

export default function DroppableDayColumn({ day, children, sx }) {
  const { setNodeRef, isOver } = useDroppable({
    id: dayDropId(day),
    data: { day, zone: 'timed' },
  });
  const preview = useCalendarDragPreview();
  const dayKey = format(day, 'yyyy-MM-dd');
  const showPreview = preview
    && preview.zone === 'timed'
    && !preview.allDay
    && preview.dayKey === dayKey;

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        ...(isOver ? {
          outline: '1px solid',
          outlineColor: 'primary.main',
          outlineOffset: -1,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
        } : {}),
        ...sx,
      }}
    >
      {children}
      {showPreview ? <TimedDropPreview preview={preview} /> : null}
    </Box>
  );
}

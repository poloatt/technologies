import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { allDayDropId } from '@shared/utils/calendar/calendarDragUtils';
import { useCalendarDragPreview } from './CalendarDragPreviewContext';

export default function DroppableAllDayLane({ day, children, sx, minHeight = 28 }) {
  const theme = useTheme();
  const { setNodeRef, isOver } = useDroppable({
    id: allDayDropId(day),
    data: { day, zone: 'allDay' },
  });
  const preview = useCalendarDragPreview();
  const dayKey = format(day, 'yyyy-MM-dd');
  const showPreview = preview?.allDay && preview.dayKey === dayKey;

  return (
    <Box
      ref={setNodeRef}
      sx={{
        width: '100%',
        minHeight,
        boxSizing: 'border-box',
        position: 'relative',
        ...(isOver || showPreview ? {
          outline: '1px dashed',
          outlineColor: 'primary.main',
          outlineOffset: -1,
          bgcolor: alpha(theme.palette.primary.main, 0.08),
        } : {}),
        ...sx,
      }}
    >
      {children}
      {showPreview ? (
        <Typography
          sx={{
            position: 'absolute',
            right: 4,
            top: 2,
            fontSize: '0.65rem',
            fontWeight: 700,
            color: 'primary.main',
            pointerEvents: 'none',
          }}
        >
          Todo el día
        </Typography>
      ) : null}
    </Box>
  );
}

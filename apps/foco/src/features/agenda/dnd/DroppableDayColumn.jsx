import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Box } from '@mui/material';
import { dayDropId } from '@shared/utils/calendar/calendarDragUtils';

export default function DroppableDayColumn({ day, children, sx }) {
  const { setNodeRef, isOver } = useDroppable({
    id: dayDropId(day),
    data: { day },
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        ...(isOver ? { outline: '1px solid', outlineColor: 'primary.main', outlineOffset: -1 } : {}),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

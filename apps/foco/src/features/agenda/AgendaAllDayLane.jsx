import React, { useState } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import DraggableAllDayEvent from './dnd/DraggableAllDayEvent';
import DroppableAllDayLane from './dnd/DroppableAllDayLane';

/**
 * Franja “todo el día” estilo Google Calendar: muestra hasta maxVisible y “+N más”.
 * Con dndEnabled, la franja es droppable aunque esté vacía.
 */
export default function AgendaAllDayLane({
  day,
  events = [],
  maxVisible = 2,
  onEventClick,
  onToggleComplete,
  compact = true,
  dndEnabled = false,
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const list = Array.isArray(events) ? events : [];
  const hiddenCount = Math.max(0, list.length - maxVisible);
  const showToggle = hiddenCount > 0;
  const visible = expanded || !showToggle ? list : list.slice(0, maxVisible);

  const body = (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        py: 0.25,
        px: 0.25,
        minHeight: dndEnabled ? 28 : undefined,
      }}
    >
      {visible.map((ev) => (
        <DraggableAllDayEvent
          key={String(ev.task._id ?? ev.task.id)}
          event={ev}
          compact={compact}
          onEventClick={onEventClick}
          onToggleComplete={onToggleComplete}
          dndEnabled={dndEnabled}
        />
      ))}
      {showToggle && (
        <ButtonBase
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          sx={{
            alignSelf: 'flex-start',
            borderRadius: 1,
            px: 0.5,
            py: 0.125,
            minHeight: 20,
            bgcolor: alpha(theme.palette.text.primary, 0.06),
            '&:hover': {
              bgcolor: alpha(theme.palette.text.primary, 0.1),
            },
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.65rem' }}>
            {expanded ? 'Menos' : `${hiddenCount} más`}
          </Typography>
        </ButtonBase>
      )}
    </Box>
  );

  if (!dndEnabled || !day) {
    if (list.length === 0) return null;
    return body;
  }

  return (
    <DroppableAllDayLane day={day}>
      {body}
    </DroppableAllDayLane>
  );
}

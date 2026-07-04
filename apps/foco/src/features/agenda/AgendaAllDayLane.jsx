import React, { useState } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import TaskEventBlock from '@shared/components/tasks/TaskEventBlock';

/**
 * Franja “todo el día” estilo Google Calendar: muestra hasta maxVisible y “+N más”.
 */
export default function AgendaAllDayLane({
  events = [],
  maxVisible = 2,
  onEventClick,
  onToggleComplete,
  compact = true,
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const list = Array.isArray(events) ? events : [];
  const hiddenCount = Math.max(0, list.length - maxVisible);
  const showToggle = hiddenCount > 0;
  const visible = expanded || !showToggle ? list : list.slice(0, maxVisible);

  if (list.length === 0) return null;

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        py: 0.25,
        px: 0.25,
      }}
    >
      {visible.map((ev) => (
        <TaskEventBlock
          key={String(ev.task._id ?? ev.task.id)}
          event={ev}
          compact={compact}
          onClick={onEventClick}
          onToggleComplete={onToggleComplete}
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
}

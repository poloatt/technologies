import React from 'react';
import { Typography, Tooltip } from '@mui/material';

/**
 * Marca compacta de origen Google en filas/eventos de tarea (no hábitos).
 */
export function GoogleTaskOriginMark({ tarea, sx }) {
  if (!tarea || String(tarea.tipo || '').toUpperCase() === 'HABITO') return null;

  const isCalendar = Boolean(tarea.googleCalendarSync?.googleEventId);
  const isTasks = Boolean(tarea.googleTasksSync?.googleTaskId || tarea.googleTasksSync?.enabled);

  if (!isCalendar && !isTasks) return null;

  let label = 'G';
  let title = 'Google Tasks';
  if (isCalendar && !tarea.googleTasksSync?.googleTaskId) {
    label = 'C';
    title = 'Google Calendar';
  } else if (isTasks) {
    title = tarea.googleTasksSync?.enabled
      ? 'Sincronizada con Google Tasks'
      : 'Vinculada a Google Tasks';
  }

  return (
    <Tooltip title={title} enterDelay={400}>
      <Typography
        component="span"
        variant="caption"
        aria-label={title}
        sx={{
          ml: 0.5,
          px: 0.4,
          py: 0.05,
          borderRadius: 0.5,
          fontSize: '0.55rem',
          fontWeight: 700,
          letterSpacing: 0.2,
          lineHeight: 1.4,
          opacity: 0.85,
          bgcolor: 'action.hover',
          color: 'text.secondary',
          flexShrink: 0,
          ...sx,
        }}
      >
        {label}
      </Typography>
    </Tooltip>
  );
}

export default GoogleTaskOriginMark;

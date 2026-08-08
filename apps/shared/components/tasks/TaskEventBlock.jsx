import React from 'react';
import { Box, Checkbox, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getEstadoColor } from '../common/StatusSystem';
import { isTaskCompleted } from '../../utils/agendaRules';
import { formatTaskCardSchedule } from '../../utils/taskCardDateRules';
import { MIN_EVENT_HEIGHT_PX } from '../../utils/calendar/calendarLayout';
import {
  getTaskEventBlockSx,
  taskEventTitleSx,
  taskEventTimeSx,
} from '../../styles/taskListStyles';
import { GoogleTaskOriginMark } from './GoogleTaskOriginMark';

/**
 * Bloque visual de tarea/evento en vistas de calendario (día, semana, todo el día).
 */
export default function TaskEventBlock({
  event,
  compact = false,
  timedCompact = false,
  onClick,
  onToggleComplete,
}) {
  const theme = useTheme();
  const { task, start, end, allDay, objetivo } = event;
  const completed = isTaskCompleted(task);
  const isEvento = String(task?.tipo || '').toUpperCase() === 'EVENTO';
  const isVirtual = Boolean(task?.virtual);
  const estadoColor = getEstadoColor(task?.estado || 'PENDIENTE', 'TAREA');
  const accent = isEvento
    ? theme.palette.primary.main
    : (objetivo?.color || estadoColor || theme.palette.secondary.main);

  const scheduleTask = {
    ...task,
    fechaInicio: start,
    fechaFin: end,
  };

  const timeLabel = allDay
    ? 'Todo el día'
    : (formatTaskCardSchedule(scheduleTask, { isMobile: false, uppercase: false }) || `${format(start, 'HH:mm', { locale: es })} – ${format(end, 'HH:mm', { locale: es })}`);

  const showCheckbox = onToggleComplete && !isEvento && !timedCompact && !isVirtual;
  const showTime = !compact && !timedCompact;

  return (
    <Box
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(task);
      }}
      sx={{
        ...getTaskEventBlockSx({
          theme,
          accent,
          completed,
          compact,
          timedCompact,
          minHeight: timedCompact ? MIN_EVENT_HEIGHT_PX : undefined,
        }),
        ...(isVirtual ? { opacity: 0.72 } : null),
      }}
    >
      {showCheckbox && (
        <Checkbox
          size="small"
          checked={completed}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            onToggleComplete(task, !completed);
          }}
          sx={{ p: 0, mt: -0.25 }}
        />
      )}
      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Typography sx={taskEventTitleSx(timedCompact, completed)}>
          {task.titulo}
          {(task.esRecurrente || task.serieId || task.virtual) && (
            <Typography
              component="span"
              variant="caption"
              sx={{ ml: 0.5, opacity: 0.75, fontSize: '0.55rem' }}
            >
              ↻
            </Typography>
          )}
          <GoogleTaskOriginMark tarea={task} />
        </Typography>
        {showTime && (
          <Typography sx={taskEventTimeSx}>
            {timeLabel}
            {objetivo?.nombre ? ` · ${objetivo.nombre}` : ''}
            {isVirtual ? ' · virtual' : ''}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

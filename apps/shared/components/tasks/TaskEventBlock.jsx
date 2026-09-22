import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getEstadoColor } from '../common/StatusSystem';
import { isTaskCompleted } from '../../utils/agendaRules';
import { formatTaskCardSchedule } from '../../utils/taskCardDateRules';
import { TASK_PILL_HEIGHT_PX } from '../../utils/calendar/calendarLayout';
import {
  getTaskEventBlockSx,
  taskEventTitleSx,
  taskEventTimeSx,
} from '../../styles/taskListStyles';
import { GoogleTaskOriginMark } from './GoogleTaskOriginMark';

/**
 * Bloque visual estilo Google Calendar:
 * - TAREA timed → pill + círculo de estado + "Título, HH:mm"
 * - EVENTO timed → bloque sólido con título + rango horario
 * - All-day / compact → chip según tipo
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
  const gcal = task?.googleCalendarSync;
  const eventLabelName = gcal?.eventLabelName || null;
  const estadoColor = getEstadoColor(task?.estado || 'PENDIENTE', 'TAREA');
  const accent = isEvento
    ? (gcal?.backgroundColor || theme.palette.primary.main)
    : (objetivo?.color || estadoColor || theme.palette.secondary.main);

  const startLabel = !allDay && start
    ? format(start, 'HH:mm', { locale: es })
    : null;

  const timeRangeLabel = allDay
    ? null
    : (formatTaskCardSchedule(
      { ...task, fechaInicio: start, fechaFin: end },
      { isMobile: false, uppercase: false },
    ) || (start && end
      ? `${format(start, 'HH:mm', { locale: es })} – ${format(end, 'HH:mm', { locale: es })}`
      : null));

  const showTaskToggle = Boolean(onToggleComplete) && !isEvento && !isVirtual;
  const durationMin = start && end
    ? Math.max(0, (end.getTime() - start.getTime()) / 60000)
    : 0;
  const showEventMeta = isEvento && timedCompact && durationMin >= 40;

  const eventTextColor = isEvento && (timedCompact || compact)
    ? theme.palette.getContrastText(accent)
    : undefined;

  return (
    <Box
      title={[task?.titulo, eventLabelName].filter(Boolean).join(' · ') || undefined}
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
          isEvento,
          minHeight: timedCompact && !isEvento ? `${TASK_PILL_HEIGHT_PX}px` : undefined,
        }),
        ...(timedCompact && !isEvento
          ? { height: '100%', maxHeight: '100%', minHeight: 0 }
          : null),
        ...(isVirtual ? { opacity: 0.72 } : null),
      }}
    >
      {showTaskToggle && (
        <IconButton
          size="small"
          aria-label={completed ? 'Marcar pendiente' : 'Completar'}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggleComplete(task, !completed);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          sx={{
            p: 0,
            flexShrink: 0,
            // Evita que el touch-target 40px estire la pill de 30 min (~28px)
            width: 18,
            height: 18,
            minWidth: 18,
            minHeight: 18,
            color: completed ? 'success.main' : 'text.secondary',
            // No iniciar drag ni abrir el form al completar
            touchAction: 'manipulation',
            '&:hover': { bgcolor: 'transparent', color: completed ? 'success.light' : 'text.primary' },
          }}
        >
          {completed ? (
            <CheckCircleIcon sx={{ fontSize: 16 }} />
          ) : (
            <RadioButtonUncheckedIcon sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      )}

      <Box
        sx={{
          minWidth: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: isEvento && timedCompact ? 'flex-start' : 'center',
        }}
      >
        {isEvento && timedCompact ? (
          <>
            <Typography
              sx={{
                ...taskEventTitleSx(true, completed, true),
                color: eventTextColor,
              }}
            >
              {task.titulo}
              {(task.esRecurrente || task.serieId || task.virtual) && (
                <Typography component="span" sx={{ ml: 0.5, opacity: 0.8, fontSize: '0.55rem' }}>
                  ↻
                </Typography>
              )}
            </Typography>
            {showEventMeta && (timeRangeLabel || eventLabelName) && (
              <Typography sx={{ ...taskEventTimeSx, color: eventTextColor, opacity: 0.92 }}>
                {[timeRangeLabel, eventLabelName].filter(Boolean).join(' · ')}
              </Typography>
            )}
          </>
        ) : (
          <Typography
            sx={{
              ...taskEventTitleSx(timedCompact, completed, isEvento),
              color: eventTextColor || (isEvento ? undefined : 'text.primary'),
            }}
          >
            {task.titulo}
            {timedCompact && !isEvento && startLabel ? (
              <Typography
                component="span"
                sx={{
                  fontWeight: 400,
                  fontSize: 'inherit',
                  opacity: 0.75,
                }}
              >
                {`, ${startLabel}`}
              </Typography>
            ) : null}
            {(task.esRecurrente || task.serieId || task.virtual) && (
              <Typography component="span" sx={{ ml: 0.5, opacity: 0.7, fontSize: '0.55rem' }}>
                ↻
              </Typography>
            )}
            <GoogleTaskOriginMark tarea={task} />
          </Typography>
        )}

        {!timedCompact && !compact && timeRangeLabel && (
          <Typography sx={taskEventTimeSx}>
            {allDay ? 'Todo el día' : timeRangeLabel}
            {eventLabelName ? ` · ${eventLabelName}` : ''}
            {!eventLabelName && objetivo?.nombre ? ` · ${objetivo.nombre}` : ''}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

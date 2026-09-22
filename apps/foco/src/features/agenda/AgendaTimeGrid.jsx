import React from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { isSameDay } from 'date-fns';
import { isCalendarToday } from '@shared/utils/dateUtils';
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  getGridHeightPx,
  HALF_HOUR_SLOTS,
  HALF_SLOT_HEIGHT_PX,
  HOUR_LABELS,
  SLOT_MINUTES,
  TIME_COLUMN_WIDTH,
} from '@shared/utils/calendar/calendarLayout';
import {
  clampEventToDay,
  formatHourLabel,
  layoutTimedEventsForDay,
} from '@shared/utils/calendar/agendaCalendarUtils';
import DraggableTimedEvent from './dnd/DraggableTimedEvent';
import DroppableDayColumn from './dnd/DroppableDayColumn';

/** Línea “ahora” estilo Google Calendar (punto + trazo) — px, igual que slots/eventos. */
function NowIndicator() {
  const theme = useTheme();
  const now = new Date();
  const hour = now.getHours();
  if (hour < DAY_START_HOUR || hour > DAY_END_HOUR) return null;

  const nowMins = (hour - DAY_START_HOUR) * 60 + now.getMinutes();
  const topPx = (nowMins / SLOT_MINUTES) * HALF_SLOT_HEIGHT_PX;

  return (
    <Box
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: `${topPx}px`,
        zIndex: 4,
        pointerEvents: 'none',
        transform: 'translateY(-50%)',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: -5,
          top: '50%',
          width: 10,
          height: 10,
          borderRadius: '50%',
          bgcolor: theme.palette.error.main,
          transform: 'translateY(-50%)',
        }}
      />
      <Box
        sx={{
          height: 2,
          bgcolor: theme.palette.error.main,
          width: '100%',
        }}
      />
    </Box>
  );
}

export default function AgendaTimeGrid({
  day,
  timedEvents = [],
  onSlotClick,
  onEventClick,
  onToggleComplete,
  showNowIndicator = true,
  showTimeColumn = true,
  dndEnabled = false,
}) {
  const theme = useTheme();
  const gridHeight = getGridHeightPx();
  const isDayToday = isCalendarToday(day);

  const dayTimed = timedEvents
    .filter((ev) => !ev.allDay)
    .map((ev) => clampEventToDay(ev, day))
    .filter((ev) => isSameDay(ev.start, day));

  const slotFromMinutes = (startMin) =>
    ((startMin - DAY_START_HOUR * 60) / SLOT_MINUTES) * HALF_SLOT_HEIGHT_PX;

  const gridBody = (
    <>
      {HALF_HOUR_SLOTS.map((startMin) => {
        const isHourLine = startMin % 60 === 0;
        const hour = Math.floor(startMin / 60);
        return (
          <Box
            key={`slot-${startMin}`}
            onClick={() => onSlotClick?.(day, hour, startMin % 60)}
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: slotFromMinutes(startMin),
              height: HALF_SLOT_HEIGHT_PX,
              borderTop: 1,
              borderColor: isHourLine
                ? alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.55 : 0.9)
                : alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.2 : 0.35),
              cursor: onSlotClick ? 'pointer' : 'default',
              boxSizing: 'border-box',
              '&:hover': onSlotClick
                ? { bgcolor: alpha(theme.palette.primary.main, 0.04) }
                : undefined,
            }}
          />
        );
      })}

      {showNowIndicator && isDayToday && <NowIndicator />}

      {(() => {
        const { items } = layoutTimedEventsForDay(dayTimed);
        // #region agent log
        const taskItems = items.filter((i) => i.layer === 'tarea');
        if (taskItems.length) {
          fetch('http://127.0.0.1:7888/ingest/f576597c-5e27-437e-8e5f-1cd13a8697b4', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b064c0' },
            body: JSON.stringify({
              sessionId: 'b064c0',
              runId: 'pre-fix',
              hypothesisId: 'E',
              location: 'AgendaTimeGrid.jsx:layout',
              message: 'day timed layout summary',
              data: {
                day: day?.toISOString?.()?.slice(0, 10),
                totalItems: items.length,
                taskCount: taskItems.length,
                eventoCount: items.filter((i) => i.layer === 'evento').length,
                tasks: taskItems.slice(0, 8).map((i) => ({
                  title: String(i.event?.task?.titulo || '').slice(0, 30),
                  top: i.style?.top,
                  height: i.style?.height,
                  start: i.event?.start
                    ? `${i.event.start.getHours()}:${String(i.event.start.getMinutes()).padStart(2, '0')}`
                    : null,
                  durMin: i.event?.start && i.event?.end
                    ? (i.event.end - i.event.start) / 60000
                    : null,
                })),
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
        }
        // #endregion
        return items.map(({ event: ev, style, layer }, idx) => (
          <DraggableTimedEvent
            key={`${ev.task._id || ev.task.id || 'ev'}-${layer || 'x'}-${idx}`}
            event={ev}
            style={style}
            layer={layer}
            onEventClick={onEventClick}
            onToggleComplete={onToggleComplete}
            dndEnabled={dndEnabled}
          />
        ));
      })()}
    </>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        height: gridHeight,
        flexShrink: 0,
        alignSelf: 'flex-start',
      }}
    >
      {showTimeColumn && (
        <Box
          sx={{
            width: TIME_COLUMN_WIDTH,
            flexShrink: 0,
            position: 'relative',
            height: gridHeight,
          }}
        >
          {HOUR_LABELS.map((hour) => (
            <Box
              key={hour}
              sx={{
                position: 'absolute',
                top: ((hour - DAY_START_HOUR) * 60 / SLOT_MINUTES) * HALF_SLOT_HEIGHT_PX,
                right: 8,
                transform: 'translateY(-50%)',
                lineHeight: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: 'text.secondary',
                  letterSpacing: '0.02em',
                }}
              >
                {formatHourLabel(hour)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          position: 'relative',
          height: gridHeight,
          flexShrink: 0,
          alignSelf: 'flex-start',
          borderLeft: showTimeColumn ? 1 : 0,
          borderColor: alpha(theme.palette.divider, 0.7),
        }}
      >
        {dndEnabled ? (
          <DroppableDayColumn day={day} sx={{ height: gridHeight, minHeight: gridHeight }}>
            {gridBody}
          </DroppableDayColumn>
        ) : gridBody}
      </Box>
    </Box>
  );
}

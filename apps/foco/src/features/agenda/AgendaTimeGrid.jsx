import React from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { isSameDay } from 'date-fns';
import { isCalendarToday } from '@shared/utils/dateUtils';
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  getGridHeightPx,
  getTotalGridMinutes,
  HALF_HOUR_SLOTS,
  HALF_SLOT_HEIGHT_PX,
  HOUR_LABELS,
  SLOT_HEIGHT_PX,
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

function NowIndicator() {
  const theme = useTheme();
  const now = new Date();
  const hour = now.getHours();
  if (hour < DAY_START_HOUR || hour > DAY_END_HOUR) return null;

  const totalMinutes = getTotalGridMinutes();
  const nowMins = (hour - DAY_START_HOUR) * 60 + now.getMinutes();
  const topPct = (nowMins / totalMinutes) * 100;

  return (
    <Box
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: `${topPct}%`,
        zIndex: 2,
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          height: 2,
          bgcolor: theme.palette.error.main,
          borderRadius: 1,
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
              borderTop: isHourLine ? 1 : '1px dashed',
              borderColor: isHourLine ? 'divider' : alpha(theme.palette.divider, 0.45),
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
        return items.map(({ event: ev, style }, idx) => (
          <DraggableTimedEvent
            key={`${ev.task._id || ev.task.id || 'ev'}-${idx}`}
            event={ev}
            style={style}
            onEventClick={onEventClick}
            onToggleComplete={onToggleComplete}
            dndEnabled={dndEnabled}
          />
        ));
      })()}
    </>
  );

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0, width: '100%' }}>
      {showTimeColumn && (
        <Box
          sx={{
            width: TIME_COLUMN_WIDTH,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            position: 'relative',
            height: gridHeight,
          }}
        >
          {HOUR_LABELS.map((hour) => (
            <Box
              key={hour}
              sx={{
                height: SLOT_HEIGHT_PX,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-end',
                pr: 0.5,
                pt: 0.25,
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
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
        }}
      >
        {dndEnabled ? (
          <DroppableDayColumn day={day}>
            {gridBody}
          </DroppableDayColumn>
        ) : gridBody}
      </Box>
    </Box>
  );
}

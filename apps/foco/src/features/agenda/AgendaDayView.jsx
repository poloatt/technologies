import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { ALL_DAY_MAX_VISIBLE, calendarScrollAreaSx } from '@shared/utils/calendar/calendarLayout';
import { eventBelongsInAllDayLane, splitEventsByDay } from '@shared/utils/calendar/agendaCalendarUtils';
import AgendaTimeGrid from './AgendaTimeGrid';
import AgendaCalendarDateHeader from './AgendaCalendarDateHeader';
import AgendaCalendarContextBar from './AgendaCalendarContextBar';
import AgendaAllDayLane from './AgendaAllDayLane';
import { useAgendaSwipeNavigate } from './useAgendaSwipeNavigate';
import CalendarDndContext from './dnd/CalendarDndContext';

export default function AgendaDayView({
  date,
  events = [],
  onEventClick,
  onToggleComplete,
  onSlotClick,
  onEventMove,
  agendaView = 'ahora',
  showRutinaStrip = true,
  viewMode = 'day',
}) {
  const swipeRef = useAgendaSwipeNavigate(viewMode);
  const dndEnabled = Boolean(onEventMove);

  const dayEvents = useMemo(() => splitEventsByDay(events, date), [events, date]);
  const allDayEvents = dayEvents.filter((ev) => eventBelongsInAllDayLane(ev));
  const timedEvents = dayEvents.filter((ev) => !eventBelongsInAllDayLane(ev));
  // #region agent log
  if (typeof fetch !== 'undefined' && allDayEvents.some((ev) => !ev.allDay)) {
    const overflow = allDayEvents.filter((ev) => !ev.allDay);
    fetch('http://127.0.0.1:7888/ingest/f576597c-5e27-437e-8e5f-1cd13a8697b4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b064c0' },
      body: JSON.stringify({
        sessionId: 'b064c0',
        runId: 'post-fix',
        hypothesisId: 'A',
        location: 'AgendaDayView.jsx:split',
        message: 'pre-grid tasks routed to all-day lane',
        data: {
          overflowCount: overflow.length,
          timedCount: timedEvents.length,
          tasks: overflow.map((ev) => ({
            title: String(ev.task?.titulo || '').slice(0, 30),
            start: `${ev.start?.getHours()}:${String(ev.start?.getMinutes()).padStart(2, '0')}`,
          })),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion
  const showAllDayLane = dndEnabled || allDayEvents.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box
        sx={{
          flexShrink: 0,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <AgendaCalendarDateHeader date={date} viewMode={viewMode} />
      </Box>

      {showRutinaStrip && (
        <AgendaCalendarContextBar targetDate={date} agendaView={agendaView} />
      )}

      <CalendarDndContext
        onEventMove={onEventMove}
        enabled={dndEnabled}
        axisLock="none"
      >
        {showAllDayLane && (
          <Box
            sx={{
              flexShrink: 0,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          >
            <AgendaAllDayLane
              day={date}
              events={allDayEvents}
              maxVisible={ALL_DAY_MAX_VISIBLE}
              onEventClick={onEventClick}
              onToggleComplete={onToggleComplete}
              compact
              dndEnabled={dndEnabled}
            />
          </Box>
        )}

        <Box
          ref={swipeRef}
          sx={{
            ...calendarScrollAreaSx,
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch',
            flex: 1,
            minHeight: 0,
            // Evita que el flex móvil estire la grilla y desalineé pills/eventos
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          <AgendaTimeGrid
            day={date}
            timedEvents={timedEvents}
            onSlotClick={onSlotClick}
            onEventClick={onEventClick}
            onToggleComplete={onToggleComplete}
            dndEnabled={dndEnabled}
          />
        </Box>
      </CalendarDndContext>
    </Box>
  );
}

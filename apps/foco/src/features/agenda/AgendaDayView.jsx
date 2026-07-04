import React, { useMemo } from 'react';

import { Box } from '@mui/material';

import { ALL_DAY_MAX_VISIBLE, calendarScrollAreaSx } from '@shared/utils/calendar/calendarLayout';

import { splitEventsByDay } from '@shared/utils/calendar/agendaCalendarUtils';

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

  const dayEvents = useMemo(() => splitEventsByDay(events, date), [events, date]);

  const allDayEvents = dayEvents.filter((ev) => ev.allDay);

  const timedEvents = dayEvents.filter((ev) => !ev.allDay);



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



      {allDayEvents.length > 0 && (

        <Box

          sx={{

            flexShrink: 0,

            borderBottom: 1,

            borderColor: 'divider',

            bgcolor: 'background.default',

          }}

        >

          <AgendaAllDayLane

            events={allDayEvents}

            maxVisible={ALL_DAY_MAX_VISIBLE}

            onEventClick={onEventClick}

            onToggleComplete={onToggleComplete}

            compact

          />

        </Box>

      )}



      <Box

        ref={swipeRef}

        sx={{

          ...calendarScrollAreaSx,

          touchAction: 'pan-y',

          flex: 1,

          minHeight: 0,

        }}

      >

        <CalendarDndContext onEventMove={onEventMove} enabled={Boolean(onEventMove)}>

          <AgendaTimeGrid

            day={date}

            timedEvents={timedEvents}

            onSlotClick={onSlotClick}

            onEventClick={onEventClick}

            onToggleComplete={onToggleComplete}

            dndEnabled={Boolean(onEventMove)}

          />

        </CalendarDndContext>

      </Box>

    </Box>

  );

}



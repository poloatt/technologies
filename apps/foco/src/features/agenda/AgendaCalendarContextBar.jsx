import React from 'react';
import { Box } from '@mui/material';
import HabitCarouselStrip from '../habits/carousel/HabitCarouselStrip';
import { calendarContextBarSx } from '@shared/utils/calendar/calendarLayout';

/**
 * Franja de acciones de rutina debajo del encabezado de fecha en vistas de calendario.
 */
export default function AgendaCalendarContextBar({
  targetDate,
  agendaView = 'ahora',
}) {
  return (
    <Box sx={calendarContextBarSx}>
      <HabitCarouselStrip targetDate={targetDate} agendaView={agendaView} />
    </Box>
  );
}

import React from 'react';
import { Box } from '@mui/material';
import { useResponsive } from '@shared/hooks';
import { DATE_HEADER_MIN_HEIGHT } from '@shared/utils/calendar/calendarLayout';
import AgendaCalendarDateHeader from '../../agenda/AgendaCalendarDateHeader';
import { useRutinaDateNav } from '../hooks/useRutinaDateNav';

/**
 * Barra de date hero para /rutinas — navegación diaria estilo Google Calendar.
 */
export default function RutinaDateHeroBar() {
  const { isMobileOrTablet } = useResponsive();
  const {
    currentDate,
    viewingToday,
    dayMode,
    loading,
    completionPercentage,
    completionTooltip,
    navHandlers,
    goToToday,
    handleDateClick,
    datePickerOpen,
    datePickerAnchor,
    handleDatePickerClose,
    handleDateChange,
  } = useRutinaDateNav();

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ width: '100%', minHeight: DATE_HEADER_MIN_HEIGHT }}>
        <AgendaCalendarDateHeader
          mode="rutina"
          date={currentDate}
          onDateClick={handleDateClick}
          onGoToToday={goToToday}
          loading={loading}
          viewingToday={viewingToday}
          navHandlers={navHandlers}
          pickerOpen={datePickerOpen}
          pickerAnchor={datePickerAnchor}
          onPickerClose={handleDatePickerClose}
          onDateChange={handleDateChange}
          completionPercentage={completionPercentage}
          completionTooltip={completionTooltip}
          dayMode={dayMode}
          hideOuterBorder
          bleedProgressBar={!isMobileOrTablet}
        />
      </Box>
    </Box>
  );
}

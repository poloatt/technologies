import React, { useCallback, useEffect } from 'react';
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import { CalendarMonthOutlined } from '@mui/icons-material';
import { startOfDay } from 'date-fns';
import { useResponsive } from '@shared/hooks';
import {
  getTodayCalendarDate,
  isViewingTodayInCalendar,
} from '@shared/utils/focoNavigationUtils';
import { getNormalizedToday } from '@shared/utils/dateUtils';
import CalendarDatePickerPopover from './CalendarDatePickerPopover';
import { useAgendaCalendarDatePicker } from './useAgendaCalendarDatePicker';
import { DATE_HEADER_MIN_HEIGHT } from '@shared/utils/calendar/calendarLayout';

const weekNavColumnSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0,
  height: DATE_HEADER_MIN_HEIGHT,
  minHeight: DATE_HEADER_MIN_HEIGHT,
  maxHeight: DATE_HEADER_MIN_HEIGHT,
  boxSizing: 'border-box',
  width: '100%',
  overflow: 'hidden',
};

/** Móvil: columna fija antes de Lunes — Hoy y calendario apilados y centrados. */
export default function AgendaWeekHeaderNavColumn({ selectedDate }) {
  const { isMobile } = useResponsive();
  const {
    pickerAnchor,
    pickerOpen,
    openPicker,
    closePicker,
    handleDatePicked,
  } = useAgendaCalendarDatePicker();
  const normalized = startOfDay(selectedDate || getNormalizedToday());
  const viewingToday = isViewingTodayInCalendar(normalized, 'week');

  const goToToday = useCallback(() => {
    window.dispatchEvent(new CustomEvent('navigate', {
      detail: { direction: 'today', date: getTodayCalendarDate().toISOString() },
    }));
  }, []);

  useEffect(() => {
    if (!isMobile) return undefined;
    window.addEventListener('scroll', closePicker, true);
    return () => window.removeEventListener('scroll', closePicker, true);
  }, [isMobile, closePicker]);

  if (!isMobile) {
    return <Box aria-hidden sx={{ minHeight: DATE_HEADER_MIN_HEIGHT }} />;
  }

  return (
    <Box sx={weekNavColumnSx}>
      <Tooltip title={viewingToday ? 'Ya estás en hoy' : 'Ir a hoy'}>
        <span>
          <Button
            size="small"
            variant="text"
            onClick={goToToday}
            disabled={viewingToday}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              minWidth: 0,
              minHeight: 0,
              px: 0.5,
              py: 0,
              lineHeight: 1.2,
              fontSize: '0.7rem',
              color: viewingToday ? 'text.disabled' : 'text.secondary',
              '&.Mui-disabled': { color: 'text.disabled' },
            }}
          >
            Hoy
          </Button>
        </span>
      </Tooltip>
      <Tooltip title="Elegir fecha">
        <IconButton
          size="small"
          onClick={openPicker}
          aria-label="Elegir fecha"
          sx={{
            p: 0,
            width: 22,
            height: 22,
            minWidth: 22,
            minHeight: 22,
          }}
        >
          <CalendarMonthOutlined sx={{ fontSize: '0.95rem' }} />
        </IconButton>
      </Tooltip>
      <CalendarDatePickerPopover
        open={pickerOpen}
        anchorEl={pickerAnchor}
        onClose={closePicker}
        value={normalized}
        onChange={handleDatePicked}
      />
    </Box>
  );
}

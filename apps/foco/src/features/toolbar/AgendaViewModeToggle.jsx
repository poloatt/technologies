import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import useResponsive from '@shared/hooks/useResponsive';
import {
  TAREAS_TOOLBAR_CENTER_ROW_HEIGHT,
  TAREAS_TOOLBAR_OPTION_MIN_WIDTH,
} from '@shared/navigation/tareasToolbarLayout';

const OPTIONS = [
  { value: 'week', label: 'Semana', minWidth: { xs: '2.65rem', sm: '3.1rem' } },
  { value: 'day', label: 'Día', minWidth: { xs: '2.35rem', sm: TAREAS_TOOLBAR_OPTION_MIN_WIDTH } },
];

/**
 * Selector "Semana | Día" para Agenda en la barra unificada (mismo slot que Ahora/Luego).
 * Estado sincronizado vía agendaCalendarState; cambia con agendaSetViewMode.
 */
export default function AgendaViewModeToggle() {
  const theme = useTheme();
  const { isMobile } = useResponsive();
  const [calendarViewMode, setCalendarViewMode] = useState('week');

  useEffect(() => {
    const handleAgendaCalendarState = (event) => {
      const { viewMode: vm } = event.detail || {};
      if (vm === 'day' || vm === 'week') setCalendarViewMode(vm);
    };
    window.addEventListener('agendaCalendarState', handleAgendaCalendarState);
    return () => window.removeEventListener('agendaCalendarState', handleAgendaCalendarState);
  }, []);

  const handleSelect = useCallback((viewMode) => {
    if (viewMode === calendarViewMode) return;
    setCalendarViewMode(viewMode);
    window.dispatchEvent(new CustomEvent('agendaSetViewMode', { detail: { viewMode } }));
  }, [calendarViewMode]);

  const inactiveColor = alpha(theme.palette.text.secondary, 0.55);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 0.5 : 0.75,
        flexShrink: 0,
        minHeight: TAREAS_TOOLBAR_CENTER_ROW_HEIGHT,
        height: TAREAS_TOOLBAR_CENTER_ROW_HEIGHT,
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
      role="group"
      aria-label="Vista de calendario"
    >
      {OPTIONS.map((option, index) => (
        <React.Fragment key={option.value}>
          {index > 0 && (
            <Typography
              component="span"
              sx={{
                fontSize: isMobile ? '0.7rem' : '0.75rem',
                lineHeight: 1,
                width: '0.35rem',
                textAlign: 'center',
                flexShrink: 0,
                color: alpha(theme.palette.text.secondary, 0.35),
                fontWeight: 300,
              }}
              aria-hidden
            >
              |
            </Typography>
          )}
          <Box
            component="button"
            type="button"
            onClick={() => handleSelect(option.value)}
            aria-pressed={calendarViewMode === option.value}
            sx={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              p: 0,
              m: 0,
              font: 'inherit',
              fontSize: isMobile ? '0.7rem' : '0.75rem',
              lineHeight: 1.2,
              minWidth: option.minWidth,
              textAlign: 'center',
              fontWeight: calendarViewMode === option.value ? 700 : 400,
              color: calendarViewMode === option.value ? 'text.primary' : inactiveColor,
              opacity: calendarViewMode === option.value ? 1 : 0.85,
              transition: 'color 0.15s ease, opacity 0.15s ease',
              '&:hover': {
                color: calendarViewMode === option.value ? 'text.primary' : 'text.secondary',
                opacity: 1,
              },
            }}
          >
            {option.label}
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
}

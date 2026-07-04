import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';
import useResponsive from '@shared/hooks/useResponsive';
import { matchTiempoSection } from '@shared/navigation/tiempoToolbarPaths';
import {
  getTaskHorizonCopy,
  TASK_HORIZON_GROUP_ARIA,
} from '@shared/copy/agendaTerminology';
import { TAREAS_TOOLBAR_CENTER_ROW_HEIGHT } from '@shared/navigation/tareasToolbarLayout';

const OPTIONS = ['ahora', 'luego'].map((value) => ({
  value,
  ...getTaskHorizonCopy(value),
}));

/**
 * Selector "Ahora | Luego" para Tareas.
 * Emite eventos: agendaViewChanged { view }
 */
export default function AgendaToolbarCenter() {
  const { pathname } = useLocation();
  const [agendaView, setAgendaView] = useState('ahora');
  const theme = useTheme();
  const { isMobile } = useResponsive();

  if (matchTiempoSection(pathname) !== 'tareas') {
    return null;
  }

  const handleSelect = (view) => {
    if (view === agendaView) return;
    setAgendaView(view);
    window.dispatchEvent(new CustomEvent('agendaViewChanged', { detail: { view } }));
  };

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
      aria-label={TASK_HORIZON_GROUP_ARIA}
    >
      {OPTIONS.map((option, index) => (
        <React.Fragment key={option.value}>
          {index > 0 && (
            <Typography
              component="span"
              sx={{
                fontSize: isMobile ? '0.7rem' : '0.75rem',
                lineHeight: 1,
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
            aria-pressed={agendaView === option.value}
            sx={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              p: 0,
              m: 0,
              font: 'inherit',
              fontSize: isMobile ? '0.7rem' : '0.75rem',
              lineHeight: 1.2,
              fontWeight: agendaView === option.value ? 700 : 400,
              color: agendaView === option.value ? 'text.primary' : inactiveColor,
              opacity: agendaView === option.value ? 1 : 0.85,
              transition: 'color 0.15s ease, opacity 0.15s ease',
              '&:hover': {
                color: agendaView === option.value ? 'text.primary' : 'text.secondary',
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

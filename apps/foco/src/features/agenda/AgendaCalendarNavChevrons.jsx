import React from 'react';
import { Box, IconButton } from '@mui/material';
import TooltipSpan from '@shared/components/TooltipSpan';
import { NavigateBefore, NavigateNext } from '@mui/icons-material';
import { useAgendaCalendarNavChevrons } from './useAgendaCalendarNavChevrons';

const chevronButtonSx = {
  width: 28,
  height: 28,
  p: 0.25,
  minWidth: 28,
  minHeight: 28,
  color: 'text.secondary',
  '& .MuiSvgIcon-root': { fontSize: '1.1rem' },
  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
};

const chevronButtonCompactSx = {
  width: 22,
  height: 22,
  p: 0,
  minWidth: 22,
  minHeight: 22,
  color: 'text.secondary',
  '& .MuiSvgIcon-root': { fontSize: '0.95rem' },
  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
};

/** ‹ › para calendario Foco o navegación entre registros de rutinas. */
export default function AgendaCalendarNavChevrons({
  viewMode,
  compact = false,
  buttonSx,
  navHandlers = null,
  middleContent = null,
}) {
  const calendarNav = useAgendaCalendarNavChevrons(navHandlers ? 'day' : viewMode);
  const onPrevious = navHandlers?.onPrevious ?? calendarNav.onPrevious;
  const onNext = navHandlers?.onNext ?? calendarNav.onNext;
  const prevTooltip = navHandlers?.prevTooltip ?? calendarNav.prevTooltip;
  const nextTooltip = navHandlers?.nextTooltip ?? calendarNav.nextTooltip;
  const prevDisabled = navHandlers?.prevDisabled ?? false;
  const nextDisabled = navHandlers?.nextDisabled ?? false;
  const resolvedButtonSx = buttonSx ?? (compact ? chevronButtonCompactSx : chevronButtonSx);

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      <TooltipSpan title={prevTooltip}>
        <IconButton
          size="small"
          onClick={onPrevious}
          disabled={prevDisabled}
          sx={resolvedButtonSx}
          aria-label="Anterior"
          data-testid={navHandlers ? 'prev-button' : 'foco-calendar-prev'}
        >
          <NavigateBefore fontSize="small" />
        </IconButton>
      </TooltipSpan>
      {middleContent}
      <TooltipSpan title={nextTooltip}>
        <IconButton
          size="small"
          onClick={onNext}
          disabled={nextDisabled}
          sx={resolvedButtonSx}
          aria-label="Siguiente"
          data-testid={navHandlers ? 'next-button' : 'foco-calendar-next'}
        >
          <NavigateNext fontSize="small" />
        </IconButton>
      </TooltipSpan>
    </Box>
  );
}

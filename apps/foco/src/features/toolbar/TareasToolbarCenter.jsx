import React from 'react';
import { Box } from '@mui/material';
import useResponsive from '@shared/hooks/useResponsive';
import { useTareasPageView } from '../tasks/list/useTareasPageView';
import AgendaToolbarCenter from './AgendaToolbarCenter';
import AgendaViewModeToggle from './AgendaViewModeToggle';
import TiempoToolbarActions from './TiempoToolbarActions';
import {
  TAREAS_TOOLBAR_CENTER_ROW_HEIGHT,
  TAREAS_TOOLBAR_MOBILE_TOGGLES_WIDTH,
} from '@shared/navigation/tareasToolbarLayout';

const rightSlotSx = {
  position: 'relative',
  flexShrink: 0,
  height: TAREAS_TOOLBAR_CENTER_ROW_HEIGHT,
};

const rightSlotLayerSx = {
  position: 'absolute',
  top: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  height: '100%',
};

export default function TareasToolbarCenter() {
  const { isMobile } = useResponsive();
  const pageView = useTareasPageView();
  const isAgendaView = pageView === 'agenda';

  if (!isMobile) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          minHeight: TAREAS_TOOLBAR_CENTER_ROW_HEIGHT,
          height: TAREAS_TOOLBAR_CENTER_ROW_HEIGHT,
          overflow: 'visible',
        }}
      >
        <TiempoToolbarActions section="tareas" dense />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        minWidth: 0,
        minHeight: TAREAS_TOOLBAR_CENTER_ROW_HEIGHT,
        height: TAREAS_TOOLBAR_CENTER_ROW_HEIGHT,
        overflow: 'visible',
        gap: 0.5,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          flex: '1 1 auto',
          minWidth: 0,
          maxWidth: `calc(100% - ${TAREAS_TOOLBAR_MOBILE_TOGGLES_WIDTH})`,
          overflow: 'visible',
        }}
      >
        <TiempoToolbarActions section="tareas" dense />
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flex: `0 0 ${TAREAS_TOOLBAR_MOBILE_TOGGLES_WIDTH}`,
          width: TAREAS_TOOLBAR_MOBILE_TOGGLES_WIDTH,
          flexShrink: 0,
        }}
      >
        <Box sx={rightSlotSx}>
          <Box
            sx={{
              ...rightSlotLayerSx,
              visibility: isAgendaView ? 'hidden' : 'visible',
              pointerEvents: isAgendaView ? 'none' : 'auto',
            }}
            aria-hidden={isAgendaView}
          >
            <AgendaToolbarCenter />
          </Box>
          <Box
            sx={{
              ...rightSlotLayerSx,
              visibility: isAgendaView ? 'visible' : 'hidden',
              pointerEvents: isAgendaView ? 'auto' : 'none',
            }}
            aria-hidden={!isAgendaView}
          >
            <AgendaViewModeToggle />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

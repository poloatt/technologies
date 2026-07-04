import React from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { getRutinaDateHeroBar } from './toolbarRegistry';
import {
  AGENDA_UNIFIED_BAR_CONFIG,
  RUTINA_NAVIGATION_BAR_CONFIG,
  isRutinasPath,
} from '../config/uiConstants';
import {
  getRutinaPageContentShellSx,
} from '../styles/rutinaPageStyles';
import useResponsive from '../hooks/useResponsive';
import { useUISettings } from '../context/UISettingsContext';
import { useSidebar } from '../context/SidebarContext';

/**
 * Barra fija bajo AgendaUnifiedBar: date hero de navegación diaria en /rutinas.
 */
export default function RutinaPageNavigationBar() {
  const { pathname } = useLocation();
  const { isMobileOrTablet } = useResponsive();
  const { showSidebarCollapsed } = useUISettings();
  const { getMainMargin } = useSidebar();
  const mainMargin = getMainMargin(isMobileOrTablet, showSidebarCollapsed);

  if (!isRutinasPath(pathname)) return null;

  const RutinaDateHeroBar = getRutinaDateHeroBar();
  if (!RutinaDateHeroBar) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: AGENDA_UNIFIED_BAR_CONFIG.height,
        left: isMobileOrTablet ? 0 : mainMargin,
        right: 0,
        height: RUTINA_NAVIGATION_BAR_CONFIG.height,
        zIndex: RUTINA_NAVIGATION_BAR_CONFIG.zIndex,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        bgcolor: 'background.default',
        transition: 'left 0.3s',
      }}
    >
      <Box
        sx={{
          ...getRutinaPageContentShellSx(isMobileOrTablet),
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <RutinaDateHeroBar />
      </Box>
    </Box>
  );
}

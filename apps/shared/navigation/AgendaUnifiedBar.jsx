import React, { useEffect, useState } from 'react';
import { Box } from '../utils/materialImports';
import { useLocation } from 'react-router-dom';
import { AGENDA_UNIFIED_BAR_CONFIG } from '../config/uiConstants';
import { SystemButtons, MenuButton } from '../components/common/SystemButtons';
import CenteredTrack from '../components/common/CenteredTrack.jsx';
import { useUISettings } from '../context/UISettingsContext';
import { useSidebar } from '../context/SidebarContext';
import useResponsive from '../hooks/useResponsive';
import { useAnchorWidths } from '../hooks/useAnchorWidths';
import {
  resolveToolbarLeftByPath,
  resolveToolbarCenterByPath,
  resolveToolbarCenterDesktop,
  resolveToolbarRightByPath,
} from './toolbarModules';
import { isCajaToolbarPath, isFocoToolbarPath, isPulsoToolbarPath } from './unifiedBarPaths';

/**
 * Barra superior unificada (Foco / Caja / Pulso):
 * izquierda: menú (+ back Caja); centro: acciones/setups; derecha: nav de sección + apps.
 * Caja sigue la misma geometría que Foco (CenteredTrack + columna derecha).
 */
export default function AgendaUnifiedBar({ currentPath = '' }) {
  const { showEntityToolbarNavigation, showSidebarCollapsed } = useUISettings();
  const { collapsedWidth, getMainMargin } = useSidebar();
  const { isMobile, isMobileOrTablet } = useResponsive();
  const location = useLocation();
  const path = currentPath || location.pathname;
  const [hasSelectedItems, setHasSelectedItems] = useState(false);

  const LeftComp = resolveToolbarLeftByPath(path);
  const RightComp = resolveToolbarRightByPath(path);
  const CenterComp = resolveToolbarCenterByPath(path);
  const showCenterOnDesktop = resolveToolbarCenterDesktop(path);
  const mainMargin = getMainMargin(isMobileOrTablet, showSidebarCollapsed);

  const showCenter = CenterComp && (isMobileOrTablet || showCenterOnDesktop);

  useEffect(() => {
    const handleSelectionChange = (event) => {
      setHasSelectedItems(!!event.detail?.hasSelections);
    };
    window.addEventListener('selectionChanged', handleSelectionChange);
    return () => window.removeEventListener('selectionChanged', handleSelectionChange);
  }, []);

  const showRightNav = !isMobile || showEntityToolbarNavigation;
  const isCajaPath = isCajaToolbarPath(path);
  const isPulsoPath = isPulsoToolbarPath(path);
  const isFocoPath = isFocoToolbarPath(path);

  // Pulso mantiene overlay propio; Foco y Caja comparten layout.
  const usePulsoCenterOverlay = isPulsoPath;
  const showDesktopSectionNav = (isFocoPath || isCajaPath) && showRightNav && RightComp && !isMobile;
  const useCenteredTrackOverlay = (isFocoPath || isCajaPath) && showCenter && !usePulsoCenterOverlay;

  const { rightWidthRef, rightWidth } = useAnchorWidths(0, 0, [
    path,
    showDesktopSectionNav,
    showCenter,
    isMobileOrTablet,
  ]);

  const showRightGridColumn = Boolean(
    showDesktopSectionNav || (showRightNav && RightComp && !isMobile && !isCajaPath && !isFocoPath),
  );
  // Con CenteredTrack el centro no usa la celda del grid.
  const showGridCenter = showCenter && !usePulsoCenterOverlay && !useCenteredTrackOverlay;
  const gridColumns = showRightGridColumn ? '1fr auto' : '1fr';

  const MOBILE_LEFT_INSET = 0;
  const baseCenterInsetLeft = isMobileOrTablet
    ? MOBILE_LEFT_INSET
    : (mainMargin < collapsedWidth ? collapsedWidth : mainMargin);
  const gridMarginRight = collapsedWidth;

  // Caja: slot fijo del botón atrás (visible o no) a la derecha del menú.
  const cajaBackSlotPx = isCajaPath ? (isMobile ? 32 : 26) : 0;

  // Caja: centro óptico entre menú(+atrás) y apps. Foco: reserva también el ancho de la nav derecha.
  const centerTrackLeft = baseCenterInsetLeft + cajaBackSlotPx;
  const centerTrackRightInset = isCajaPath
    ? collapsedWidth
    : collapsedWidth + (showDesktopSectionNav ? rightWidth : 0);

  return (
    <Box
      sx={{
        width: '100%',
        height: AGENDA_UNIFIED_BAR_CONFIG.height,
        bgcolor: '#181818',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        overflow: 'visible',
      }}
    >
      {usePulsoCenterOverlay && (
        <Box
          sx={{
            position: 'absolute',
            left: `${baseCenterInsetLeft}px`,
            right: `${gridMarginRight}px`,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobileOrTablet ? 'flex-start' : 'center',
            pointerEvents: 'none',
            zIndex: 3,
            '& > *': { pointerEvents: 'auto' },
          }}
        >
          {CenterComp && <CenterComp hasSelectedItems={hasSelectedItems} />}
        </Box>
      )}
      {useCenteredTrackOverlay && CenterComp && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            pointerEvents: 'none',
          }}
        >
          <CenteredTrack
            isMobileOrTablet={isMobileOrTablet}
            mainMargin={centerTrackLeft}
            leftWidth={isMobileOrTablet ? cajaBackSlotPx : 0}
            rightWidth={centerTrackRightInset}
            height={AGENDA_UNIFIED_BAR_CONFIG.height}
          >
            <Box
              sx={{
                pointerEvents: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                maxWidth: '100%',
              }}
            >
              <CenterComp hasSelectedItems={hasSelectedItems} />
            </Box>
          </CenteredTrack>
        </Box>
      )}
      <Box
        sx={{
          position: 'absolute',
          left: { xs: -1, sm: -2, md: -3 },
          top: 0,
          height: AGENDA_UNIFIED_BAR_CONFIG.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 0.25,
          pl: 0,
          zIndex: 5,
        }}
      >
        {!isMobileOrTablet && (
          <Box
            sx={{
              width: collapsedWidth,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MenuButton />
          </Box>
        )}
        {LeftComp && <LeftComp hasSelectedItems={hasSelectedItems} />}
      </Box>

      <Box
        sx={{
          position: 'absolute',
          right: { xs: -1, sm: -2, md: -3 },
          top: 0,
          width: collapsedWidth,
          height: AGENDA_UNIFIED_BAR_CONFIG.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 6,
        }}
      >
        <SystemButtons.AppsButton />
      </Box>

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          ml: `${baseCenterInsetLeft}px`,
          mr: `${gridMarginRight}px`,
          display: 'grid',
          gridTemplateColumns: gridColumns,
          alignItems: 'center',
          gap: { xs: 0.5, sm: 1 },
          px: { xs: 0.5, sm: 1, md: 1.5 },
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {showGridCenter && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
              minHeight: 26,
              overflow: 'visible',
              width: '100%',
              height: '100%',
              position: 'relative',
              zIndex: 2,
            }}
          >
            {CenterComp ? (
              <CenterComp hasSelectedItems={hasSelectedItems} />
            ) : null}
          </Box>
        )}

        {showRightGridColumn && (
          <Box
            ref={showDesktopSectionNav ? rightWidthRef : null}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              flexShrink: 0,
              gap: 0.25,
              position: 'relative',
              zIndex: 4,
              ...(!showGridCenter ? { gridColumn: 2 } : {}),
            }}
          >
            <RightComp hasSelectedItems={hasSelectedItems} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

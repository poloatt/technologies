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
import { resolveCajaBranchHubPath } from './appNavResolver';
import { isCajaToolbarPath, isFocoToolbarPath, isPulsoToolbarPath } from './unifiedBarPaths';

/**
 * Barra superior unificada (Foco / Caja / Pulso):
 * izquierda: menú; centro: acciones; derecha: subpáginas + apps.
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
  const useCenterActionsOverlay = isCajaPath || isPulsoPath;
  const hideGridCenter = useCenterActionsOverlay;
  const showCajaBranchSwitcher = isCajaPath && !isMobile && RightComp;
  const showFocoRightNav = isFocoPath && showRightNav && RightComp && !isMobile;

  const showRightGridColumn = Boolean(
    showRightNav && RightComp && !showCajaBranchSwitcher && (!isMobile || isCajaPath),
  );
  const useFocoCenterOverlay = isFocoPath && showCenter && !useCenterActionsOverlay;
  const { rightWidthRef, rightWidth } = useAnchorWidths(0, 0, [
    path,
    showFocoRightNav,
    showCenter,
    isMobileOrTablet,
  ]);
  const focoCenterRightInset = collapsedWidth + (showFocoRightNav ? rightWidth : 0);
  const showGridCenter = showCenter && !hideGridCenter && !useFocoCenterOverlay;
  const gridColumns = showRightGridColumn ? '1fr auto' : '1fr';

  const showCajaBranchBack = isCajaPath && !!resolveCajaBranchHubPath(path);
  const TOOLBAR_BACK_SLOT_WIDTH = 34;
  const showBranchBack = showCajaBranchBack && !isMobile;
  const MOBILE_LEFT_INSET = 0;
  const baseCenterInsetLeft = isMobileOrTablet
    ? MOBILE_LEFT_INSET
    : (mainMargin < collapsedWidth ? collapsedWidth : mainMargin);
  const centerActionsInsetLeft = showBranchBack
    ? baseCenterInsetLeft + TOOLBAR_BACK_SLOT_WIDTH
    : baseCenterInsetLeft;
  const gridMarginRight = collapsedWidth;
  const centerOverlayRight = showCajaBranchSwitcher
    ? collapsedWidth + 96
    : gridMarginRight;

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
      {useCenterActionsOverlay && (
        <Box
          sx={{
            position: 'absolute',
            left: `${centerActionsInsetLeft}px`,
            right: `${centerOverlayRight}px`,
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
          {isCajaPath && CenterComp && <CenterComp hasSelectedItems={hasSelectedItems} />}
          {isPulsoPath && CenterComp && <CenterComp hasSelectedItems={hasSelectedItems} />}
        </Box>
      )}
      {useFocoCenterOverlay && CenterComp && (
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', '& > *': { pointerEvents: 'auto' } }}>
          <CenteredTrack
            isMobileOrTablet={isMobileOrTablet}
            mainMargin={baseCenterInsetLeft}
            leftWidth={0}
            rightWidth={focoCenterRightInset}
            height={AGENDA_UNIFIED_BAR_CONFIG.height}
          >
            <CenterComp hasSelectedItems={hasSelectedItems} />
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
          zIndex: 4,
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
          zIndex: 2,
        }}
      >
        <SystemButtons.AppsButton />
      </Box>

      {showCajaBranchSwitcher && (
        <Box
          sx={{
            position: 'absolute',
            right: `${collapsedWidth}px`,
            top: 0,
            height: AGENDA_UNIFIED_BAR_CONFIG.height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            zIndex: 4,
            px: 0.5,
          }}
        >
          <RightComp hasSelectedItems={hasSelectedItems} />
        </Box>
      )}

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
              justifyContent: isMobileOrTablet ? 'flex-start' : 'center',
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
            ref={showFocoRightNav ? rightWidthRef : null}
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

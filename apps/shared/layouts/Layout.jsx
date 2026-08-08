import React, { useContext, useEffect } from 'react';
import { Box } from '@mui/material';
import { useUISettings } from '../context/UISettingsContext';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../context/AuthContext';
import { Header, Toolbar, AgendaUnifiedBar } from '../navigation';
import RutinaPageNavigationBar from '../navigation/RutinaPageNavigationBar.jsx';
import { isUnifiedToolbarPath } from '../navigation/unifiedBarPaths';
import {
  calculateTopPadding,
  getMainBottomPadding,
  getRutinaPageMainMargin,
  shouldRenderAppSidebar,
  HEADER_CONFIG,
  FOOTER_CONFIG,
  SPACING,
  isRutinasPath,
} from '../config/uiConstants.js';
import { Footer } from '../navigation';
import { Sidebar, BottomNavigation } from '../navigation';
import { CustomSnackbarProvider } from '../components/common';
import { PwaInstallBanner } from '../components/pwa';
import { FormManagerProvider } from '../context/FormContext';
import { GlobalFormEventListener } from '../context/GlobalFormEventListener';
import useResponsive from '../hooks/useResponsive';
import { useNavigationState } from '../utils/navigationUtils';
import RutinasContext, { RutinasProvider } from '../context/RutinasContext';

// Evita doble provider (p.ej. cuando el host app ya envuelve con RutinasProvider, como `apps/foco/src/App.jsx`)
function MaybeRutinasProvider({ children }) {
  const existing = useContext(RutinasContext);
  if (existing) return children;
  return <RutinasProvider>{children}</RutinasProvider>;
}

export function Layout() {
  const { isMobile, isTablet, isMobileOrTablet } = useResponsive();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Usar utilidad centralizada para navegación
  const { moduloActivo, nivel1Activo, nivel2 } = useNavigationState(currentPath);
  
  const { isOpen, isDesktop, sidebarWidth, collapsedWidth } = useSidebar();
  const { showEntityToolbarNavigation, showSidebarCollapsed } = useUISettings();
  const { user } = useAuth();

  useEffect(() => {
    const handleHeaderAddButton = (event) => {
      if (!event.detail?.path) return;
      if (event.detail.path !== location.pathname) {
        navigate(event.detail.path, { state: { openAdd: true } });
      } else {
        window.dispatchEvent(new CustomEvent('openAddFormLocal'));
      }
    };
    window.addEventListener('headerAddButtonClicked', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAddButton);
  }, [navigate, location.pathname]);

  if (!user) {
    navigate('/login');
    return null;
  }

  // Usar constantes centralizadas para dimensiones
  // Mostrar siempre la Toolbar en desktop; respetar preferencia solo en móvil/tablet
  // Nota UX: el setting "showEntityToolbarNavigation" está pensado SOLO para móvil.
  // En tablet/desktop la Toolbar siempre debe mostrarse (evita que quede "oculta" en pantallas medianas).
  const showToolbar = isMobile ? showEntityToolbarNavigation : true;
  const unifiedBar = isUnifiedToolbarPath(currentPath);
  const isRutinasPage = isRutinasPath(currentPath);
  const rutinasSubNav = unifiedBar && isRutinasPage;
  const totalTopPadding = calculateTopPadding(showToolbar, unifiedBar, rutinasSubNav);
  const sidebarTopPadding = calculateTopPadding(showToolbar, unifiedBar, false);
  const showHeader = !unifiedBar;
  const showLegacyToolbar = showToolbar && !unifiedBar;
  const showAgendaBar = unifiedBar;
  
  // Padding superior para el main
  const mainTopPadding = totalTopPadding;

  // Sidebar en desktop; móvil/tablet usa BottomNavigation
  const shouldRenderSidebar = shouldRenderAppSidebar(isMobileOrTablet, currentPath);

  const getMainContentMargin = () => {
    if (isRutinasPage) {
      return getRutinaPageMainMargin(isMobileOrTablet, isOpen, sidebarWidth);
    }
    if (isMobileOrTablet) {
      return 0;
    }
    return isOpen ? sidebarWidth : collapsedWidth;
  };

  const mainContentMargin = getMainContentMargin();
  const mainBottomPadding = getMainBottomPadding(isMobileOrTablet);

  return (
    <FormManagerProvider>
      <GlobalFormEventListener />
      <Box sx={{ minHeight: '100vh', maxWidth: '100vw', bgcolor: 'background.default', position: 'relative' }}>
        {showHeader && (
          <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100vw', zIndex: 1400 }}>
            <Header />
          </Box>
        )}
        {showAgendaBar && (
          <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100vw', zIndex: 1400, overflow: 'visible' }}>
            <AgendaUnifiedBar currentPath={currentPath} />
          </Box>
        )}
        {/* Toolbar + Sidebar + Main: envueltos por RutinasProvider cuando corresponde */}
        {isRutinasPage ? (
          <MaybeRutinasProvider>
            {showAgendaBar && <RutinaPageNavigationBar />}
            {/* Toolbar siempre se renderiza */}
            {showLegacyToolbar && (
              <Box sx={{ position: 'fixed', top: `${HEADER_CONFIG.height}px`, left: 0, width: '100vw', zIndex: 1399 }}>
                <Toolbar 
                  moduloActivo={moduloActivo}
                  nivel1={nivel2}
                  currentPath={currentPath}
                />
              </Box>
            )}
            {/* Sidebar */}
            {isOpen !== undefined && shouldRenderSidebar && (
              <Box
                sx={{
                  position: 'fixed',
                  top: `${sidebarTopPadding}px`,
                  left: 0,
                  height: isMobile
                    ? `calc(100vh - ${sidebarTopPadding}px - ${SPACING.bottomNavigationHeight}px)`
                    : `calc(100vh - ${sidebarTopPadding}px - ${FOOTER_CONFIG.height}px)`,
                  zIndex: 1100,
                  width: isOpen ? sidebarWidth : collapsedWidth,
                  transition: 'width 0.3s',
                  bgcolor: 'background.default',
                  borderRight: '1.5px solid #232323',
                  overflow: 'hidden',
                  display: 'block',
                }}
              >
                <Sidebar moduloActivo={moduloActivo} nivel1Activo={nivel1Activo} />
              </Box>
            )}
            {/* Main content */}
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                left: mainContentMargin,
                right: 0,
                bottom: 0,
                pt: `${mainTopPadding}px`,
                pb: mainBottomPadding,
                bgcolor: 'background.default',
                overflowY: 'auto',
                overflowX: 'hidden',
                zIndex: 1,
                scrollbarGutter: 'stable',
                transition: 'left 0.3s',
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: 'rgba(255, 255, 255, 0.2)',
                }
              }}
            >
              <Box sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                minHeight: 0,
                border: 'none',
                outline: 'none',
                pb: { xs: 1, sm: 0 },
              }}>
                <Outlet />
              </Box>
              {isMobileOrTablet && <BottomNavigation />}
              <CustomSnackbarProvider />
            </Box>
          </MaybeRutinasProvider>
        ) : (
          <>
            {showLegacyToolbar && (
              <Box sx={{ position: 'fixed', top: `${HEADER_CONFIG.height}px`, left: 0, width: '100vw', zIndex: 1399 }}>
                <Toolbar 
                  moduloActivo={moduloActivo}
                  nivel1={nivel2}
                  currentPath={currentPath}
                />
              </Box>
            )}
            {/* Sidebar */}
            {isOpen !== undefined && shouldRenderSidebar && (
              <Box
                sx={{
                  position: 'fixed',
                  top: `${sidebarTopPadding}px`,
                  left: 0,
                  height: isMobile
                    ? `calc(100vh - ${sidebarTopPadding}px - ${SPACING.bottomNavigationHeight}px)`
                    : `calc(100vh - ${sidebarTopPadding}px - ${FOOTER_CONFIG.height}px)`,
                  zIndex: 1100,
                  width: isOpen ? sidebarWidth : collapsedWidth,
                  transition: 'width 0.3s',
                  bgcolor: 'background.default',
                  borderRight: '1.5px solid #232323',
                  overflow: 'hidden',
                  display: 'block',
                }}
              >
                <Sidebar moduloActivo={moduloActivo} nivel1Activo={nivel1Activo} />
              </Box>
            )}
            {/* Main content */}
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                left: mainContentMargin,
                right: 0,
                bottom: 0,
                pt: `${mainTopPadding}px`,
                pb: mainBottomPadding,
                bgcolor: 'background.default',
                overflowY: 'auto',
                overflowX: 'hidden',
                zIndex: 1,
                scrollbarGutter: 'stable',
                transition: 'left 0.3s',
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: 'rgba(255, 255, 255, 0.2)',
                }
              }}
            >
              <Box sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                minHeight: 0,
                border: 'none',
                outline: 'none',
                pb: { xs: 1, sm: 0 },
              }}>
                <Outlet />
              </Box>
              {isMobileOrTablet && <BottomNavigation />}
              <CustomSnackbarProvider />
            </Box>
          </>
        )}
        {/* Footer health-check: solo desktop; en móvil compite con BottomNavigation */}
        {!isMobileOrTablet && (
          <Box sx={{ position: 'fixed', left: 0, bottom: 0, width: '100vw', zIndex: 1300, height: `${FOOTER_CONFIG.height}px` }}>
            <Footer isDesktop={isDesktop} isSidebarOpen={isOpen && isDesktop} />
          </Box>
        )}
        <PwaInstallBanner />
      </Box>
    </FormManagerProvider>
  );
}

export default Layout;

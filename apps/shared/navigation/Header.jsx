import { 
    AppBar, 
    Toolbar, 
    Typography, 
    Box,
    IconButton,
    Tooltip
  } from '../utils/materialImports';
import { alpha } from '@mui/material/styles';
  import { useSidebar } from '../context/SidebarContext';
  import { useUISettings } from '../context/UISettingsContext';
  import { AutorenewOutlined } from '@mui/icons-material';
  import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
  import { Dialog } from '../utils/materialImports';
  // import { MercadoPagoConnectButton, BankConnectionForm } from '../../../caja/src/finance/bankconnections'; // Comentado: import cruzado
  import { getBreadcrumbs } from './breadcrumbUtils';
import { getIconByKey, icons } from './menuIcons';
import { modulos } from './menuStructure';
import { Breadcrumbs } from '../utils/materialImports';
import useResponsive from '../hooks/useResponsive';
import { useNavigationState } from '../utils/navigationUtils';
import { HEADER_CONFIG, NAV_TYPO } from '../config/uiConstants';
import { isUnifiedToolbarPath } from './unifiedBarPaths';
import { getCenteredSectionSx } from './alignmentUtils';
import { DynamicIcon } from '../components/common/DynamicIcon';
  import { SystemButtons, SYSTEM_ICONS, MenuButton } from '../components/common/SystemButtons';
  import { Refresh as RefreshIcon } from '@mui/icons-material';
  import theme from '../context/ThemeContext';
  import React from 'react';
  import CenteredTrack from '../components/common/CenteredTrack.jsx';
  import { useAnchorWidths } from '../hooks/useAnchorWidths';
  
  export default function Header() {
    const { toggleSidebar, isOpen: sidebarIsOpen, collapsedWidth, getMainMargin } = useSidebar();
    const { showEntityToolbarNavigation, showSidebarCollapsed } = useUISettings();
  
    const location = useLocation();
    const navigate = useNavigate();
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [isBankConnectionFormOpen, setIsBankConnectionFormOpen] = useState(false);
    const { isMobile, isTablet, isMobileOrTablet, isDesktop } = useResponsive();
    // Hook de medición reutilizable (inicial izquierda = collapsedWidth por el MenuButton)
    const { leftWidthRef, rightWidthRef, leftWidth, rightWidth } = useAnchorWidths(
      collapsedWidth,
      0,
      [collapsedWidth, isMobileOrTablet, showEntityToolbarNavigation, location.pathname]
    );
    const { moduloActivo } = useNavigationState(location.pathname);
    // Construir breadcrumbs incluyendo el módulo padre cuando estés dentro de un módulo
    let breadcrumbs = [];
    if (moduloActivo) {
      // Si estás dentro de un módulo, incluir el módulo padre
      breadcrumbs = getBreadcrumbs(location.pathname, [moduloActivo]);
    } else {
      // Si no estás dentro de un módulo, usar todos los módulos
      breadcrumbs = getBreadcrumbs(location.pathname, modulos);
    }
    
    // Usar función centralizada para calcular mainMargin (pasando visibilidad colapsada en móvil)
    const mainMargin = getMainMargin(isMobileOrTablet, showSidebarCollapsed);
  
    const handleBack = () => {
      // Encuentra el menú padre según la ruta
      const pathParts = location.pathname.split('/').filter(Boolean);
      if (pathParts.length > 1) {
        // Quita el último segmento
        const parentPath = '/' + pathParts.slice(0, -1).join('/');
        navigate(parentPath);
      } else {
        navigate('/');
      }
    };

    // Determinar si se debe mostrar el botón atrás: ocultarlo en raíz y en niveles padre del menú (ej: finanzas, propiedades, etc.)
    const shouldShowBackButton = (() => {
      const path = location.pathname;
      if (path === '/') return false;
      // Construir lista de rutas que actúan como nivel padre (tienen subItems) o módulos raíz
      const parentPaths = new Set();
      modulos.forEach(m => {
        if (m.path) parentPaths.add(m.path);
        if (Array.isArray(m.subItems)) {
          m.subItems.forEach(s => {
            if (s.path && Array.isArray(s.subItems) && s.subItems.length > 0) {
              parentPaths.add(s.path);
            }
          });
        }
      });
      return !parentPaths.has(path);
    })();
  
    // Nota: el centrado real se realiza vía CenteredTrack

    const titlePillSx = (muiTheme) => ({
      display: 'inline-flex',
      alignItems: 'center',
      // ~20% menos alto: bajar lineHeight y evitar padding vertical extra
      py: 0,
      px: 1,
      borderRadius: 1,
      backgroundColor: muiTheme.palette.mode === 'dark'
        ? alpha(muiTheme.palette.common.black, 0.28)
        : alpha(muiTheme.palette.common.black, 0.06),
    });

    const titleTextSx = {
      ...NAV_TYPO.headerTitleSx,
      lineHeight: 1.0,
    };

    if (isUnifiedToolbarPath(location.pathname)) {
      return null;
    }

    return (
      <AppBar 
        position="static"
        color="default" // <-- Forzar uso del color de fondo definido en el theme
        elevation={0}    // <-- Quitar sombra
        sx={{ 
          backgroundColor: '#181818', // <-- Forzar color exacto
          boxShadow: 'none', // <-- Forzar sin sombra
          height: HEADER_CONFIG.height,
          width: '100%', // Header siempre 100% del ancho
          transition: 'none', // Sin transiciones innecesarias
          top: 0 // Header siempre arriba de todo (no-op en static, pero no molesta)
        }}
      >
        <Toolbar 
          variant="dense"
          sx={{ 
            minHeight: HEADER_CONFIG.height,
            height: HEADER_CONFIG.height,
            px: {
              xs: 1,
              sm: 2,
              md: 3
            },
            boxShadow: 'none', // <-- Forzar sin sombra en Toolbar
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            position: 'relative'
          }}
        >
          {/* Layout específico para móvil/tablet cuando la toolbar está deshabilitada */}
          {isMobileOrTablet && !showEntityToolbarNavigation ? (
              <Box sx={{
                width: '100%',
                height: HEADER_CONFIG.height,
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: 0.5
              }}>
                {/* Izquierda: primero Menú y luego Atrás */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, height: '100%' }}>
                  {!isMobileOrTablet && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: HEADER_CONFIG.height, height: HEADER_CONFIG.height }}>
                      <MenuButton />
                    </Box>
                  )}
                  {shouldShowBackButton && (
                    <IconButton onClick={handleBack} size="small" aria-label="Volver" sx={{ width: HEADER_CONFIG.height, height: HEADER_CONFIG.height }}>
                      {icons.arrowBack ? <icons.arrowBack sx={{ fontSize: 18 }} /> : <span>&larr;</span>}
                    </IconButton>
                  )}
                </Box>
                {/* Centro: ruta/título centrado */}
                {(() => {
                  const last = breadcrumbs[breadcrumbs.length - 1];
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {last?.icon && (
                        <DynamicIcon 
                          iconKey={last.icon} 
                          size="small" 
                          color="primary.main" 
                          sx={{ marginRight: 0.5 }} 
                        />
                      )}
                      <Box sx={titlePillSx}>
                        <Typography
                          color="inherit"
                          variant={NAV_TYPO.headerTitleVariant}
                          sx={{
                            ...titleTextSx,
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {last?.title}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })()}
                {/* Derecha: [acciones extra, settings] ... [espaciador] ... [apps al extremo derecho] */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, width: '100%' }}>
                  {/* Acciones adicionales futuras: colócalas aquí a la izquierda dentro de este grupo */}
                  {/* Espaciador para empujar Apps al extremo derecho */}
                  <Box sx={{ flexGrow: 1 }} />
                  {/* Apps toggle siempre último y alineado a la derecha */}
                  <SystemButtons.AppsButton />
                </Box>
              </Box>
          ) : (
            <>
              {/* MenuButton fijo - solo en desktop */}
              {!isMobileOrTablet && (
                <Box sx={{ 
                  position: 'absolute',
                  left: { xs: -1, sm: -2, md: -3 },
                  top: 0,
                  width: collapsedWidth,
                  height: HEADER_CONFIG.height,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2
                }} ref={leftWidthRef}>
                  <MenuButton />
                </Box>
              )}

                {/* Sección de navegación alineada con main content */}
                <Box sx={{ 
                  marginLeft: showEntityToolbarNavigation ? 0 : `${mainMargin}px`,
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 1,
                  flex: 1
                }}>
                  {/* Botón de atrás solo si no estamos en la raíz y la toolbar no está activa */}
                  {shouldShowBackButton && !showEntityToolbarNavigation && (
                    <IconButton onClick={handleBack} size="small" sx={{ ml: 0, mr: 0.5 }}>
                      {icons.arrowBack ? <icons.arrowBack sx={{ fontSize: 18 }} /> : <span>&larr;</span>}
                    </IconButton>
                  )}
                </Box>
            </>
          )}

          {/* Título centrado - solo en desktop */}
          {isDesktop && (() => {
              const last = breadcrumbs[breadcrumbs.length - 1];
              return (
                <CenteredTrack
                  isMobileOrTablet={false}
                  mainMargin={mainMargin}
                  leftWidth={leftWidth}
                  rightWidth={rightWidth}
                  height={HEADER_CONFIG.height}
                >
                  {last?.icon && (
                    <DynamicIcon 
                      iconKey={last.icon} 
                      size="small" 
                      color="primary.main" 
                      sx={{ marginRight: 0.5 }} 
                    />
                  )}
                  <Box sx={titlePillSx}>
                    <Typography color="inherit" variant={NAV_TYPO.headerTitleVariant} sx={titleTextSx}>
                      {last?.title}
                    </Typography>
                  </Box>
                </CenteredTrack>
            );
          })()}

          {/* Título para móvil/tablet ahora lo maneja el layout específico cuando la toolbar está deshabilitada */}
          {isMobileOrTablet && showEntityToolbarNavigation && (() => {
              const last = breadcrumbs[breadcrumbs.length - 1];
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {last?.icon && (
                    <DynamicIcon 
                      iconKey={last.icon} 
                      size="small" 
                      color="primary.main" 
                      sx={{ marginRight: 0.5 }} 
                    />
                  )}
                  <Box sx={titlePillSx}>
                    <Typography color="inherit" variant={NAV_TYPO.headerTitleVariant} sx={titleTextSx}>
                      {last?.title}
                    </Typography>
                  </Box>
                </Box>
            );
          })()}

          {/* Acciones y botones del lado derecho - solo en desktop */}
          {isDesktop && (
            <>
              {/* Botones de acción (sync, etc.) - antes del AppsButton */}
              <Box sx={{ display: 'flex', alignItems: 'center', marginRight: `${collapsedWidth}px` }}>
                  <SystemButtons
                    actions={[
                     !showEntityToolbarNavigation && location.pathname.includes('/cuentas') ? {
                       key: 'sync',
                       icon: <AutorenewOutlined sx={{ fontSize: 20, color: 'white' }} />,
                       label: 'Sincronizar',
                       tooltip: 'Sincronizar nueva cuenta',
                       onClick: () => setIsSyncModalOpen(true),
                       disabled: false
                     } : null,
                    ]}
                    direction="row"
                    size="small"
                  />
              </Box>
              {/* AppsButton fijo - simétrico con MenuButton */}
              <Box sx={{ 
                  position: 'absolute',
                  right: { xs: -1, sm: -2, md: -3 }, // Compensar padding del Toolbar
                  top: 0,
                  width: collapsedWidth,
                  height: HEADER_CONFIG.height,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2
                }} ref={rightWidthRef}>
                  <SystemButtons.AppsButton />
              </Box>
            </>
          )}

          {/* En móvil/tablet con toolbar habilitada, mantener Apps toggle alineado a la derecha */}
          {isMobileOrTablet && showEntityToolbarNavigation && (
            <Box sx={{ 
                position: 'absolute', 
                right: { xs: 1, sm: 2, md: 3 }, 
                display: 'flex', 
                alignItems: 'center', 
                height: HEADER_CONFIG.height, 
                gap: 0.25 
              }}>
                <SystemButtons.AppsButton />
              </Box>
            )}
          {/* Diálogos modales para sincronizar y agregar cuenta */}
          <Dialog open={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} maxWidth="xs" fullWidth>
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Sincronizar nueva cuenta</Typography>
              {/* <MercadoPagoConnectButton
                onSuccess={() => setIsSyncModalOpen(false)}
                onError={() => setIsSyncModalOpen(false)}
              /> */}
            </Box>
          </Dialog>
          {/* <Dialog open={isBankConnectionFormOpen} onClose={() => setIsBankConnectionFormOpen(false)} maxWidth="xs" fullWidth>
            <BankConnectionForm onClose={() => setIsBankConnectionFormOpen(false)} />
          </Dialog> */}
        </Toolbar>
      </AppBar>
    );
  } 
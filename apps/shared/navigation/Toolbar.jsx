// Toolbar.jsx
// Toolbar modular: ahora recibe 'moduloActivo', 'nivel1' y 'currentPath' como props. Solo navega entre los hijos de nivel1.

import React, { useEffect, useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '../utils/materialImports';
import { FORM_HEIGHTS, TOOLBAR_CONFIG, NAV_TYPO } from '../config/uiConstants';
import CenteredTrack from '../components/common/CenteredTrack.jsx';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getIconByKey, icons } from './menuIcons';
import { SystemButtons } from '../components/common/SystemButtons';
import TooltipSpan from '../components/TooltipSpan';
import { useEntityActions } from '../components/common/CommonActions';
import { useUISettings } from '../context/UISettingsContext';
import { useSidebar } from '../context/SidebarContext';
import useResponsive from '../hooks/useResponsive';
import { useAnchorWidths } from '../hooks/useAnchorWidths';
import { getMainModules, reorderModulesWithActiveFirst, findActiveModule, navigateToAppPath, prefetchAppForPath } from '../utils/navigationUtils';
import { DynamicIcon, ClickableIcon, IconWithText } from '../components/common/DynamicIcon';
import { ToggleButton, ToggleButtonGroup, Menu, MenuItem } from '@mui/material';
import {
  resolveToolbarCenterByPath,
  resolveToolbarCenterDesktop,
  resolveToolbarRightByPath,
} from './toolbarModules';
import { isUnifiedToolbarPath } from './unifiedBarPaths';

export default function Toolbar({
  moduloActivo,
  nivel1 = [],
  currentPath = '',
  children,
  additionalActions = [],
  onBack,
  parentInfo,
  customMainSection,
}) {
  // 1. HOOKS Y CÁLCULOS PRINCIPALES
  const { showEntityToolbarNavigation, showSidebarCollapsed } = useUISettings();
  const { isOpen: sidebarIsOpen, getMainMargin } = useSidebar();
  const { isMobile, isTablet, isMobileOrTablet } = useResponsive();
  const { getEntityConfig, showAddButton } = useEntityActions();
  const entityConfig = getEntityConfig();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Estado para controlar el botón de delete
  const [hasSelectedItems, setHasSelectedItems] = useState(false);
  const RightComp = resolveToolbarRightByPath(currentPath);
  
  // Medición de anclajes izquierda/derecha
  const { leftWidthRef, rightWidthRef, leftWidth, rightWidth } = useAnchorWidths(0, 0, [isMobileOrTablet, showEntityToolbarNavigation, location.pathname]);
  
  // Usar función centralizada para calcular mainMargin base
  const baseMainMargin = getMainMargin(isMobileOrTablet, showSidebarCollapsed);

  // 2. LÓGICA DE NAVEGACIÓN
  // Siblings: los hijos de nivel1
  const siblings = nivel1;
  // Determinar si mostrar botón de atrás
  const shouldShowBack = !!onBack && !!parentInfo;

  // Lógica para mostrar íconos de módulos principales (solo cuando sidebar está extendida)
  const shouldShowModuleIcons = sidebarIsOpen && !isMobile;
  const moduleData = shouldShowModuleIcons ? (() => {
    // Usar utilidades centralizadas para navegación
    const moduloActivo = findActiveModule(location.pathname);
    const todosLosModulos = getMainModules(); // ['assets', 'salud', 'tiempo']
    
    // Reordenar usando utilidad centralizada
    return reorderModulesWithActiveFirst(todosLosModulos, moduloActivo);
  })() : [];

  // Efecto para escuchar cambios en la selección de elementos
  useEffect(() => {
    const handleSelectionChange = (event) => {
      const { hasSelections } = event.detail;
      setHasSelectedItems(hasSelections);
    };

    window.addEventListener('selectionChanged', handleSelectionChange);
    
    return () => {
      window.removeEventListener('selectionChanged', handleSelectionChange);
    };
  }, []);

  // (Las medidas ahora las gestiona useAnchorWidths)

  // 3. RENDER
  // Mostrar siempre la Toolbar en tablet/desktop; respetar preferencia solo en móvil
  if (isMobile && !showEntityToolbarNavigation) return null;

  return (
    <Box sx={{
      width: '100%',
      position: 'relative',
      bgcolor: '#181818',
      minHeight: FORM_HEIGHTS.minHeight,
      m: 0,
      p: 0,
      boxShadow: 'none'
    }}>
      {/* Sección de módulos - posicionada en el área de la sidebar */}
      {shouldShowModuleIcons && moduleData.length > 0 && (
        <Box sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: baseMainMargin,
          height: TOOLBAR_CONFIG.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          zIndex: 1
        }}>
          {/* Módulo activo a la izquierda */}
          {(() => {
            const moduloActivo = moduleData[0];
            return (
              <Tooltip title={moduloActivo.title}>
                <IconWithText 
                  iconKey={moduloActivo.icon}
                  text={moduloActivo.title}
                  onClick={() => navigateToAppPath(navigate, moduloActivo.path)}
                  onMouseEnter={() => prefetchAppForPath(moduloActivo.path)}
                  sx={{
                    color: 'text.primary',
                  }}
                  textSx={{
                    fontSize: '0.75rem'
                  }}
                />
              </Tooltip>
            );
          })()}

          {/* Otros módulos a la derecha */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            {moduleData.slice(1).map(modulo => (
              <ClickableIcon
                key={modulo.id}
                iconKey={modulo.icon}
                title={modulo.title}
                onClick={() => navigateToAppPath(navigate, modulo.path)}
                onMouseEnter={() => prefetchAppForPath(modulo.path)}
                size="small"
                sx={{
                  fontSize: 18
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Sección principal - posicionada en el área del main content */}
      <Box sx={{
        width: '100%',
        height: TOOLBAR_CONFIG.height,
        display: 'flex',
        alignItems: 'center',
        px: { xs: 1, sm: 2, md: 3 },
        gap: 1,
        position: 'relative'
      }}>
        {/* Sección izquierda: Botón de atrás */}
        <Box 
          ref={leftWidthRef}
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            minWidth: 'fit-content',
            position: 'absolute',
            left: { xs: 1, sm: 2, md: 3 }
          }}
        >
          {showEntityToolbarNavigation && shouldShowBack ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title={parentInfo.title || 'Volver'}>
                <IconButton onClick={onBack} size="small">
                  {icons.arrowBack && typeof icons.arrowBack === 'function' ? React.createElement(icons.arrowBack, { sx: { fontSize: 18 } }) : <span>&larr;</span>}
                </IconButton>
              </Tooltip>
              {/* Ícono del destino - solo mostrar en desktop */}
              {parentInfo.icon && typeof parentInfo.icon === 'function' && !isMobile && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                  {React.createElement(parentInfo.icon, { sx: { fontSize: 16 } })}
                  <Typography variant={NAV_TYPO.itemVariant} sx={{ fontWeight: 500 }}>
                    {parentInfo.title}
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              opacity: 0.1,
              color: 'background.default',
              pointerEvents: 'none'
            }}>
              <Box component="span" sx={{
                fontSize: 18,
                color: 'background.default',
                fontWeight: 300,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: 'rotate(180deg)'
              }}>
                →
              </Box>
            </Box>
          )}
        </Box>

        {/* Sección central: Hermanos (siblings) o navegación específica */}
        <CenteredTrack
          isMobileOrTablet={isMobileOrTablet}
          mainMargin={baseMainMargin}
          leftWidth={leftWidth}
          rightWidth={rightWidth}
          height={TOOLBAR_CONFIG.height}
        >
          {customMainSection ? (
            // Usar navegación específica pasada como prop si está disponible
            customMainSection
          ) : (
            // Resolver componente central modular por ruta
            (() => {
              const CenterComp = resolveToolbarCenterByPath(currentPath);
              const showCenterOnDesktop = resolveToolbarCenterDesktop(currentPath);
              if (CenterComp && (isMobileOrTablet || showCenterOnDesktop)) {
                return <CenterComp />;
              }
              return (
              siblings.length > 1 ? (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: { xs: 0.125, sm: 0.5 }
                }}>
                  {siblings.map(item => {
                    const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
                    return isMobile ? (
                      // Versión simplificada para móvil
                      <Tooltip key={item.path} title={item.title}>
                        <IconButton
                          onClick={() => navigate(item.path)}
                          size="small"
                          sx={{
                            bgcolor: 'transparent',
                            color: isActive ? 'primary.main' : 'text.secondary',
                            borderRadius: '50%',
                            padding: 0.25,
                            minWidth: 32,
                            height: 32,
                            position: 'relative',
                            '&::after': isActive ? {
                              content: '""',
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: 23,
                              height: 23,
                              borderRadius: '50%',
                              bgcolor: 'action.selected',
                              zIndex: -1
                            } : {},
                            '&:hover': {
                              color: 'primary.main',
                              bgcolor: isActive ? 'transparent' : 'action.hover',
                            }
                          }}
                        >
                          {React.createElement(getIconByKey(item.icon), { sx: { fontSize: 14 } })}
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <ClickableIcon
                        key={item.path}
                        iconKey={item.icon}
                        title={item.title}
                        onClick={() => navigate(item.path)}
                        isActive={isActive}
                        size="small"
                        sx={{
                          fontSize: 18,
                          flexShrink: 0
                        }}
                      />
                    );
                  })}
                </Box>
              ) : null
              );
            })()
          )}
        </CenteredTrack>

        {/* Sección derecha: Acciones y herramientas */}
        <Box 
          ref={rightWidthRef}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexShrink: 0,
            minWidth: { xs: 'auto', sm: 48 },
            height: TOOLBAR_CONFIG.height,
            position: 'absolute',
            right: 0, // El contenedor principal ya tiene px, así que right: 0 alinea con el padding
            pr: { xs: 1, sm: 2, md: 3 }, // Padding derecho para alineación con la página principal
            gap: 0.25
          }}
        >
          {/* Botón Undo — solo en toolbar legacy (no barra unificada) */}
          {!isUnifiedToolbarPath(currentPath) && <SystemButtons.UndoMenu />}
          
          {/* Acciones adicionales */}
          {!isMobile && additionalActions && additionalActions.map((action, idx) => (
              <TooltipSpan key={idx} title={action.tooltip || action.label}>
                {action.icon}
              </TooltipSpan>
          ))}
          {/* Children */}
          {!isMobile && children}

          {/* Botón de sincronización de MercadoPago en Cuentas */}
          {(currentPath === '/finanzas/cuentas'
            || currentPath === '/propiedades/cuentas'
            || currentPath === '/propiedades/inventario/cuentas') && (
            <Tooltip title="Sincronizar">
              <IconButton
                size="small"
                onClick={() => window.dispatchEvent(new CustomEvent('openMercadoPagoConnect'))}
                sx={{
                  mr: 0.5,
                  color: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    transform: 'scale(1.05)',
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {React.createElement(icons.sync || (() => (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.96-.69 2.79l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm-6.77.23L3.77 5.69C2.46 7.97 2 9.43 2 11c0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-1.01.25-1.96.69-2.79z"/>
                  </svg>
                )), { sx: { fontSize: 18 } })}
              </IconButton>
            </Tooltip>
          )}

          {/* Acciones modulares por ruta (lado derecho) */}
          {RightComp && (
            <RightComp hasSelectedItems={hasSelectedItems} />
          )}

          {/* Botón de agregar inteligente */}
          {(() => {
            // Si hay un módulo right, no renderizar acciones duplicadas aquí
            if (RightComp) return null;

            // Para páginas de objetivos, usar botón inteligente
            if (
              (currentPath.startsWith('/tiempo/objetivos') || 
               currentPath.startsWith('/tiempo/tareas') || 
               currentPath.startsWith('/objetivos') || 
               currentPath.startsWith('/tareas'))
            ) {
              
              const getSmartAddButton = () => {
                const handleSmartAdd = (e) => {
                  if (currentPath === '/tiempo/objetivos' || currentPath === '/objetivos') {
                    window.dispatchEvent(new CustomEvent('addObjetivo'));
                  } else if (
                    currentPath === '/tiempo/tareas'
                    || currentPath === '/tareas'
                  ) {
                    window.dispatchEvent(new CustomEvent('addTask', { detail: {} }));
                  }
                };

                const getTooltip = () => {
                  if (currentPath === '/tiempo/objetivos' || currentPath === '/objetivos') return 'Nuevo objetivo';
                  if (
                    currentPath === '/tiempo/tareas'
                    || currentPath === '/tareas'
                  ) {
                    return 'Nueva Tarea';
                  }
                  return 'Agregar';
                };

                return (
                  <Tooltip title={getTooltip()}>
                    <IconButton
                      size="small"
                      onClick={handleSmartAdd}
                      sx={{ 
                        ml: 0,
                        width: 32,
                        height: 32,
                        padding: 0.5,
                        color: 'text.secondary',
                        '&:hover': {
                          color: 'primary.main',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          transform: 'scale(1.05)',
                        },
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      {React.createElement(icons.add, { sx: { fontSize: 18 } })}
                    </IconButton>
                  </Tooltip>
                );
              };

              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  {/* Mantener acciones para objetivos aquí (Agenda/Tareas ya vive en módulo Right) */}
                  {(currentPath === '/tiempo/objetivos' || currentPath === '/objetivos') && (
                    <Tooltip title="Seleccionar todos los Objetivos">
                      <IconButton
                        size="small"
                        onClick={() => window.dispatchEvent(new CustomEvent('selectAllObjetivos'))}
                        sx={{
                          width: 32,
                          height: 32,
                          padding: 0.5,
                          color: 'text.secondary',
                          opacity: 0.7,
                          '&:hover': {
                            backgroundColor: 'action.hover',
                            color: 'primary.main',
                            transform: 'scale(1.05)',
                            opacity: 1,
                          },
                          transition: 'all 0.2s ease-in-out'
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                      </IconButton>
                    </Tooltip>
                  )}
                  {getSmartAddButton()}
                </Box>
              );
            }
            
            // Para otras páginas, usar la lógica original
            if (showAddButton && entityConfig) {
              return <SystemButtons.AddButton entityConfig={entityConfig} buttonSx={{ ml: 1 }} />;
            }
            
            return (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                ml: 1,
                opacity: 0.1,
                color: 'background.default',
                pointerEvents: 'none',
                borderRadius: 1,
                padding: 0.5
              }}>
                <Box component="span" sx={{
                  fontSize: 18,
                  color: 'background.default',
                  fontWeight: 300,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18
                }}>
                  +
                </Box>
              </Box>
            );
            
            return null;
          })()}
        </Box>
      </Box>
    </Box>
  );
}
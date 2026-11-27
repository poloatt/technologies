import React from 'react';
import { 
  Drawer, 
  Box, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  ListItemButton, 
  Collapse,
  IconButton,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { navigateToAppPath, isRouteActive, prefetchAppForPath } from '../utils/navigationUtils';
import { useSidebar } from '../context/SidebarContext';
import SidebarResizer from './SidebarResizer';
import { DynamicIcon } from '../components/common/DynamicIcon';
import { SIDEBAR_CONFIG, TRANSITIONS, UI_COLORS, Z_INDEX, SPACING, getChildPadding } from '../config/uiConstants';
import { NAV_TYPO } from '../tipografia';
import { bottomNavigationItems } from './menuStructure';

export default function Sidebar({ moduloActivo, nivel1Activo }) {
  const {
    isOpen,
    isDesktop,
    sidebarWidth,
    handleSidebarResize,
    getSidebarConfig,
  } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isDesktop && !moduloActivo) return null;

  const renderAppSwitcher = () => {
    if (!isDesktop) return null;
    const config = getSidebarConfig();
    const padding = isOpen ? config.parent.paddingUnits : 0;

    return (
      <Box sx={{ pb: 1 }}>
        <List disablePadding>
          {bottomNavigationItems.map((app) => {
            const isActive = isRouteActive(location.pathname, app.activePaths);
            return (
              <ListItem key={app.id} disablePadding sx={{ bgcolor: 'transparent' }}>
                <ListItemButton
                  onClick={() => navigateToAppPath(navigate, app.path)}
                  onMouseEnter={() => prefetchAppForPath(app.path)}
                  onFocus={() => prefetchAppForPath(app.path)}
                  selected={isActive}
                  sx={{
                    minHeight: SIDEBAR_CONFIG.parent.minHeight,
                    paddingLeft: padding,
                    paddingRight: isOpen ? 12 : 0,
                    borderRadius: SIDEBAR_CONFIG.parent.borderRadius,
                    mb: SIDEBAR_CONFIG.parent.marginBottom,
                    justifyContent: isOpen ? 'initial' : 'center',
                    backgroundColor: isActive ? UI_COLORS.backgroundActive.parent : 'transparent',
                    '&:hover': {
                      backgroundColor: isActive
                        ? UI_COLORS.backgroundActive.parent
                        : UI_COLORS.backgroundHover.default,
                    },
                    '&.Mui-selected, &.Mui-selected:hover': {
                      backgroundColor: UI_COLORS.backgroundActive.parent,
                      color: '#fff',
                    },
                    transition: TRANSITIONS.backgroundChange,
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: config.parent.iconMinWidth,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      width: isOpen ? 'auto' : '100%',
                      mx: isOpen ? 0 : 'auto',
                    }}
                  >
                    <DynamicIcon iconKey={app.icon} size="small" />
                  </ListItemIcon>
                  {isOpen && <ListItemText primary={app.title} />}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    );
  };

  // Función recursiva simplificada que usa directamente la estructura de menuStructure.js
  const renderMenuItem = (item, level = 1) => {
    const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
    const hasChildren = item.subItems && item.subItems.length > 0;
    const isParent = level === 1;
    const isChild = level === 2;

    // Determinar si debe estar expandido basado SOLO en la ruta actual (elimina estado duplicado)
    const shouldExpand = nivel1Activo && nivel1Activo.id === item.id;

    // Padding según nivel: parents y children usan configuración centralizada de uiConstants
    const config = getSidebarConfig();
    const padding = isChild 
      ? getChildPadding(isOpen)  // ÚNICA DEFINICIÓN en uiConstants.js
      : (isOpen ? config.parent.paddingUnits : 0);

    // Debug temporal - verificar valores de padding aplicados (comentado para producción)
    // if (isChild && isOpen) {
    //   console.log(`🔍 Child "${item.title}" | Level ${level}:`, {
    //     appliedPadding: padding,
    //     calculation: {
    //       parentPadding: `${config.parent.paddingPx}px`,
    //       parentIconWidth: `${config.parent.iconWidth}px`,  
    //       additionalGap: `${config.child.additionalGap}px`,
    //       alignmentOffset: `${config.child.alignmentOffset}px`,
    //       total: `${config.child.baseAlignment + config.child.additionalGap + config.child.alignmentOffset}px`
    //     },
    //     debug: {
    //       adjust: 'window.adjustChildAlignment(offset)',
    //       example: 'window.adjustChildAlignment(-4) // move left 4px'
    //     }
    //   });
    //   
    //   // Exponer función de ajuste globalmente para debugging
    //   window.adjustChildAlignment = adjustChildAlignment;
    // }

    return (
      <React.Fragment key={item.id}>
        <ListItem disablePadding sx={{ bgcolor: 'transparent' }}>
          <ListItemButton
            onClick={() => {
              if (item.path && !item.isUnderConstruction) {
                navigateToAppPath(navigate, item.path);
              }
            }}
            selected={isActive}
            disabled={item.isUnderConstruction}
            sx={{
              minHeight: isChild ? SIDEBAR_CONFIG.child.minHeight : SIDEBAR_CONFIG.parent.minHeight,
              paddingLeft: padding,
              paddingRight: isOpen ? 12 : (isChild ? 8 : 0),
              borderRadius: SIDEBAR_CONFIG.parent.borderRadius,
              mb: isChild ? SIDEBAR_CONFIG.child.marginBottom : SIDEBAR_CONFIG.parent.marginBottom,
              justifyContent: isOpen ? 'initial' : 'center',
              backgroundColor: isActive 
                ? (isChild ? UI_COLORS.backgroundActive.child : UI_COLORS.backgroundActive.parent) 
                : 'transparent',
              '&:hover': {
                backgroundColor: isActive 
                  ? (isChild ? UI_COLORS.backgroundHover.child : UI_COLORS.backgroundHover.parent) 
                  : UI_COLORS.backgroundHover.default,
              },
              '&.Mui-selected, &.Mui-selected:hover': {
                backgroundColor: isChild ? UI_COLORS.backgroundActive.child : UI_COLORS.backgroundActive.parent,
                color: '#fff',
              },
              opacity: item.isUnderConstruction ? 0.5 : 1,
              transition: TRANSITIONS.backgroundChange,
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: config.parent.iconMinWidth,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: isOpen ? 'auto' : '100%',
                mx: isOpen ? 0 : 'auto',
              }}
            >
              <DynamicIcon iconKey={item.icon} size="small" />
            </ListItemIcon>
            {isOpen && <ListItemText primary={item.title} />}
          </ListItemButton>
        </ListItem>
        
                 {/* Renderizar children recursivamente */}
         {hasChildren && isParent && (
           <Collapse in={shouldExpand && isOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.subItems.map(child => renderMenuItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  const renderModuleStructure = () => {
    if (isDesktop || !moduloActivo?.subItems?.length) return null;
    return (
      <List disablePadding>
        {moduloActivo.subItems.map((item) => renderMenuItem(item, 1))}
      </List>
    );
  };

  return (
    <Box sx={{
      width: isOpen ? sidebarWidth : SIDEBAR_CONFIG.collapsedWidth,
      transition: TRANSITIONS.sidebarWidth,
      flexShrink: 0,
      pb: SPACING.sidebarPadding,
      backgroundColor: UI_COLORS.backgroundDefault,
      height: '100%',
      borderRight: UI_COLORS.border,
      position: 'relative',
      zIndex: Z_INDEX.sidebar,
    }}>
      <Drawer
        variant="permanent"
        sx={{
          width: isOpen ? sidebarWidth : SIDEBAR_CONFIG.collapsedWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            position: 'relative',
            left: 0,
            top: 0,
            width: isOpen ? sidebarWidth : SIDEBAR_CONFIG.collapsedWidth,
            minWidth: SIDEBAR_CONFIG.collapsedWidth,
            maxWidth: SIDEBAR_CONFIG.maxWidth,
            borderRadius: 0,
            borderRight: UI_COLORS.border,
            backgroundColor: UI_COLORS.backgroundDefault,
            height: '100%',
            transition: TRANSITIONS.sidebarWidth,
            overflowX: 'hidden',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            scrollbarWidth: 'thin',
            zIndex: Z_INDEX.sidebar,
            pb: SPACING.sidebarPadding,
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: '#232323', borderRadius: 0 },
          }
        }}
      >
        {/* Contenedor principal con flexbox para separar contenido y botón de configuración */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%',
          justifyContent: 'space-between'
        }}>
          {/* Contenido principal del sidebar */}
          <Box sx={{ flex: 1 }}>
            {renderAppSwitcher()}
            {renderModuleStructure()}
          </Box>

          {/* Botón de configuración al final */}
          <Box sx={{ 
            p: 1,
            borderTop: UI_COLORS.border,
            backgroundColor: UI_COLORS.backgroundDefault
          }}>
            <IconButton
              onClick={() => navigate('/configuracion')}
              sx={{
                width: isOpen ? '100%' : '40px',
                height: '40px',
                borderRadius: SIDEBAR_CONFIG.parent.borderRadius,
                justifyContent: isOpen ? 'flex-start' : 'center',
                pl: isOpen ? 2 : 0,
                color: 'inherit',
                '&:hover': {
                  backgroundColor: UI_COLORS.backgroundHover.default,
                },
                transition: TRANSITIONS.backgroundChange,
              }}
            >
              <DynamicIcon 
                iconKey="settings" 
                size="small" 
                sx={{ mr: isOpen ? 1 : 0 }}
              />
              {isOpen && (
                <Box component="span" sx={{ typography: NAV_TYPO.itemVariant }}>
                  Configuración
                </Box>
              )}
            </IconButton>
          </Box>
        </Box>

        {/* Sidebar Resizer y otros elementos si es necesario */}
        <SidebarResizer 
          onResize={handleSidebarResize}
          isOpen={isOpen}
          isDesktop={isDesktop}
          // Usa constantes centralizadas de uiConstants.js
          minWidth={SIDEBAR_CONFIG.minWidth}
          maxWidth={SIDEBAR_CONFIG.maxWidth}
          defaultWidth={sidebarWidth}
        />
      </Drawer>
    </Box>
  );
}

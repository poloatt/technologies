/**
 * Constantes centralizadas de UI para eliminar duplicación
 * Usado en: SidebarContext.jsx, Sidebar.jsx, SidebarResizer.jsx, Layout.jsx
 */
import { DATE_HEADER_MIN_HEIGHT } from '../utils/calendar/calendarLayout.js';

// ===== SIDEBAR CONFIGURATION =====
export const SIDEBAR_CONFIG = {
  // Dimensiones principales
  collapsedWidth: 56,
  defaultWidth: 280,
  minWidth: 200,
  maxWidth: 400,
  
  // Configuración de parents (nivel 1)
  parent: {
    paddingUnits: 2,        // Theme spacing units (2 * 8px = 16px)
    paddingPx: 16,          // Equivalente en píxeles
    iconWidth: 36,          // Ancho real del ícono parent
    iconMinWidth: 36,       // minWidth del ListItemIcon parent
    iconMarginRight: 0,     // Margen derecho del ícono (si existe)
    minHeight: 36,          // Altura mínima del ListItemButton
    borderRadius: '12px',   // Border radius de los botones
    marginBottom: 0.25      // Margen inferior entre items
  },
  
  // Configuración de children (nivel 2)
  child: {
    collapsedPadding: 2,    // Theme units cuando colapsada
    baseAlignment: 52,      // 16px (parent) + 36px (icon) = punto base de alineación
    additionalGap: 0,       // Sin gap adicional: hijos comienzan donde termina el ícono del parent
    alignmentOffset: -12,    // Ajuste fino: reducir 4px el margen
    iconSize: 'small',      // Tamaño de íconos child
    minHeight: 32,          // Altura mínima del ListItemButton child
    marginBottom: 0.15      // Margen inferior entre items child
  },
  
  // Función helper para calcular padding child
  calculateChildPadding() {
    return `${this.child.baseAlignment + this.child.additionalGap + this.child.alignmentOffset}px`;
  }
};

// ===== HEADER AND TOOLBAR CONFIGURATION =====
export const HEADER_CONFIG = {
  height: 40,
  zIndex: 1400
};

export const TOOLBAR_CONFIG = {
  height: 40,
  zIndex: 1399
};

/** Barra única del módulo Agenda (header + toolbar integrados). */
export const AGENDA_UNIFIED_BAR_CONFIG = {
  height: 48,
  zIndex: 1400,
};

/** Altura de la barra de progreso bajo el date hero de rutinas. */
export const RUTINA_PROGRESS_BAR_HEIGHT = 4;

/** Barra de navegación diaria de Rutinas (bajo AgendaUnifiedBar). */
export const RUTINA_NAVIGATION_BAR_CONFIG = {
  height: DATE_HEADER_MIN_HEIGHT + RUTINA_PROGRESS_BAR_HEIGHT + 4,
  zIndex: 1398,
};

export function isRutinasPath(path = '') {
  return path.startsWith('/rutinas') || path.startsWith('/tiempo/rutinas');
}

// ===== FORM AND COMPONENT HEIGHTS =====
export const FORM_HEIGHTS = {
  input: 40,           // Altura estándar para inputs y campos de formulario
  button: 40,          // Altura estándar para botones
  iconButton: 40,      // Altura estándar para icon buttons
  toolbar: 40,         // Altura estándar para toolbars
  header: 40,          // Altura estándar para headers
  minHeight: 40,       // Altura mínima estándar
  tableRow: 40,        // Altura estándar para filas de tabla
  chip: 32,            // Altura para chips
  small: 32,           // Altura pequeña
  medium: 40,          // Altura media (estándar)
  large: 48            // Altura grande
};

// ===== FOOTER CONFIGURATION =====
export const FOOTER_CONFIG = {
  height: 48,
  zIndex: 1300
};

// ===== Z-INDEX HIERARCHY =====
export const Z_INDEX = {
  header: 1400,
  toolbar: 1399,
  footer: 1300,
  sidebarResizer: 1300,
  sidebar: 1100,
  main: 1
};

// ===== TRANSITIONS =====
export const TRANSITIONS = {
  sidebarWidth: 'width 0.3s ease',
  colorChange: 'color 0.2s',
  backgroundChange: 'background 0.2s',
  default: '0.2s ease'
};

// ===== COLORS AND BORDERS =====
export const UI_COLORS = {
  border: '1.5px solid #232323',
  backgroundActive: {
    parent: '#323232',
    child: '#232323'
  },
  backgroundHover: {
    parent: '#3a3a3a',
    child: '#232323',
    default: '#232323'
  },
  backgroundDefault: 'background.default'
};

// ===== BREAKPOINTS (Material-UI equivalents) =====
export const BREAKPOINTS = {
  mobile: 600,    // sm breakpoint
  tablet: 960,    // md breakpoint
  desktop: 1280   // lg breakpoint
};

// ===== SPACING =====
export const SPACING = {
  bottomNavigationHeight: 88, // Para mobile
  sidebarPadding: {
    xs: '88px',
    sm: '88px', 
    md: 0
  }
};

// ===== LOCAL STORAGE KEYS =====
export const STORAGE_KEYS = {
  sidebarOpen: 'sidebarOpen',
  sidebarWidth: 'sidebarWidth',
  uiSettings: 'uiSettings'
};

// ===== ICON SIZES =====
export const ICON_SIZES = {
  small: 'small',
  medium: 'medium',
  large: 'large'
};

// ===== NAVIGATION TYPOGRAPHY TOKENS =====
// Best practice: evitar hardcodes repetidos en componentes de navegación.
// Usamos variants de MUI y solo dejamos tamaños puntuales cuando el layout lo exige (ej: bottom nav).
export const NAV_TYPO = {
  // Texto en items de sidebar / navegación principal
  itemVariant: 'body2',     // ~0.875rem por defecto en MUI
  // Texto pequeño auxiliar (chips, captions)
  captionVariant: 'caption', // ~0.75rem por defecto en MUI
  // Título principal en Header (ruta/página)
  headerTitleVariant: 'subtitle2',
  headerTitleSx: { fontWeight: 600, lineHeight: 1.2, letterSpacing: '0.01em' },
  // Labels en Chips dentro de navegación (footer/rutinas)
  chipLabelSx: { typography: 'caption', lineHeight: 1.1, letterSpacing: '0.01em' },
  // Bottom navigation suele necesitar un poco más chico para evitar overflow
  bottomNavLabelSx: { fontSize: '0.75rem', lineHeight: 1.1, letterSpacing: '0.01em' },
  // Usado en lugares donde body2 queda grande pero no queremos hardcodes sueltos
  compactBodySx: { fontSize: '0.8rem', lineHeight: 1.2, letterSpacing: '0.01em' }
};

// ===== BORDER RADIUS =====
export const BORDER_RADIUS = {
  button: '12px',
  small: 1,
  medium: 4,
  circle: '50%'
};

// ===== UTILITY FUNCTIONS =====

/**
 * Calcula el margen principal basado en el estado de la sidebar
 * @param {boolean} isOpen - Estado de apertura de la sidebar
 * @param {number} sidebarWidth - Ancho de la sidebar expandida
 * @param {boolean} isMobileOrTablet - Si es mobile o tablet
 * @param {boolean} [_showSidebarCollapsed] - Obsoleto en móvil/tablet (sidebar deshabilitada)
 * @returns {number} - Margen calculado
 */
export function calculateMainMargin(isOpen, sidebarWidth, isMobileOrTablet, _showSidebarCollapsed = false) {
  if (isMobileOrTablet) {
    return 0;
  }
  return isOpen ? sidebarWidth : SIDEBAR_CONFIG.collapsedWidth;
}

/**
 * Margen horizontal del layout en /rutinas (misma reserva de sidebar que el resto de desktop).
 * @param {boolean} isMobileOrTablet
 * @param {boolean} isOpen
 * @param {number} sidebarWidth
 * @returns {number}
 */
export function getRutinaPageMainMargin(isMobileOrTablet, isOpen, sidebarWidth) {
  return calculateMainMargin(isOpen, sidebarWidth, isMobileOrTablet);
}

/** Sidebar visible solo en desktop; móvil/tablet usa BottomNavigation. */
export function shouldRenderAppSidebar(isMobileOrTablet, _path = '') {
  return !isMobileOrTablet;
}

/**
 * Calcula el padding total superior (header + toolbar, o barra Agenda unificada)
 * @param {boolean} showToolbar - Si mostrar toolbar (rutas no-Agenda)
 * @param {boolean} [agendaUnified] - Si la ruta usa barra Agenda unificada
 * @param {boolean} [rutinasSubNav] - Si la ruta muestra barra de navegación de rutinas bajo el header
 * @returns {number} - Padding total superior
 */
export function calculateTopPadding(showToolbar, agendaUnified = false, rutinasSubNav = false) {
  if (agendaUnified) {
    return AGENDA_UNIFIED_BAR_CONFIG.height
      + (rutinasSubNav ? RUTINA_NAVIGATION_BAR_CONFIG.height : 0);
  }
  return HEADER_CONFIG.height + (showToolbar ? TOOLBAR_CONFIG.height : 0);
}

/**
 * Padding inferior del área principal (Layout).
 * Móvil/tablet: bottom nav + safe area iOS; desktop: footer de health-check.
 * @param {boolean} isMobileOrTablet
 * @param {number} [extraPadding=24]
 * @returns {string}
 */
export function getMainBottomPadding(isMobileOrTablet, extraPadding = 24) {
  if (isMobileOrTablet) {
    return `calc(${SPACING.bottomNavigationHeight}px + env(safe-area-inset-bottom, 0px) + ${extraPadding}px)`;
  }
  return `${FOOTER_CONFIG.height + extraPadding}px`;
}

/**
 * Obtiene la configuración de padding para children
 * @param {boolean} isOpen - Estado de apertura de la sidebar
 * @returns {string|number} - Padding calculado
 */
export function getChildPadding(isOpen) {
  if (!isOpen) return SIDEBAR_CONFIG.child.collapsedPadding;
  return SIDEBAR_CONFIG.calculateChildPadding();
} 
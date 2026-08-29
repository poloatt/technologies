import { alpha } from '@mui/material/styles';
import {
  HUB_SECTION,
  hubHeaderIconSx,
  hubSectionBg,
  hubSectionHeaderSx,
  hubSectionShellBodySx,
  hubSectionShellSx,
  hubSectionTitleSx,
} from './hubSectionStyles';
import {
  getTaskGroupShellSx,
  taskGroupCountSx,
  taskGroupTitleSx,
} from './taskListStyles';
import {
  getRutinaChevronTokens,
  RUTINA_CHEVRON,
} from './rutinaIconTokens';
import { taskFormHeaderActionIconSx } from '../components/forms/tareaFormTokens';

/** Tokens compartidos para secciones colapsables (tareas, rutinas, hubs). */

export const COLLAPSE_TRANSITION_MS = 200;

/** Props estándar para MUI Collapse. */
export const collapsePanelProps = {
  timeout: COLLAPSE_TRANSITION_MS,
  unmountOnExit: true,
};

/** Chevron rotatorio (KeyboardArrowDown → arriba al expandir). */
export function collapseChevronSx(expanded) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: 'text.secondary',
    transform: expanded ? 'rotate(-180deg)' : 'rotate(0deg)',
    transition: `transform ${COLLAPSE_TRANSITION_MS}ms`,
  };
}

/** IconButton decorativo en cabeceras de acordeón. */
export function collapseChevronButtonSx(expanded) {
  return {
    p: 0.25,
    ...collapseChevronSx(expanded),
  };
}

/** Chevron en cabeceras hub con icono de sección (tamaño responsive rutinas). */
export function collapseHubChevronButtonSx(expanded, mobile = false) {
  const tokens = getRutinaChevronTokens(mobile);
  return {
    ...taskFormHeaderActionIconSx('text.secondary'),
    ...collapseChevronButtonSx(expanded),
    width: mobile ? RUTINA_CHEVRON.mobile.button : RUTINA_CHEVRON.desktop.button,
    height: mobile ? RUTINA_CHEVRON.mobile.button : RUTINA_CHEVRON.desktop.button,
    minWidth: mobile ? RUTINA_CHEVRON.mobile.button : RUTINA_CHEVRON.desktop.button,
    minHeight: mobile ? RUTINA_CHEVRON.mobile.button : RUTINA_CHEVRON.desktop.button,
    opacity: 0.7,
    '&:hover': { opacity: 1 },
    '& .MuiSvgIcon-root': {
      fontSize: tokens.glyph,
    },
  };
}

/** Layout de fila compartido en cabeceras (con o sin chevron). */
export const collapseHeaderLayoutSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
};

/** Fila clicable de cabecera (acordeón de grupo). */
export const collapseHeaderRowSx = {
  ...collapseHeaderLayoutSx,
  cursor: 'pointer',
  userSelect: 'none',
  '&:hover': { bgcolor: 'action.hover' },
};

/** Toggle inline con título + chevron (sub-secciones: SIN HACER, AHORA, HECHO). */
export const collapseInlineToggleSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  border: 'none',
  background: 'none',
  padding: 0,
  cursor: 'pointer',
  color: 'text.secondary',
  userSelect: 'none',
  textAlign: 'left',
  '&:hover': { color: 'text.primary' },
};

/** Encabezado de sub-sección (cadencia / franjas / hecho). */
export const collapseSubsectionHeadingSx = {
  px: 0.5,
  py: 0.5,
  fontWeight: 600,
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontSize: '0.7rem',
};

export const collapseSubsectionHeadingLgSx = {
  ...collapseSubsectionHeadingSx,
  fontSize: '0.75rem',
  py: 0.75,
};

/** Espaciado vertical uniforme entre secciones colapsables (cadencia, tareas, rutinas). */
export const COLLAPSE_SECTION_STACK_GAP = 1;

/** Altura fija de cabecera de sección colapsable (px). */
export const COLLAPSE_SECTION_HEADER_HEIGHT = {
  mobile: 36,
  desktop: 32,
};

export function getCollapseSectionHeaderHeight(isMobile = false) {
  return isMobile
    ? COLLAPSE_SECTION_HEADER_HEIGHT.mobile
    : COLLAPSE_SECTION_HEADER_HEIGHT.desktop;
}

/** Chevron compacto alineado a la altura de cabecera. */
export function getCollapseSectionChevronButtonSx(expanded, isMobile = false) {
  const buttonSize = isMobile ? 24 : 22;
  return {
    ...collapseChevronButtonSx(expanded),
    width: buttonSize,
    height: buttonSize,
    minWidth: buttonSize,
    minHeight: buttonSize,
    p: 0,
    flexShrink: 0,
    '& .MuiSvgIcon-root': {
      fontSize: isMobile ? '1.125rem' : '1rem',
    },
  };
}

/** Tipografía compacta del título en cabecera colapsable. */
export function getCollapseSectionTitleSx(isMobile = false) {
  return {
    ...taskGroupTitleSx,
    lineHeight: 1,
    fontSize: '0.8125rem',
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  };
}

/** Contenedor vertical de secciones con gap uniforme. */
export const collapseSectionStackSx = {
  display: 'flex',
  flexDirection: 'column',
  gap: COLLAPSE_SECTION_STACK_GAP,
  width: '100%',
};

/** Padding del cuerpo extendible (checklist, carrusel, hecho). */
export function getCollapseSectionContentSx(isMobile = false) {
  return {
    px: isMobile ? 1 : 1.25,
    py: 0.5,
  };
}

/** Padding compacto cuando el cuerpo es solo carrusel bajo la cabecera (colapsado). */
export function getCollapseSectionCarouselBodySx(isMobile = false, { expanded = false } = {}) {
  const base = getCollapseSectionContentSx(isMobile);
  return expanded
    ? base
    : { ...base, pt: 0, pb: base.py };
}

/** Shell de tarjeta colapsable (grupos HOY, Cuidado personal, etc.). */
export function getCollapseSectionShellSx(isMobile = false, { withShadow = true } = {}) {
  return {
    ...(withShadow ? getTaskGroupShellSx(isMobile) : {
      ...hubSectionShellSx,
      bgcolor: hubSectionBg,
      borderRadius: HUB_SECTION.sectionRadius,
      overflow: 'hidden',
      width: '100%',
      minHeight: 0,
    }),
    flexShrink: 0,
  };
}

/** Cabecera de tarjeta colapsable. */
export function getCollapseSectionHeaderSx(isMobile = false) {
  const height = getCollapseSectionHeaderHeight(isMobile);
  const { borderBottom, px, py, ...headerTint } = hubSectionHeaderSx;

  return {
    ...headerTint,
    ...collapseHeaderLayoutSx,
    px: isMobile ? 1 : 1.25,
    py: 0,
    height,
    minHeight: height,
    maxHeight: height,
    boxSizing: 'border-box',
  };
}

/** Cabecera hub con preview colapsado (rutinas: carrusel en header). */
export function collapseHubHeaderSx(expanded) {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: expanded ? 0 : 0.25,
    overflow: 'hidden',
    borderBottom: expanded ? 1 : 0,
    borderColor: 'divider',
    cursor: 'pointer',
  };
}

export function getCollapseHubHeaderTopRowSx(isMobile = false) {
  return {
    ...getCollapseSectionHeaderSx(isMobile),
    ...collapseHeaderRowSx,
    borderBottom: 0,
  };
}

/** @deprecated Usar getCollapseHubHeaderTopRowSx(isMobile) */
export const collapseHubHeaderTopRowSx = getCollapseHubHeaderTopRowSx(false);

export const collapseHubTitleRowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  minWidth: 0,
  flex: 1,
};

export const collapseHubTitleSx = {
  ...hubSectionTitleSx,
  textTransform: 'none',
  letterSpacing: 0,
  fontSize: { xs: '0.875rem', md: '0.8125rem' },
  lineHeight: 1.3,
};

export const collapseHubHeaderIconSx = hubHeaderIconSx;

export const collapseHubBodySx = {
  ...hubSectionShellBodySx,
  px: 1,
  py: 0.5,
  pt: 0,
  bgcolor: hubSectionBg,
};

export { taskGroupCountSx as collapseSectionCountSx };
export const collapseSectionTitleSx = getCollapseSectionTitleSx(false);

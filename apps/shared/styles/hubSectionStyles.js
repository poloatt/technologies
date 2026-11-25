import { alpha } from '@mui/material/styles';

/** Scroll de página hub (Foco hub, Rutinas) — scrollbar, altura viewport y padding inferior. */
export function hubPageScrollSx({
  isMobile = false,
  isMobileOrTablet,
  bottomPadding,
  extraTopOffset = 0,
} = {}) {
  const compactViewport = isMobileOrTablet ?? isMobile;
  const viewportOffset = (compactViewport ? 180 : 190) + extraTopOffset;
  return {
    flex: 1,
    minHeight: 0,
    py: compactViewport ? 1 : 2,
    px: { xs: 1, sm: 2, md: 3 },
    maxHeight: `calc(100vh - ${viewportOffset}px)`,
    overflowY: 'auto',
    overflowX: 'hidden',
    // El clearance de bottom nav lo aplica Layout (mainBottomPadding); padding grande
    // dentro de overflow:auto genera scrollHeight extra y barra vertical fantasma.
    pb: bottomPadding ?? (compactViewport ? 1 : 2),
    '&::-webkit-scrollbar': {
      width: compactViewport ? '4px' : '8px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: (theme) =>
        alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.06 : 0.04),
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: (theme) =>
        alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.18 : 0.12),
      borderRadius: '4px',
    },
    '&::-webkit-scrollbar-thumb:hover': {
      backgroundColor: (theme) =>
        alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.28 : 0.2),
    },
  };
}

/**
 * Design system de secciones hub (cabecera tintada, shell cuadrado, preview).
 * SSOT compartido por Caja, Foco y Pulso (HubSectionCard / HubSectionShell).
 */
export const HUB_SECTION = {
  /** 0 = esquinas cuadradas en cards/shells hub de las tres apps. */
  sectionRadius: 0,
  blockGap: 1,
  headerPx: 1.75,
  /** Cabeceras hub (Transacciones, etc.): una sola altura para todas las barras. */
  headerHeight: 28,
  headerPy: 0.375,
  bodyPx: 1.5,
  bodyPy: 1.25,
};

/** Fondo plano de tarjeta/cuerpo (misma base que Layout → background.default). */
export const hubSectionBg = 'background.default';

export const HUB_SECTION_CARD_BODY_MIN_HEIGHT = 132;
export const HUB_SECTION_CARD_MIN_HEIGHT = 176;

/** Base de tarjeta de sección (borde sutil, sin caja gris anidada). */
export function getHubCardSx(isActive) {
  return {
    border: '1px solid',
    borderColor: isActive ? 'primary.main' : 'divider',
    bgcolor: hubSectionBg,
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: { xs: 'auto', md: HUB_SECTION_CARD_MIN_HEIGHT },
  };
}

/** Contenedor exterior cuadrado con sombra (hub cards navegables). */
export function getHubSectionCardSx(isActive) {
  return {
    ...getHubCardSx(isActive),
    borderRadius: HUB_SECTION.sectionRadius,
    backgroundImage: 'none',
    boxShadow: (theme) => (isActive ? theme.shadows[2] : theme.shadows[1]),
    overflow: 'hidden',
    // Anula MuiPaper-rounded / shape.borderRadius del theme.
    '&.MuiPaper-rounded': {
      borderRadius: HUB_SECTION.sectionRadius,
    },
  };
}

/** Shell plano sin Card/shadow (preview embebido en páginas, ej. Foco Tareas). */
export const hubSectionShellSx = {
  flexShrink: 0,
  mb: 1,
  borderRadius: HUB_SECTION.sectionRadius,
  overflow: 'hidden',
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: hubSectionBg,
};

export const hubHeaderActionSx = {
  px: 1,
  py: 0.375,
  display: 'flex',
  alignItems: 'center',
  minHeight: HUB_SECTION.headerHeight,
  height: HUB_SECTION.headerHeight,
  maxHeight: HUB_SECTION.headerHeight,
  boxSizing: 'border-box',
};

/** Acción dentro de la cabecera. No hereda el touch target global de 44px. */
export const hubHeaderSlotButtonSx = {
  width: HUB_SECTION.headerHeight,
  height: HUB_SECTION.headerHeight,
  minWidth: HUB_SECTION.headerHeight,
  minHeight: HUB_SECTION.headerHeight,
  maxWidth: HUB_SECTION.headerHeight,
  maxHeight: HUB_SECTION.headerHeight,
  boxSizing: 'border-box',
};

export const hubSectionHeaderSx = {
  ...hubHeaderActionSx,
  px: HUB_SECTION.headerPx,
  py: HUB_SECTION.headerPy,
  minHeight: HUB_SECTION.headerHeight,
  height: HUB_SECTION.headerHeight,
  maxHeight: HUB_SECTION.headerHeight,
  borderBottom: 1,
  borderColor: 'divider',
  bgcolor: (theme) =>
    alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.03),
};

export const hubSectionTitleSx = {
  fontWeight: 600,
  flex: 1,
};

export const hubSectionBodySx = {
  px: HUB_SECTION.bodyPx,
  py: HUB_SECTION.bodyPy,
  pt: 1,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: { xs: 'auto', md: HUB_SECTION_CARD_BODY_MIN_HEIGHT },
  bgcolor: hubSectionBg,
  gap: HUB_SECTION.blockGap,
};

/** Cuerpo compacto para shells embebidos (sin min-height de hub card). */
export const hubSectionShellBodySx = {
  px: HUB_SECTION.bodyPx,
  py: 0.75,
  minHeight: 36,
};

export const hubGridContainerSx = {
  alignItems: 'stretch',
};

export const hubGridItemSx = {
  display: 'flex',
  width: '100%',
};

/** Celdas de subsección (chips, métricas, tiles) dentro del cuerpo de tarjeta hub. */
export const HUB_SUBSECTION = {
  borderRadius: 1.5,
};

/**
 * Recuadro plano con fondo de sección y borde sutil (sin paper/elevación).
 * Usar en grids de Monedas, Transacciones, Cuentas, Propiedades, Inventario, etc.
 */
export function getHubSubsectionSx({ selected } = {}) {
  return {
    borderRadius: HUB_SUBSECTION.borderRadius,
    bgcolor: selected ? 'action.selected' : hubSectionBg,
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: 'none',
    backgroundImage: 'none',
  };
}

/** Footer expand compacto (uppercase) — hubs CAJA con Collapse inline. */
export const hubExpandButtonSx = {
  width: '100%',
  mt: 0.1,
  py: 0.25,
  borderRadius: 1.5,
  color: 'text.secondary',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.25,
  fontSize: '0.6875rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
  '&:hover': { bgcolor: hubSectionBg },
};

/** Botón "Ver más" con navegación — preview embebido (ej. Foco Objetivos). */
export const hubSectionSeeMoreSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.5,
  width: '100%',
  mt: 0.5,
  py: 0.75,
  borderRadius: 1,
  fontSize: '0.8125rem',
  color: 'text.secondary',
  '&:hover': {
    bgcolor: (theme) =>
      alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.06 : 0.04),
  },
};

export const hubHeaderIconSx = {
  flexShrink: 0,
  color: 'text.primary',
};

import { alpha } from '@mui/material/styles';
import {
  HUB_SECTION,
  hubSectionBg,
  hubSectionShellSx,
  hubSectionShellBodySx,
  hubGridContainerSx,
  hubGridItemSx,
  getHubSubsectionSx,
  hubPageScrollSx,
} from './hubSectionStyles';
import {
  taskFormCaptionTextSx,
  taskFormBodyTextSx,
  taskFormHeaderActionIconSx,
  TASK_FORM_CAPTION_FONT_SIZE,
} from '../components/forms/tareaFormTokens';
import {
  getRutinaHabitIconTokens,
  RUTINA_CHEVRON,
  RUTINA_HABIT_ICON_GLYPH,
  RUTINA_HABIT_ICON_SIZE,
} from './rutinaIconTokens';
import {
  collapseHubBodySx,
  collapseHubChevronButtonSx,
  collapseHubHeaderIconSx,
  collapseHubHeaderSx,
  collapseHubTitleRowSx,
  collapseHubTitleSx,
  collapseSubsectionHeadingSx,
  getCollapseHubHeaderTopRowSx,
  getCollapseSectionShellSx,
} from './collapseSectionStyles';

/** Ancho máximo del contenido de la página Rutinas (alineado con TareaForm / hub Foco). */
export const RUTINA_PAGE_MAX_WIDTH = 900;

/** Contenedor único: hero de fecha + cuerpo de página comparten max-width y padding horizontal. */
export function getRutinaPageContentShellSx(isMobileOrTablet = false) {
  if (isMobileOrTablet) {
    return {
      width: '100%',
      maxWidth: 'none',
      mx: 0,
      px: { xs: 1, sm: 2, md: 3 },
      boxSizing: 'border-box',
    };
  }
  return {
    width: '100%',
    maxWidth: RUTINA_PAGE_MAX_WIDTH,
    mx: 'auto',
    px: { xs: 1, sm: 2, md: 3 },
    boxSizing: 'border-box',
  };
}

/** @deprecated Prefer getRutinaPageContentShellSx(isMobileOrTablet) for desktop left alignment. */
export const rutinaPageContentShellSx = getRutinaPageContentShellSx(true);

/** @deprecated Prefer imports from rutinaIconTokens.js */
export * from './rutinaIconTokens';

export const rutinaPageMainSx = {
  width: '100%',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
};

export const rutinaPageContainerSx = (isMobileOrTablet = false) => ({
  ...getRutinaPageContentShellSx(isMobileOrTablet),
  py: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
});

export function rutinaPageScrollSx(isMobileOrTablet, bottomPadding, extraTopOffset = 0) {
  return {
    ...hubPageScrollSx({ isMobileOrTablet, bottomPadding, extraTopOffset }),
    px: 0,
  };
}

export const rutinaPageLoaderSx = {
  display: 'flex',
  justifyContent: 'center',
  my: 4,
};

export const rutinaEmptyStatePaperSx = {
  ...getHubSubsectionSx(),
  p: 2,
  mb: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 1,
  textAlign: 'center',
};

export const rutinaErrorStatePaperSx = {
  p: 2,
  mb: 2,
  bgcolor: 'error.light',
  color: 'error.contrastText',
  borderRadius: HUB_SECTION.sectionRadius,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

export const rutinaTableContainerSx = {
  width: '100%',
  boxSizing: 'border-box',
};

export const rutinaGridContainerSx = {
  ...hubGridContainerSx,
  alignItems: 'stretch',
};

export const rutinaGridItemSx = {
  ...hubGridItemSx,
  display: 'flex',
  '& > *': { width: '100%' },
};

/** Shell de sección (Cuidado Personal, Nutrición, etc.) — mismo shell que tareas. */
export function getRutinaSectionShellSx(isMobile = false) {
  return {
    ...getCollapseSectionShellSx(isMobile),
    mb: 0,
    width: '100%',
    height: '100%',
  };
}

export const rutinaSectionShellSx = getRutinaSectionShellSx(false);

/** @deprecated Usar collapseHubHeaderSx desde collapseSectionStyles */
export const rutinaSectionHeaderSx = collapseHubHeaderSx;

/** @deprecated Usar getCollapseHubHeaderTopRowSx(isMobile) */
export const rutinaSectionHeaderTopRowSx = getCollapseHubHeaderTopRowSx(false);

/** @deprecated Usar collapseHubTitleRowSx desde collapseSectionStyles */
export const rutinaSectionTitleRowSx = collapseHubTitleRowSx;

/** @deprecated Usar collapseHubTitleSx desde collapseSectionStyles */
export const rutinaSectionTitleSx = collapseHubTitleSx;

/** @deprecated Usar collapseHubHeaderIconSx desde collapseSectionStyles */
export const rutinaSectionHeaderIconSx = collapseHubHeaderIconSx;

/** @deprecated Usar collapseHubBodySx desde collapseSectionStyles */
export const rutinaSectionBodySx = collapseHubBodySx;

export const rutinaSectionSubdividerSx = {
  mb: 1,
  pb: 1,
  borderBottom: 1,
  borderColor: 'divider',
};

export const rutinaSectionEmptySx = {
  ...getHubSubsectionSx(),
  mb: 1,
  p: 2,
};

/** @deprecated Usar collapseHubChevronButtonSx desde collapseSectionStyles */
export function rutinaExpandIconSx(isExpanded = false, mobile = false) {
  return collapseHubChevronButtonSx(isExpanded, mobile);
}

export const rutinaBackToListIconSx = {
  ...taskFormHeaderActionIconSx('text.secondary'),
  width: { xs: RUTINA_CHEVRON.mobile.button, md: RUTINA_CHEVRON.desktop.button },
  height: { xs: RUTINA_CHEVRON.mobile.button, md: RUTINA_CHEVRON.desktop.button },
  minWidth: { xs: RUTINA_CHEVRON.mobile.button, md: RUTINA_CHEVRON.desktop.button },
  minHeight: { xs: RUTINA_CHEVRON.mobile.button, md: RUTINA_CHEVRON.desktop.button },
  mr: 0.5,
};

/** Botón circular de hábito (lista expandida de rutina). */
export function getRutinaHabitIconButtonSx({
  isCompleted,
  size = RUTINA_HABIT_ICON_SIZE.desktop,
  glyph,
  mr = 1,
} = {}) {
  const resolvedGlyph = glyph || (size >= 44
    ? RUTINA_HABIT_ICON_GLYPH.mobile
    : size <= 32
      ? RUTINA_HABIT_ICON_GLYPH.compact
      : RUTINA_HABIT_ICON_GLYPH.desktop);

  return {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    p: 0,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    mr,
    cursor: 'pointer',
    color: isCompleted ? 'primary.main' : 'text.secondary',
    bgcolor: isCompleted ? 'action.selected' : 'transparent',
    borderRadius: '50%',
    border: '1px solid',
    borderStyle: 'solid',
    borderColor: isCompleted ? 'primary.main' : 'divider',
    transition: 'all 0.2s ease',
    '& .MuiSvgIcon-root': {
      fontSize: resolvedGlyph,
    },
    '&:hover': {
      color: isCompleted ? 'primary.main' : 'text.primary',
      bgcolor: isCompleted ? 'action.selected' : 'action.hover',
    },
  };
}

export const rutinaCollapsedIconsRowSx = {
  width: '100%',
  minWidth: 0,
  bgcolor: hubSectionBg,
};

export const rutinaChecklistItemSx = {
  mb: 0.5,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  bgcolor: 'transparent',
};

export const rutinaChecklistRowSx = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  py: 0.5,
  position: 'relative',
  pr: 0,
  gap: 0,
};

/** Máximo de iconos visibles en columna fija antes de scroll horizontal. */
export const RUTINA_CHECKLIST_MAX_ROUTINE_ICONS = 4;

/** Ancho reservado del handle de drag — alinea filas con y sin sort. */
export const RUTINA_CHECKLIST_DRAG_HANDLE_WIDTH = {
  mobile: 24,
  desktop: 22,
};

/** Margen central fijo entre columna de iconos y texto (theme spacing). */
export const RUTINA_CHECKLIST_CENTER_GAP = 0.5;

export function getRutinaChecklistDragHandleWidth(mobile = false) {
  return mobile
    ? RUTINA_CHECKLIST_DRAG_HANDLE_WIDTH.mobile
    : RUTINA_CHECKLIST_DRAG_HANDLE_WIDTH.desktop;
}

export function getRutinaChecklistDragHandleSlotSx(mobile = false) {
  const width = getRutinaChecklistDragHandleWidth(mobile);
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: `0 0 ${width}px`,
    width,
    minWidth: width,
    flexShrink: 0,
    color: 'text.disabled',
    touchAction: 'none',
    '&:active': { cursor: 'grabbing' },
  };
}

export function getRutinaChecklistIconSize(compact = false, mobile = false) {
  return getRutinaHabitIconTokens({ compact, mobile }).size;
}

/** Ancho fijo de la columna de iconos (siempre el estándar, independiente del tamaño del glifo). */
export function getRutinaChecklistIconColumnLayoutWidth({
  mobile = false,
  maxIcons = RUTINA_CHECKLIST_MAX_ROUTINE_ICONS,
} = {}) {
  return getRutinaChecklistIconColumnWidth({ compact: false, mobile, maxIcons });
}

/** @deprecated Usar getRutinaChecklistIconColumnLayoutWidth para alinear el margen central. */
export function getRutinaChecklistIconColumnWidth({
  compact = false,
  mobile = false,
  maxIcons = RUTINA_CHECKLIST_MAX_ROUTINE_ICONS,
} = {}) {
  const iconSize = getRutinaChecklistIconSize(compact, mobile);
  const gapPx = compact ? 1.2 : 2;
  return iconSize * maxIcons + gapPx * Math.max(0, maxIcons - 1);
}

export function rutinaChecklistIconColumnSx({ compact = false, mobile = false, fluid = false } = {}) {
  const gap = compact ? 0.15 : 0.25;
  const minHeight = getRutinaChecklistIconSize(compact, mobile);

  if (fluid) {
    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flex: '1 1 auto',
      minWidth: 0,
      maxWidth: '100%',
      gap,
      minHeight,
    };
  }

  const width = getRutinaChecklistIconColumnLayoutWidth({ mobile });
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: `0 0 ${width}px`,
    width,
    minWidth: width,
    flexShrink: 0,
    gap,
    minHeight,
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    '&::-webkit-scrollbar': { display: 'none' },
  };
}

export const rutinaChecklistContentSx = {
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  minWidth: 0,
  gap: RUTINA_CHECKLIST_CENTER_GAP,
  overflow: 'hidden',
  color: 'text.primary',
};

export const rutinaChecklistTextColumnSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'center',
  minWidth: 0,
  flex: 1,
  overflow: 'hidden',
};

export function rutinaChecklistLabelSx(isCompleted) {
  return {
    ...taskFormBodyTextSx,
    fontWeight: 400,
    color: isCompleted ? 'text.disabled' : 'text.primary',
    textDecoration: isCompleted ? 'line-through' : 'none',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  };
}

export const rutinaChecklistMetaSx = {
  ...taskFormCaptionTextSx,
  fontSize: TASK_FORM_CAPTION_FONT_SIZE,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const rutinaChainRowWrapSx = {
  position: 'relative',
};

export const rutinaStackRowSx = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'stretch',
  gap: 0.75,
  width: '100%',
  minWidth: 0,
};

/** Fila compacta: hábitos apilados lado a lado, misma altura que filas normales. */
export const rutinaStackRowInlineSx = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'stretch',
  gap: 0,
  width: '100%',
  minWidth: 0,
};

/** Fila compacta en vista de grupo: ancho según contenido, sin estirar celdas. */
export const rutinaStackRowCompactSx = {
  display: 'inline-flex',
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 1.25,
  maxWidth: '100%',
};

export const rutinaStackRowWrapCompactSx = {
  width: '100%',
  minWidth: 0,
  mb: 0.5,
};

export const rutinaStackRowWrapSx = {
  width: '100%',
  minWidth: 0,
  mb: 0.5,
};

export const rutinaStackRowHeaderSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  px: 0.5,
  pb: 0.35,
  minWidth: 0,
};

export const rutinaStackCellSx = {
  flex: '1 1 0',
  minWidth: 0,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.5,
  overflow: 'hidden',
  bgcolor: 'background.default',
  position: 'relative',
};

/** Celda inline sin borde — mismo aspecto que un hábito suelto. */
export const rutinaStackCellInlineSx = {
  flex: '1 1 0',
  minWidth: 0,
  overflow: 'hidden',
  position: 'relative',
};

/** Celda compacta: solo el ancho necesario, sin borde ni meta. */
export const rutinaStackCellCompactSx = {
  flex: '0 0 auto',
  minWidth: 0,
  maxWidth: 180,
  overflow: 'hidden',
  position: 'relative',
};

export const rutinaChecklistStackCellItemSx = {
  px: 0.75,
  py: 0.75,
  mb: 0,
  width: '100%',
  height: '100%',
};

export const rutinaChecklistStackCellRowSx = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 0.25,
  position: 'relative',
  width: '100%',
  py: 0.25,
};

export const rutinaChecklistStackCellLabelRowSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 0.35,
  width: '100%',
  minWidth: 0,
};

export const rutinaChecklistStackCellContentSx = {
  alignItems: 'center',
  justifyContent: 'flex-start',
  textAlign: 'left',
  width: '100%',
  flexDirection: 'row',
  gap: RUTINA_CHECKLIST_CENTER_GAP,
};

export const rutinaChecklistStackCellTextSx = {
  alignItems: 'flex-start',
  justifyContent: 'center',
  width: '100%',
  flex: 1,
  minWidth: 0,
};

export const rutinaChecklistStackCellActionsSx = {
  position: 'absolute',
  top: 2,
  right: 2,
  zIndex: 1,
};

export const rutinaChainConnectorSx = {
  position: 'absolute',
  left: 19,
  top: -10,
  bottom: '50%',
  width: 2,
  bgcolor: 'divider',
  borderRadius: 1,
  pointerEvents: 'none',
};

export const rutinaChainChipSx = {
  fontSize: '0.65rem',
  height: 18,
  ml: 0.5,
  verticalAlign: 'middle',
};

export const rutinaRoutineChipSx = {
  fontSize: '0.65rem',
  height: 18,
  mt: 0.25,
  alignSelf: 'flex-start',
};

/** Chip de rutina como etiqueta principal (sin meta secundaria). */
export const rutinaRoutineChipPrimarySx = {
  ...rutinaRoutineChipSx,
  mt: 0,
};

export const rutinaChainLockedRowSx = {
  opacity: 0.55,
};

export const rutinaHorariosRowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.3,
  ml: 0.5,
};

export function rutinaHorarioIconButtonSx(horarioCompleted) {
  return {
    ...taskFormHeaderActionIconSx(horarioCompleted ? 'primary.main' : 'text.disabled'),
    padding: 0.25,
    width: 'auto',
    height: 'auto',
    minWidth: 'auto',
    opacity: horarioCompleted ? 1 : 0.4,
    '&:hover': {
      color: horarioCompleted ? 'primary.main' : 'text.secondary',
      opacity: horarioCompleted ? 1 : 0.7,
      bgcolor: 'action.hover',
    },
    '&:disabled': {
      opacity: 0.3,
      cursor: 'default',
    },
  };
}

export const rutinaHorarioIconSx = {
  fontSize: '0.75rem',
};

export const rutinaRowActionsSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  ml: 'auto',
  position: 'absolute',
  right: 0,
  top: '50%',
  transform: 'translateY(-50%)',
};

export function rutinaRowActionIconSx(isActive = false) {
  return {
    ...taskFormHeaderActionIconSx(isActive ? 'primary.main' : 'text.disabled'),
    width: 24,
    height: 24,
    minWidth: 24,
    '&:hover': {
      color: 'primary.main',
      bgcolor: 'action.hover',
    },
  };
}

export const rutinaSystemButtonsSx = {
  display: 'flex',
  alignItems: 'center',
  '& .MuiIconButton-root': {
    width: 24,
    height: 24,
    borderRadius: 0,
    padding: 0.25,
    '& .MuiSvgIcon-root': {
      fontSize: '1rem',
    },
  },
};

export const rutinaInlineConfigSx = {
  width: '100%',
  mt: 1,
};

/** Separador fino antes del sector Hecho. */
export const rutinaDoneSectionDividerSx = {
  mt: 0.75,
  pt: 0.75,
  borderTop: '1px solid',
  borderColor: (theme) => alpha(theme.palette.divider, 0.3),
};

/** @deprecated Usar collapseSubsectionHeadingSx desde collapseSectionStyles */
export const rutinaDoneSectionHeadingSx = collapseSubsectionHeadingSx;

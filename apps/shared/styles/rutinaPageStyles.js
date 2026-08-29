import { alpha } from '@mui/material/styles';
import {
  HUB_SECTION,
  hubSectionBg,
  hubSectionShellSx,
  hubSectionTitleSx,
  hubHeaderIconSx,
  hubSectionShellBodySx,
  hubGridContainerSx,
  hubGridItemSx,
  getHubSubsectionSx,
  hubPageScrollSx,
} from './hubSectionStyles';
import {
  taskFormCaptionTextSx,
  taskFormBodyTextSx,
  taskFormRowWithActionSx,
  taskFormHeaderActionIconSx,
  TASK_FORM_CAPTION_FONT_SIZE,
} from '../components/forms/tareaFormTokens';

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

/** Shell de sección (Cuidado Personal, Nutrición, etc.) — misma base que HubSectionShell. */
export const rutinaSectionShellSx = {
  ...hubSectionShellSx,
  mb: 0,
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

export function rutinaSectionHeaderSx(isExpanded) {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: isExpanded ? 0 : 0.25,
    overflow: 'hidden',
    borderBottom: isExpanded ? 1 : 0,
    borderColor: 'divider',
    cursor: 'pointer',
  };
}

/** Fila superior de sección: cabecera compacta (solo título + chevron). */
export const rutinaSectionHeaderTopRowSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  minWidth: 0,
  gap: { xs: 0.5, md: 0.375 },
  py: { xs: 0.5, md: 0.25 },
  px: { xs: 1.25, md: 1 },
  minHeight: { xs: 40, md: 'unset' },
  bgcolor: (theme) =>
    alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.03),
};

export const rutinaSectionTitleRowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  minWidth: 0,
  flex: 1,
};

export const rutinaSectionTitleSx = {
  ...hubSectionTitleSx,
  textTransform: 'none',
  letterSpacing: 0,
  fontSize: { xs: '0.875rem', md: '0.8125rem' },
  lineHeight: 1.3,
};

export const rutinaSectionHeaderIconSx = hubHeaderIconSx;

export const rutinaSectionBodySx = {
  ...hubSectionShellBodySx,
  px: 1,
  py: 0.5,
  pt: 0,
  bgcolor: hubSectionBg,
};

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

export const rutinaExpandIconSx = {
  ...taskFormHeaderActionIconSx('text.secondary'),
  width: { xs: 24, md: 20 },
  height: { xs: 24, md: 20 },
  minWidth: { xs: 24, md: 20 },
  minHeight: { xs: 24, md: 20 },
  opacity: 0.7,
  '&:hover': { opacity: 1 },
  '& .MuiSvgIcon-root': { fontSize: { xs: '1.1rem', md: '1rem' } },
};

export const rutinaBackToListIconSx = {
  ...rutinaExpandIconSx,
  mr: 0.5,
};

/** Botón circular de hábito (lista expandida de rutina). */
export function getRutinaHabitIconButtonSx({
  isCompleted,
  size = 38,
  mr = 1,
} = {}) {
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
      fontSize: size <= 32 ? '1.1rem' : '1.2rem',
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
  ...taskFormRowWithActionSx,
  width: '100%',
  py: 0.5,
  position: 'relative',
  pr: 0,
};

export const rutinaChecklistContentSx = {
  display: 'flex',
  alignItems: 'center',
  flexGrow: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'text.primary',
  pr: 0,
};

export const rutinaChecklistTextColumnSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  minWidth: 0,
  flexGrow: 1,
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
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 0.35,
  textAlign: 'center',
  position: 'relative',
  width: '100%',
  py: 0.25,
};

export const rutinaChecklistStackCellContentSx = {
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  width: '100%',
  flexDirection: 'column',
  gap: 0.15,
};

export const rutinaChecklistStackCellTextSx = {
  alignItems: 'center',
  width: '100%',
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

export const rutinaDoneSectionHeadingSx = {
  px: 0.5,
  py: 0.5,
  fontWeight: 600,
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontSize: '0.7rem',
};

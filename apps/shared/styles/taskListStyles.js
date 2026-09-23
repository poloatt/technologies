import { alpha } from '@mui/material/styles';
import { getEstadoColor } from '../components/common/StatusSystem';
import {
  HUB_SECTION,
  hubSectionBg,
  hubSectionHeaderSx,
  hubSectionShellSx,
  hubSectionTitleSx,
} from './hubSectionStyles';
import {
  TASK_FORM_BODY_FONT_SIZE,
  taskFormBodyTextSx,
  taskFormCaptionTextSx,
} from '../components/forms/tareaFormTokens';
import { TASK_PILL_HEIGHT_PX } from '../utils/calendar/calendarLayout';

/** Ancho de la barra de acento por estado (borde izquierdo). */
export const TASK_ACCENT_BAR_WIDTH = 4;

/** Tokens de superficie para listas de tareas (alineados con hub / rutinas). */
export function getTaskSurfaceTokens(theme) {
  const layoutBg = theme.palette.background.default;
  const layoutDividerColor = theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.black, 0.35)
    : alpha(theme.palette.common.black, 0.12);
  const surfaceBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.035)
    : alpha(theme.palette.common.black, 0.03);
  const sectionDividerColor = theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.10)
    : alpha(theme.palette.common.black, 0.10);
  const hoverBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.055)
    : alpha(theme.palette.common.black, 0.045);
  const groupTitleBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.06)
    : alpha(theme.palette.common.black, 0.06);

  return {
    layoutBg,
    layoutDividerColor,
    surfaceBg,
    sectionDividerColor,
    hoverBg,
    groupTitleBg,
  };
}

export function normalizeTaskEstado(estado) {
  return String(estado || '').toUpperCase();
}

/** Tokens de color por estado de tarea (StatusSystem + fondos suaves). */
export function getTaskEstadoTokens(theme, estado) {
  const e = normalizeTaskEstado(estado);
  const main = getEstadoColor(e, 'TAREA') || getEstadoColor('PENDIENTE', 'TAREA');

  return {
    main,
    softBg: theme.palette.mode === 'dark' ? alpha(main, 0.10) : alpha(main, 0.08),
    softBorder: theme.palette.mode === 'dark' ? alpha(main, 0.35) : alpha(main, 0.28),
  };
}

/** Shell de grupo por período (HOY, MAÑANA, etc.) — patrón hub section. */
export function getTaskGroupShellSx(isMobile = false) {
  return {
    ...hubSectionShellSx,
    bgcolor: hubSectionBg,
    borderRadius: HUB_SECTION.sectionRadius,
    overflow: 'hidden',
    mx: isMobile ? 0 : 'auto',
    width: '100%',
    minHeight: 0,
    boxShadow: (theme) => theme.shadows[1],
  };
}

/** Cabecera de grupo con contador. */
export function getTaskGroupHeaderSx(isMobile = false) {
  return {
    ...hubSectionHeaderSx,
    px: isMobile ? 1.25 : HUB_SECTION.headerPx,
    py: isMobile ? 0.75 : HUB_SECTION.headerPy,
    borderBottom: 1,
    borderColor: 'divider',
  };
}

export const taskGroupTitleSx = {
  ...hubSectionTitleSx,
  lineHeight: 1.2,
};

export const taskGroupCountSx = {
  ml: 0.75,
  color: 'text.secondary',
  fontWeight: 700,
};

/** Tipografía del título en fila de tarea. */
export function getTaskRowTitleSx(isMobile = false, completed = false) {
  return {
    ...taskFormBodyTextSx,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: isMobile ? '0.8125rem' : TASK_FORM_BODY_FONT_SIZE,
    lineHeight: 1.25,
    textDecoration: completed ? 'line-through' : 'none',
    opacity: completed ? 0.72 : 1,
  };
}

/** Tipografía de fecha/horario en fila. */
export function getTaskRowScheduleSx(isMobile = false) {
  return {
    ...taskFormCaptionTextSx,
    fontSize: isMobile ? '0.6875rem' : '0.75rem',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  };
}

/** Padding de celdas en fila (mobile vs desktop). */
export function getTaskRowCellPadding(isMobile = false) {
  return {
    py: isMobile ? 0.75 : 0.625,
    px: isMobile ? 1 : 1.25,
  };
}

/**
 * Estilos de TableRow para una tarea.
 * Acepta flags de selección / presión larga sin acoplar lógica de negocio.
 */
export function getTaskRowSx({
  theme,
  isMobile = false,
  estadoColor,
  selectionAccent,
  isLongPressing = false,
  isSelected = false,
  hasSelections = false,
  showMultiSelectHint = false,
  surfaceBg,
  hoverBg,
  layoutDividerColor,
}) {
  const accent = selectionAccent || theme.palette.info.main;

  return {
    '& > *': { borderBottom: `1px solid ${layoutDividerColor}` },
    cursor: 'pointer',
    '&:hover': { backgroundColor: hoverBg },
    position: 'relative',
    '& .MuiSvgIcon-root': {
      fontSize: isMobile ? '1.1rem' : '1rem',
    },
    '& .MuiTableCell-root': {
      borderBottom: `1px solid ${layoutDividerColor} !important`,
      ...getTaskRowCellPadding(isMobile),
      lineHeight: 1.2,
    },
    bgcolor: isLongPressing
      ? alpha(accent, 0.16)
      : (isSelected ? alpha(accent, 0.12) : surfaceBg),
    transition: 'background-color 0.2s ease',
    ...(hasSelections && {
      outline: isSelected ? '2px solid' : 'none',
      outlineColor: isSelected ? accent : 'transparent',
      outlineOffset: '-2px',
      borderRadius: 1,
    }),
    ...(showMultiSelectHint && !hasSelections && {
      outline: '2px dashed',
      outlineColor: accent,
      outlineOffset: '-2px',
      borderRadius: 1,
      backgroundColor: alpha(accent, 0.06),
      '&:hover': {
        backgroundColor: alpha(accent, 0.10),
        outlineColor: alpha(accent, 0.9),
      },
    }),
    ...(hasSelections && !isSelected && {
      animation: 'taskListSubtlePulse 3s infinite',
    }),
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: TASK_ACCENT_BAR_WIDTH,
      backgroundColor: estadoColor,
      borderRadius: '0 2px 2px 0',
    },
    ...(isLongPressing && {
      '&::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: alpha(accent, 0.10),
        outline: '2px solid',
        outlineColor: accent,
        outlineOffset: '-2px',
        borderRadius: 1,
        pointerEvents: 'none',
      },
    }),
  };
}

/** Bloque de evento/tarea en calendario (paridad visual Google Calendar). */
export function getTaskEventBlockSx({
  theme,
  accent,
  completed = false,
  compact = false,
  timedCompact = false,
  isEvento = false,
  minHeight,
}) {
  // EVENTO: bloque sólido que ocupa la duración (ligeramente transparente para ver TAREA encima)
  if (isEvento && timedCompact) {
    return {
      position: 'relative',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 0.25,
      px: 0.75,
      py: 0.375,
      borderRadius: '4px',
      border: 'none',
      bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.88 : 0.92),
      color: theme.palette.getContrastText(accent),
      opacity: completed ? 0.55 : 1,
      cursor: 'pointer',
      overflow: 'hidden',
      height: '100%',
      minHeight: minHeight ?? 20,
      boxSizing: 'border-box',
      transition: 'filter 0.12s ease',
      '&:hover': {
        filter: 'brightness(1.08)',
      },
    };
  }

  // TAREA timed: pill fina tipo Google Tasks en Calendar
  if (timedCompact && !isEvento) {
    const pillBg = theme.palette.mode === 'dark'
      ? alpha(theme.palette.common.white, 0.10)
      : alpha(theme.palette.common.black, 0.08);
    return {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      px: 0.75,
      py: 0,
      borderRadius: '999px',
      border: 'none',
      bgcolor: pillBg,
      opacity: completed ? 0.5 : 1,
      cursor: 'pointer',
      overflow: 'hidden',
      height: '100%',
      maxHeight: '100%',
      minHeight: minHeight ?? `${TASK_PILL_HEIGHT_PX}px`,
      boxSizing: 'border-box',
      transition: 'background-color 0.12s ease',
      '&:hover': {
        bgcolor: theme.palette.mode === 'dark'
          ? alpha(theme.palette.common.white, 0.14)
          : alpha(theme.palette.common.black, 0.12),
      },
    };
  }

  // All-day / compact chips — misma altura que pill timed (media hora)
  const soft = theme.palette.mode === 'dark'
    ? alpha(accent, 0.28)
    : alpha(accent, 0.18);

  return {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    px: 0.75,
    py: 0,
    borderRadius: isEvento ? '4px' : '999px',
    border: 'none',
    bgcolor: isEvento ? accent : soft,
    color: isEvento ? theme.palette.getContrastText(accent) : undefined,
    opacity: completed ? 0.5 : 1,
    cursor: 'pointer',
    overflow: 'hidden',
    height: `${TASK_PILL_HEIGHT_PX}px`,
    maxHeight: `${TASK_PILL_HEIGHT_PX}px`,
    minHeight: 0,
    boxSizing: 'border-box',
    transition: 'filter 0.12s ease',
    '&:hover': {
      filter: 'brightness(0.97)',
    },
  };
}

export const taskEventTitleSx = (timedCompact = false, completed = false, isEvento = false) => ({
  ...taskFormBodyTextSx,
  fontWeight: isEvento ? 600 : 500,
  fontSize: timedCompact
    ? (isEvento ? '0.75rem' : '0.8125rem')
    : '0.8125rem',
  lineHeight: 1.2,
  letterSpacing: '-0.01em',
  display: 'block',
  textDecoration: completed ? 'line-through' : 'none',
  textDecorationThickness: completed ? '1px' : undefined,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const taskEventTimeSx = {
  ...taskFormCaptionTextSx,
  fontSize: '0.6875rem',
  fontWeight: 400,
  opacity: 0.9,
  lineHeight: 1.2,
};

/** Contenedor de lista (spacing entre grupos). */
export function getTaskListStackSx(isMobile = false) {
  return {
    spacing: isMobile ? 1 : 1.5,
    pb: isMobile ? 4 : 1.5,
  };
}

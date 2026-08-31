/**
 * Estilos de botón de icono de hábito (feature Hábitos).
 * Unifica lista/checklist y carrusel: outline pendiente + hechos filled planos.
 */
import { alpha } from '@mui/material/styles';
import {
  getHabitIconTokens,
  RUTINA_HABIT_ICON_GLYPH,
  RUTINA_HABIT_ICON_SIZE,
} from './rutinaIconTokens';
import { HABIT_ICON_DONE_TONE } from '../habits/presentation/habitIconPresentation.js';

/** Grosor del anillo activo — proporcional al stroke MUI Outlined. */
export const HABIT_ICON_ACTIVE_RING_WIDTH = 1.5;

/** Escala del glifo outline dentro del círculo (aire vs anillo). */
export const HABIT_ICON_OUTLINE_INSET_SCALE = 0.84;

export { getHabitIconTokens };

function resolveGlyph(size, glyph) {
  if (glyph) return glyph;
  return getHabitIconTokens({
    mobile: size >= 44,
    compact: size <= 32,
  }).glyph;
}

function shouldInsetOutlineGlyph(variant, outline) {
  if (!outline) return false;
  return variant === 'activePending';
}

function baseIconBoxSx(size, mr, resolvedGlyph, { outline = false, variant = null } = {}) {
  const inset = shouldInsetOutlineGlyph(variant, outline);
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
    borderRadius: '50%',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
    '& .MuiSvgIcon-root': {
      fontSize: resolvedGlyph,
      ...(inset ? { transform: `scale(${HABIT_ICON_OUTLINE_INSET_SCALE})` } : null),
    },
  };
}

/** Hecho hoy: filled plano, brillo pleno. */
function completedTodaySx(theme) {
  return {
    color: theme.palette.primary.main,
    bgcolor: 'transparent',
    border: 'none',
    borderStyle: 'none',
    borderColor: 'transparent',
    opacity: 1,
    filter: `drop-shadow(0 0 4px ${alpha(theme.palette.primary.main, 0.55)})`,
    '&:hover': {
      color: theme.palette.primary.main,
      bgcolor: alpha(theme.palette.primary.main, 0.08),
      filter: `drop-shadow(0 0 5px ${alpha(theme.palette.primary.main, 0.65)})`,
    },
  };
}

/** Hecho antes (cuota vigente): filled plano, claramente más apagado que hoy. */
function completedBeforeSx(theme) {
  return {
    color: alpha(theme.palette.primary.main, 0.55),
    bgcolor: 'transparent',
    border: 'none',
    borderStyle: 'none',
    borderColor: 'transparent',
    opacity: 0.42,
    filter: 'none',
    '&:hover': {
      color: alpha(theme.palette.primary.main, 0.72),
      bgcolor: alpha(theme.palette.primary.main, 0.05),
      opacity: 0.58,
    },
  };
}

/** Luego / diferido: outline plano, brillo bajo — no tienta el click. */
function deferredPendingSx(theme) {
  return {
    color: theme.palette.text.disabled,
    bgcolor: 'transparent',
    border: 'none',
    borderStyle: 'none',
    borderColor: 'transparent',
    opacity: 0.38,
    filter: 'none',
    cursor: 'default',
    '&:hover': {
      color: theme.palette.text.secondary,
      bgcolor: alpha(theme.palette.action.hover, 0.4),
      opacity: 0.5,
    },
  };
}

/**
 * Botón de hábito (lista expandida y carrusel).
 */
export function getHabitIconButtonSx({
  isCompleted,
  size = RUTINA_HABIT_ICON_SIZE.desktop,
  glyph,
  mr = 1,
  hideBorder = false,
  doneTone = null,
  variant = null,
  outline = false,
} = {}) {
  const resolvedGlyph = resolveGlyph(size, glyph);
  const tone = doneTone
    || (isCompleted ? HABIT_ICON_DONE_TONE.TODAY : null);
  const base = baseIconBoxSx(size, mr, resolvedGlyph, { outline, variant });

  if (tone === HABIT_ICON_DONE_TONE.BEFORE || variant === 'completedBefore') {
    return (theme) => ({
      ...base,
      ...completedBeforeSx(theme),
    });
  }

  if (tone === HABIT_ICON_DONE_TONE.TODAY || variant === 'completedToday') {
    return (theme) => ({
      ...base,
      ...completedTodaySx(theme),
    });
  }

  if (variant === 'deferredPending') {
    return (theme) => ({
      ...base,
      ...deferredPendingSx(theme),
    });
  }

  const plainPending = (hideBorder || variant === 'plainPending') && !isCompleted;

  return {
    ...base,
    color: 'text.secondary',
    bgcolor: 'transparent',
    border: plainPending ? 'none' : `${HABIT_ICON_ACTIVE_RING_WIDTH}px solid`,
    borderStyle: plainPending ? 'none' : 'solid',
    borderColor: plainPending ? 'transparent' : 'divider',
    opacity: plainPending ? 0.78 : 1,
    '&:hover': {
      color: 'text.primary',
      bgcolor: 'action.hover',
      opacity: 1,
    },
  };
}

/**
 * Variante carrusel: mismos tokens visuales que la lista + extras táctiles.
 */
export function getHabitCarouselIconButtonSx({
  isCompleted,
  size = RUTINA_HABIT_ICON_SIZE.desktop,
  glyph,
  hideBorder = false,
  requireExpand = false,
  interactive = true,
  doneTone = null,
  variant = null,
  outline = false,
} = {}) {
  const base = getHabitIconButtonSx({
    isCompleted,
    size,
    glyph,
    mr: 0,
    hideBorder,
    doneTone,
    variant,
    outline,
  });
  const tone = doneTone || (isCompleted ? HABIT_ICON_DONE_TONE.TODAY : null);
  const isDeferred = variant === 'deferredPending';
  const dashed = !tone && !isDeferred && !hideBorder && !isCompleted && requireExpand;

  const carouselExtras = {
    maxWidth: size,
    maxHeight: size,
    boxSizing: 'border-box',
    touchAction: 'pan-x',
    cursor: interactive && !isDeferred ? 'pointer' : 'default',
    ...(!tone && !isDeferred && requireExpand && !isCompleted ? { opacity: 0.72 } : null),
    ...(dashed ? { borderStyle: 'dashed' } : null),
    '&.Mui-disabled': tone || variant === 'completedToday' || variant === 'completedBefore'
      ? {
        opacity: (tone === HABIT_ICON_DONE_TONE.BEFORE || variant === 'completedBefore') ? 0.42 : 1,
        color: 'primary.main',
        bgcolor: 'transparent',
      }
      : undefined,
  };

  if (typeof base === 'function') {
    return (theme) => ({
      ...base(theme),
      ...carouselExtras,
      borderStyle: dashed ? 'dashed' : (base(theme).borderStyle ?? 'none'),
      '&:hover': {
        ...base(theme)['&:hover'],
        ...(!tone && !isDeferred && requireExpand && !isCompleted ? { opacity: 1 } : null),
      },
    });
  }

  return {
    ...base,
    ...carouselExtras,
    borderStyle: dashed ? 'dashed' : base.borderStyle,
    '&:hover': {
      ...base['&:hover'],
      ...(!tone && !isDeferred && requireExpand && !isCompleted ? { opacity: 1 } : null),
    },
  };
}

/** Superficie del carril de carrusel (tamaño del icono, no chrome). */
export function getHabitIconCarouselTokens({ mobile = false, dense = false } = {}) {
  return getHabitIconTokens({ mobile, dense });
}

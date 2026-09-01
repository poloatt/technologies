import React from 'react';
import { IconButton } from '@mui/material';
import { HabitCounterBadge } from '../common/HabitCounterBadge';
import { getCurrentTimeOfDay } from '../../utils/timeOfDayUtils';
import { resolveHabitIconPresentation } from '../../habits/presentation';
import { resolveHabitDisplayIcon } from '../../utils/habitOutlineIcons';
import { isRutinaFuturePreview } from '../../utils/rutinaDayMode';
import { getHabitIconButtonSx, getHabitIconTokens } from '../../styles/habitIconStyles';
import { RUTINA_HABIT_ICON_SIZE } from '../../styles/rutinaIconTokens';

/** Botón circular de hábito (listas/checklist). Estilos canónicos de Hábitos. */
export default function HabitIconButton({
  isCompleted,
  Icon,
  iconName = null,
  onClick,
  readOnly,
  size = RUTINA_HABIT_ICON_SIZE.desktop,
  glyph,
  mr = 1,
  /** Franja anterior aún visible (sinHacer): outline sin círculo. */
  hideBorder = false,
  /** Luego / diferido: outline plano con menos brillo. */
  deferredPending = false,
  /** 'today' | 'before' — hechos filled planos (hoy = brillo pleno; antes = más sutil). */
  doneTone = null,
  config = {},
  currentTimeOfDay,
  displayHorario = null,
  overlap = 'subtle',
  rutina = null,
  section = null,
  itemId = null,
  quotaSlot = null,
  /** Franjas completadas en Hecho histórico multi-franja (un icono, varias insignias). */
  completedHorarios = null,
  /** Menú posponer: clic derecho / long-press en el icono. */
  postponeHandlers = null,
  ...props
}) {
  const timeOfDay = currentTimeOfDay || getCurrentTimeOfDay();
  const resolvedGlyph = glyph || getHabitIconTokens({
    mobile: size >= 44,
    compact: size <= 32,
  }).glyph;
  const presentation = resolveHabitIconPresentation({
    isCompleted,
    plainPending: hideBorder,
    deferredPending,
    doneTone,
    forcePlainPending: isRutinaFuturePreview(rutina),
  });
  const DisplayIcon = resolveHabitDisplayIcon(Icon, {
    iconName,
    outline: presentation.outline,
  });

  return (
    <HabitCounterBadge
      config={config}
      currentTimeOfDay={timeOfDay}
      displayHorario={completedHorarios ? null : displayHorario}
      completedHorarios={completedHorarios}
      size={size <= 32 ? 'small' : 'medium'}
      overlap={overlap}
      rutina={rutina}
      section={section}
      itemId={itemId}
      isCompleted={Boolean(isCompleted) || presentation.doneTone != null}
      quotaSlot={quotaSlot}
      iconPresentation={presentation}
    >
      <IconButton
        size="small"
        disabled={readOnly}
        sx={getHabitIconButtonSx({
          isCompleted: Boolean(isCompleted) || presentation.doneTone != null,
          size,
          glyph: resolvedGlyph,
          mr,
          hideBorder: presentation.hideBorder,
          doneTone: presentation.doneTone,
          variant: presentation.variant,
          outline: presentation.outline,
        })}
        {...props}
        onClick={(event) => {
          if (postponeHandlers?.onClick) {
            postponeHandlers.onClick(event);
            if (event.defaultPrevented) return;
          }
          event.stopPropagation();
          onClick?.(event);
        }}
        onPointerDown={(event) => {
          postponeHandlers?.onPointerDown?.(event);
          event.stopPropagation();
          props.onPointerDown?.(event);
        }}
        onPointerUp={(event) => {
          postponeHandlers?.onPointerUp?.(event);
          props.onPointerUp?.(event);
        }}
        onPointerMove={(event) => {
          postponeHandlers?.onPointerMove?.(event);
          props.onPointerMove?.(event);
        }}
        onPointerCancel={(event) => {
          postponeHandlers?.onPointerCancel?.(event);
          props.onPointerCancel?.(event);
        }}
        onPointerLeave={(event) => {
          postponeHandlers?.onPointerLeave?.(event);
          props.onPointerLeave?.(event);
        }}
        onContextMenu={(event) => {
          if (postponeHandlers?.onContextMenu) {
            postponeHandlers.onContextMenu(event);
            return;
          }
          event.stopPropagation();
          props.onContextMenu?.(event);
        }}
      >
        {DisplayIcon && <DisplayIcon />}
      </IconButton>
    </HabitCounterBadge>
  );
}

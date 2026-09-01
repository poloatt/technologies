import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { HabitCounterBadge } from '../common/HabitCounterBadge';
import {
  getHorarioForCarousel,
  isHabitFullyCompletedToday,
  resolveHabitIconPresentation,
  resolveDoneFranjaBadges,
  resolveHabitDeferralMenuOptions,
  canDeferHabit,
  HABIT_DEFERRAL_ACTION,
  isHabitHiddenByDeferral,
} from '../../habits';
import { getCurrentTimeOfDay } from '../../utils/timeOfDayUtils';
import { getRutinaDayMode, isRutinaFuturePreview } from '../../utils/rutinaDayMode.js';
import { getPeriodicCarouselCopy, RUTINA_DAY_GROUP_COPY } from '../../copy/agendaTerminology';
import { resolveHabitDisplayIcon } from '../../utils/habitOutlineIcons';
import { getHabitCarouselIconButtonSx, getHabitIconTokens } from '../../styles/habitIconStyles';
import useHabitItemContextMenu from '../../hooks/useHabitItemContextMenu';
import HabitItemPostponeMenu from './HabitItemPostponeMenu';

const postponeIconWrapSx = {
  cursor: 'context-menu',
  WebkitTouchCallout: 'none',
  userSelect: 'none',
  touchAction: 'manipulation',
};

/** Ahora + franjas atrasadas del mismo día (sinHacer en carrusel). */
const DEFERRAL_CAROUSEL_SLOTS = new Set(['ahora', 'sinHacer']);

/**
 * Botón de hábito en carrusel. Presentación canónica de Hábitos
 * (outline pendiente; hechos filled planos con tono hoy / antes).
 */
export default function HabitCarouselIconButton({
  section,
  itemId,
  Icon,
  iconName = null,
  label,
  itemConfig,
  itemValue,
  currentTimeOfDay,
  rutinaHoy,
  mode = 'ahora',
  displayHorario = null,
  isCadenciaDebt = false,
  dense,
  interactive,
  showCompletionState,
  isScheduled = true,
  carouselSlot,
  size,
  iconFontSize,
  onToggle,
  requireExpand = false,
  onRequireExpand,
  allowPostpone = false,
  onDefer = null,
  onPostpone = null,
  /** 'today' | 'before' — hechos filled planos (hoy vs cuota anterior). */
  doneTone = null,
  /** false solo en carrusel de Tareas (filled pendiente legacy). Default: outline. */
  preferOutlineWhenPending = true,
  /** Hecho hoy/histórico: un icono con insignias de franja en multi-horario. */
  consolidateDoneFranjas = false,
  quotaSlot = null,
}) {
  const horariosConfig = Array.isArray(itemConfig?.horarios) ? itemConfig.horarios : [];
  const completadoHoy = itemValue !== undefined ? itemValue : false;

  const horarioToShow = displayHorario || getHorarioForCarousel(
    mode,
    horariosConfig,
    currentTimeOfDay,
    completadoHoy,
  );

  const isObjectFormat = typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue);
  const isBooleanFormat = typeof itemValue === 'boolean';
  const frecuencia = Number(itemConfig?.frecuencia || 1);
  const hasMultipleDaily = frecuencia > 1 || horariosConfig.length > 1;

  let isCompleted = false;
  if (showCompletionState) {
    if (hasMultipleDaily && isObjectFormat && horarioToShow) {
      isCompleted = itemValue[horarioToShow] === true;
    } else if (hasMultipleDaily && isObjectFormat) {
      isCompleted = isHabitFullyCompletedToday(itemValue, horariosConfig);
    } else if (isObjectFormat) {
      isCompleted = isHabitFullyCompletedToday(itemValue, horariosConfig);
    } else if (isBooleanFormat) {
      isCompleted = itemValue === true;
    }
  }

  const isHistoricalDay = rutinaHoy?.fecha && getRutinaDayMode(rutinaHoy.fecha) === 'historical';
  const shouldConsolidateDoneFranjas = consolidateDoneFranjas || isHistoricalDay;
  const completedFranjaBadges = (showCompletionState && shouldConsolidateDoneFranjas && isCompleted)
    ? resolveDoneFranjaBadges({
      config: itemConfig,
      itemValue: completadoHoy,
      franjaKey: displayHorario,
    })
    : null;
  const fullyCompleted = !showCompletionState
    || !hasMultipleDaily
    || !isObjectFormat
    || isHabitFullyCompletedToday(itemValue, horariosConfig);

  const presentation = resolveHabitIconPresentation({
    isCompleted,
    carouselSlot: showCompletionState ? carouselSlot : null,
    isScheduled: showCompletionState ? isScheduled : true,
    preferOutlineWhenPending,
    doneTone: fullyCompleted ? doneTone : null,
    forcePlainPending: isRutinaFuturePreview(rutinaHoy),
  });

  const isDoneVisual = presentation.doneTone != null;
  const statusLabel = isDoneVisual ? 'completado' : 'pendiente';
  const isNotTodaySlot = showCompletionState
    && !isHistoricalDay
    && (carouselSlot === 'notToday' || (!carouselSlot && !isScheduled));
  const isPlainPending = presentation.variant === 'plainPending'
    || presentation.variant === 'deferredPending';
  const periodicHint = isCadenciaDebt ? getPeriodicCarouselCopy(mode, { isCadenciaDebt: true }) : '';
  const expandHint = requireExpand ? 'Expandir grupo para elegir franja' : '';
  const plainHint = isNotTodaySlot ? RUTINA_DAY_GROUP_COPY.notToday : '';
  const tooltipTitle = expandHint
    ? `${label} — ${expandHint}`
    : (plainHint
      ? `${label} — ${plainHint}`
      : (periodicHint ? `${label} — ${periodicHint}` : label));
  const canQuickToggle = interactive && !requireExpand && !isNotTodaySlot;
  const canInteract = interactive && !isNotTodaySlot && !requireExpand;

  const postponeFranja = displayHorario || horarioToShow || getCurrentTimeOfDay();
  const isHiddenByDeferral = isHabitHiddenByDeferral({
    rutina: rutinaHoy,
    section,
    itemId,
    franja: postponeFranja,
  });

  const deferMenuSlotAllowed = DEFERRAL_CAROUSEL_SLOTS.has(carouselSlot);
  const canOpenDeferMenu = allowPostpone && interactive && deferMenuSlotAllowed && canDeferHabit({
    rutina: rutinaHoy,
    section,
    itemId,
    config: itemConfig,
    itemValue: completadoHoy,
    focusHorario: postponeFranja,
    readOnly: !interactive,
    allowPostpone: allowPostpone && deferMenuSlotAllowed,
  });
  const { menuState, closeMenu, getPostponeHandlers } = useHabitItemContextMenu({
    enabled: canOpenDeferMenu,
  });

  if (isHiddenByDeferral) {
    return null;
  }
  const postponeEntry = { section, itemId, config: itemConfig, itemValue: completadoHoy, label };
  const resolveMenuMeta = () => resolveHabitDeferralMenuOptions({
    rutina: rutinaHoy,
    section,
    itemId,
    config: itemConfig,
    itemValue: completadoHoy,
    focusHorario: postponeFranja,
    readOnly: !interactive,
    allowPostpone: allowPostpone && deferMenuSlotAllowed,
  });
  const postponeHandlers = canOpenDeferMenu
    ? getPostponeHandlers(postponeEntry, resolveMenuMeta)
    : {};
  const postponeEnabled = canOpenDeferMenu;

  const mergePostponeIconHandlers = (baseHandlers = {}) => ({
    ...baseHandlers,
    onClick: (event) => {
      postponeHandlers?.onClick?.(event);
      if (event.defaultPrevented) return;
      baseHandlers.onClick?.(event);
    },
    onPointerDown: (event) => {
      postponeHandlers?.onPointerDown?.(event);
      baseHandlers.onPointerDown?.(event);
    },
    onPointerUp: (event) => {
      postponeHandlers?.onPointerUp?.(event);
      baseHandlers.onPointerUp?.(event);
    },
    onPointerMove: (event) => {
      postponeHandlers?.onPointerMove?.(event);
      baseHandlers.onPointerMove?.(event);
    },
    onPointerCancel: (event) => {
      postponeHandlers?.onPointerCancel?.(event);
      baseHandlers.onPointerCancel?.(event);
    },
    onPointerLeave: (event) => {
      postponeHandlers?.onPointerLeave?.(event);
      baseHandlers.onPointerLeave?.(event);
    },
    onContextMenu: (event) => {
      if (postponeHandlers?.onContextMenu) {
        postponeHandlers.onContextMenu(event);
        return;
      }
      baseHandlers.onContextMenu?.(event);
    },
  });

  const DisplayIcon = resolveHabitDisplayIcon(Icon, {
    iconName,
    outline: presentation.outline,
  });
  const { glyph } = getHabitIconTokens({
    mobile: size >= 44,
    compact: size <= 32,
  });
  const resolvedGlyph = iconFontSize || glyph;
  const buttonSx = getHabitCarouselIconButtonSx({
    isCompleted: isDoneVisual,
    size,
    glyph: resolvedGlyph,
    hideBorder: presentation.hideBorder,
    requireExpand,
    interactive: canInteract || isDoneVisual,
    doneTone: presentation.doneTone,
    variant: presentation.variant,
    outline: presentation.outline,
  });

  const plainIcon = (
    <Box
      component="span"
      role="img"
      aria-label={`${label}, ${statusLabel}`}
      sx={getHabitCarouselIconButtonSx({
        isCompleted: false,
        size,
        glyph: resolvedGlyph,
        hideBorder: true,
        interactive: false,
        variant: presentation.variant === 'deferredPending' ? 'deferredPending' : 'plainPending',
        outline: presentation.outline,
      })}
      {...(postponeEnabled ? mergePostponeIconHandlers() : null)}
    >
      {DisplayIcon && <DisplayIcon />}
    </Box>
  );

  const interactiveButton = (
    <IconButton
      size="small"
      disabled={isDoneVisual ? !interactive : (!canInteract && !isDoneVisual)}
      aria-label={requireExpand && !isDoneVisual
        ? `Expandir grupo para marcar ${label}`
        : `${label}, ${statusLabel}`}
      aria-pressed={requireExpand && !isDoneVisual ? undefined : isDoneVisual}
      {...mergePostponeIconHandlers({
        onClick: (e) => {
          e.stopPropagation();
          if (requireExpand && !isDoneVisual) {
            onRequireExpand?.(section, itemId);
            return;
          }
          if (isDoneVisual) {
            if (!interactive) return;
            onToggle(section, itemId, displayHorario || horarioToShow);
            return;
          }
          if (!canQuickToggle) return;
          onToggle(section, itemId, displayHorario || horarioToShow);
        },
        onPointerDown: (e) => e.stopPropagation(),
      })}
      sx={buttonSx}
    >
      {DisplayIcon && <DisplayIcon />}
    </IconButton>
  );

  const habitBadge = (child, reserveBadgeSpace = showCompletionState && !isNotTodaySlot) => (
    <HabitCounterBadge
      config={itemConfig}
      currentTimeOfDay={currentTimeOfDay}
      displayHorario={completedFranjaBadges ? null : (displayHorario || horarioToShow)}
      completedHorarios={completedFranjaBadges}
      size={dense && !iconFontSize ? 'small' : 'medium'}
      overlap="subtle"
      reserveBadgeSpace={reserveBadgeSpace}
      rutina={rutinaHoy}
      section={section}
      itemId={itemId}
      isCompleted={isDoneVisual}
      quotaSlot={quotaSlot}
      iconPresentation={presentation}
    >
      {child}
    </HabitCounterBadge>
  );

  let renderedButton = interactiveButton;
  if (isPlainPending && !canQuickToggle) {
    renderedButton = plainIcon;
  }

  const wrapBadge = !isPlainPending || Boolean(horarioToShow) || isDoneVisual;

  return (
    <>
      <Tooltip title={tooltipTitle} arrow placement="top">
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            flex: '0 0 auto',
            alignItems: 'flex-start',
            justifyContent: 'center',
            verticalAlign: 'middle',
            ...(postponeEnabled ? postponeIconWrapSx : null),
          }}
        >
          {wrapBadge
            ? habitBadge(
              renderedButton,
              isDoneVisual ? false : (showCompletionState && !isNotTodaySlot),
            )
            : renderedButton}
        </Box>
      </Tooltip>
      {postponeEnabled && (
        <HabitItemPostponeMenu
          open={menuState.open && menuState.entry?.itemId === itemId && menuState.entry?.section === section}
          anchorPosition={menuState.anchorPosition}
          postponeLabel={menuState.postponeLabel}
          empujarLabel={menuState.empujarLabel}
          onClose={closeMenu}
          onPostpone={() => {
            if (!menuState.canPostpone) return;
            const defer = onDefer || onPostpone;
            defer?.(section, itemId, HABIT_DEFERRAL_ACTION.POSTPONE, {
              franja: menuState.franja || postponeFranja,
              postponeTargetDate: menuState.menuOptions?.postponeTargetDate,
              pushTargetDate: menuState.menuOptions?.pushTargetDate,
            });
          }}
          onEmpujar={() => {
            if (!menuState.canEmpujar) return;
            const defer = onDefer || onPostpone;
            defer?.(section, itemId, HABIT_DEFERRAL_ACTION.PUSH, {
              franja: menuState.franja || postponeFranja,
              postponeTargetDate: menuState.menuOptions?.postponeTargetDate,
              pushTargetDate: menuState.menuOptions?.pushTargetDate,
            });
          }}
          onIgnoreToday={() => {
            const defer = onDefer || onPostpone;
            defer?.(section, itemId, HABIT_DEFERRAL_ACTION.IGNORE, {
              franja: menuState.franja || postponeFranja,
            });
          }}
        />
      )}
    </>
  );
}

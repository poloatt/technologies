import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { HabitCounterBadge } from '../common/HabitCounterBadge';
import {
  getHorarioForCarousel,
  isHabitFullyCompletedToday,
} from '../../habits';
import { getPeriodicCarouselCopy, RUTINA_DAY_GROUP_COPY } from '../../copy/agendaTerminology';

/**
 * Botón circular de hábito reutilizado en carrusel y panel desktop de rutinas.
 */
export default function HabitCarouselIconButton({
  section,
  itemId,
  Icon,
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
  bg,
  hoverBg,
  rail,
  size,
  iconFontSize,
  onToggle,
  requireExpand = false,
  onRequireExpand,
  plainCompleted = false,
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

  const statusLabel = isCompleted ? 'completado' : 'pendiente';
  const isNotTodaySlot = showCompletionState
    && (carouselSlot === 'notToday' || (!carouselSlot && !isScheduled));
  const isPlainInactiveSlot = showCompletionState && !isCompleted && (
    carouselSlot === 'notToday'
    || carouselSlot === 'luego'
    || carouselSlot === 'inactiveFranja'
    || (!carouselSlot && !isScheduled)
  );
  const isPlainDone = plainCompleted && isCompleted;
  const isPlainPending = isPlainInactiveSlot;
  const isDashedCircle = !isPlainPending && !isPlainDone && !isCompleted && requireExpand;
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

  const plainIcon = (
    <Box
      component="span"
      role="img"
      aria-label={`${label}, ${statusLabel}`}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flex: '0 0 auto',
        color: isCompleted ? 'primary.main' : 'text.disabled',
        opacity: isCompleted ? 0.65 : 0.45,
        pointerEvents: 'none',
        border: 'none',
        outline: 'none',
        bgcolor: 'transparent',
        boxShadow: 'none',
      }}
    >
      <Icon sx={{ fontSize: iconFontSize || (dense ? '1.1rem' : '1.2rem') }} />
    </Box>
  );

  const plainPendingButton = (
    <IconButton
      size="small"
      disabled={!canQuickToggle}
      aria-label={`${label}, ${statusLabel}`}
      aria-pressed={isCompleted}
      onClick={(e) => {
        e.stopPropagation();
        if (!canQuickToggle) return;
        onToggle(section, itemId, displayHorario || horarioToShow);
      }}
      sx={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
        p: 0,
        borderRadius: '50%',
        boxSizing: 'border-box',
        bgcolor: 'transparent',
        color: 'text.disabled',
        opacity: 0.45,
        border: 'none',
        boxShadow: 'none',
        flex: '0 0 auto',
        touchAction: 'pan-x',
        '&:hover': {
          bgcolor: canQuickToggle ? 'action.hover' : 'transparent',
          opacity: canQuickToggle ? 0.65 : 0.45,
        },
      }}
    >
      <Icon sx={{ fontSize: iconFontSize || (dense ? '1.1rem' : '1.2rem') }} />
    </IconButton>
  );

  const plainCompletedButton = (
    <IconButton
      size="small"
      disabled={!interactive}
      aria-label={`${label}, completado`}
      aria-pressed
      onClick={(e) => {
        e.stopPropagation();
        if (!interactive) return;
        onToggle(section, itemId, displayHorario || horarioToShow);
      }}
      sx={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
        p: 0,
        borderRadius: '50%',
        boxSizing: 'border-box',
        bgcolor: 'transparent',
        color: 'primary.main',
        opacity: 0.65,
        border: 'none',
        boxShadow: 'none',
        flex: '0 0 auto',
        touchAction: 'pan-x',
        '&:hover': {
          bgcolor: 'action.hover',
          opacity: 0.85,
        },
      }}
    >
      <Icon sx={{ fontSize: iconFontSize || (dense ? '1.1rem' : '1.2rem') }} />
    </IconButton>
  );

  const iconButton = (
          <IconButton
            size="small"
            disabled={!canInteract && !isCompleted}
            aria-label={requireExpand ? `Expandir grupo para marcar ${label}` : `${label}, ${statusLabel}`}
            aria-pressed={requireExpand ? undefined : isCompleted}
            onClick={(e) => {
              e.stopPropagation();
              if (requireExpand) {
                onRequireExpand?.(section, itemId);
                return;
              }
              if (!canQuickToggle) return;
              onToggle(section, itemId, displayHorario || horarioToShow);
            }}
            sx={{
              width: size,
              height: size,
              minWidth: size,
              minHeight: size,
              maxWidth: size,
              maxHeight: size,
              p: 0,
              borderRadius: '50%',
              boxSizing: 'border-box',
              bgcolor: isCompleted ? 'action.selected' : bg,
              color: isCompleted ? 'primary.main' : 'text.secondary',
              border: '1px solid',
              borderStyle: isDashedCircle ? 'dashed' : 'solid',
              borderColor: isCompleted ? 'primary.main' : rail,
              flex: '0 0 auto',
              touchAction: 'pan-x',
              opacity: requireExpand ? 0.72 : 1,
              transition: showCompletionState
                ? 'color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease'
                : undefined,
              '&.Mui-disabled': {
                opacity: isCompleted ? 1 : undefined,
                color: isCompleted ? 'primary.main' : undefined,
                bgcolor: isCompleted ? 'action.selected' : undefined,
                borderColor: isCompleted ? 'primary.main' : undefined,
              },
              '&:hover': {
                bgcolor: isCompleted ? 'action.selected' : hoverBg,
                color: isCompleted ? 'primary.main' : 'text.primary',
                ...(requireExpand && !isCompleted && { opacity: 1 }),
              },
            }}
          >
            <Icon sx={{ fontSize: iconFontSize || (dense ? '1.1rem' : '1.2rem') }} />
          </IconButton>
  );

  const habitBadge = (child, reserveBadgeSpace = showCompletionState && !isNotTodaySlot) => (
    <HabitCounterBadge
      config={itemConfig}
      currentTimeOfDay={currentTimeOfDay}
      displayHorario={horarioToShow}
      size={dense && !iconFontSize ? 'small' : 'medium'}
      overlap="subtle"
      reserveBadgeSpace={reserveBadgeSpace}
      rutina={rutinaHoy}
      section={section}
      itemId={itemId}
    >
      {child}
    </HabitCounterBadge>
  );

  let renderedButton = iconButton;
  if (isPlainPending) {
    renderedButton = canQuickToggle ? plainPendingButton : plainIcon;
  } else if (isPlainDone) {
    renderedButton = plainCompletedButton;
  }

  const wrapBadge = !isPlainPending || Boolean(horarioToShow);

  return (
    <Tooltip title={tooltipTitle} arrow placement="top">
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          flex: '0 0 auto',
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          verticalAlign: 'middle',
        }}
      >
        {wrapBadge
          ? habitBadge(renderedButton, isPlainDone ? false : (showCompletionState && !isNotTodaySlot))
          : renderedButton}
      </Box>
    </Tooltip>
  );
}

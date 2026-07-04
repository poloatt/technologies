import React from 'react';
import { IconButton } from '@mui/material';
import { HabitCounterBadge } from '../common/HabitCounterBadge';
import { getCurrentTimeOfDay } from '../../utils/timeOfDayUtils';
import { getRutinaHabitIconButtonSx } from '../../styles/rutinaPageStyles';

/** Botón circular de hábito para listas/checklist de rutina. */
export default function HabitIconButton({
  isCompleted,
  isPartialPending = false,
  Icon,
  onClick,
  readOnly,
  size = 38,
  iconSize = 'small',
  mr = 1,
  config = {},
  currentTimeOfDay,
  displayHorario = null,
  overlap = 'subtle',
  rutina = null,
  section = null,
  itemId = null,
  ...props
}) {
  const timeOfDay = currentTimeOfDay || getCurrentTimeOfDay();

  return (
    <HabitCounterBadge
      config={config}
      currentTimeOfDay={timeOfDay}
      displayHorario={displayHorario}
      size={size <= 32 ? 'small' : 'medium'}
      overlap={overlap}
      rutina={rutina}
      section={section}
      itemId={itemId}
    >
      <IconButton
        size="small"
        onClick={onClick}
        disabled={readOnly}
        sx={getRutinaHabitIconButtonSx({ isCompleted, isPartialPending, size, mr })}
        {...props}
      >
        {Icon && <Icon sx={{ fontSize: size <= 32 ? '1.1rem' : '1.2rem' }} />}
      </IconButton>
    </HabitCounterBadge>
  );
}

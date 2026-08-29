import React from 'react';
import { IconButton } from '@mui/material';
import { HabitCounterBadge } from '../common/HabitCounterBadge';
import { getCurrentTimeOfDay } from '../../utils/timeOfDayUtils';
import { getRutinaHabitIconButtonSx } from '../../styles/rutinaPageStyles';
import { getRutinaHabitIconTokens, RUTINA_HABIT_ICON_SIZE } from '../../styles/rutinaIconTokens';

/** Botón circular de hábito para listas/checklist de rutina. */
export default function HabitIconButton({
  isCompleted,
  Icon,
  onClick,
  readOnly,
  size = RUTINA_HABIT_ICON_SIZE.desktop,
  glyph,
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
  const resolvedGlyph = glyph || getRutinaHabitIconTokens({
    mobile: size >= 44,
    compact: size <= 32,
  }).glyph;

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
        sx={getRutinaHabitIconButtonSx({ isCompleted, size, glyph: resolvedGlyph, mr })}
        {...props}
      >
        {Icon && <Icon sx={{ fontSize: resolvedGlyph }} />}
      </IconButton>
    </HabitCounterBadge>
  );
}

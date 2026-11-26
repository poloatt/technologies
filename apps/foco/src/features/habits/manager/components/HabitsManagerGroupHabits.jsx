import React, { useMemo } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { getIconByName } from '@shared/utils/iconConfig';

const ROW_SX = {
  display: 'flex',
  justifyContent: 'flex-start',
  alignItems: 'center',
  gap: 1,
  width: '100%',
  px: 1.25,
  py: 0.75,
  mb: 0.5,
  borderRadius: 1.5,
  border: '1px solid',
  textAlign: 'left',
  transition: 'border-color 0.15s ease',
};

/**
 * Hábitos del grupo en navegación: al elegir uno se abre para editarlo.
 * El primer ítem es siempre la acción "+ Agregar hábito al grupo".
 * El hábito en edición va resaltado; los inactivos se ven atenuados.
 */
export default function HabitsManagerGroupHabits({
  habits = [],
  selectedHabitId = null,
  onSelect,
  onAdd,
  addLabel = 'Agregar hábito al grupo',
  emptyLabel = 'Este grupo no tiene hábitos',
}) {
  const sortedHabits = useMemo(
    () => [...habits].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [habits],
  );

  return (
    <Box
      role="listbox"
      aria-label="Hábitos del grupo"
      sx={{ pt: 0.75, pb: 0.25 }}
    >
      {onAdd ? (
        <ButtonBase
          onClick={onAdd}
          aria-label={addLabel}
          sx={{
            ...ROW_SX,
            borderStyle: 'dashed',
            borderColor: 'divider',
            color: 'text.secondary',
            '&:hover': { borderColor: 'text.secondary', color: 'text.primary' },
          }}
        >
          <AddIcon sx={{ fontSize: '1.1rem', flexShrink: 0 }} />
          <Typography
            variant="body2"
            sx={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', fontWeight: 500, color: 'inherit' }}
          >
            {addLabel}
          </Typography>
        </ButtonBase>
      ) : null}

      {sortedHabits.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: 'center' }}>
          {emptyLabel}
        </Typography>
      ) : null}

      {sortedHabits.map((habit) => {
        const Icon = getIconByName(habit.icon);
        const selected = habit.id === selectedHabitId;
        const inactive = habit.activo === false;
        return (
          <ButtonBase
            key={habit.id}
            role="option"
            aria-selected={selected}
            onClick={() => onSelect?.(habit.id)}
            sx={{
              ...ROW_SX,
              borderColor: selected ? 'text.primary' : 'divider',
              opacity: inactive ? 0.55 : 1,
              '&:hover': { borderColor: selected ? 'text.primary' : 'text.secondary' },
            }}
          >
            {Icon ? (
              <Icon
                sx={{
                  fontSize: '1.1rem',
                  color: selected ? 'text.primary' : 'text.secondary',
                  flexShrink: 0,
                }}
              />
            ) : null}
            <Typography
              variant="body2"
              sx={{
                flex: 1,
                minWidth: 0,
                fontSize: '0.8125rem',
                fontWeight: selected ? 600 : 500,
                color: selected ? 'text.primary' : 'text.secondary',
                textDecoration: inactive ? 'line-through' : 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {habit.label}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

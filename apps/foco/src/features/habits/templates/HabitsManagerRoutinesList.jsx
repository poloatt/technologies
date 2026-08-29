import React, { useMemo } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { getChainDisplayLabel } from '@shared/habits';
import { HUB_SUBSECTION, hubSectionBg } from '@shared/styles/hubSectionStyles';

function getRoutineListItemSx({ selected = false } = {}) {
  return {
    borderRadius: HUB_SUBSECTION.borderRadius,
    bgcolor: hubSectionBg,
    border: '1px solid',
    borderColor: selected ? 'text.primary' : 'divider',
    boxShadow: 'none',
    transition: 'border-color 0.15s ease',
    cursor: 'pointer',
    '&:hover': {
      borderColor: selected ? 'text.primary' : 'text.secondary',
    },
  };
}

export default function HabitsManagerRoutinesList({
  habitChains = [],
  habits = {},
  selectedChainId,
  loading = false,
  onSelect,
}) {
  const stackChains = useMemo(
    () => (habitChains || []).filter(
      (chain) => chain?.type === 'stack'
        && Array.isArray(chain.steps)
        && chain.steps.length >= 2,
    ),
    [habitChains],
  );

  if (loading && stackChains.length === 0) {
    return (
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={44} sx={{ borderRadius: 1.5 }} />
        ))}
      </Box>
    );
  }

  if (stackChains.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No hay rutinas creadas
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Asigna hábitos a una rutina desde la vista de Hábitos
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      role="listbox"
      aria-label="Rutinas"
      sx={{
        overflowY: 'auto',
        minHeight: 0,
        flex: 1,
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
      }}
    >
      {stackChains.map((chain) => {
        const label = getChainDisplayLabel(chain, habits);
        const selected = selectedChainId === chain.id;
        const stepCount = chain.steps?.length || 0;

        return (
          <Box
            key={chain.id}
            role="option"
            aria-selected={selected}
            onClick={() => onSelect?.(chain.id)}
            sx={{
              ...getRoutineListItemSx({ selected }),
              px: 1.25,
              py: 1,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: selected ? 600 : 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stepCount} hábito{stepCount === 1 ? '' : 's'}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

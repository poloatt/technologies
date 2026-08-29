import React, { useMemo, useCallback } from 'react';
import { Box, Typography, Button, Skeleton } from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { getChainDisplayLabel, isGroupedRoutineChain } from '@shared/habits';
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

function RoutineMobileChip({
  chain,
  habits,
  selected,
  onSelect,
}) {
  const label = getChainDisplayLabel(chain, habits);
  const stepCount = chain.steps?.length || 0;

  return (
    <Box
      role="option"
      aria-selected={selected}
      aria-label={label}
      onClick={() => onSelect?.(chain.id)}
      sx={{
        ...getRoutineListItemSx({ selected }),
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        px: 1,
        py: 0.65,
        minWidth: 0,
        flex: '1 1 calc(50% - 4px)',
        maxWidth: '100%',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: selected ? 600 : 400,
          fontSize: '0.8125rem',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        {label}
      </Typography>
      {stepCount > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ lineHeight: 1.1, fontSize: '0.62rem' }}
        >
          {stepCount} háb.
        </Typography>
      )}
    </Box>
  );
}

function RoutinesMobileGrid({
  routineChains,
  habits,
  selectedChainId,
  onSelect,
}) {
  return (
    <Box
      role="listbox"
      aria-label="Rutinas"
      sx={{
        overflowY: 'auto',
        minHeight: 0,
        flex: 1,
        px: 1,
        py: 0.75,
        display: 'flex',
        flexWrap: 'wrap',
        alignContent: 'flex-start',
        gap: 0.5,
      }}
    >
      {routineChains.map((chain) => (
        <RoutineMobileChip
          key={chain.id}
          chain={chain}
          habits={habits}
          selected={selectedChainId === chain.id}
          onSelect={onSelect}
        />
      ))}
    </Box>
  );
}

function DraggableRoutineItem({
  chain,
  habits,
  selected,
  onSelect,
}) {
  const label = getChainDisplayLabel(chain, habits);
  const stepCount = chain.steps?.length || 0;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: chain.id });

  const { setNodeRef: setDropRef } = useDroppable({ id: chain.id });

  const setNodeRef = (node) => {
    setDragRef(node);
    setDropRef(node);
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 1 : 'auto',
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      role="option"
      aria-selected={selected}
      onClick={() => onSelect?.(chain.id)}
      sx={{
        ...getRoutineListItemSx({ selected }),
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.25,
        py: 1,
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        onClick={(event) => event.stopPropagation()}
        sx={{
          display: 'flex',
          alignItems: 'center',
          color: 'text.disabled',
          cursor: 'grab',
          touchAction: 'none',
          flexShrink: 0,
        }}
        aria-label={`Reordenar ${label}`}
      >
        <DragIndicatorIcon sx={{ fontSize: 18 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
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
    </Box>
  );
}

function RoutinesListBody({
  routineChains,
  habits,
  selectedChainId,
  onSelect,
  onReorder,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = routineChains.map((chain) => chain.id);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = [...ids];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    onReorder?.(reordered);
  }, [routineChains, onReorder]);

  const canSort = routineChains.length > 1 && typeof onReorder === 'function';

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
      {canSort ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {routineChains.map((chain) => (
            <DraggableRoutineItem
              key={chain.id}
              chain={chain}
              habits={habits}
              selected={selectedChainId === chain.id}
              onSelect={onSelect}
            />
          ))}
        </DndContext>
      ) : (
        routineChains.map((chain) => {
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
        })
      )}
    </Box>
  );
}

export default function HabitsManagerRoutinesList({
  habitChains = [],
  habits = {},
  selectedChainId,
  loading = false,
  onSelect,
  onReorder,
  isMobile = false,
  listExpanded = false,
  onToggleListExpanded,
}) {
  const routineChains = useMemo(
    () => (habitChains || []).filter(isGroupedRoutineChain),
    [habitChains],
  );

  const handleSelect = (chainId) => {
    onSelect?.(chainId);
    onToggleListExpanded?.(false);
  };

  if (loading && routineChains.length === 0) {
    return (
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={44} sx={{ borderRadius: 1.5 }} />
        ))}
      </Box>
    );
  }

  if (routineChains.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No hay rutinas creadas
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Usa el botón + para crear una rutina
        </Typography>
      </Box>
    );
  }

  if (!isMobile) {
    return (
      <RoutinesListBody
        routineChains={routineChains}
        habits={habits}
        selectedChainId={selectedChainId}
        onSelect={onSelect}
        onReorder={onReorder}
      />
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: '0 0 auto',
        minHeight: 0,
      }}
    >
      {!listExpanded ? null : (
        <Box
          sx={{
            maxHeight: 'min(36vh, 240px)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Elegir rutina
            </Typography>
            <Button
              size="small"
              onClick={() => onToggleListExpanded?.(false)}
              endIcon={<ExpandLessIcon sx={{ fontSize: '1.1rem !important' }} />}
              sx={{ textTransform: 'none', flexShrink: 0, minWidth: 'auto' }}
            >
              Ver menos
            </Button>
          </Box>
          <RoutinesMobileGrid
            routineChains={routineChains}
            habits={habits}
            selectedChainId={selectedChainId}
            onSelect={handleSelect}
          />
        </Box>
      )}
    </Box>
  );
}

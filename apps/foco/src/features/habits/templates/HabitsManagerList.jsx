import React from 'react';
import {
  Box,
  Typography,
  Button,
  Skeleton,
  Chip,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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
import { getIconByName } from '@shared/utils/iconConfig';
import { getFrecuenciaLabel } from '@shared/habits';
import { getTimeOfDayLabels } from '@shared/utils/timeOfDayUtils';
import { getHubSubsectionSx } from '@shared/styles/hubSectionStyles';
import { getHabitConfig } from '@shared/habits/form/habitsManagerUtils';

function CompactSelectedHabit({ habit, habitConfig, onToggleList }) {
  const Icon = getIconByName(habit?.icon);
  const cadenciaLabel = habit ? getFrecuenciaLabel(habitConfig) : '';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minWidth: 0,
      }}
    >
      {Icon && (
        <Icon sx={{ fontSize: '1.25rem', color: 'primary.main', flexShrink: 0 }} />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {habit?.label}
        </Typography>
        {cadenciaLabel && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {cadenciaLabel}
          </Typography>
        )}
      </Box>
      {onToggleList && (
        <Button
          size="small"
          onClick={onToggleList}
          endIcon={<ExpandMoreIcon sx={{ fontSize: '1.1rem !important' }} />}
          sx={{ textTransform: 'none', flexShrink: 0, minWidth: 'auto', px: 1 }}
        >
          Cambiar
        </Button>
      )}
    </Box>
  );
}

function DraggableHabitItem({
  habit,
  habitConfig,
  isSelected,
  onSelect,
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: habit.id });

  const { setNodeRef: setDropRef } = useDroppable({ id: habit.id });

  const setNodeRef = (node) => {
    setDragRef(node);
    setDropRef(node);
  };

  const Icon = getIconByName(habit.icon);
  const cadenciaLabel = getFrecuenciaLabel(habitConfig);
  const horariosLabel = habitConfig?.horarios?.length
    ? getTimeOfDayLabels(habitConfig.horarios)
    : null;

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
      aria-selected={isSelected}
      onClick={() => onSelect(habit.id)}
      sx={{
        ...getHubSubsectionSx({ selected: isSelected }),
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        mb: 0.75,
        cursor: 'pointer',
        opacity: habit.activo === false ? 0.55 : 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        '&:hover': {
          borderColor: 'primary.main',
        },
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        sx={{
          display: 'flex',
          alignItems: 'center',
          color: 'text.disabled',
          cursor: 'grab',
          touchAction: 'none',
          flexShrink: 0,
        }}
        aria-label={`Reordenar ${habit.label}`}
      >
        <DragIndicatorIcon sx={{ fontSize: 18 }} />
      </Box>
      {Icon && (
        <Icon
          sx={{
            fontSize: '1.2rem',
            color: habit.activo !== false ? 'primary.main' : 'text.disabled',
            flexShrink: 0,
          }}
        />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: habit.activo === false ? 'line-through' : 'none',
            color: habit.activo !== false ? 'text.primary' : 'text.disabled',
          }}
        >
          {habit.label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {cadenciaLabel}
          </Typography>
          {horariosLabel && (
            <Chip
              label={horariosLabel}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default function HabitsManagerList({
  habits,
  habitsConfig,
  currentSection,
  selectedHabitId,
  loading,
  sectionLabel,
  onSelect,
  onReorder,
  onAddClick,
  isMobile = false,
  listExpanded = false,
  onToggleListExpanded,
  showAddForm = false,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = habits.findIndex((h) => h.id === active.id);
    const newIndex = habits.findIndex((h) => h.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = [...habits];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    onReorder(reordered.map((h) => h.id));
  };

  const selectedHabit = habits.find((h) => h.id === selectedHabitId) || null;
  const selectedConfig = selectedHabit
    ? getHabitConfig(habitsConfig, currentSection, selectedHabit.id, selectedHabit)
    : null;
  const showMobilePicker = isMobile && habits.length > 0 && !showAddForm;
  const mobileCollapsed = showMobilePicker && !listExpanded;

  const handleSelect = (id) => {
    onSelect(id);
    if (isMobile && listExpanded) {
      onToggleListExpanded?.(false);
    }
  };

  const listContent = (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {habits.map((habit) => (
        <DraggableHabitItem
          key={habit.id}
          habit={habit}
          habitConfig={getHabitConfig(habitsConfig, currentSection, habit.id, habit)}
          isSelected={selectedHabitId === habit.id}
          onSelect={handleSelect}
        />
      ))}
    </DndContext>
  );

  if (loading && habits.length === 0) {
    return (
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={56} sx={{ borderRadius: 1.5 }} />
        ))}
      </Box>
    );
  }

  if (habits.length === 0) {
    return (
      <Box
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 1.5,
          minHeight: 160,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No hay hábitos en {sectionLabel}
        </Typography>
        <Button size="small" variant="outlined" onClick={onAddClick} sx={{ textTransform: 'none' }}>
          Agregar hábito
        </Button>
      </Box>
    );
  }

  return (
    <Box
      role="listbox"
      aria-label={`Hábitos de ${sectionLabel}`}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        flexShrink: 0,
        ...(isMobile ? { flex: '0 0 auto' } : { flex: 1 }),
      }}
    >
      {showMobilePicker && (
        <Box
          sx={{
            px: 1.5,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.default',
            flexShrink: 0,
          }}
        >
          {mobileCollapsed ? (
            selectedHabit ? (
              <CompactSelectedHabit
                habit={selectedHabit}
                habitConfig={selectedConfig}
                onToggleList={() => onToggleListExpanded?.(true)}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {habits.length} hábitos en {sectionLabel}
                </Typography>
                <Button
                  size="small"
                  onClick={() => onToggleListExpanded?.(true)}
                  sx={{ textTransform: 'none', flexShrink: 0 }}
                >
                  Ver todos
                </Button>
              </Box>
            )
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {habits.length} hábitos
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
          )}
        </Box>
      )}

      {(!isMobile || listExpanded) && (
        <Box
          sx={{
            p: 1.5,
            overflowY: 'auto',
            minHeight: 0,
            ...(isMobile
              ? { maxHeight: 'min(38vh, 260px)' }
              : { flex: 1 }),
          }}
        >
          {listContent}
        </Box>
      )}
    </Box>
  );
}

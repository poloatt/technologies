import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Skeleton,
  Collapse,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
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
import { getOutlineIconByName } from '@shared/utils/iconConfig';
import { groupHabitsIntoDisplayRows, getChainDisplayLabel } from '@shared/habits';
import { HUB_SUBSECTION, hubSectionBg } from '@shared/styles/hubSectionStyles';

const MOBILE_MOSAIC_ICON_SIZE = 36;
const MOBILE_MOSAIC_GAP = 0.15;

function MosaicIconButton({ habit, isSelected, onSelect }) {
  const Icon = getOutlineIconByName(habit.icon);
  const inactive = habit.activo === false;

  return (
    <Box
      component="button"
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-label={habit.label}
      onClick={() => onSelect(habit.id)}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: MOBILE_MOSAIC_ICON_SIZE,
        height: MOBILE_MOSAIC_ICON_SIZE,
        p: 0,
        m: 0,
        border: 'none',
        bgcolor: 'transparent',
        borderRadius: 0,
        cursor: 'pointer',
        opacity: inactive ? 0.45 : 1,
        color: isSelected
          ? 'primary.main'
          : (inactive ? 'text.disabled' : 'text.secondary'),
        flexShrink: 0,
        verticalAlign: 'middle',
        '&:hover': {
          color: inactive ? 'text.disabled' : 'text.primary',
        },
      }}
    >
      {Icon && (
        <Icon sx={{ fontSize: '1.35rem', display: 'block' }} />
      )}
    </Box>
  );
}

/** Recuadro de ítem en lista — selección sutil, sin brillo ni fill. */
function getHabitsManagerListItemSx({ selected = false } = {}) {
  return {
    borderRadius: HUB_SUBSECTION.borderRadius,
    bgcolor: hubSectionBg,
    border: '1px solid',
    borderColor: selected ? 'text.primary' : 'divider',
    boxShadow: 'none',
    backgroundImage: 'none',
    transition: 'border-color 0.15s ease',
    '&:hover': {
      borderColor: selected ? 'text.primary' : 'text.secondary',
    },
  };
}

/** Fila embebida (dentro de stack) — solo el hábito activo con borde sutil. */
function getHabitsManagerEmbeddedRowSx({ selected = false } = {}) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    p: 1,
    cursor: 'pointer',
    bgcolor: 'transparent',
    borderRadius: 1,
    border: '1px solid',
    borderColor: selected ? 'text.primary' : 'transparent',
    boxShadow: 'none',
    transition: 'border-color 0.15s ease',
    '&:hover': {
      borderColor: selected ? 'text.primary' : 'divider',
    },
  };
}

function DraggableHabitItem({
  habit,
  isSelected,
  onSelect,
  embedded = false,
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

  const Icon = getOutlineIconByName(habit.icon);

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 1 : 'auto',
  };

  const rowContent = (
    <>
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
            fontWeight: 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: habit.activo === false ? 'line-through' : 'none',
            color: habit.activo !== false ? 'text.primary' : 'text.disabled',
          }}
        >
          {habit.label}
        </Typography>
      </Box>
    </>
  );

  if (embedded) {
    return (
      <Box
        ref={setNodeRef}
        style={style}
        role="option"
        aria-selected={isSelected}
        onClick={() => onSelect(habit.id)}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          opacity: habit.activo === false ? 0.55 : 1,
        }}
      >
        <Box sx={getHabitsManagerEmbeddedRowSx({ selected: isSelected })}>
          {rowContent}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={setNodeRef}
      style={style}
      role="option"
      aria-selected={isSelected}
      onClick={() => onSelect(habit.id)}
      sx={{
        ...getHabitsManagerListItemSx({ selected: isSelected }),
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        mb: 0.75,
        cursor: 'pointer',
        opacity: habit.activo === false ? 0.55 : 1,
      }}
    >
      {rowContent}
    </Box>
  );
}

function MosaicStackCluster({
  entries,
  selectedHabitId,
  onSelect,
}) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.1,
        flexShrink: 0,
      }}
    >
      {entries.map((entry) => (
        <MosaicIconButton
          key={entry.habit.id}
          habit={entry.habit}
          isSelected={selectedHabitId === entry.habit.id}
          onSelect={onSelect}
        />
      ))}
    </Box>
  );
}

function HabitsManagerMobileMosaic({
  sections = [],
  allHabits = {},
  habitChains = [],
  selectedHabitId,
  onSelect,
  onCollapse,
}) {
  const handleSelect = (habitId, sectionId) => {
    onSelect(habitId, sectionId);
    onCollapse?.();
  };

  return (
    <Box sx={{ px: 0.75, py: 0.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {sections.map((section) => {
        const habits = allHabits[section.value] || [];
        const sortedHabits = [...habits].sort((a, b) => (a.orden || 0) - (b.orden || 0));
        if (!sortedHabits.length) return null;

        const displayRows = groupHabitsIntoDisplayRows(sortedHabits, section.value, habitChains);

        return (
          <Box
            key={section.value}
            sx={{
              position: 'relative',
              pt: 1.25,
            }}
          >
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1,
                px: 0.5,
                py: 0.125,
                fontWeight: 600,
                fontSize: '0.62rem',
                letterSpacing: '0.03em',
                lineHeight: 1,
                pointerEvents: 'none',
                bgcolor: (theme) => alpha(theme.palette.background.default, 0.88),
              }}
            >
              {section.label}
            </Typography>
            <Box
              role="listbox"
              aria-label={`Hábitos de ${section.label}`}
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                alignContent: 'flex-start',
                gap: MOBILE_MOSAIC_GAP,
                lineHeight: 0,
              }}
            >
              {displayRows.map((row) => {
                if (row.kind === 'stack') {
                  return (
                    <MosaicStackCluster
                      key={`stack-${section.value}-${row.chainId}`}
                      entries={row.entries}
                      selectedHabitId={selectedHabitId}
                      onSelect={(habitId) => handleSelect(habitId, section.value)}
                    />
                  );
                }

                const habit = row.entry.habit;
                return (
                  <MosaicIconButton
                    key={habit.id}
                    habit={habit}
                    isSelected={selectedHabitId === habit.id}
                    onSelect={(habitId) => handleSelect(habitId, section.value)}
                  />
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function HabitsManagerStackGroup({
  chainId,
  entries,
  habitChains,
  allHabits,
  selectedHabitId,
  onSelect,
}) {
  const chain = habitChains?.find((item) => item.id === chainId);
  const chainLabel = chain ? getChainDisplayLabel(chain, allHabits) : null;

  return (
    <Box
      data-habit-stack={chainId}
      sx={{
        ...getHabitsManagerListItemSx(),
        mb: 0.75,
        overflow: 'hidden',
      }}
    >
      {chainLabel && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            px: 1,
            pt: 0.75,
            pb: 0.25,
            fontSize: '0.65rem',
            fontWeight: 600,
            letterSpacing: '0.02em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {chainLabel}
        </Typography>
      )}
      {entries.map((entry) => (
        <DraggableHabitItem
          key={entry.habit.id}
          habit={entry.habit}
          isSelected={selectedHabitId === entry.habit.id}
          onSelect={onSelect}
          embedded
        />
      ))}
    </Box>
  );
}

function HabitsManagerSectionGroup({
  sectionId,
  sectionLabel,
  habits,
  expanded,
  onToggle,
  allHabits,
  habitChains,
  selectedHabitId,
  onSelect,
  onReorder,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const sortedHabits = useMemo(
    () => [...habits].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [habits],
  );

  const displayRows = useMemo(
    () => groupHabitsIntoDisplayRows(sortedHabits, sectionId, habitChains),
    [sortedHabits, sectionId, habitChains],
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedHabits.findIndex((h) => h.id === active.id);
    const newIndex = sortedHabits.findIndex((h) => h.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = [...sortedHabits];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    onReorder(sectionId, reordered.map((h) => h.id));
  };

  const handleSelect = (habitId) => {
    onSelect(habitId, sectionId);
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => onToggle(sectionId)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle(sectionId);
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.5,
          py: 1,
          cursor: 'pointer',
          bgcolor: expanded ? 'action.hover' : 'transparent',
          transition: 'background-color 0.15s ease',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontSize: '0.8125rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {sectionLabel}
        </Typography>
        <ExpandMoreIcon
          sx={{
            fontSize: '1.1rem',
            color: 'text.secondary',
            flexShrink: 0,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </Box>

      <Collapse in={expanded} timeout={200} unmountOnExit>
        <Box sx={{ px: 1, pb: 1, pt: 0.25 }}>
          {sortedHabits.length === 0 ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', px: 0.5, py: 0.75 }}
            >
              Sin hábitos
            </Typography>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              {displayRows.map((row) => {
                if (row.kind === 'stack') {
                  return (
                    <HabitsManagerStackGroup
                      key={`stack-${sectionId}-${row.chainId}`}
                      chainId={row.chainId}
                      entries={row.entries}
                      habitChains={habitChains}
                      allHabits={allHabits}
                      selectedHabitId={selectedHabitId}
                      onSelect={handleSelect}
                    />
                  );
                }

                const habit = row.entry.habit;
                return (
                  <DraggableHabitItem
                    key={habit.id}
                    habit={habit}
                    isSelected={selectedHabitId === habit.id}
                    onSelect={handleSelect}
                  />
                );
              })}
            </DndContext>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

export default function HabitsManagerList({
  sections = [],
  allHabits = {},
  habitChains = [],
  expandedSection,
  onSectionExpand,
  selectedHabitId,
  loading,
  onSelect,
  onReorder,
  onAddClick,
  isMobile = false,
  listExpanded = false,
  onToggleListExpanded,
  showAddForm = false,
}) {
  const totalHabits = useMemo(
    () => sections.reduce((count, section) => count + (allHabits[section.value]?.length || 0), 0),
    [sections, allHabits],
  );

  const accordionContent = sections.map((section) => (
    <HabitsManagerSectionGroup
      key={section.value}
      sectionId={section.value}
      sectionLabel={section.label}
      habits={allHabits[section.value] || []}
      expanded={expandedSection === section.value}
      onToggle={onSectionExpand}
      allHabits={allHabits}
      habitChains={habitChains}
      selectedHabitId={selectedHabitId}
      onSelect={onSelect}
      onReorder={onReorder}
    />
  ));

  if (loading && totalHabits === 0) {
    return (
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={44} sx={{ borderRadius: 1.5 }} />
        ))}
      </Box>
    );
  }

  if (totalHabits === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          flex: 1,
        }}
      >
        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {accordionContent}
        </Box>
      </Box>
    );
  }

  if (isMobile) {
    if (!listExpanded || totalHabits === 0) {
      return null;
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: '0 0 auto' }}>
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
            Elegir hábito
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
        <Box
          sx={{
            overflowY: 'auto',
            minHeight: 0,
            maxHeight: 'min(48vh, 360px)',
          }}
        >
          <HabitsManagerMobileMosaic
            sections={sections}
            allHabits={allHabits}
            habitChains={habitChains}
            selectedHabitId={selectedHabitId}
            onSelect={onSelect}
            onCollapse={() => onToggleListExpanded?.(false)}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        flex: 1,
      }}
    >
      <Box
        sx={{
          overflowY: 'auto',
          minHeight: 0,
          flex: 1,
        }}
      >
        {accordionContent}
      </Box>
    </Box>
  );
}


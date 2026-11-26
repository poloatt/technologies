import React, { useMemo, useState, useCallback } from 'react';
import { Box, ButtonBase, Tooltip, Typography } from '@mui/material';
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
import { getIconByName } from '@shared/utils/iconConfig';
import { buildHabitManagerSections } from '@shared/habits/form/habitsManagerUtils';
import { normalizeHabitStep, stepsEqual } from '@shared/habits';
import { HABIT_CHAIN_COPY } from '@shared/copy/agendaTerminology';
import HabitGroupTabs from './HabitGroupTabs.jsx';

function stepKey(section, habitId) {
  return `${section}:${habitId}`;
}

const PICKER_SECTION_LABEL_SX = {
  display: 'block',
  textAlign: 'center',
  px: 1.25,
  pb: 0.25,
  fontSize: '0.6875rem',
  fontWeight: 500,
  letterSpacing: '0.03em',
  color: 'text.secondary',
  flexShrink: 0,
};

const SELECTED_ICON_SIZE = 36;

/** Una sola fila horizontal con scroll (sin barra visible). */
const SELECTED_ICON_ROW_SX = {
  display: 'flex',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: 0.75,
  px: 1.25,
  pb: 0.75,
  overflowX: 'auto',
  overflowY: 'hidden',
  overscrollBehaviorX: 'contain',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
};

/** Convierte la rueda vertical en scroll horizontal cuando la fila desborda. */
function handleSelectedRowWheel(event) {
  const node = event.currentTarget;
  if (node.scrollWidth <= node.clientWidth) return;
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  node.scrollLeft += event.deltaY;
}

/**
 * Hábito incluido en la rutina, como icono: clic para quitarlo,
 * arrastrar (si `sortable`) para reordenar.
 */
function HabitPickIcon({
  habit,
  onToggle,
  sortable = false,
  stepId = null,
}) {
  const Icon = getIconByName(habit.icon);
  const habitId = habit.id || habit._id;
  const dragId = stepId || habitId;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: dragId, disabled: !sortable });
  const { setNodeRef: setDropRef } = useDroppable({ id: dragId, disabled: !sortable });

  const setNodeRef = sortable
    ? (node) => {
      setDragRef(node);
      setDropRef(node);
    }
    : undefined;

  const style = sortable
    ? {
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0.85 : 1,
      zIndex: isDragging ? 1 : 'auto',
    }
    : undefined;

  return (
    <Tooltip title={habit.label} arrow placement="top">
      <ButtonBase
        ref={setNodeRef}
        style={style}
        {...(sortable ? { ...attributes, ...listeners } : null)}
        role="option"
        aria-selected
        aria-label={`Quitar ${habit.label} de la rutina`}
        onClick={onToggle}
        sx={{
          flex: '0 0 auto',
          width: SELECTED_ICON_SIZE,
          height: SELECTED_ICON_SIZE,
          borderRadius: '50%',
          border: '1px solid',
          borderColor: 'text.primary',
          color: 'text.primary',
          bgcolor: 'transparent',
          cursor: sortable ? 'grab' : 'pointer',
          touchAction: sortable ? 'none' : 'manipulation',
          transition: 'border-color 0.15s ease, opacity 0.15s ease',
          '&:hover': { borderColor: 'text.secondary', opacity: 0.8 },
        }}
      >
        {Icon ? <Icon sx={{ fontSize: '1.2rem' }} /> : null}
      </ButtonBase>
    </Tooltip>
  );
}

function HabitPickRow({
  habit,
  selected,
  onToggle,
  sortable = false,
  stepId = null,
}) {
  const Icon = getIconByName(habit.icon);
  const habitId = habit.id || habit._id;
  const dragId = stepId || habitId;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: dragId, disabled: !sortable });

  const { setNodeRef: setDropRef } = useDroppable({ id: dragId, disabled: !sortable });

  const setNodeRef = sortable
    ? (node) => {
      setDragRef(node);
      setDropRef(node);
    }
    : undefined;

  const style = sortable
    ? {
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0.85 : 1,
      zIndex: isDragging ? 1 : 'auto',
    }
    : undefined;

  return (
    <Box
      ref={setNodeRef}
      style={style}
      role="option"
      aria-selected={selected}
      onClick={() => onToggle(habitId)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        width: '100%',
        px: 1.25,
        py: 0.75,
        mb: 0.5,
        borderRadius: 1.5,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: selected ? 'text.primary' : 'divider',
        bgcolor: 'transparent',
        boxShadow: 'none',
        transition: 'border-color 0.15s ease',
        '&:hover': {
          borderColor: selected ? 'text.primary' : 'text.secondary',
        },
      }}
    >
      {sortable && (
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
          aria-label={`Reordenar ${habit.label}`}
        >
          <DragIndicatorIcon sx={{ fontSize: 18 }} />
        </Box>
      )}
      {Icon && (
        <Icon
          sx={{
            fontSize: '1.1rem',
            color: selected ? 'text.primary' : 'text.secondary',
            flexShrink: 0,
          }}
        />
      )}
      <Typography
        variant="body2"
        sx={{
          fontWeight: selected ? 600 : 500,
          color: selected ? 'text.primary' : 'text.secondary',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
          fontSize: '0.8125rem',
        }}
      >
        {habit.label}
      </Typography>
    </Box>
  );
}

/**
 * Multi-select minimal de hábitos con pestañas por grupo.
 */
export default function HabitChainAfterPicker({
  habits = {},
  customSections = [],
  linkedSteps = [],
  onChange,
  excludeSection = '',
  excludeHabitId = null,
  flat = false,
  fillHeight = false,
  pinSelectedAboveGroups = false,
  sortableSelected = false,
}) {
  const sections = useMemo(
    () => buildHabitManagerSections(customSections),
    [customSections],
  );

  const habitsBySection = useMemo(() => {
    const map = {};
    sections.forEach(({ value }) => {
      map[value] = (habits[value] || [])
        .filter((h) => h?.activo !== false)
        .filter((h) => {
          const id = h.id || h._id;
          if (!id) return false;
          if (value === excludeSection && id === excludeHabitId) return false;
          return true;
        })
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));
    });
    return map;
  }, [habits, sections, excludeSection, excludeHabitId]);

  const sectionsWithHabits = useMemo(
    () => sections.filter(({ value }) => (habitsBySection[value]?.length || 0) > 0),
    [sections, habitsBySection],
  );

  const normalizedSteps = useMemo(
    () => (linkedSteps || []).map(normalizeHabitStep).filter(Boolean),
    [linkedSteps],
  );

  const selectedKeys = useMemo(
    () => new Set(normalizedSteps.map((step) => stepKey(step.section, step.habitId))),
    [normalizedSteps],
  );

  const selectedEntries = useMemo(
    () => normalizedSteps.map((step) => {
      const sectionHabits = habitsBySection[step.section] || [];
      const habit = sectionHabits.find((entry) => (entry.id || entry._id) === step.habitId);
      if (!habit) return null;
      return { habit, section: step.section };
    }).filter(Boolean),
    [normalizedSteps, habitsBySection],
  );

  // Las pestañas y la lista de cada grupo incluyen siempre todos sus hábitos;
  // los incluidos en la rutina solo se ven marcados.
  const sectionsForTabs = sectionsWithHabits;

  const [activeSection, setActiveSection] = useState(
    () => sectionsForTabs[0]?.value || sectionsWithHabits[0]?.value || sections[0]?.value || 'bodyCare',
  );

  React.useEffect(() => {
    if (!sectionsForTabs.some(({ value }) => value === activeSection)) {
      setActiveSection(sectionsForTabs[0]?.value || sectionsWithHabits[0]?.value || sections[0]?.value || 'bodyCare');
    }
  }, [activeSection, sectionsForTabs, sectionsWithHabits, sections]);

  const tabsStickySx = {
    position: fillHeight ? 'relative' : 'sticky',
    top: 0,
    zIndex: 1,
  };

  const visibleHabits = habitsBySection[activeSection] || [];

  const toggleHabit = (section, habitId) => {
    const step = { section, habitId };
    const key = stepKey(section, habitId);
    const current = normalizedSteps;

    if (selectedKeys.has(key)) {
      onChange?.(current.filter((s) => !stepsEqual(s, step)));
      return;
    }
    onChange?.([...current, step]);
  };

  const selectedSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleSelectedDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = normalizedSteps.map((step) => stepKey(step.section, step.habitId));
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = [...normalizedSteps];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    onChange?.(reordered);
  }, [normalizedSteps, onChange]);

  const canSortSelected = sortableSelected && pinSelectedAboveGroups && selectedEntries.length > 1;

  if (sectionsWithHabits.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        {HABIT_CHAIN_COPY.noHabitsAvailable}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        display: fillHeight ? 'flex' : 'block',
        flexDirection: fillHeight ? 'column' : undefined,
        flex: fillHeight ? 1 : undefined,
        minHeight: fillHeight ? 0 : undefined,
        ...(flat
          ? { bgcolor: 'transparent', border: 'none', borderRadius: 0 }
          : {
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            bgcolor: 'background.default',
          }),
        overflow: 'hidden',
      }}
    >
      {pinSelectedAboveGroups && (
        <Box sx={{ flexShrink: 0, pt: 0.25 }}>
          <Typography variant="caption" sx={PICKER_SECTION_LABEL_SX}>
            {HABIT_CHAIN_COPY.routineHabitsLabel}
          </Typography>
          {selectedEntries.length > 0 && (
            <Box
              role="listbox"
              aria-multiselectable="true"
              aria-orientation="horizontal"
              aria-label={HABIT_CHAIN_COPY.routineHabitsLabel}
              onWheel={handleSelectedRowWheel}
              sx={SELECTED_ICON_ROW_SX}
            >
              {canSortSelected ? (
                <DndContext
                  sensors={selectedSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSelectedDragEnd}
                >
                  {selectedEntries.map(({ habit, section }) => {
                    const habitId = habit.id || habit._id;
                    const id = stepKey(section, habitId);
                    return (
                      <HabitPickIcon
                        key={id}
                        habit={habit}
                        stepId={id}
                        sortable
                        onToggle={() => toggleHabit(section, habitId)}
                      />
                    );
                  })}
                </DndContext>
              ) : (
                selectedEntries.map(({ habit, section }) => {
                  const habitId = habit.id || habit._id;
                  return (
                    <HabitPickIcon
                      key={stepKey(section, habitId)}
                      habit={habit}
                      onToggle={() => toggleHabit(section, habitId)}
                    />
                  );
                })
              )}
            </Box>
          )}
        </Box>
      )}

      {pinSelectedAboveGroups && sectionsForTabs.length > 0 ? (
        <Box
          sx={{
            display: fillHeight ? 'flex' : 'block',
            flexDirection: fillHeight ? 'column' : undefined,
            flex: fillHeight ? 1 : undefined,
            minHeight: fillHeight ? 0 : undefined,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              ...PICKER_SECTION_LABEL_SX,
              pt: 0.75,
            }}
          >
            {HABIT_CHAIN_COPY.addHabitsLabel}
          </Typography>
          <HabitGroupTabs
            sections={sectionsForTabs}
            value={activeSection}
            onChange={setActiveSection}
            sx={tabsStickySx}
          />
          <Box
            role="listbox"
            aria-multiselectable="true"
            aria-label={HABIT_CHAIN_COPY.addHabitsLabel}
            sx={{
              pt: 0.75,
              pb: 0.25,
              flex: fillHeight ? 1 : undefined,
              minHeight: fillHeight ? 0 : undefined,
              maxHeight: fillHeight ? undefined : 200,
              overflowY: 'auto',
            }}
          >
            {visibleHabits.map((habit) => {
              const habitId = habit.id || habit._id;
              const key = stepKey(activeSection, habitId);
              return (
                <HabitPickRow
                  key={key}
                  habit={habit}
                  selected={selectedKeys.has(key)}
                  onToggle={(id) => toggleHabit(activeSection, id)}
                />
              );
            })}

            {visibleHabits.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: 'center' }}>
                {HABIT_CHAIN_COPY.emptySection}
              </Typography>
            )}
          </Box>
        </Box>
      ) : (
        <>
          {sectionsForTabs.length > 0 && (
            <HabitGroupTabs
              sections={sectionsForTabs}
              value={activeSection}
              onChange={setActiveSection}
              sx={tabsStickySx}
            />
          )}

          <Box
            role="listbox"
            aria-multiselectable="true"
            aria-label={HABIT_CHAIN_COPY.pickLabel}
            sx={{
              pt: 0.75,
              pb: 0.25,
              flex: fillHeight ? 1 : undefined,
              minHeight: fillHeight ? 0 : undefined,
              maxHeight: fillHeight ? undefined : 200,
              overflowY: 'auto',
            }}
          >
            {visibleHabits.map((habit) => {
              const habitId = habit.id || habit._id;
              const key = stepKey(activeSection, habitId);
              return (
                <HabitPickRow
                  key={key}
                  habit={habit}
                  selected={selectedKeys.has(key)}
                  onToggle={(id) => toggleHabit(activeSection, id)}
                />
              );
            })}

            {visibleHabits.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: 'center' }}>
                {HABIT_CHAIN_COPY.emptySection}
              </Typography>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}

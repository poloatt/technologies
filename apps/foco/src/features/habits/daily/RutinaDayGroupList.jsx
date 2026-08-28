import React, { useCallback, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import ChecklistItem from './ChecklistItem';
import SortableRutinaHabitRow from './SortableRutinaHabitRow';
import { RUTINA_DAY_GROUP_COPY } from '@shared/copy/agendaTerminology';
import { isHabitCompletedForHistorial } from '@shared/habits';

const GROUP_HEADING_SX = {
  px: 0.5,
  py: 0.75,
  fontWeight: 600,
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontSize: '0.7rem',
};

function buildSectionReorderIds(sectionHabits = [], reorderedVisibleIds = []) {
  const allIds = (sectionHabits || [])
    .map((habit) => habit?.id || habit?._id)
    .filter(Boolean);
  const visibleSet = new Set(reorderedVisibleIds);
  const trailingIds = allIds.filter((id) => !visibleSet.has(id));
  return [...reorderedVisibleIds, ...trailingIds];
}

function StaticHabitRow({
  entry,
  section,
  rutina,
  readOnly,
  onItemClick,
  onEditHabit,
  localData,
}) {
  const { itemId, Icon, label, config, userHabit } = entry;
  const itemValue = localData?.[itemId] !== undefined
    ? localData[itemId]
    : rutina?.[section]?.[itemId];
  const isCompleted = isHabitCompletedForHistorial(itemValue);

  return (
    <Box key={itemId} id={`habit-row-${itemId}`}>
      <ChecklistItem
        itemId={itemId}
        section={section}
        Icon={Icon}
        isCompleted={isCompleted}
        completionValue={itemValue}
        readOnly={readOnly}
        onItemClick={onItemClick}
        config={config}
        habitLabel={label}
        isCustomHabit={Boolean(userHabit)}
        localData={localData}
        onEditHabit={userHabit && onEditHabit ? () => onEditHabit(userHabit, section) : undefined}
      />
    </Box>
  );
}

function HabitRows({
  items,
  section,
  rutina,
  readOnly,
  onItemClick,
  onEditHabit,
  localData,
  sortable = false,
}) {
  if (!items.length) return null;

  if (sortable) {
    return items.map((entry) => (
      <SortableRutinaHabitRow
        key={entry.itemId}
        entry={entry}
        section={section}
        rutina={rutina}
        readOnly={readOnly}
        onItemClick={onItemClick}
        onEditHabit={onEditHabit}
        localData={localData}
      />
    ));
  }

  return items.map((entry) => (
    <StaticHabitRow
      key={entry.itemId}
      entry={entry}
      section={section}
      rutina={rutina}
      readOnly={readOnly}
      onItemClick={onItemClick}
      onEditHabit={onEditHabit}
      localData={localData}
    />
  ));
}

/**
 * Listado agrupado: Hoy y No toca hoy. Soporta reorden vertical por drag en grupo expandido.
 */
export default function RutinaDayGroupList({
  today = [],
  notToday = [],
  section,
  rutina,
  readOnly = false,
  sortable = false,
  sectionHabits = [],
  onReorder,
  onItemClick,
  onEditHabit,
  localData = null,
}) {
  const hasToday = today.length > 0;
  const visibleItems = useMemo(() => [...today, ...notToday], [today, notToday]);
  const canSort = sortable && !readOnly && visibleItems.length > 1 && typeof onReorder === 'function';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = visibleItems.findIndex((entry) => entry.itemId === active.id);
    const newIndex = visibleItems.findIndex((entry) => entry.itemId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedVisible = [...visibleItems];
    const [moved] = reorderedVisible.splice(oldIndex, 1);
    reorderedVisible.splice(newIndex, 0, moved);

    onReorder(buildSectionReorderIds(sectionHabits, reorderedVisible.map((entry) => entry.itemId)));
  }, [onReorder, sectionHabits, visibleItems]);

  const listBody = (
    <>
      {hasToday && (
        <Box>
          <Typography variant="caption" sx={GROUP_HEADING_SX}>
            {RUTINA_DAY_GROUP_COPY.today}
          </Typography>
          <HabitRows
            items={today}
            section={section}
            rutina={rutina}
            readOnly={readOnly}
            onItemClick={onItemClick}
            onEditHabit={onEditHabit}
            localData={localData}
            sortable={canSort}
          />
        </Box>
      )}
      {notToday.length > 0 && (
        <Box>
          <Typography variant="caption" sx={GROUP_HEADING_SX}>
            {RUTINA_DAY_GROUP_COPY.notToday}
          </Typography>
          <HabitRows
            items={notToday}
            section={section}
            rutina={rutina}
            readOnly={readOnly}
            onItemClick={onItemClick}
            onEditHabit={onEditHabit}
            localData={localData}
            sortable={canSort}
          />
        </Box>
      )}
    </>
  );

  if (!canSort) {
    return listBody;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {listBody}
    </DndContext>
  );
}

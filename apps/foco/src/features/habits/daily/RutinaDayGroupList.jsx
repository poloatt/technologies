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
import RutinaDoneCarousel from './RutinaDoneCarousel';
import { RUTINA_DAY_GROUP_COPY } from '@shared/copy/agendaTerminology';
import { isHabitCompletedForHistorial, isHabitHorarioCompleted, resolveEntryFranjaFocusHorario } from '@shared/habits';

const GROUP_HEADING_SX = {
  px: 0.5,
  py: 0.75,
  fontWeight: 600,
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontSize: '0.7rem',
};

const FRANJA_GROUP_HEADING_SX = {
  ...GROUP_HEADING_SX,
  textTransform: 'none',
  letterSpacing: '0.02em',
  fontSize: '0.75rem',
};

function buildSectionReorderIds(sectionHabits = [], reorderedVisibleIds = []) {
  const allIds = (sectionHabits || [])
    .map((habit) => habit?.id || habit?._id)
    .filter(Boolean);
  const visibleSet = new Set(reorderedVisibleIds);
  const trailingIds = allIds.filter((id) => !visibleSet.has(id));
  return [...reorderedVisibleIds, ...trailingIds];
}

function resolveEntrySection(entry, fallbackSection) {
  return entry?.section || fallbackSection;
}

function resolveEntryLocalData(entry, fallbackSection, localData, localDataBySection) {
  const section = resolveEntrySection(entry, fallbackSection);
  if (localDataBySection && section) {
    return localDataBySection[section] || null;
  }
  return localData;
}

function resolveEntryFocusHorario(entry) {
  return resolveEntryFranjaFocusHorario(entry);
}

function StaticHabitRow({
  entry,
  section,
  rutina,
  readOnly,
  onItemClick,
  onEditHabit,
  localData,
  localDataBySection = null,
  rowKey = null,
  multiSection = false,
}) {
  const entrySection = resolveEntrySection(entry, section);
  const entryLocalData = resolveEntryLocalData(entry, section, localData, localDataBySection);
  const focusHorario = resolveEntryFocusHorario(entry);
  const { itemId, Icon, label, config, userHabit } = entry;
  const itemValue = entryLocalData?.[itemId] !== undefined
    ? entryLocalData[itemId]
    : rutina?.[entrySection]?.[itemId];
  const isCompleted = focusHorario
    ? isHabitHorarioCompleted(itemValue, focusHorario)
    : isHabitCompletedForHistorial(itemValue);

  const handleItemClick = (clickedItemId, event, horario) => {
    const resolvedHorario = horario ?? focusHorario ?? null;
    if (multiSection) {
      onItemClick(clickedItemId, event, resolvedHorario, entrySection);
      return;
    }
    onItemClick(clickedItemId, event, resolvedHorario);
  };

  return (
    <Box key={rowKey || `${entrySection}-${itemId}`} id={`habit-row-${entrySection}-${itemId}`}>
      <ChecklistItem
        itemId={itemId}
        section={entrySection}
        Icon={Icon}
        isCompleted={isCompleted}
        completionValue={itemValue}
        readOnly={readOnly}
        onItemClick={handleItemClick}
        config={config}
        habitLabel={label}
        isCustomHabit={Boolean(userHabit)}
        localData={entryLocalData}
        focusHorario={focusHorario}
        onEditHabit={userHabit && onEditHabit ? () => onEditHabit(userHabit, entrySection) : undefined}
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
  localDataBySection = null,
  sortable = false,
  rowKeyPrefix = '',
  multiSection = false,
}) {
  if (!items.length) return null;

  if (sortable) {
    return items.map((entry) => {
      const entrySection = resolveEntrySection(entry, section);
      return (
        <SortableRutinaHabitRow
          key={rowKeyPrefix ? `${rowKeyPrefix}-${entrySection}-${entry.itemId}` : `${entrySection}-${entry.itemId}`}
          entry={entry}
          section={entrySection}
          rutina={rutina}
          readOnly={readOnly}
          onItemClick={onItemClick}
          onEditHabit={onEditHabit}
          localData={resolveEntryLocalData(entry, section, localData, localDataBySection)}
        />
      );
    });
  }

  return items.map((entry) => (
    <StaticHabitRow
      key={rowKeyPrefix ? `${rowKeyPrefix}-${resolveEntrySection(entry, section)}-${entry.itemId}` : `${resolveEntrySection(entry, section)}-${entry.itemId}`}
      rowKey={rowKeyPrefix ? `${rowKeyPrefix}-${resolveEntrySection(entry, section)}-${entry.itemId}` : null}
      entry={entry}
      section={section}
      rutina={rutina}
      readOnly={readOnly}
      onItemClick={onItemClick}
      onEditHabit={onEditHabit}
      localData={localData}
      localDataBySection={localDataBySection}
      multiSection={multiSection}
    />
  ));
}

/**
 * Listado agrupado: Hoy y No toca hoy. Soporta reorden vertical por drag en grupo expandido.
 * Con `sectionLabel` + `useFranjaHeadings`, el encabezado es directo: "Esta mañana".
 */
export default function RutinaDayGroupList({
  today = [],
  done = [],
  notToday = [],
  section,
  rutina,
  readOnly = false,
  sortable = false,
  sectionHabits = [],
  onReorder,
  onItemClick,
  onEditHabit,
  onDoneToggle,
  localData = null,
  localDataBySection = null,
  habitsPreferences = {},
  sectionLabel = null,
  multiSection = false,
  useFranjaHeadings = false,
  rowKeyPrefix = '',
  hideDone = false,
}) {
  const hasToday = today.length > 0;
  const hasDone = done.length > 0;
  const visibleItems = useMemo(() => [...today, ...notToday], [today, notToday]);
  const canSort = !multiSection
    && sortable
    && !readOnly
    && visibleItems.length > 1
    && typeof onReorder === 'function'
    && section;

  const formatGroupHeading = (dayGroupLabel) => {
    if (useFranjaHeadings && dayGroupLabel === RUTINA_DAY_GROUP_COPY.notToday) {
      return RUTINA_DAY_GROUP_COPY.notToday;
    }
    if (useFranjaHeadings && sectionLabel && dayGroupLabel === RUTINA_DAY_GROUP_COPY.today) {
      return sectionLabel;
    }
    if (sectionLabel) {
      return `${sectionLabel} de ${dayGroupLabel}`;
    }
    return dayGroupLabel;
  };

  const todayHeadingSx = useFranjaHeadings ? FRANJA_GROUP_HEADING_SX : GROUP_HEADING_SX;

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

  const handleDoneToggle = useCallback((itemSection, itemId, horario) => {
    if (multiSection) {
      onDoneToggle?.(itemSection, itemId, null, horario);
      return;
    }
    onDoneToggle?.(itemId, null, horario);
  }, [multiSection, onDoneToggle]);

  const listBody = (
    <>
      {hasToday && (
        <Box>
          {!useFranjaHeadings && (
            <Typography variant="caption" sx={todayHeadingSx}>
              {formatGroupHeading(RUTINA_DAY_GROUP_COPY.today)}
            </Typography>
          )}
          {useFranjaHeadings && sectionLabel && (
            <Typography variant="caption" sx={todayHeadingSx}>
              {sectionLabel}
            </Typography>
          )}
          <HabitRows
            items={today}
            section={section}
            rutina={rutina}
            readOnly={readOnly}
            onItemClick={onItemClick}
            onEditHabit={onEditHabit}
            localData={localData}
            localDataBySection={localDataBySection}
            sortable={canSort}
            rowKeyPrefix={rowKeyPrefix}
            multiSection={multiSection}
          />
        </Box>
      )}
      {notToday.length > 0 && (
        <Box sx={{ mt: hasToday ? 0.5 : 0 }}>
          <Typography variant="caption" sx={GROUP_HEADING_SX}>
            {formatGroupHeading(RUTINA_DAY_GROUP_COPY.notToday)}
          </Typography>
          <HabitRows
            items={notToday}
            section={section}
            rutina={rutina}
            readOnly={readOnly}
            onItemClick={onItemClick}
            onEditHabit={onEditHabit}
            localData={localData}
            localDataBySection={localDataBySection}
            sortable={canSort}
            rowKeyPrefix={rowKeyPrefix}
            multiSection={multiSection}
          />
        </Box>
      )}
      {!hideDone && hasDone && (
        <Box sx={{ mt: (hasToday || notToday.length > 0) ? 0.5 : 0 }}>
          <Typography variant="caption" sx={GROUP_HEADING_SX}>
            {RUTINA_DAY_GROUP_COPY.done}
          </Typography>
          <RutinaDoneCarousel
            items={done}
            rutina={rutina}
            habitsPreferences={habitsPreferences}
            readOnly={readOnly}
            onToggle={handleDoneToggle}
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

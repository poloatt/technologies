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
import ChecklistItem from '../../components/ChecklistItem';
import SortableRutinaHabitRow from '../../components/SortableRutinaHabitRow';
import SortableRutinaStackHabitRow from '../../components/SortableRutinaStackHabitRow';
import RutinaStackHabitRow from '../../components/RutinaStackHabitRow';
import RutinaDoneSection from './RutinaDoneSection';
import RutinaFranjaIconCarousel from '../cadence/RutinaFranjaIconCarousel';
import { RUTINA_DAY_GROUP_COPY, DAILY_CADENCE_SECTION_COPY } from '@shared/copy/agendaTerminology';
import {
  isHabitCompletedForHistorial,
  isHabitHorarioCompleted,
  resolveEntryFranjaFocusHorario,
  getHabitDisplayLabel,
  groupEntriesIntoDisplayRows,
  reorderFlatEntriesByDisplayRowDnD,
} from '@shared/habits';
import { VALID_TIME_OF_DAY } from '@shared/utils/timeOfDayUtils';

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

function buildMultiSectionReorderUpdates(visibleItems, reorderedIds, habits = {}, fallbackSection = null) {
  const idToSection = new Map();
  visibleItems.forEach((entry) => {
    idToSection.set(entry.itemId, resolveEntrySection(entry, fallbackSection));
  });

  const bySection = {};
  reorderedIds.forEach((id) => {
    const sec = idToSection.get(id);
    if (!sec) return;
    if (!bySection[sec]) bySection[sec] = [];
    bySection[sec].push(id);
  });

  return Object.entries(bySection).map(([entrySection, orderedVisibleIds]) => ({
    section: entrySection,
    habitIds: buildSectionReorderIds(habits?.[entrySection] || [], orderedVisibleIds),
  }));
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
  habits = null,
  readOnly,
  onItemClick,
  localData,
  localDataBySection = null,
  rowKey = null,
  multiSection = false,
  stackCell = false,
  hideChainBadge = false,
  hideMeta = false,
}) {
  const entrySection = resolveEntrySection(entry, section);
  const entryLocalData = resolveEntryLocalData(entry, section, localData, localDataBySection);
  const focusHorario = resolveEntryFocusHorario(entry);
  const { itemId, Icon, label, config, chain } = entry;
  const prevStepLabel = chain?.prevStep
    ? getHabitDisplayLabel(chain.prevStep.section, chain.prevStep.habitId, habits)
    : '';
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
    <Box
      key={rowKey || `${entrySection}-${itemId}`}
      id={stackCell ? undefined : `habit-row-${entrySection}-${itemId}`}
    >
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
        localData={entryLocalData}
        focusHorario={focusHorario}
        chain={chain}
        prevStepLabel={prevStepLabel}
        stackCell={stackCell}
        hideChainBadge={hideChainBadge}
        hideMeta={hideMeta}
      />
    </Box>
  );
}

function HabitRows({
  items,
  section,
  rutina,
  habits = null,
  readOnly,
  onItemClick,
  localData,
  localDataBySection = null,
  sortable = false,
  rowKeyPrefix = '',
  multiSection = false,
  stackVariant = 'inline',
}) {
  const displayRows = useMemo(() => groupEntriesIntoDisplayRows(items), [items]);

  if (!displayRows.length) return null;

  if (sortable) {
    return displayRows.map((row) => {
      if (row.kind === 'stack') {
        return (
          <SortableRutinaStackHabitRow
            key={rowKeyPrefix ? `${rowKeyPrefix}-stack-${row.chainId}` : `stack-${row.chainId}`}
            chainId={row.chainId}
            entries={row.entries}
            section={section}
            rutina={rutina}
            habits={habits}
            readOnly={readOnly}
            onItemClick={onItemClick}
            localData={localData}
            localDataBySection={localDataBySection}
            rowKeyPrefix={rowKeyPrefix}
            multiSection={multiSection}
            stackVariant={stackVariant}
          />
        );
      }

      const entry = row.entry;
      const entrySection = resolveEntrySection(entry, section);
      return (
        <SortableRutinaHabitRow
          key={rowKeyPrefix ? `${rowKeyPrefix}-${entrySection}-${entry.itemId}` : `${entrySection}-${entry.itemId}`}
          entry={entry}
          section={entrySection}
          rutina={rutina}
          readOnly={readOnly}
          onItemClick={onItemClick}
          habits={habits}
          localData={resolveEntryLocalData(entry, section, localData, localDataBySection)}
        />
      );
    });
  }

  return displayRows.map((row) => {
    if (row.kind === 'stack') {
      return (
        <RutinaStackHabitRow
          key={rowKeyPrefix ? `${rowKeyPrefix}-stack-${row.chainId}` : `stack-${row.chainId}`}
          chainId={row.chainId}
          entries={row.entries}
          section={section}
          rutina={rutina}
          habits={habits}
          readOnly={readOnly}
          onItemClick={onItemClick}
          localData={localData}
          localDataBySection={localDataBySection}
          rowKeyPrefix={rowKeyPrefix}
          multiSection={multiSection}
          stackVariant={stackVariant}
        />
      );
    }

    const entry = row.entry;
    return (
      <StaticHabitRow
        key={rowKeyPrefix ? `${rowKeyPrefix}-${resolveEntrySection(entry, section)}-${entry.itemId}` : `${resolveEntrySection(entry, section)}-${entry.itemId}`}
        rowKey={rowKeyPrefix ? `${rowKeyPrefix}-${resolveEntrySection(entry, section)}-${entry.itemId}` : null}
        entry={entry}
        section={section}
        rutina={rutina}
        habits={habits}
        readOnly={readOnly}
        onItemClick={onItemClick}
        localData={localData}
        localDataBySection={localDataBySection}
        multiSection={multiSection}
      />
    );
  });
}

/**
 * Listado agrupado: Hoy y No toca hoy. Soporta reorden vertical por drag en grupo expandido.
 * Con `sectionLabel` + `useFranjaHeadings`, el encabezado es directo: "Esta mañana".
 */
export default function RutinaDayGroupList({
  today = [],
  done = [],
  notToday = [],
  sinHacer = [],
  luego = [],
  section,
  rutina,
  readOnly = false,
  sortable = false,
  habits = null,
  sectionHabits = [],
  onReorder,
  onReorderSection,
  onItemClick,
  onDoneToggle,
  localData = null,
  localDataBySection = null,
  habitsPreferences = {},
  sectionLabel = null,
  multiSection = false,
  useFranjaHeadings = false,
  useSectionFranjaLayout = false,
  activeFranja = 'MAÑANA',
  activeFranjaLabel = null,
  rowKeyPrefix = '',
  hideDone = false,
  hideGroupHeadings = false,
  stackVariant = 'inline',
}) {
  const hasToday = today.length > 0;
  const hasDone = done.length > 0;
  const visibleItems = useMemo(() => [...today, ...notToday], [today, notToday]);
  const sortableDisplayRows = useMemo(
    () => groupEntriesIntoDisplayRows(visibleItems),
    [visibleItems],
  );
  const canSort = sortable
    && !readOnly
    && sortableDisplayRows.length > 1
    && (
      (multiSection && typeof onReorderSection === 'function')
      || (!multiSection && typeof onReorder === 'function' && section)
    );

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

    const reorderedIds = reorderFlatEntriesByDisplayRowDnD(visibleItems, active.id, over.id);
    if (!reorderedIds) return;

    if (multiSection && onReorderSection) {
      buildMultiSectionReorderUpdates(visibleItems, reorderedIds, habits, section)
        .forEach(({ section: entrySection, habitIds }) => {
          onReorderSection(entrySection, habitIds);
        });
      return;
    }

    onReorder?.(buildSectionReorderIds(sectionHabits, reorderedIds));
  }, [multiSection, onReorderSection, habits, section, onReorder, sectionHabits, visibleItems]);

  const handleDoneToggle = useCallback((itemSection, itemId, horario) => {
    if (multiSection) {
      onDoneToggle?.(itemSection, itemId, null, horario);
      return;
    }
    onDoneToggle?.(itemId, null, horario);
  }, [multiSection, onDoneToggle]);

  const handleCarouselToggle = useCallback((entrySection, itemId, horario) => {
    if (multiSection) {
      onItemClick?.(itemId, null, horario, entrySection);
      return;
    }
    onItemClick?.(itemId, null, horario);
  }, [multiSection, onItemClick]);

  const luegoByFranja = useMemo(() => {
    if (!useSectionFranjaLayout || luego.length === 0) return [];
    const map = Object.fromEntries(VALID_TIME_OF_DAY.map((key) => [key, []]));
    luego.forEach((entry) => {
      const key = entry?.franjaKey;
      if (key && map[key]) map[key].push(entry);
    });
    return VALID_TIME_OF_DAY
      .map((franjaKey) => ({ franjaKey, items: map[franjaKey] }))
      .filter((group) => group.items.length > 0);
  }, [useSectionFranjaLayout, luego]);

  const listBody = (
    <>
      {useSectionFranjaLayout && sinHacer.length > 0 && (
        <Box sx={{ mb: hasToday || luegoByFranja.length ? 0.5 : 0 }}>
          <Typography variant="caption" sx={FRANJA_GROUP_HEADING_SX}>
            {DAILY_CADENCE_SECTION_COPY.sinHacer}
          </Typography>
          <RutinaFranjaIconCarousel
            pending={sinHacer}
            franjaKey="SIN_HACER"
            activeFranjaKey={activeFranja}
            rutina={rutina}
            habitsPreferences={habitsPreferences}
            readOnly={readOnly}
            onToggle={handleCarouselToggle}
            centerWhenFits={useSectionFranjaLayout ? false : undefined}
          />
        </Box>
      )}
      {hasToday && (
        <Box>
          {useSectionFranjaLayout && activeFranjaLabel && (
            <Typography variant="caption" sx={FRANJA_GROUP_HEADING_SX}>
              {activeFranjaLabel}
            </Typography>
          )}
          {useFranjaHeadings && sectionLabel && (
            <Typography variant="caption" sx={todayHeadingSx}>
              {sectionLabel}
            </Typography>
          )}
          {!hideGroupHeadings && !useFranjaHeadings && !useSectionFranjaLayout && (
            <Typography variant="caption" sx={todayHeadingSx}>
              {formatGroupHeading(RUTINA_DAY_GROUP_COPY.today)}
            </Typography>
          )}
          <HabitRows
            items={today}
            section={section}
            rutina={rutina}
            habits={habits}
            readOnly={readOnly}
            onItemClick={onItemClick}
            localData={localData}
            localDataBySection={localDataBySection}
            sortable={canSort}
            rowKeyPrefix={rowKeyPrefix}
            multiSection={multiSection}
            stackVariant={stackVariant}
          />
        </Box>
      )}
      {luegoByFranja.map(({ franjaKey, items }) => (
        <Box key={franjaKey} sx={{ mt: hasToday || sinHacer.length ? 0.5 : 0 }}>
          <Typography variant="caption" sx={FRANJA_GROUP_HEADING_SX}>
            {franjaKey === 'MAÑANA' ? 'Mañana' : franjaKey === 'TARDE' ? 'Tarde' : 'Noche'}
          </Typography>
          <RutinaFranjaIconCarousel
            pending={items}
            franjaKey={franjaKey}
            activeFranjaKey={activeFranja}
            rutina={rutina}
            habitsPreferences={habitsPreferences}
            readOnly={readOnly}
            onToggle={handleCarouselToggle}
          />
        </Box>
      ))}
      {notToday.length > 0 && (
        <Box sx={{ mt: hasToday ? 0.5 : 0 }}>
          {!hideGroupHeadings && (
            <Typography variant="caption" sx={GROUP_HEADING_SX}>
              {formatGroupHeading(RUTINA_DAY_GROUP_COPY.notToday)}
            </Typography>
          )}
          <HabitRows
            items={notToday}
            section={section}
            rutina={rutina}
            habits={habits}
            readOnly={readOnly}
            onItemClick={onItemClick}
            localData={localData}
            localDataBySection={localDataBySection}
            sortable={canSort}
            rowKeyPrefix={rowKeyPrefix}
            multiSection={multiSection}
            stackVariant={stackVariant}
          />
        </Box>
      )}
      {!hideDone && hasDone && (
        <RutinaDoneSection
          items={done}
          rutina={rutina}
          habitsPreferences={habitsPreferences}
          readOnly={readOnly}
          onToggle={handleDoneToggle}
          showDivider={hasToday || notToday.length > 0 || sinHacer.length > 0 || luegoByFranja.length > 0}
          alignIconsLeft={useSectionFranjaLayout}
        />
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

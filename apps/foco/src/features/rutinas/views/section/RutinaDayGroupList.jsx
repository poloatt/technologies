import React, { useCallback, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import CollapseSectionToggle from '@shared/components/common/CollapseSectionToggle';
import { CollapseSectionLabel } from '@shared/components/collapse';
import {
  collapseSectionStackSx,
  getCollapseSectionCarouselBodySx,
} from '@shared/styles/collapseSectionStyles';
import useResponsive from '@shared/hooks/useResponsive';
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
  groupEntriesIntoDisplayRows,
  reorderFlatEntriesByDisplayRowDnD,
} from '@shared/habits';
import { VALID_TIME_OF_DAY } from '@shared/utils/timeOfDayUtils';
import { useRutinas } from '@shared/context';

function ExpandableCarouselSection({
  sectionKey,
  label,
  items,
  expandedSections,
  onToggleExpand,
  showSectionCounts,
  franjaKey,
  activeFranja,
  rutina,
  habitsPreferences,
  readOnly,
  onCarouselToggle,
  section,
  habits,
  onItemClick,
  localData,
  localDataBySection,
  multiSection,
  rowKeyPrefix,
  stackVariant,
  centerWhenFits,
  allowPostpone = false,
  onPostpone,
}) {
  const { isMobileOrTablet } = useResponsive();
  const isExpanded = expandedSections.has(sectionKey);
  const canExpand = items.length > 0;

  if (!canExpand) {
    return (
      <RutinaFranjaIconCarousel
        pending={items}
        franjaKey={franjaKey}
        activeFranjaKey={activeFranja}
        rutina={rutina}
        habitsPreferences={habitsPreferences}
        readOnly={readOnly}
        onToggle={onCarouselToggle}
        centerWhenFits={centerWhenFits}
      />
    );
  }

  return (
    <CollapseSectionToggle
      expanded={isExpanded}
      onToggle={() => onToggleExpand(sectionKey)}
      title={label}
      count={showSectionCounts ? items.length : undefined}
      showDivider={isExpanded}
      contentSx={getCollapseSectionCarouselBodySx(isMobileOrTablet, { expanded: isExpanded })}
    >
      {isExpanded ? (
        <HabitRows
          items={items}
          section={section}
          rutina={rutina}
          habits={habits}
          readOnly={readOnly}
          onItemClick={onItemClick}
          localData={localData}
          localDataBySection={localDataBySection}
          sortable={false}
          rowKeyPrefix={`${rowKeyPrefix}-${sectionKey}`}
          multiSection={multiSection}
          stackVariant={stackVariant}
          allowPostpone={allowPostpone}
          onPostpone={onPostpone}
        />
      ) : (
        <RutinaFranjaIconCarousel
          pending={items}
          franjaKey={franjaKey}
          activeFranjaKey={activeFranja}
          rutina={rutina}
          habitsPreferences={habitsPreferences}
          readOnly={readOnly}
          onToggle={onCarouselToggle}
          centerWhenFits={centerWhenFits}
        />
      )}
    </CollapseSectionToggle>
  );
}

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
  hideMeta = false,
  stackVariant = 'inline',
  allowPostpone = false,
  onPostpone,
}) {
  const entrySection = resolveEntrySection(entry, section);
  const entryLocalData = resolveEntryLocalData(entry, section, localData, localDataBySection);
  const focusHorario = resolveEntryFocusHorario(entry);
  const { itemId, Icon, label, config } = entry;
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
        stackCell={stackCell}
        hideMeta={hideMeta}
        isCadenciaDebt={entry.isCadenciaDebt}
        isScheduled={entry.isScheduled}
        iconColumnCompact={stackVariant === 'compact'}
        allowPostpone={allowPostpone}
        onPostpone={onPostpone}
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
  allowPostpone = false,
  onPostpone,
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
            allowPostpone={allowPostpone}
            onPostpone={onPostpone}
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
          stackVariant={stackVariant}
          allowPostpone={allowPostpone}
          onPostpone={onPostpone}
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
        stackVariant={stackVariant}
        allowPostpone={allowPostpone}
        onPostpone={onPostpone}
      />
    );
  });
}

/**
 * Listado agrupado por franja (Sin hacer / Ahora / Noche / Hecho) o por Hoy/Hecho en buckets sin franja.
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
  showSectionCounts = false,
  expandableCarousels = false,
  doneHeadingLabel,
  doneTodayLabel,
  doneBeforeLabel,
  doneDefaultExpanded = false,
  doneCollapsible = false,
}) {
  const { postponeHabitFranja } = useRutinas();
  const [expandedCarouselSections, setExpandedCarouselSections] = useState(() => new Set());

  const handlePostpone = useCallback(async (entrySection, itemId, franja) => {
    if (!rutina?._id || readOnly) return;
    await postponeHabitFranja(rutina._id, entrySection, itemId, franja);
  }, [postponeHabitFranja, readOnly, rutina?._id]);

  const toggleCarouselExpand = useCallback((sectionKey) => {
    setExpandedCarouselSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  }, []);

  const shouldShowCounts = showSectionCounts || useSectionFranjaLayout;
  const shouldExpandCarousels = expandableCarousels || useSectionFranjaLayout;
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

  const resolveTodaySectionTitle = () => {
    if (useSectionFranjaLayout && activeFranjaLabel) return activeFranjaLabel;
    if (useFranjaHeadings && sectionLabel) return sectionLabel;
    if (!hideGroupHeadings && !useFranjaHeadings && !useSectionFranjaLayout) {
      return formatGroupHeading(RUTINA_DAY_GROUP_COPY.today);
    }
    return hideGroupHeadings ? null : RUTINA_DAY_GROUP_COPY.today;
  };

  const todaySectionTitle = resolveTodaySectionTitle();

  const renderTodayRows = () => (
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
      allowPostpone={useSectionFranjaLayout && !readOnly}
      onPostpone={handlePostpone}
    />
  );

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
    <Box sx={collapseSectionStackSx}>
      {useSectionFranjaLayout && sinHacer.length > 0 && (
        shouldExpandCarousels ? (
          <ExpandableCarouselSection
              sectionKey="sinHacer"
              label={DAILY_CADENCE_SECTION_COPY.sinHacer}
              items={sinHacer}
              expandedSections={expandedCarouselSections}
              onToggleExpand={toggleCarouselExpand}
              showSectionCounts={shouldShowCounts}
              franjaKey="SIN_HACER"
              activeFranja={activeFranja}
              rutina={rutina}
              habitsPreferences={habitsPreferences}
              readOnly={readOnly}
              onCarouselToggle={handleCarouselToggle}
              section={section}
              habits={habits}
              onItemClick={onItemClick}
              localData={localData}
              localDataBySection={localDataBySection}
              multiSection={multiSection}
              rowKeyPrefix={rowKeyPrefix}
              stackVariant={stackVariant}
              allowPostpone={useSectionFranjaLayout && !readOnly}
              onPostpone={handlePostpone}
            />
          ) : (
            <CollapseSectionLabel
              title={DAILY_CADENCE_SECTION_COPY.sinHacer}
              count={shouldShowCounts ? sinHacer.length : undefined}
            >
              <RutinaFranjaIconCarousel
                pending={sinHacer}
                franjaKey="SIN_HACER"
                activeFranjaKey={activeFranja}
                rutina={rutina}
                habitsPreferences={habitsPreferences}
                readOnly={readOnly}
                onToggle={handleCarouselToggle}
              />
            </CollapseSectionLabel>
          )
      )}
      {hasToday && (
        todaySectionTitle ? (
          <CollapseSectionLabel
            title={todaySectionTitle}
            count={shouldShowCounts ? today.length : undefined}
          >
            {renderTodayRows()}
          </CollapseSectionLabel>
        ) : renderTodayRows()
      )}
      {luegoByFranja.map(({ franjaKey, items }) => {
        const franjaLabel = franjaKey === 'MAÑANA' ? 'Mañana' : franjaKey === 'TARDE' ? 'Tarde' : 'Noche';
        const sectionKey = `luego:${franjaKey}`;

        return shouldExpandCarousels ? (
          <ExpandableCarouselSection
            key={franjaKey}
            sectionKey={sectionKey}
            label={franjaLabel}
            items={items}
            expandedSections={expandedCarouselSections}
            onToggleExpand={toggleCarouselExpand}
            showSectionCounts={shouldShowCounts}
            franjaKey={franjaKey}
            activeFranja={activeFranja}
            rutina={rutina}
            habitsPreferences={habitsPreferences}
            readOnly={readOnly}
            onCarouselToggle={handleCarouselToggle}
            section={section}
            habits={habits}
            onItemClick={onItemClick}
            localData={localData}
            localDataBySection={localDataBySection}
            multiSection={multiSection}
            rowKeyPrefix={rowKeyPrefix}
            stackVariant={stackVariant}
            centerWhenFits={franjaKey === 'NOCHE' ? undefined : false}
            allowPostpone={useSectionFranjaLayout && !readOnly}
            onPostpone={handlePostpone}
          />
        ) : (
          <CollapseSectionLabel
            key={franjaKey}
            title={franjaLabel}
            count={shouldShowCounts ? items.length : undefined}
          >
            <RutinaFranjaIconCarousel
              pending={items}
              franjaKey={franjaKey}
              activeFranjaKey={activeFranja}
              rutina={rutina}
              habitsPreferences={habitsPreferences}
              readOnly={readOnly}
              onToggle={handleCarouselToggle}
              centerWhenFits={franjaKey === 'NOCHE' ? undefined : false}
            />
          </CollapseSectionLabel>
        );
      })}
      {notToday.length > 0 && !useSectionFranjaLayout && (
        hideGroupHeadings ? (
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
        ) : (
          <CollapseSectionLabel
            title={formatGroupHeading(RUTINA_DAY_GROUP_COPY.notToday)}
            count={shouldShowCounts ? notToday.length : undefined}
          >
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
          </CollapseSectionLabel>
        )
      )}
      {!hideDone && hasDone && (
        <RutinaDoneSection
          items={done}
          rutina={rutina}
          habitsPreferences={habitsPreferences}
          readOnly={readOnly}
          onToggle={handleDoneToggle}
          alignIconsLeft={useSectionFranjaLayout}
          doneHeadingLabel={doneHeadingLabel}
          doneTodayLabel={doneTodayLabel}
          doneBeforeLabel={doneBeforeLabel}
          defaultExpanded={doneDefaultExpanded}
          collapsible={doneCollapsible}
          collapseThreshold={doneDefaultExpanded ? 3 : 5}
        />
      )}
    </Box>
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

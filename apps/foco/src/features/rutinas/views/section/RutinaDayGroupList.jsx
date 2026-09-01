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
import HabitFormSectionLabel from '@shared/components/habits/HabitFormSectionLabel';
import {
  isHabitCompletedForHistorial,
  isHabitHorarioCompleted,
  resolveEntryFranjaFocusHorario,
  groupEntriesIntoDisplayRows,
  reorderFlatEntriesByDisplayRowDnD,
  habitRequiresExpandedCarouselToggle,
  isEntryFranjaSinHacer,
  resolveActiveDailyFranja,
} from '@shared/habits';
import { RoutineStackRow } from '@shared/components/habits/routines';
import HabitIconScrollRow from '@shared/components/habits/HabitIconScrollRow';
import { shouldUseHabitRowIconCarousel } from '@shared/components/habits/habitRowCarouselUtils';
import { rutinaStackCellCompactSx } from '@shared/styles/rutinaPageStyles';
import { getHabitIconTokens } from '@shared/styles/habitIconStyles';
import { VALID_TIME_OF_DAY } from '@shared/utils/timeOfDayUtils';
import { getRutinaDayMode } from '@shared/utils/rutinaDayMode';
import { useRutinas } from '@shared/context';

function resolveFranjaLabel(franjaKey) {
  if (franjaKey === 'MAÑANA') return 'Mañana';
  if (franjaKey === 'TARDE') return 'Tarde';
  if (franjaKey === 'NOCHE') return 'Noche';
  return franjaKey;
}

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
  onDefer,
  /** Contenido expandido custom (p. ej. subsecciones floating de Luego). */
  expandedContent = null,
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
        expandedContent || (
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
            onDefer={onDefer}
          />
        )
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
          allowPostpone={allowPostpone}
          onDefer={onDefer}
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

/** Hábitos simples (1 franja / frecuencia 1) pueden compartir renglón en móvil. */
function entryCanShareCompactRow(entry) {
  return Boolean(entry?.config && !habitRequiresExpandedCarouselToggle(entry.config));
}

/** Agrupa singles consecutivos compartibles en filas compactas (solo móvil). */
function groupDisplayRowsForCompactSharing(displayRows = []) {
  const layoutRows = [];
  let pendingSingles = [];

  const flushSingles = () => {
    if (pendingSingles.length === 0) return;
    if (pendingSingles.length === 1) {
      layoutRows.push({ kind: 'single', entry: pendingSingles[0] });
    } else {
      layoutRows.push({ kind: 'compact', entries: [...pendingSingles] });
    }
    pendingSingles = [];
  };

  displayRows.forEach((row) => {
    if (row.kind === 'stack') {
      flushSingles();
      layoutRows.push(row);
      return;
    }
    if (entryCanShareCompactRow(row.entry)) {
      pendingSingles.push(row.entry);
      return;
    }
    flushSingles();
    layoutRows.push(row);
  });

  flushSingles();
  return layoutRows;
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
  onDefer,
  deferredPending = false,
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
  const hideIconBorder = isEntryFranjaSinHacer(entry, resolveActiveDailyFranja(rutina));

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
      sx={stackCell ? rutinaStackCellCompactSx : undefined}
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
        chain={entry.chain}
        iconColumnCompact={stackVariant === 'compact'}
        allowPostpone={allowPostpone}
        onDefer={onDefer}
        hideIconBorder={hideIconBorder}
        deferredPending={deferredPending}
        quotaSlot={entry.quotaSlot ?? null}
        rutina={rutina}
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
  onDefer,
  deferredPending = false,
}) {
  const { isMobileOrTablet } = useResponsive();
  const effectiveStackVariant = stackVariant;
  const isHistoricalDay = rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'historical';
  const shouldShareRows = isMobileOrTablet && !sortable && !isHistoricalDay;
  const compactIconSize = getHabitIconTokens({
    mobile: isMobileOrTablet,
    compact: effectiveStackVariant === 'compact',
  }).size;

  const displayRows = useMemo(() => groupEntriesIntoDisplayRows(items), [items]);
  const layoutRows = useMemo(
    () => (shouldShareRows ? groupDisplayRowsForCompactSharing(displayRows) : displayRows),
    [displayRows, shouldShareRows],
  );

  if (!layoutRows.length) return null;

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
            stackVariant={effectiveStackVariant}
            allowPostpone={allowPostpone}
            onDefer={onDefer}
            deferredPending={deferredPending}
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
          multiSection={multiSection}
          stackVariant={effectiveStackVariant}
          allowPostpone={allowPostpone}
          onDefer={onDefer}
          deferredPending={deferredPending}
        />
      );
    });
  }

  return layoutRows.map((row, rowIndex) => {
    if (row.kind === 'compact') {
      const shareKey = rowKeyPrefix ? `${rowKeyPrefix}-share-${rowIndex}` : `share-${rowIndex}`;
      const useCompactCarousel = shouldUseHabitRowIconCarousel({
        mobile: isMobileOrTablet,
        itemCount: row.entries.length,
      });
      const compactCells = row.entries.map((entry) => (
        <StaticHabitRow
          key={`${resolveEntrySection(entry, section)}-${entry.itemId}`}
          entry={entry}
          section={section}
          rutina={rutina}
          habits={habits}
          readOnly={readOnly}
          onItemClick={onItemClick}
          localData={localData}
          localDataBySection={localDataBySection}
          multiSection={multiSection}
          stackCell
          hideMeta
          stackVariant={effectiveStackVariant}
          allowPostpone={allowPostpone}
          onDefer={onDefer}
          deferredPending={deferredPending}
        />
      ));

      return (
        <RoutineStackRow
          key={shareKey}
          chainId={shareKey}
          rowKeyPrefix={rowKeyPrefix}
          variant="compact"
        >
          {useCompactCarousel ? (
            <HabitIconScrollRow
              itemCount={row.entries.length}
              iconSize={compactIconSize}
              sx={{ width: '100%' }}
            >
              {() => compactCells}
            </HabitIconScrollRow>
          ) : compactCells}
        </RoutineStackRow>
      );
    }

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
          multiSection={multiSection}
          stackVariant={effectiveStackVariant}
          allowPostpone={allowPostpone}
          onDefer={onDefer}
          deferredPending={deferredPending}
        />
      );
    }

    return (
      <StaticHabitRow
        key={rowKeyPrefix
          ? `${rowKeyPrefix}-${resolveEntrySection(row.entry, section)}-${row.entry.itemId}`
          : `${resolveEntrySection(row.entry, section)}-${row.entry.itemId}`}
        entry={row.entry}
        section={section}
        rutina={rutina}
        habits={habits}
        readOnly={readOnly}
        onItemClick={onItemClick}
        localData={localData}
        localDataBySection={localDataBySection}
        multiSection={multiSection}
        stackVariant={effectiveStackVariant}
        allowPostpone={allowPostpone}
        onDefer={onDefer}
        deferredPending={deferredPending}
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
  /** Grupos semanales pendientes a mostrar dentro de Luego ({ weekdayKey, weekdayLabel, pending }). */
  luegoWeekdayGroups = [],
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
  hideNotToday = false,
  stackVariant = 'inline',
  showSectionCounts = false,
  expandableCarousels = false,
  /** Claves iniciales expandidas en secciones con carrusel colapsable (p. ej. `['today']`). */
  defaultExpandedCarouselKeys = [],
  doneHeadingLabel,
  doneTodayLabel,
  doneBeforeLabel,
  doneDefaultExpanded = false,
  doneCollapsible = false,
  doneCollapsePreviewMode = 'hide',
}) {
  const { isMobileOrTablet } = useResponsive();
  const { deferHabitItem } = useRutinas();
  const effectiveStackVariant = stackVariant;
  const [expandedCarouselSections, setExpandedCarouselSections] = useState(
    () => new Set(defaultExpandedCarouselKeys),
  );

  const handleDefer = useCallback(async (entrySection, itemId, action, options = {}) => {
    if (!rutina?._id || readOnly) return;
    await deferHabitItem(rutina._id, entrySection, itemId, action, options);
  }, [deferHabitItem, readOnly, rutina?._id]);

  const toggleCarouselExpand = useCallback((sectionKey) => {
    setExpandedCarouselSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  }, []);

  const shouldShowCounts = showSectionCounts || useSectionFranjaLayout || luegoWeekdayGroups.length > 0;
  const shouldExpandCarousels = expandableCarousels
    || useSectionFranjaLayout
    || luegoWeekdayGroups.length > 0;
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
      stackVariant={effectiveStackVariant}
      allowPostpone={useSectionFranjaLayout && !readOnly}
      onDefer={handleDefer}
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

  const luegoPeriodic = useMemo(() => {
    if (!useSectionFranjaLayout) return [];
    return luego.filter((entry) => !entry?.franjaKey);
  }, [useSectionFranjaLayout, luego]);

  const luegoByFranja = useMemo(() => {
    if (!useSectionFranjaLayout) return [];
    const map = Object.fromEntries(VALID_TIME_OF_DAY.map((key) => [key, []]));
    luego.forEach((entry) => {
      const key = entry?.franjaKey;
      if (key && map[key]) map[key].push(entry);
    });
    return VALID_TIME_OF_DAY
      .map((franjaKey) => ({ franjaKey, items: map[franjaKey] }))
      .filter((group) => group.items.length > 0);
  }, [useSectionFranjaLayout, luego]);

  const pendingWeekdayGroups = useMemo(
    () => (luegoWeekdayGroups || []).filter((group) => (group?.pending || []).length > 0),
    [luegoWeekdayGroups],
  );

  const luegoAllItems = useMemo(() => [
    ...luegoByFranja.flatMap((group) => group.items),
    ...pendingWeekdayGroups.flatMap((group) => group.pending),
    ...luegoPeriodic,
  ], [luegoByFranja, pendingWeekdayGroups, luegoPeriodic]);

  const hasUnifiedLuego = luegoAllItems.length > 0;

  const renderLuegoSubsectionRows = (items, subsectionKey) => (
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
      rowKeyPrefix={`${rowKeyPrefix}-${subsectionKey}`}
      multiSection={multiSection}
      stackVariant={effectiveStackVariant}
      allowPostpone={useSectionFranjaLayout && !readOnly}
      onDefer={handleDefer}
      deferredPending
    />
  );

  const unifiedLuegoExpandedContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {luegoByFranja.map(({ franjaKey, items }) => (
        <Box key={`franja-${franjaKey}`}>
          <HabitFormSectionLabel>{resolveFranjaLabel(franjaKey)}</HabitFormSectionLabel>
          {renderLuegoSubsectionRows(items, `luego-franja-${franjaKey}`)}
        </Box>
      ))}
      {pendingWeekdayGroups.map((group) => (
        <Box key={`wd-${group.weekdayKey}`}>
          <HabitFormSectionLabel>{group.weekdayLabel}</HabitFormSectionLabel>
          {renderLuegoSubsectionRows(group.pending, `luego-wd-${group.weekdayKey}`)}
        </Box>
      ))}
      {luegoPeriodic.length > 0 && (
        <Box key="luego-periodic">
          {(luegoByFranja.length > 0 || pendingWeekdayGroups.length > 0) ? (
            <HabitFormSectionLabel>Más tarde</HabitFormSectionLabel>
          ) : null}
          {renderLuegoSubsectionRows(luegoPeriodic, 'luego-periodic')}
        </Box>
      )}
    </Box>
  );

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
              stackVariant={effectiveStackVariant}
              allowPostpone={useSectionFranjaLayout && !readOnly}
              onDefer={handleDefer}
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
                allowPostpone={useSectionFranjaLayout && !readOnly}
                onDefer={handleDefer}
              />
            </CollapseSectionLabel>
          )
      )}
      {hasToday && (
        shouldExpandCarousels && !useSectionFranjaLayout ? (
          <ExpandableCarouselSection
            sectionKey="today"
            label={todaySectionTitle || RUTINA_DAY_GROUP_COPY.today}
            items={today}
            expandedSections={expandedCarouselSections}
            onToggleExpand={toggleCarouselExpand}
            showSectionCounts={shouldShowCounts}
            franjaKey={activeFranja}
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
            stackVariant={effectiveStackVariant}
            allowPostpone={false}
          />
        ) : todaySectionTitle ? (
          <CollapseSectionLabel
            title={todaySectionTitle}
            count={shouldShowCounts ? today.length : undefined}
          >
            {renderTodayRows()}
          </CollapseSectionLabel>
        ) : renderTodayRows()
      )}
      {hasUnifiedLuego && (
        shouldExpandCarousels ? (
          <ExpandableCarouselSection
            sectionKey="luego"
            label={DAILY_CADENCE_SECTION_COPY.luego}
            items={luegoAllItems}
            expandedSections={expandedCarouselSections}
            onToggleExpand={toggleCarouselExpand}
            showSectionCounts={shouldShowCounts}
            franjaKey="LUEGO"
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
            stackVariant={effectiveStackVariant}
            centerWhenFits={false}
            allowPostpone={useSectionFranjaLayout && !readOnly}
            onDefer={handleDefer}
            expandedContent={unifiedLuegoExpandedContent}
          />
        ) : (
          <CollapseSectionLabel
            title={DAILY_CADENCE_SECTION_COPY.luego}
            count={shouldShowCounts ? luegoAllItems.length : undefined}
          >
            {unifiedLuegoExpandedContent}
          </CollapseSectionLabel>
        )
      )}
      {notToday.length > 0 && !useSectionFranjaLayout && !hideNotToday && (
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
            stackVariant={effectiveStackVariant}
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
              stackVariant={effectiveStackVariant}
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
          collapsePreviewMode={doneCollapsePreviewMode}
          collapseThreshold={doneCollapsible && doneCollapsePreviewMode === 'carousel' ? 0 : 5}
          habits={habits}
          stackVariant={effectiveStackVariant}
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

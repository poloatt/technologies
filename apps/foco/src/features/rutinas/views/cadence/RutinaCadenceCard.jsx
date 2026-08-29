import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  List,
} from '@mui/material';
import ViewListIcon from '@mui/icons-material/ViewList';
import CollapseSectionHeader from '@shared/components/collapse/CollapseSectionHeader';
import { collapsePanelProps, getCollapseHubHeaderTopRowSx } from '@shared/styles/collapseSectionStyles';
import {
  getRutinaSectionShellSx,
  rutinaSectionHeaderSx,
  rutinaSectionHeaderIconSx,
  rutinaSectionBodySx,
  rutinaBackToListIconSx,
  rutinaCollapsedIconsRowSx,
} from '@shared/styles/rutinaPageStyles';
import { useRutinas, useHabits } from '@shared/context';
import {
  resolveRutinaItemConfig,
  groupRutinaHabitsByCadence,
  habitRequiresExpandedCarouselToggle,
  CADENCE_BUCKET_ICON_KEYS,
  getCadenceBucketCompletionStats,
} from '@shared/habits';
import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import useResponsive from '@shared/hooks/useResponsive';
import RutinaCadenceBucketList from './RutinaCadenceBucketList';
import RutinaCadenceCarousel from './RutinaCadenceCarousel';
import HubSectionShell from '@shared/components/hub/HubSectionShell';
import { DynamicIcon } from '@shared/components/common/DynamicIcon';
import useRutinaItemToggle from '../../hooks/useRutinaItemToggle';
import useRutinaBucketLocalData from '../../hooks/useRutinaBucketLocalData';

/** Tarjeta expandible por bucket de cadencia (paridad con RutinaCard). */
function RutinaCadenceCard({
  bucket,
  rutina,
  readOnly = false,
  expandedCadence = null,
  onExpandedCadenceChange,
}) {
  const { markItemComplete } = useRutinas();
  const { habits, customSections, reorderHabits } = useHabits();
  const { habitsPreferences, habitChains, prefsReady } = useHabitsPreferences();
  const habitPrefs = prefsReady ? (habitsPreferences || {}) : {};
  const { isMobileOrTablet } = useResponsive();

  const sectionsInBucket = useMemo(
    () => [...new Set(bucket.items.map((entry) => entry.section))],
    [bucket.items],
  );

  const [localDataBySection, setLocalDataBySection] = useRutinaBucketLocalData(sectionsInBucket, rutina);
  const [focusedItemId, setFocusedItemId] = useState(null);

  const isExpanded = expandedCadence === bucket.id;
  const bucketIconKey = CADENCE_BUCKET_ICON_KEYS[bucket.id] || 'repeat';
  const { completed, total } = getCadenceBucketCompletionStats(bucket);

  const habitIconsMap = useMemo(
    () => buildHabitSectionIconsMap(habits).iconsMap,
    [habits],
  );

  const resolvedConfigByKey = useMemo(() => {
    const resolved = {};
    bucket.items.forEach(({ section, itemId }) => {
      const key = `${section}:${itemId}`;
      resolved[key] = resolveRutinaItemConfig(section, itemId, rutina, habitPrefs);
    });
    return resolved;
  }, [bucket.items, rutina, habitPrefs]);

  const habitGroups = useMemo(() => {
    const buckets = groupRutinaHabitsByCadence({
      rutina,
      habits,
      habitsPreferences: habitPrefs,
      habitChains: prefsReady ? habitChains : [],
      customSections,
      iconsMap: habitIconsMap,
      localDataBySection,
    });
    const current = buckets.find((b) => b.id === bucket.id) || bucket;

    if (!focusedItemId) {
      return { today: current.today, done: current.done, notToday: current.notToday };
    }

    const matchFocused = (items) => items.filter((entry) => entry.itemId === focusedItemId);
    return {
      today: matchFocused(current.today),
      done: matchFocused(current.done),
      notToday: matchFocused(current.notToday),
    };
  }, [bucket, rutina, habits, habitPrefs, habitChains, prefsReady, customSections, habitIconsMap, localDataBySection, focusedItemId]);

  const displayBucket = useMemo(
    () => ({
      ...bucket,
      today: habitGroups.today,
      done: habitGroups.done,
      notToday: habitGroups.notToday,
    }),
    [bucket, habitGroups],
  );

  const toggleItem = useRutinaItemToggle({
    rutina,
    habits,
    habitsPreferences: habitPrefs,
    habitChains: prefsReady ? habitChains : [],
    markItemComplete,
    readOnly,
    getSectionOverrides: (section) => localDataBySection[section] || {},
    getLocalDataBySection: () => localDataBySection,
    onOptimisticValue: (section, itemId, newValue) => {
      setLocalDataBySection((prev) => ({
        ...prev,
        [section]: { ...(prev[section] || {}), [itemId]: newValue },
      }));
    },
    onRevertValue: (section, itemId, previousValue) => {
      setLocalDataBySection((prev) => ({
        ...prev,
        [section]: { ...(prev[section] || {}), [itemId]: previousValue },
      }));
    },
    onServerValue: (section, itemId, serverValue) => {
      setLocalDataBySection((prev) => ({
        ...prev,
        [section]: { ...(prev[section] || {}), [itemId]: serverValue },
      }));
    },
  });

  const handleToggle = () => {
    const next = !isExpanded;
    onExpandedCadenceChange?.(next ? bucket.id : null);
    if (!next) {
      setFocusedItemId(null);
    }
  };

  const openExpandedForHabit = useCallback((itemId) => {
    onExpandedCadenceChange?.(bucket.id);
    setFocusedItemId(itemId);
  }, [onExpandedCadenceChange, bucket.id]);

  const handleItemClick = useCallback((section, itemId, event, horario = null) => {
    const itemConfig = resolvedConfigByKey[`${section}:${itemId}`]
      || resolveRutinaItemConfig(section, itemId, rutina, habitPrefs);

    if (!isExpanded && habitRequiresExpandedCarouselToggle(itemConfig)) {
      openExpandedForHabit(itemId);
      return;
    }

    toggleItem(section, itemId, horario, event);
  }, [
    rutina,
    habitPrefs,
    isExpanded,
    resolvedConfigByKey,
    openExpandedForHabit,
    toggleItem,
  ]);

  const handleCarouselToggle = useCallback((section, itemId, horario) => {
    handleItemClick(section, itemId, null, horario);
  }, [handleItemClick]);

  const handleReorderSection = useCallback(async (section, habitIds) => {
    if (!habitIds?.length || !section) return;
    try {
      await reorderHabits(section, habitIds);
    } catch {
      // feedback en HabitsContext
    }
  }, [reorderHabits]);

  const showCollapsedCarousel = !isExpanded && !expandedCadence;

  return (
    <>
      <HubSectionShell
        shellSx={getRutinaSectionShellSx(isMobileOrTablet)}
        hideBody={!isExpanded}
        headerContent={(
          <Box sx={rutinaSectionHeaderSx(isExpanded)}>
            <CollapseSectionHeader
              expanded={isExpanded}
              onToggle={handleToggle}
              isMobile={isMobileOrTablet}
              headerLeading={focusedItemId && isExpanded ? (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocusedItemId(null);
                  }}
                  sx={rutinaBackToListIconSx}
                  title="Ver todos los hábitos"
                >
                  <ViewListIcon fontSize="small" />
                </IconButton>
              ) : null}
              headerTrailing={(
                <>
                  <DynamicIcon
                    iconKey={bucketIconKey}
                    size="small"
                    sx={rutinaSectionHeaderIconSx}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, flexShrink: 0 }}>
                    {completed}/{total}
                  </Typography>
                </>
              )}
              title={bucket.label}
              headerSx={getCollapseHubHeaderTopRowSx(isMobileOrTablet)}
            />
            {showCollapsedCarousel && (
              <Box
                sx={rutinaCollapsedIconsRowSx}
                onClick={(e) => e.stopPropagation()}
              >
                <RutinaCadenceCarousel
                  bucketId={bucket.id}
                  rutina={rutina}
                  habits={habits}
                  habitsPreferences={habitPrefs}
                  habitChains={prefsReady ? habitChains : []}
                  customSections={customSections}
                  onToggle={handleCarouselToggle}
                  onRequireExpand={(_, itemId) => openExpandedForHabit(itemId)}
                  interactive={!readOnly}
                  showDividers={false}
                  embedInHeader
                  mobile={isMobileOrTablet}
                />
              </Box>
            )}
          </Box>
        )}
        bodySx={rutinaSectionBodySx}
      >
        <Collapse in={isExpanded} {...collapsePanelProps}>
          <Box>
            <List dense disablePadding sx={{ py: 0, my: 0 }}>
              <RutinaCadenceBucketList
                bucket={displayBucket}
                rutina={rutina}
                readOnly={readOnly}
                sortable={isExpanded}
                habits={habits}
                habitsPreferences={habitPrefs}
                localDataBySection={localDataBySection}
                onItemClick={handleItemClick}
                onReorderSection={handleReorderSection}
              />
            </List>
          </Box>
        </Collapse>
      </HubSectionShell>
    </>
  );
}

export default memo(RutinaCadenceCard, (prevProps, nextProps) => (
  prevProps.bucket?.id === nextProps.bucket?.id
  && prevProps.readOnly === nextProps.readOnly
  && prevProps.expandedCadence === nextProps.expandedCadence
  && prevProps.rutina?._id === nextProps.rutina?._id
  && JSON.stringify(prevProps.bucket?.items) === JSON.stringify(nextProps.bucket?.items)
));

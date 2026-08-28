import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  List,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ViewListIcon from '@mui/icons-material/ViewList';
import { useRutinas, useHabits } from '@shared/context';
import HabitFormDialog from '@shared/components/HabitFormDialog';
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
import useRutinaItemToggle from '@foco/features/habits/hooks/useRutinaItemToggle';
import useRutinaBucketLocalData from '@foco/features/habits/hooks/useRutinaBucketLocalData';
import {
  rutinaSectionShellSx,
  rutinaSectionHeaderSx,
  rutinaSectionHeaderTopRowSx,
  rutinaSectionTitleRowSx,
  rutinaSectionTitleSx,
  rutinaSectionHeaderIconSx,
  rutinaSectionBodySx,
  rutinaExpandIconSx,
  rutinaBackToListIconSx,
  rutinaCollapsedIconsRowSx,
} from '@shared/styles/rutinaPageStyles';

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
  const { habitsPreferences, prefsReady } = useHabitsPreferences();
  const habitPrefs = prefsReady ? (habitsPreferences || {}) : {};
  const { isMobileOrTablet } = useResponsive();

  const sectionsInBucket = useMemo(
    () => [...new Set(bucket.items.map((entry) => entry.section))],
    [bucket.items],
  );

  const [localDataBySection, setLocalDataBySection] = useRutinaBucketLocalData(sectionsInBucket, rutina);
  const [editingHabitDialog, setEditingHabitDialog] = useState({ open: false, habit: null, section: null });
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
  }, [bucket, rutina, habits, habitPrefs, customSections, habitIconsMap, localDataBySection, focusedItemId]);

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
    habitsPreferences: habitPrefs,
    markItemComplete,
    readOnly,
    getSectionOverrides: (section) => localDataBySection[section] || {},
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

  const handleEditHabit = useCallback((habit, section) => {
    setEditingHabitDialog({ open: true, habit, section });
  }, []);

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
        shellSx={rutinaSectionShellSx}
        hideBody={!isExpanded}
        headerContent={(
          <Box
            sx={rutinaSectionHeaderSx(isExpanded)}
            onClick={handleToggle}
          >
            <Box sx={rutinaSectionHeaderTopRowSx}>
              {focusedItemId && isExpanded && (
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
              )}
              <Box sx={rutinaSectionTitleRowSx}>
                <DynamicIcon
                  iconKey={bucketIconKey}
                  size="small"
                  sx={rutinaSectionHeaderIconSx}
                />
                <Typography variant="body2" sx={rutinaSectionTitleSx}>
                  {bucket.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                  {completed}/{total}
                </Typography>
              </Box>
              <IconButton
                size="small"
                sx={{ ...rutinaExpandIconSx, ml: 'auto', flexShrink: 0 }}
              >
                {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Box>
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
        <Collapse in={isExpanded} unmountOnExit>
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
                onEditHabit={handleEditHabit}
                onReorderSection={handleReorderSection}
              />
            </List>
          </Box>
        </Collapse>
      </HubSectionShell>

      <HabitFormDialog
        open={editingHabitDialog.open}
        onClose={() => setEditingHabitDialog({ open: false, habit: null, section: null })}
        editingHabit={editingHabitDialog.habit}
        editingSection={editingHabitDialog.section}
      />
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

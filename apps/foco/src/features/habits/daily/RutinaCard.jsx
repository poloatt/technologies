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
  groupSectionHabitsByDaySchedule,
  habitRequiresExpandedCarouselToggle,
} from '@shared/habits';
import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import useResponsive from '@shared/hooks/useResponsive';
import RutinaDayGroupList from './RutinaDayGroupList';
import RutinaSectionCarousel from './RutinaSectionCarousel';
import HubSectionShell from '@shared/components/hub/HubSectionShell';
import { DynamicIcon } from '@shared/components/common/DynamicIcon';
import { getRutinaSectionIconKey } from '@shared/navigation/rutinaSectionIcons';
import { resolveSectionIconKey, isCustomHabitSection } from '@shared/habits';
import HabitGroupContextMenu from '@shared/components/habits/HabitGroupContextMenu';
import useHabitGroupContextMenu from '@shared/hooks/useHabitGroupContextMenu';
import useRutinaItemToggle from '@foco/features/habits/hooks/useRutinaItemToggle';
import useRutinaSectionLocalData from '@foco/features/habits/hooks/useRutinaSectionLocalData';
import {
  rutinaSectionShellSx,
  rutinaSectionHeaderSx,
  rutinaSectionHeaderTopRowSx,
  rutinaSectionTitleRowSx,
  rutinaSectionTitleSx,
  rutinaSectionHeaderIconSx,
  rutinaSectionBodySx,
  rutinaSectionEmptySx,
  rutinaExpandIconSx,
  rutinaBackToListIconSx,
  rutinaCollapsedIconsRowSx,
} from '@shared/styles/rutinaPageStyles';

// Función para capitalizar solo la primera letra
const capitalizeFirstLetter = (string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};

const RutinaCard = ({
  title,
  section,
  data = {},
  config = {},
  readOnly = false,
  onEditGroup,
  onDeleteGroup,
  expandedSection = null,
  onExpandedSectionChange,
}) => {
  const { rutina, markItemComplete } = useRutinas();
  const { habits, customSections, reorderHabits } = useHabits();
  const { habitsPreferences, prefsReady } = useHabitsPreferences();
  const habitPrefs = prefsReady ? (habitsPreferences || {}) : {};
  const { isMobileOrTablet } = useResponsive();
  
  // Obtener iconos de hábitos personalizados o usar defaults
  const sectionHabits = habits[section] || [];

  const resolvedSectionConfig = useMemo(() => {
    const itemIds = new Set([
      ...Object.keys(config || {}),
      ...sectionHabits.map((h) => h.id || h._id).filter(Boolean),
      ...Object.keys(habitPrefs?.[section] || {}),
    ]);
    const resolved = {};
    itemIds.forEach((itemId) => {
      resolved[itemId] = resolveRutinaItemConfig(section, itemId, rutina, habitPrefs);
    });
    return resolved;
  }, [section, rutina, habitPrefs, config, sectionHabits]);
  
  const sectionIcons = useMemo(() => {
    const { iconsMap } = buildHabitSectionIconsMap(habits);
    return iconsMap[section] || {};
  }, [habits, section]);

  const isSectionEmpty = !section
    || (sectionHabits.filter((h) => h?.activo !== false).length === 0
      && Object.keys(sectionIcons).length === 0);

  const sectionIconKey = resolveSectionIconKey(section, customSections)
    || getRutinaSectionIconKey(section);

  const canManageGroup = !readOnly
    && isCustomHabitSection(section)
    && Boolean(onEditGroup && onDeleteGroup);
  const { menuState, closeMenu, getSectionHandlers } = useHabitGroupContextMenu({
    enabled: canManageGroup,
  });
  const groupContextHandlers = getSectionHandlers(section, isCustomHabitSection(section));
  const { onClick: onGroupContextClick, ...restGroupContextHandlers } = groupContextHandlers;

  const isExpanded = expandedSection === section;
  const [localData, setLocalData] = useRutinaSectionLocalData(section, data, rutina);

  const [editingHabitDialog, setEditingHabitDialog] = useState({ open: false, habit: null, section: null });

  const [focusedItemId, setFocusedItemId] = useState(null);

  const handleEditHabit = useCallback((habit, habitSection) => {
    setEditingHabitDialog({ open: true, habit, section: habitSection });
  }, []);

  const toggleItem = useRutinaItemToggle({
    rutina,
    habitsPreferences: habitPrefs,
    markItemComplete,
    readOnly,
    getSectionOverrides: () => localData,
    onOptimisticValue: (_section, itemId, newValue) => {
      setLocalData((prevData) => ({ ...prevData, [itemId]: newValue }));
    },
    onRevertValue: (_section, itemId, previousValue) => {
      setLocalData((prevData) => ({ ...prevData, [itemId]: previousValue }));
    },
    onServerValue: (_section, itemId, serverValue) => {
      setLocalData((prevData) => ({ ...prevData, [itemId]: serverValue }));
    },
  });

  const handleToggle = () => {
    const next = !isExpanded;
    onExpandedSectionChange?.(next ? section : null);
    if (!next) {
      setFocusedItemId(null);
    }
  };

  const openExpandedForHabit = useCallback((itemId) => {
    onExpandedSectionChange?.(section);
    setFocusedItemId(itemId);
  }, [onExpandedSectionChange, section]);

  const handleItemClick = useCallback((itemId, event, horario = null) => {
    const itemConfig = resolvedSectionConfig[itemId]
      || resolveRutinaItemConfig(section, itemId, rutina, habitPrefs);

    if (!isExpanded && habitRequiresExpandedCarouselToggle(itemConfig)) {
      openExpandedForHabit(itemId);
      return;
    }

    toggleItem(section, itemId, horario, event);
  }, [
    section,
    rutina,
    habitPrefs,
    isExpanded,
    resolvedSectionConfig,
    openExpandedForHabit,
    toggleItem,
  ]);

  const habitIconsMap = useMemo(() => buildHabitSectionIconsMap(habits).iconsMap, [habits]);

  const habitGroups = useMemo(() => {
    const grouped = groupSectionHabitsByDaySchedule({
      section,
      rutina,
      habits,
      habitsPreferences: habitPrefs,
      localData,
      iconsMap: habitIconsMap,
    });

    if (!focusedItemId) {
      return grouped;
    }

    const matchFocused = (items) => items.filter((entry) => entry.itemId === focusedItemId);
    return {
      today: matchFocused(grouped.today),
      done: matchFocused(grouped.done),
      notToday: matchFocused(grouped.notToday),
    };
  }, [section, rutina, habits, habitPrefs, localData, focusedItemId, habitIconsMap]);

  const handleCarouselToggle = useCallback((sec, itemId, horario) => {
    handleItemClick(itemId, null, horario);
  }, [handleItemClick]);

  const handleReorderHabits = useCallback(async (habitIds) => {
    if (!habitIds?.length) return;
    try {
      await reorderHabits(section, habitIds);
    } catch {
      // feedback en HabitsContext
    }
  }, [reorderHabits, section]);

  const showCollapsedCarousel = !isExpanded && !expandedSection;

  if (isSectionEmpty) {
    console.warn(`[RutinaCard] Sección no válida o sin hábitos: ${section}`);
    return (
      <Box sx={rutinaSectionEmptySx}>
        <Typography variant="subtitle1" color="text.primary">
          {capitalizeFirstLetter(title) || 'Sección sin título'} - No hay hábitos configurados
        </Typography>
      </Box>
    );
  }

  return (
    <>
    <HubSectionShell
      shellSx={rutinaSectionShellSx}
      hideBody={!isExpanded}
      headerContent={(
        <Box
          sx={rutinaSectionHeaderSx(isExpanded)}
          onClick={(event) => {
            onGroupContextClick?.(event);
            if (!event.defaultPrevented) {
              handleToggle();
            }
          }}
          {...restGroupContextHandlers}
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
                iconKey={sectionIconKey}
                size="small"
                sx={rutinaSectionHeaderIconSx}
              />
              <Typography variant="body2" sx={rutinaSectionTitleSx}>
                {capitalizeFirstLetter(title) || section}
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
              <RutinaSectionCarousel
                section={section}
                rutina={rutina}
                habits={habits}
                habitsPreferences={habitPrefs}
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
          {isMobileOrTablet && (
            <RutinaSectionCarousel
              section={section}
              rutina={rutina}
              habits={habits}
              habitsPreferences={habitPrefs}
              onToggle={handleCarouselToggle}
              interactive={!readOnly}
            />
          )}
          <List dense disablePadding sx={{ py: 0, my: 0 }}>
            <RutinaDayGroupList
              today={habitGroups.today}
              done={habitGroups.done}
              notToday={habitGroups.notToday}
              section={section}
              rutina={rutina}
              readOnly={readOnly}
              sortable={isExpanded}
              sectionHabits={sectionHabits}
              habitsPreferences={habitPrefs}
              onReorder={handleReorderHabits}
              onItemClick={handleItemClick}
              onDoneToggle={handleItemClick}
              onEditHabit={handleEditHabit}
              localData={localData}
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
    {canManageGroup && (
      <HabitGroupContextMenu
        open={menuState.open}
        anchorPosition={menuState.anchorPosition}
        onClose={closeMenu}
        onEdit={() => {
          if (menuState.sectionId) onEditGroup(menuState.sectionId);
          closeMenu();
        }}
        onDelete={() => {
          if (menuState.sectionId) onDeleteGroup(menuState.sectionId);
          closeMenu();
        }}
      />
    )}
  </>
  );
};

// Memoizar RutinaCard con comparación optimizada
const MemoizedRutinaCard = memo(RutinaCard, (prevProps, nextProps) => {
  // Comparación optimizada para evitar re-renderizados innecesarios
  return (
    prevProps.section === nextProps.section &&
    prevProps.title === nextProps.title &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.expandedSection === nextProps.expandedSection &&
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data) &&
    JSON.stringify(prevProps.config) === JSON.stringify(nextProps.config)
  );
});

export default MemoizedRutinaCard;

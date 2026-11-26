import React, { useMemo, useRef, useCallback } from 'react';
import { Box, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useRutinas, useHabits } from '@shared/context';
import { resolveRutinaForDate } from '@shared/habits';
import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';
import { getNormalizedToday } from '@shared/utils/dateUtils';
import { getCurrentTimeOfDay } from '@shared/utils/timeOfDayUtils';
import { isSameDay } from 'date-fns';
import useHorizontalDragScroll from '@shared/hooks/useHorizontalDragScroll';
import { useEnsureRutinaForDate } from '../../rutinas';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import { getHabitCarouselSurface } from '@shared/styles/habitCarouselStyles';
import useHabitCarouselItems from './useHabitCarouselItems';
import useHabitCarouselToggle from './useHabitCarouselToggle';
import HabitCarouselIconRow from './HabitCarouselIconRow';

const SKELETON_SLOTS = [0, 1, 2, 3, 4];

/**
 * Carrusel de hábitos embebido (Ahora / Luego).
 * @param {'ahora'|'luego'} mode
 */
export default function HabitCarouselRow({
  mode = 'ahora',
  variant = 'iconsRow',
  dense = true,
  showDividers = true,
  enableDragScroll = true,
  interactive = true,
  targetDate,
  showCompletedToggle = false,
  mobile = false,
}) {
  const theme = useTheme();
  const {
    rutina,
    rutinas,
    loading: rutinasLoading,
    error: rutinasError,
    markItemComplete,
    patchRutinaSection,
    deferHabitItem,
  } = useRutinas();
  const { habits, loading: habitsLoading, habitsReady, customSections } = useHabits();
  const { habitsPreferences, habitChains, prefsReady } = useHabitsPreferences();
  const carouselRef = useRef(null);
  const { size } = getHabitCarouselSurface(theme, { mobile });

  const { scrollRef, dragRef, isDragging, bind } = useHorizontalDragScroll({
    enabled: enableDragScroll,
    thresholdPx: 12,
  });

  const resolvedTargetDate = useMemo(
    () => targetDate || getNormalizedToday(),
    [targetDate],
  );
  const isTargetToday = useMemo(
    () => isSameDay(resolvedTargetDate, getNormalizedToday()),
    [resolvedTargetDate],
  );
  const currentTimeOfDay = isTargetToday ? getCurrentTimeOfDay() : 'MAÑANA';
  const isInteractive = interactive && isTargetToday;

  const rutinaHoy = useMemo(
    () => resolveRutinaForDate({ rutina, rutinas, targetDate: resolvedTargetDate }),
    [rutina, rutinas, resolvedTargetDate],
  );

  useEnsureRutinaForDate(resolvedTargetDate);

  const sectionIconsMap = useMemo(
    () => buildHabitSectionIconsMap(habits),
    [habits],
  );

  const hasConfiguredHabits = useMemo(
    () => Object.values(habits || {}).some(
      (section) => Array.isArray(section) && section.some((h) => h?.activo !== false),
    ),
    [habits],
  );

  const { pendingItems, carouselItems, completedTodayItems } = useHabitCarouselItems(mode, {
    rutinaHoy,
    sectionIconsMap,
    habits,
    currentTimeOfDay,
    habitsPreferences,
    habitChains: habitChains || [],
    customSections,
    allRutinas: rutinas,
    includeCompletedToday: showCompletedToggle,
  });

  const handleToggle = useHabitCarouselToggle({
    mode,
    interactive: isInteractive,
    dragRef,
    rutinaHoy,
    markItemComplete,
    patchRutinaSection,
    currentTimeOfDay,
    habitsPreferences: habitsPreferences || {},
  });

  const handleDefer = useCallback((section, itemId, action, options) => {
    if (!isInteractive || !rutinaHoy?._id || typeof deferHabitItem !== 'function') return;
    if (dragRef.current?.moved) return;
    deferHabitItem(rutinaHoy._id, section, itemId, action, options);
  }, [isInteractive, rutinaHoy?._id, deferHabitItem, dragRef]);

  const isInitialLoading = (
    !rutinasError
    && pendingItems.length === 0
    && completedTodayItems.length === 0
    && (!prefsReady || !habitsReady || (!rutinaHoy && (rutinasLoading || habitsLoading)))
  );

  if (isInitialLoading) {
    const iconSkeletonSize = Math.max(24, Math.round(size * 0.62));
    return (
      <Box
        role="status"
        aria-label="Cargando hábitos"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: mobile ? 1.5 : 1.25,
          minHeight: size + 4,
          pt: dense ? 0.25 : 0.5,
          pb: dense ? 0.25 : 0,
        }}
      >
        {SKELETON_SLOTS.map((slot) => (
          <Skeleton
            key={slot}
            variant="circular"
            width={iconSkeletonSize}
            height={iconSkeletonSize}
            animation="wave"
          />
        ))}
      </Box>
    );
  }

  return (
    <HabitCarouselIconRow
      mode={mode}
      variant={variant}
      dense={dense}
      showDividers={showDividers}
      enableDragScroll={enableDragScroll}
      interactive={isInteractive}
      carouselItems={carouselItems}
      pendingItems={pendingItems}
      completedTodayItems={completedTodayItems}
      showCompletedToggle={showCompletedToggle}
      rutinaHoy={rutinaHoy}
      sectionIconsMap={sectionIconsMap}
      habitsPreferences={habitsPreferences || {}}
      currentTimeOfDay={currentTimeOfDay}
      rutinasLoading={rutinasLoading}
      habitsLoading={habitsLoading}
      rutinasError={rutinasError}
      hasConfiguredHabits={hasConfiguredHabits}
      scrollRef={scrollRef}
      carouselRef={carouselRef}
      isDragging={isDragging}
      bind={bind}
      onToggle={handleToggle}
      allowPostpone={isInteractive}
      onDefer={handleDefer}
      mobile={mobile}
    />
  );
}

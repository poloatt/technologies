import { useCallback, useMemo, useState } from 'react';
import { startOfDay } from 'date-fns';
import { useRutinas, useHabits } from '@shared/context';
import { formatDateForAPI, getNormalizedToday, parseAPIDate } from '@shared/utils/dateUtils';
import {
  getRutinaCompletionStats,
  getRutinaDayMode,
  resolveRutinaNavigateTarget,
} from '@shared/habits';
import { ensureRutinaForDate } from '../lib/ensureRutinaForDate';

/**
 * Navegación diaria del date hero de rutinas (fecha, Hoy, ‹ ›, picker).
 */
export function useRutinaDateNav() {
  const {
    rutina,
    rutinas,
    loading,
    viewDate,
    previewRutinaDate,
    getRutinaById,
    fetchRutinas,
  } = useRutinas();
  const { habits } = useHabits();

  const [datePickerAnchor, setDatePickerAnchor] = useState(null);
  const datePickerOpen = Boolean(datePickerAnchor);

  const applyNavigateTarget = useCallback(async (target) => {
    if (!target || target.type === 'noop') return;

    if (target.type === 'select') {
      await getRutinaById(target.rutinaId);
      return;
    }

    if (target.type === 'preview') {
      previewRutinaDate(parseAPIDate(target.date));
      return;
    }

    if (target.type === 'ensure') {
      await ensureRutinaForDate(parseAPIDate(target.date), {
        rutinas,
        getRutinaById,
        fetchRutinas,
      });
    }
  }, [fetchRutinas, getRutinaById, previewRutinaDate, rutinas]);

  const resolveTarget = useCallback((direction, date) => resolveRutinaNavigateTarget({
    direction,
    date,
    rutinas,
    activeRutinaId: rutina?._id,
    activeDate: viewDate,
  }), [rutina?._id, rutinas, viewDate]);

  const onPrevious = useCallback(async () => {
    if (loading) return;
    await applyNavigateTarget(resolveTarget('prev'));
  }, [applyNavigateTarget, loading, resolveTarget]);

  const onNext = useCallback(async () => {
    if (loading) return;
    await applyNavigateTarget(resolveTarget('next'));
  }, [applyNavigateTarget, loading, resolveTarget]);

  const goToToday = useCallback(async () => {
    if (loading) return;
    await applyNavigateTarget(resolveTarget('today', getNormalizedToday()));
  }, [applyNavigateTarget, loading, resolveTarget]);

  const handleDateClick = useCallback((event) => {
    setDatePickerAnchor(event.currentTarget);
  }, []);

  const handleDatePickerClose = useCallback(() => {
    setDatePickerAnchor(null);
  }, []);

  const handleDateChange = useCallback(async (newDate) => {
    if (!newDate) return;
    try {
      await applyNavigateTarget(resolveTarget('pick', startOfDay(newDate)));
    } finally {
      handleDatePickerClose();
    }
  }, [applyNavigateTarget, handleDatePickerClose, resolveTarget]);

  const currentDate = useMemo(
    () => startOfDay(viewDate || getNormalizedToday()),
    [viewDate],
  );

  const viewingToday = useMemo(() => {
    try {
      return formatDateForAPI(currentDate) === formatDateForAPI(getNormalizedToday());
    } catch {
      return false;
    }
  }, [currentDate]);

  const dayMode = useMemo(
    () => getRutinaDayMode(currentDate),
    [currentDate],
  );

  const completionStats = useMemo(
    () => getRutinaCompletionStats(rutina, habits),
    [rutina, habits],
  );

  const completionPercentage = rutina ? completionStats.percentage : 0;
  const totalCompleted = completionStats.completed;
  const totalVisible = completionStats.total;

  const completionTooltip = totalVisible > 0
    ? `${totalCompleted}/${totalVisible} completados`
    : 'Sin ítems activos';

  const navHandlers = useMemo(() => ({
    onPrevious,
    onNext,
    prevTooltip: 'Día anterior',
    nextTooltip: 'Día siguiente',
    prevDisabled: loading,
    nextDisabled: loading,
  }), [loading, onNext, onPrevious]);

  return {
    currentDate,
    viewingToday,
    dayMode,
    loading,
    completionPercentage,
    completionTooltip,
    navHandlers,
    goToToday,
    handleDateClick,
    datePickerOpen,
    datePickerAnchor,
    handleDatePickerClose,
    handleDateChange,
  };
}

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSnackbar } from 'notistack';
import { useResponsive, useScopedPageHistory } from '@shared/hooks';
import { useRutinas, useHabits } from '@shared/context';
import { getMainBottomPadding } from '@shared/config/uiConstants';
import { formatDateForAPI, getNormalizedToday, parseAPIDate } from '@shared/utils/dateUtils';
import {
  getRutinaCompletionStats,
  getRutinaDayMode,
  isRutinaHistorical,
  isRutinaToday,
  resolveRutinaNavigateTarget,
} from '@shared/habits';
import { ensureRutinaForDate } from './ensureRutinaForDate';
import useEnsureRutinaForDate from './useEnsureRutinaForDate';

/**
 * Estado, eventos toolbar y helpers compartidos para la página Rutinas.
 */
export function useRutinasPageController() {
  const { enqueueSnackbar } = useSnackbar();
  const { isMobile, isMobileOrTablet } = useResponsive();
  const {
    rutina,
    rutinas,
    loading,
    error,
    viewDate,
    fetchRutinas,
    getRutinaById,
    previewRutinaDate,
    markItemComplete,
    patchRutinaSection,
    updateItemConfiguration,
  } = useRutinas();
  const { habits, fetchHabits } = useHabits();

  useEnsureRutinaForDate(getNormalizedToday());

  const fetchRutinasStable = useCallback(async () => {
    await Promise.all([
      fetchRutinas(true).catch(() => {}),
      fetchHabits().catch(() => {}),
    ]);
  }, [fetchRutinas, fetchHabits]);

  const undoDeps = useMemo(() => ({
    markItemComplete,
    patchRutinaSection,
    updateItemConfiguration,
  }), [markItemComplete, patchRutinaSection, updateItemConfiguration]);

  useScopedPageHistory(
    fetchRutinasStable,
    (err) => {
      console.error('Error al revertir acción en rutinas:', err);
      enqueueSnackbar('Error al revertir la acción', { variant: 'error' });
    },
    { scope: 'rutinas', deps: undoDeps },
  );

  const [editMode, setEditMode] = useState(false);
  const [rutinaToEdit, setRutinaToEdit] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [habitsManagerOpen, setHabitsManagerOpen] = useState(false);
  const [habitFormOpen, setHabitFormOpen] = useState(false);
  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (rutina?._id && rutinas.length > 0) {
      const index = rutinas.findIndex((r) => r._id === rutina._id);
      if (index !== -1) {
        setCurrentPage(index + 1);
        setTotalPages(rutinas.length);
      }
    }
  }, [rutina?._id, rutinas.length]);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchRutinas().catch(() => {});
      fetchHabits().catch(() => {});
    }
  }, [fetchRutinas, fetchHabits]);

  const handleCloseForm = useCallback(() => {
    setEditMode(false);
    setRutinaToEdit(null);
  }, []);

  const handleEditRutina = useCallback(() => {
    if (!rutina) return;
    setRutinaToEdit(rutina);
    setEditMode(true);
  }, [rutina]);

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

  const handleNavigateEvent = useCallback(async (event) => {
    const { direction, date } = event.detail || {};
    const target = resolveRutinaNavigateTarget({
      direction,
      date,
      rutinas,
      activeRutinaId: rutina?._id,
      activeDate: viewDate,
    });

    try {
      await applyNavigateTarget(target);
    } catch {
      // navegación silenciosa
    }
  }, [applyNavigateTarget, rutina?._id, rutinas, viewDate]);

  useEffect(() => {
    const onOpenAddHabit = () => setHabitFormOpen(true);
    const onOpenHabitsManager = () => setHabitsManagerOpen(true);
    const onEditRutina = () => handleEditRutina();

    window.addEventListener('openAddHabit', onOpenAddHabit);
    window.addEventListener('openHabitTemplates', onOpenHabitsManager);
    window.addEventListener('editRutina', onEditRutina);
    window.addEventListener('navigate', handleNavigateEvent);

    return () => {
      window.removeEventListener('openAddHabit', onOpenAddHabit);
      window.removeEventListener('openHabitTemplates', onOpenHabitsManager);
      window.removeEventListener('editRutina', onEditRutina);
      window.removeEventListener('navigate', handleNavigateEvent);
    };
  }, [handleEditRutina, handleNavigateEvent]);

  const activeFecha = rutina?.fecha ?? viewDate;

  const completionStats = useMemo(
    () => getRutinaCompletionStats(rutina, habits),
    [rutina, habits],
  );

  const dayMode = useMemo(
    () => getRutinaDayMode(activeFecha),
    [activeFecha],
  );

  const isViewingFutureWithoutRecord = !rutina && getRutinaDayMode(viewDate) === 'future';

  const scrollBottomPadding = getMainBottomPadding(isMobileOrTablet);

  return {
    rutina,
    rutinas,
    loading,
    error,
    viewDate,
    editMode,
    rutinaToEdit,
    currentPage,
    totalPages,
    habitsManagerOpen,
    setHabitsManagerOpen,
    habitFormOpen,
    setHabitFormOpen,
    handleCloseForm,
    handleEditRutina,
    completionStats,
    dayMode,
    isViewingFutureWithoutRecord,
    isToday: isRutinaToday(activeFecha),
    isHistorical: isRutinaHistorical(activeFecha),
    isMobile,
    isMobileOrTablet,
    scrollBottomPadding,
  };
}

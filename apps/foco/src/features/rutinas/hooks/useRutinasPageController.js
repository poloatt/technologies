import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSnackbar } from 'notistack';
import { useResponsive, useScopedPageHistory } from '@shared/hooks';
import { useRutinas, useHabits } from '@shared/context';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import { getNormalizedToday, parseAPIDate } from '@shared/utils/dateUtils';
import {
  getRutinaCompletionStats,
  getRutinaDayMode,
  isRutinaHistorical,
  isRutinaToday,
  resolveRutinaNavigateTarget,
  resolveEffectiveRutinaView,
} from '@shared/habits';
import { ensureRutinaForDate } from '../lib/ensureRutinaForDate';
import useEnsureRutinaForDate from './useEnsureRutinaForDate';
import { listenOpenHabitsManager } from '../../habits/manager';

/**
 * Estado, eventos toolbar y helpers compartidos para la página Rutinas.
 * Bootstrap de datos: solo useEnsureRutinaForDate (fetch + ensure del día).
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
  const { habits, fetchHabits, customSections } = useHabits();
  const { habitsPreferences, prefsReady } = useHabitsPreferences();
  const habitPrefs = prefsReady ? (habitsPreferences || {}) : {};

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
  const [habitsManagerOpen, setHabitsManagerOpen] = useState(false);
  const [habitFormOpen, setHabitFormOpen] = useState(false);

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
    const removeHabitsManagerListener = listenOpenHabitsManager(onOpenHabitsManager);
    window.addEventListener('editRutina', onEditRutina);
    window.addEventListener('navigate', handleNavigateEvent);

    return () => {
      window.removeEventListener('openAddHabit', onOpenAddHabit);
      removeHabitsManagerListener();
      window.removeEventListener('editRutina', onEditRutina);
      window.removeEventListener('navigate', handleNavigateEvent);
    };
  }, [handleEditRutina, handleNavigateEvent]);

  const activeFecha = rutina?.fecha ?? viewDate;

  const effectiveView = useMemo(
    () => resolveEffectiveRutinaView({
      rutina,
      viewDate,
      habits,
      habitsPreferences: habitPrefs,
      rutinas,
      customSections,
    }),
    [rutina, viewDate, habits, habitPrefs, rutinas, customSections],
  );

  const effectiveRutina = effectiveView.rutina;

  const completionStats = useMemo(
    () => getRutinaCompletionStats(effectiveRutina, habits, habitPrefs),
    [effectiveRutina, habits, habitPrefs],
  );

  const dayMode = useMemo(
    () => effectiveView.dayMode || getRutinaDayMode(activeFecha),
    [effectiveView.dayMode, activeFecha],
  );

  const isViewingFutureWithoutRecord = effectiveView.isPreview;
  const rutinaReadOnly = effectiveView.readOnly;

  return {
    rutina,
    effectiveRutina,
    rutinaReadOnly,
    isPreview: effectiveView.isPreview,
    rutinas,
    loading,
    error,
    viewDate,
    editMode,
    rutinaToEdit,
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
  };
}

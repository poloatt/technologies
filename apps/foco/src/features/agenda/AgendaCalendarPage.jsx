import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useSnackbar } from 'notistack';
import { startOfDay } from 'date-fns';
import { useResponsive } from '@shared/hooks';
import { useHabits, useRutinas } from '@shared/context';
import { usePageWithHistory } from '@shared/hooks';
import { applyTimedMoveToTask } from '@shared/utils/calendar/calendarDragUtils';
import { isTaskCompleted } from '@shared/utils/agendaRules';
import { getNormalizedToday } from '@shared/utils/dateUtils';
import { TareaForm, buildTareaPayload, syncTareaToGoogleInBackground } from '../tasks/form';
import GoogleTasksConfig from '../tasks/google/GoogleTasksConfig';
import { useCalendarTaskFilter } from './hooks/useCalendarTaskFilter';
import { useHabitsAgendaView } from '../habits/hooks/useHabitsAgendaView';
import { useObjetivosLight } from '../tasks/hooks/useObjetivosLight';
import { useTasksForCalendar } from '../tasks/hooks/useTasksForCalendar';
import { HabitsManagerHost } from '../habits';
import HabitFormDialog from '@shared/components/HabitFormDialog';
import { ensureRutinaForDate } from '../habits/daily/ensureRutinaForDate';
import AgendaDayView from './AgendaDayView';
import AgendaWeekView from './AgendaWeekView';
import { useAgendaCalendar } from './useAgendaCalendar';
import AgendaQuickCreate from './AgendaQuickCreate';
import { saveHabitFromForm } from '@shared/habits/form';

export default function AgendaCalendarPage() {
  const { isMobile } = useResponsive();
  const { enqueueSnackbar } = useSnackbar();
  const { rutinas, fetchRutinas, getRutinaById, updateUserHabitPreference } = useRutinas();
  const { habits, addHabit, fetchHabits } = useHabits();

  const [selectedDate, setSelectedDate] = useState(() => startOfDay(getNormalizedToday()));
  const [viewMode, setViewMode] = useState(() => (isMobile ? 'day' : 'week'));
  const { objetivos, refetch: refetchObjetivos } = useObjetivosLight();
  const {
    tasks: tareas,
    setTasks: setTareas,
    loading,
    refetch: refetchCalendarTasks,
  } = useTasksForCalendar(selectedDate, viewMode);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTarea, setEditingTarea] = useState(null);
  const [isGoogleTasksConfigOpen, setIsGoogleTasksConfigOpen] = useState(false);
  const [selectedTareas, setSelectedTareas] = useState([]);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateAnchor, setQuickCreateAnchor] = useState(null);
  const [quickCreateInitialStart, setQuickCreateInitialStart] = useState(null);
  const quickCreateFallbackRef = useRef(null);
  const [quickCreateTipo, setQuickCreateTipo] = useState('EVENTO');
  const [habitFormOpen, setHabitFormOpen] = useState(false);
  const [habitFormDraft, setHabitFormDraft] = useState(null);

  const { filteredTasks: calendarTasks } = useCalendarTaskFilter(tareas);
  const agendaView = useHabitsAgendaView('ahora');

  useEffect(() => {
    setViewMode(isMobile ? 'day' : 'week');
  }, [isMobile]);

  useEffect(() => {
    const handleToggleViewMode = () => {
      setViewMode((prev) => (prev === 'day' ? 'week' : 'day'));
    };
    const handleSetViewMode = (event) => {
      const { viewMode: vm } = event.detail || {};
      if (vm === 'day' || vm === 'week') setViewMode(vm);
    };
    window.addEventListener('agendaToggleViewMode', handleToggleViewMode);
    window.addEventListener('agendaSetViewMode', handleSetViewMode);
    return () => {
      window.removeEventListener('agendaToggleViewMode', handleToggleViewMode);
      window.removeEventListener('agendaSetViewMode', handleSetViewMode);
    };
  }, []);

  const { events, weekDays } = useAgendaCalendar(
    calendarTasks,
    selectedDate,
    viewMode,
    objetivos,
    agendaView,
  );

  const fetchDataStable = useCallback(async () => {
    await Promise.all([refetchObjetivos(), refetchCalendarTasks()]);
  }, [refetchObjetivos, refetchCalendarTasks]);

  const {
    createWithHistory,
    updateWithHistory,
    deleteWithHistory,
  } = usePageWithHistory(fetchDataStable, (error) => {
    console.error('Error al revertir acción:', error);
    enqueueSnackbar('Error al revertir la acción', { variant: 'error' });
  });

  useEffect(() => {
    // fetchRutinas es el único responsable de "asegurar la rutina de hoy":
    // auto-crea (guard ensureTodayAttemptedRef) y la selecciona. Evita la carrera
    // de doble POST y el GET /verify redundante de un ensureRutinaForDate extra.
    fetchRutinas?.();
  }, []);

  const syncRutinaForDate = useCallback(async (date) => {
    const normalized = startOfDay(date);
    setSelectedDate(normalized);

    try {
      await ensureRutinaForDate(normalized, {
        rutinas,
        getRutinaById,
        fetchRutinas,
      });
    } catch {
      // noop
    }
  }, [rutinas, getRutinaById, fetchRutinas]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('agendaCalendarState', {
      detail: {
        date: selectedDate.toISOString(),
        viewMode,
      },
    }));
  }, [selectedDate, viewMode]);

  useEffect(() => {
    const handleNavigateEvent = async (event) => {
      const { date } = event.detail || {};
      if (!date) return;
      try {
        await syncRutinaForDate(new Date(date));
      } catch {
        // noop
      }
    };

    window.addEventListener('navigate', handleNavigateEvent);
    return () => window.removeEventListener('navigate', handleNavigateEvent);
  }, [syncRutinaForDate]);

  const openQuickCreate = useCallback((anchorEl, initialStart = null, tipo = 'EVENTO') => {
    setEditingTarea(null);
    setQuickCreateInitialStart(initialStart);
    setQuickCreateTipo(tipo);
    setQuickCreateAnchor(anchorEl || quickCreateFallbackRef.current);
    setQuickCreateOpen(true);
  }, []);

  useEffect(() => {
    const handleAddTask = (event) => {
      const { anchorEl, initialStart, tipo } = event.detail || {};
      openQuickCreate(anchorEl, initialStart, tipo || 'TAREA');
    };
    const handleOpenGoogleTasksConfig = () => setIsGoogleTasksConfigOpen(true);
    const handleGoogleTasksSyncCompleted = () => fetchDataStable();
    const handleGoogleCalendarSyncCompleted = () => fetchDataStable();
    const handleDeleteSelectedTasks = async () => {
      if (selectedTareas.length === 0) return;
      try {
        await Promise.allSettled(selectedTareas.map((id) => deleteWithHistory(id)));
        setSelectedTareas([]);
        window.dispatchEvent(new CustomEvent('selectionChanged', { detail: { hasSelections: false } }));
        await fetchDataStable();
        enqueueSnackbar('Tareas eliminadas', { variant: 'success' });
      } catch {
        enqueueSnackbar('Error al eliminar tareas', { variant: 'error' });
      }
    };

    window.addEventListener('addTask', handleAddTask);
    window.addEventListener('openGoogleTasksConfig', handleOpenGoogleTasksConfig);
    window.addEventListener('googleTasksSyncCompleted', handleGoogleTasksSyncCompleted);
    window.addEventListener('googleCalendarSyncCompleted', handleGoogleCalendarSyncCompleted);
    window.addEventListener('deleteSelectedTasks', handleDeleteSelectedTasks);

    return () => {
      window.removeEventListener('addTask', handleAddTask);
      window.removeEventListener('openGoogleTasksConfig', handleOpenGoogleTasksConfig);
      window.removeEventListener('googleTasksSyncCompleted', handleGoogleTasksSyncCompleted);
      window.removeEventListener('googleCalendarSyncCompleted', handleGoogleCalendarSyncCompleted);
      window.removeEventListener('deleteSelectedTasks', handleDeleteSelectedTasks);
    };
  }, [selectedTareas, deleteWithHistory, fetchDataStable, enqueueSnackbar, openQuickCreate]);

  const resolveAgendaTask = useCallback((tarea) => {
    if (!tarea?.virtual) return tarea;
    const sid = String(tarea.serieId?._id || tarea.serieId || '');
    if (!sid) return tarea;
    const anchor = tareas.find(
      (t) => !t.virtual
        && String(t.serieId?._id || t.serieId) === sid
        && t.googleTasksSync?.googleTaskId,
    ) || tareas.find(
      (t) => !t.virtual && String(t.serieId?._id || t.serieId) === sid,
    );
    return anchor || tarea;
  }, [tareas]);

  const handleEdit = useCallback((tarea) => {
    setEditingTarea(resolveAgendaTask(tarea));
    setIsFormOpen(true);
  }, [resolveAgendaTask]);

  const handleToggleComplete = useCallback(async (tarea, markComplete) => {
    const target = resolveAgendaTask(tarea);
    if (target?.virtual) {
      enqueueSnackbar('No se puede completar esta ocurrencia sin ancla en la serie', { variant: 'warning' });
      return;
    }
    try {
      const original = { ...target };
      const updateData = markComplete
        ? { estado: 'COMPLETADA', completada: true }
        : { estado: 'PENDIENTE', completada: false };
      const updated = await updateWithHistory(target._id, updateData, original);
      setTareas((prev) => prev.map((t) => {
        const sid = String(t.serieId?._id || t.serieId || '');
        const targetSid = String(target.serieId?._id || target.serieId || '');
        if (t._id === target._id || (sid && sid === targetSid)) {
          return { ...t, ...updated, virtual: t.virtual };
        }
        return t;
      }));
      await fetchDataStable();
    } catch (error) {
      console.error('Error al actualizar tarea:', error);
      enqueueSnackbar('Error al actualizar la tarea', { variant: 'error' });
    }
  }, [resolveAgendaTask, updateWithHistory, enqueueSnackbar, fetchDataStable, setTareas]);

  const handleSlotClick = useCallback((day, hour, minutes = 0) => {
    const start = new Date(day);
    start.setHours(hour, minutes, 0, 0);
    openQuickCreate(quickCreateFallbackRef.current, start, 'EVENTO');
  }, [openQuickCreate]);

  const handleEventMove = useCallback(async (calendarEvent, newStart, newEnd) => {
    const target = resolveAgendaTask(calendarEvent?.task);
    if (!target?._id) return;
    if (target?.virtual) {
      enqueueSnackbar('No se puede mover esta ocurrencia sin ancla en la serie', { variant: 'warning' });
      return;
    }
    if (isTaskCompleted(target)) return;

    const datePatch = applyTimedMoveToTask(target, newStart, newEnd);

    setTareas((prev) => prev.map((t) => {
      if (t._id === target._id) return { ...t, ...datePatch };
      const sid = String(t.serieId?._id || t.serieId || '');
      const targetSid = String(target.serieId?._id || target.serieId || '');
      if (sid && sid === targetSid) {
        return { ...t, ...datePatch, virtual: t.virtual };
      }
      return t;
    }));

    try {
      const payload = buildTareaPayload(
        {
          ...target,
          ...datePatch,
          googleTasksSync: {
            ...(target.googleTasksSync || {}),
            ...(datePatch.googleTasksSync || {}),
          },
        },
        { editingTarea: target, objetivos },
      );
      const saved = await updateWithHistory(target._id, payload, target);
      syncTareaToGoogleInBackground(saved || { ...target, ...payload }, {
        onSynced: () => enqueueSnackbar('Sincronizada con Google Tasks', { variant: 'info' }),
        onError: (syncErr) => enqueueSnackbar(
          syncErr.response?.data?.error || 'Movido localmente; no se pudo sincronizar con Google',
          { variant: 'warning' },
        ),
      });
    } catch (error) {
      console.error('Error al mover tarea en calendario:', error);
      enqueueSnackbar('Error al mover la tarea', { variant: 'error' });
      await refetchCalendarTasks();
    }
  }, [
    resolveAgendaTask,
    enqueueSnackbar,
    setTareas,
    objetivos,
    updateWithHistory,
    refetchCalendarTasks,
  ]);

  const handleQuickSave = useCallback(async (data) => {
    try {
      if (data.tipo === 'HABITO') {
        await saveHabitFromForm({
          label: data.titulo,
          section: data.section || 'bodyCare',
          icon: data.icon,
          config: data.config,
          habits,
          addHabit,
          updateUserHabitPreference,
          fetchHabits,
        });
        enqueueSnackbar('Hábito creado', { variant: 'success' });
        return;
      }

      const payload = buildTareaPayload({
        titulo: data.titulo,
        descripcion: data.descripcion,
        estado: data.estado,
        tipo: data.tipo,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        fechaVencimiento: data.fechaVencimiento,
        prioridad: data.prioridad,
        objetivo: data.objetivo,
        subtareas: data.subtareas,
      });
      await createWithHistory(payload);
      enqueueSnackbar(payload.tipo === 'EVENTO' ? 'Evento creado' : 'Tarea creada', { variant: 'success' });
      await fetchDataStable();
    } catch (error) {
      enqueueSnackbar(
        error.response?.data?.error || 'Error al crear la tarea',
        { variant: 'error' },
      );
      throw error;
    }
  }, [
    addHabit,
    createWithHistory,
    enqueueSnackbar,
    fetchDataStable,
    fetchHabits,
    habits,
    updateUserHabitPreference,
  ]);

  const handleFormSubmit = async (formData) => {
    try {
      const datosAEnviar = buildTareaPayload(formData, { editingTarea, objetivos });
      let saved;

      if (editingTarea?._id) {
        saved = await updateWithHistory(editingTarea._id, datosAEnviar, editingTarea);
        enqueueSnackbar('Tarea actualizada', { variant: 'success' });
      } else {
        saved = await createWithHistory(datosAEnviar);
        enqueueSnackbar('Tarea creada', { variant: 'success' });
      }

      syncTareaToGoogleInBackground(saved || datosAEnviar, {
        onSynced: () => enqueueSnackbar('Sincronizada con Google Tasks', { variant: 'info' }),
        onError: (syncErr) => enqueueSnackbar(
          syncErr.response?.data?.error || 'Tarea guardada; no se pudo sincronizar con Google',
          { variant: 'warning' },
        ),
      });

      setIsFormOpen(false);
      setEditingTarea(null);
      await fetchDataStable();
    } catch (error) {
      enqueueSnackbar(
        error.response?.data?.error || 'Error al guardar la tarea',
        { variant: 'error' },
      );
    }
  };

  const initialFormData = useMemo(() => {
    if (!editingTarea) return null;
    return editingTarea;
  }, [editingTarea]);

  return (
    <Box
      sx={{
        position: 'relative',
        px: { xs: 0, sm: 1, md: 2 },
        width: '100%',
        height: isMobile ? 'calc(100vh - 160px)' : 'calc(100vh - 170px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box ref={quickCreateFallbackRef} sx={{ position: 'absolute', top: 8, right: 16, width: 1, height: 1 }} />

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50%' }}>
            <CircularProgress />
          </Box>
        ) : viewMode === 'day' ? (
          <AgendaDayView
            date={selectedDate}
            events={events}
            agendaView={agendaView}
            viewMode={viewMode}
            showRutinaStrip
            onEventClick={handleEdit}
            onToggleComplete={handleToggleComplete}
            onSlotClick={handleSlotClick}
            onEventMove={handleEventMove}
          />
        ) : (
          <AgendaWeekView
            weekDays={weekDays}
            events={events}
            selectedDate={selectedDate}
            agendaView={agendaView}
            onEventClick={handleEdit}
            onToggleComplete={handleToggleComplete}
            onSlotClick={handleSlotClick}
            onEventMove={handleEventMove}
          />
        )}
      </Box>

      <AgendaQuickCreate
        open={quickCreateOpen}
        anchorEl={quickCreateAnchor}
        isMobile={isMobile}
        onClose={() => {
          setQuickCreateOpen(false);
          setQuickCreateInitialStart(null);
        }}
        selectedDate={selectedDate}
        initialStart={quickCreateInitialStart}
        objetivos={objetivos}
        defaultTipo={quickCreateTipo}
        onSave={handleQuickSave}
      />

      <HabitsManagerHost />
      <HabitFormDialog
        open={habitFormOpen}
        onClose={() => {
          setHabitFormOpen(false);
          setHabitFormDraft(null);
        }}
        initialDraft={habitFormDraft}
      />

      {isFormOpen && (
        <TareaForm
          open={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingTarea(null);
          }}
          onSubmit={handleFormSubmit}
          isEditing={!!editingTarea?._id}
          initialData={initialFormData}
          objetivos={objetivos}
          onObjetivosUpdate={refetchObjetivos}
          updateWithHistory={updateWithHistory}
        />
      )}

      <GoogleTasksConfig
        open={isGoogleTasksConfigOpen}
        onClose={() => setIsGoogleTasksConfigOpen(false)}
      />
    </Box>
  );
}

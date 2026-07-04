import { useState, useEffect } from 'react';
import { useSnackbar } from 'notistack';
import { addDays, addWeeks, addMonths, isWeekend, startOfMonth } from 'date-fns';

/**
 * Action handlers for TareaDetailPopup (extracted from TareaRow).
 */
export function useTareaDetailActions({ tarea, updateWithHistory, onUpdateEstado, onRefreshData }) {
  const [estadoLocal, setEstadoLocal] = useState(tarea?.estado);
  const [subtareasLocal, setSubtareasLocal] = useState(tarea?.subtareas || []);
  const [prioridadLocal, setPrioridadLocal] = useState(tarea?.prioridad);
  const [isUpdating, setIsUpdating] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    setEstadoLocal(tarea?.estado);
    setSubtareasLocal(tarea?.subtareas || []);
    setPrioridadLocal(tarea?.prioridad);
  }, [tarea]);

  const handleSubtareaToggle = async (subtareaId, completada) => {
    if (isUpdating || !tarea) return;

    try {
      setIsUpdating(true);
      const tareaOriginal = { ...tarea };
      const nuevasSubtareas = subtareasLocal.map((st) =>
        (st._id === subtareaId ? { ...st, completada: !completada } : st),
      );
      setSubtareasLocal(nuevasSubtareas);

      const todasCompletadas = nuevasSubtareas.every((st) => st.completada);
      const algunaCompletada = nuevasSubtareas.some((st) => st.completada);
      let nuevoEstado = 'PENDIENTE';
      if (todasCompletadas) nuevoEstado = 'COMPLETADA';
      else if (algunaCompletada) nuevoEstado = 'EN_PROGRESO';
      setEstadoLocal(nuevoEstado);

      const updateData = {
        subtareas: nuevasSubtareas,
        estado: nuevoEstado,
        completada: todasCompletadas,
      };

      const response = await updateWithHistory(tarea._id, updateData, tareaOriginal);
      if (response && onUpdateEstado) onUpdateEstado(response);
    } catch (error) {
      setSubtareasLocal(tarea.subtareas || []);
      setEstadoLocal(tarea.estado);
      console.error('Error al actualizar subtarea:', error);
      enqueueSnackbar('Error al actualizar subtarea', { variant: 'error' });
    } finally {
      setTimeout(() => setIsUpdating(false), 300);
    }
  };

  const handlePush = async (t) => {
    const today = new Date();
    let nuevaFecha;

    switch ((t.pushCount || 0) % 4) {
      case 0:
        nuevaFecha = addDays(today, 1);
        while (isWeekend(nuevaFecha)) {
          nuevaFecha = addDays(nuevaFecha, 1);
        }
        break;
      case 1:
        nuevaFecha = addWeeks(today, 1);
        break;
      case 2:
        nuevaFecha = startOfMonth(addMonths(today, 1));
        break;
      case 3:
      default:
        nuevaFecha = today;
        break;
    }

    try {
      const tareaOriginal = { ...t };
      const updated = await updateWithHistory(
        t._id,
        { fechaInicio: nuevaFecha.toISOString(), pushCount: (t.pushCount || 0) + 1 },
        tareaOriginal,
      );
      if (onUpdateEstado) onUpdateEstado(updated);
      enqueueSnackbar('Fecha actualizada exitosamente', { variant: 'success' });
    } catch (error) {
      console.error('Error al actualizar fecha:', error);
      enqueueSnackbar('Error al actualizar fecha', { variant: 'error' });
    }
  };

  const handleDelegate = () => {
    enqueueSnackbar('Función por implementar', { variant: 'info' });
  };

  const handleTogglePriority = async (t) => {
    try {
      const nuevaPrioridad = prioridadLocal === 'ALTA' ? 'BAJA' : 'ALTA';
      setPrioridadLocal(nuevaPrioridad);

      const tareaOriginal = { ...t };
      const updated = await updateWithHistory(t._id, { prioridad: nuevaPrioridad }, tareaOriginal);
      if (onUpdateEstado) onUpdateEstado(updated);
      enqueueSnackbar('Prioridad actualizada exitosamente', { variant: 'success' });
    } catch (error) {
      setPrioridadLocal(t.prioridad);
      console.error('Error al actualizar prioridad:', error);
      enqueueSnackbar('Error al actualizar prioridad', { variant: 'error' });
    }
  };

  const handleComplete = async (t) => {
    try {
      const tareaOriginal = { ...t };
      const nuevasSubtareas = (t.subtareas || []).map((st) => ({ ...st, completada: true }));
      const updateData = { estado: 'COMPLETADA', completada: true };
      if (t.subtareas?.length > 0) updateData.subtareas = nuevasSubtareas;

      const response = await updateWithHistory(t._id, updateData, tareaOriginal);
      if (onUpdateEstado) onUpdateEstado(response);

      setEstadoLocal('COMPLETADA');
      if (t.subtareas?.length > 0) setSubtareasLocal(nuevasSubtareas);
      if (onRefreshData) await onRefreshData();

      enqueueSnackbar('Tarea completada exitosamente', { variant: 'success' });
    } catch (error) {
      console.error('Error al completar tarea:', error);
      enqueueSnackbar('Error al completar tarea', { variant: 'error' });
    }
  };

  const handleReactivate = async (t) => {
    try {
      const tareaOriginal = { ...t };
      const nuevasSubtareas = (t.subtareas || []).map((st) => ({ ...st, completada: false }));
      const updateData = { estado: 'PENDIENTE', completada: false };
      if (t.subtareas?.length > 0) updateData.subtareas = nuevasSubtareas;

      const response = await updateWithHistory(t._id, updateData, tareaOriginal);
      if (onUpdateEstado) onUpdateEstado(response);

      setEstadoLocal('PENDIENTE');
      if (t.subtareas?.length > 0) setSubtareasLocal(nuevasSubtareas);
      if (onRefreshData) await onRefreshData();

      enqueueSnackbar('Tarea reactivada exitosamente', { variant: 'success' });
    } catch (error) {
      console.error('Error al reactivar tarea:', error);
      enqueueSnackbar('Error al reactivar tarea', { variant: 'error' });
    }
  };

  const handleCancel = async (t) => {
    try {
      const tareaOriginal = { ...t };
      const updated = await updateWithHistory(t._id, { estado: 'CANCELADA', completada: false }, tareaOriginal);
      if (onUpdateEstado) onUpdateEstado(updated);
      enqueueSnackbar('Tarea cancelada exitosamente', { variant: 'success' });
    } catch (error) {
      console.error('Error al cancelar tarea:', error);
      enqueueSnackbar('Error al cancelar tarea', { variant: 'error' });
    }
  };

  return {
    estadoLocal,
    subtareasLocal,
    prioridadLocal,
    isUpdating,
    handleSubtareaToggle,
    handlePush,
    handleDelegate,
    handleTogglePriority,
    handleComplete,
    handleReactivate,
    handleCancel,
  };
}

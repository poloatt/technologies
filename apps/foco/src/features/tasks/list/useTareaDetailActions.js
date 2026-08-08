import { useState, useEffect, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { getNextPushDate } from '../utils/taskPushSchedule';

function normalizeOwnerIds(owners = [], creatorId) {
  const ids = (Array.isArray(owners) ? owners : [])
    .map((o) => String(o?._id ?? o?.id ?? o))
    .filter(Boolean);
  if (creatorId && !ids.includes(String(creatorId))) {
    ids.unshift(String(creatorId));
  }
  return [...new Set(ids)];
}

/**
 * Action handlers for TareaDetailPopup / TareaActionsPopover.
 */
export function useTareaDetailActions({ tarea, updateWithHistory, onUpdateEstado, onRefreshData }) {
  const [estadoLocal, setEstadoLocal] = useState(tarea?.estado);
  const [subtareasLocal, setSubtareasLocal] = useState(tarea?.subtareas || []);
  const [prioridadLocal, setPrioridadLocal] = useState(tarea?.prioridad);
  const [ownersLocal, setOwnersLocal] = useState(tarea?.owners || []);
  const [isUpdating, setIsUpdating] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    setEstadoLocal(tarea?.estado);
    setSubtareasLocal(tarea?.subtareas || []);
    setPrioridadLocal(tarea?.prioridad);
    setOwnersLocal(tarea?.owners || []);
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
    const nuevaFecha = getNextPushDate(t);

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

  const handleDelegate = useCallback(() => {
    setDelegateOpen(true);
  }, []);

  const handleAddOwner = useCallback(async (user) => {
    if (!tarea || !user) return;
    const userId = String(user._id || user.id);
    const creatorId = tarea.usuario?._id || tarea.usuario;
    const currentIds = normalizeOwnerIds(ownersLocal, creatorId);
    if (currentIds.includes(userId)) {
      enqueueSnackbar('Ese usuario ya es owner', { variant: 'info' });
      return;
    }

    const nextOwners = [...currentIds, userId];

    try {
      const tareaOriginal = { ...tarea };
      const updated = await updateWithHistory(
        tarea._id,
        { owners: nextOwners },
        tareaOriginal,
      );
      setOwnersLocal(updated?.owners || [...(ownersLocal || []), user]);
      if (onUpdateEstado) onUpdateEstado(updated);
      enqueueSnackbar('Owner agregado', { variant: 'success' });
      if (onRefreshData) await onRefreshData();
    } catch (error) {
      console.error('Error al delegar:', error);
      enqueueSnackbar('Error al agregar owner', { variant: 'error' });
    }
  }, [tarea, ownersLocal, updateWithHistory, onUpdateEstado, onRefreshData, enqueueSnackbar]);

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
      setEstadoLocal('CANCELADA');
      if (onUpdateEstado) onUpdateEstado(updated);
      if (onRefreshData) await onRefreshData();
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
    ownersLocal,
    isUpdating,
    delegateOpen,
    setDelegateOpen,
    handleSubtareaToggle,
    handlePush,
    handleDelegate,
    handleAddOwner,
    handleTogglePriority,
    handleComplete,
    handleReactivate,
    handleCancel,
  };
}

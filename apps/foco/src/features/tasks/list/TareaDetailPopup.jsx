import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import TareaActions from '../components/TareaActions';
import TareaForm from '../form/TareaForm';
import { useTareaDetailActions } from './useTareaDetailActions';

/**
 * Editable task detail popup: TareaForm + quick-action toolbar (TareaActions).
 * Desktop agenda uses half-screen positioning on the opposite column (Ahora ↔ Luego).
 */
export default function TareaDetailPopup({
  open,
  onClose,
  tarea,
  isMobile,
  agendaView = 'ahora',
  desktopHalfScreen = false,
  objetivos = [],
  onSubmit,
  onObjetivosUpdate,
  onDelete,
  updateWithHistory,
  onUpdateEstado,
  onRefreshData,
}) {
  const actions = useTareaDetailActions({
    tarea,
    updateWithHistory,
    onUpdateEstado,
    onRefreshData,
  });

  useEffect(() => {
    if (!tarea) return undefined;
    window.dispatchEvent(new CustomEvent('taskDetailOpenChanged', { detail: { open } }));
    return () => {
      window.dispatchEvent(new CustomEvent('taskDetailOpenChanged', { detail: { open: false } }));
    };
  }, [open, tarea]);

  if (!tarea) return null;

  const handleSubmit = (formData) => onSubmit?.(formData, tarea);

  const handleDelete = async (id) => {
    await onDelete?.(id);
    onClose();
  };

  return (
    <TareaForm
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      initialData={tarea}
      isEditing
      objetivos={objetivos}
      onObjetivosUpdate={onObjetivosUpdate}
      updateWithHistory={updateWithHistory}
      shell="detail"
      agendaView={agendaView}
      desktopHalfScreen={desktopHalfScreen}
      actionsToolbar={(syncProps) => (
        <Box sx={{ mb: 0.5 }}>
          <TareaActions
            tarea={{ ...tarea, prioridad: actions.prioridadLocal }}
            hideEdit
            onDelete={handleDelete}
            onPush={actions.handlePush}
            onDelegate={actions.handleDelegate}
            onTogglePriority={actions.handleTogglePriority}
            onAttach={syncProps.onAttach}
            onComplete={actions.handleComplete}
            onReactivate={actions.handleReactivate}
            onCancel={actions.handleCancel}
            onGoogleSync={syncProps.canGoogleSync ? syncProps.handleSyncToGoogle : undefined}
            syncingToGoogle={syncProps.syncingToGoogle}
            googleTasksSync={syncProps.googleTasksSync}
          />
        </Box>
      )}
    />
  );
}

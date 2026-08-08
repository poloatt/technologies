import React, { useEffect } from 'react';
import TareaActions from '../components/TareaActions';
import TareaDelegateDialog from '../components/TareaDelegateDialog';
import TareaForm from '../form/TareaForm';
import { useTareaDetailActions } from './useTareaDetailActions';
import { buildTareaActionsToolbarProps } from './buildTareaActionsToolbarProps';

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
  embedded = false,
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

  const excludeOwnerIds = [
    tarea.usuario?._id || tarea.usuario,
    ...(actions.ownersLocal || []).map((o) => o?._id || o?.id || o),
  ].filter(Boolean);

  return (
    <>
      <TareaForm
        open={open}
        onClose={onClose}
        onSubmit={handleSubmit}
        initialData={{
          ...tarea,
          owners: actions.ownersLocal ?? tarea.owners,
          estado: actions.estadoLocal ?? tarea.estado,
        }}
        isEditing
        objetivos={objetivos}
        onObjetivosUpdate={onObjetivosUpdate}
        updateWithHistory={updateWithHistory}
        shell="detail"
        agendaView={agendaView}
        desktopHalfScreen={desktopHalfScreen}
        embedded={embedded}
        onDelegateRequest={actions.handleDelegate}
        actionsToolbar={(syncProps) => {
          const props = buildTareaActionsToolbarProps({
            tarea,
            actions,
            hideEdit: true,
            onDelete: handleDelete,
            onAttach: syncProps.onAttach,
            onGoogleSync: syncProps.canGoogleSync ? syncProps.handleSyncToGoogle : undefined,
            syncingToGoogle: syncProps.syncingToGoogle,
            googleTasksSync: syncProps.googleTasksSync,
          });
          return props ? <TareaActions {...props} /> : null;
        }}
      />
      <TareaDelegateDialog
        open={actions.delegateOpen}
        onClose={() => actions.setDelegateOpen(false)}
        onSelect={actions.handleAddOwner}
        excludeIds={excludeOwnerIds}
      />
    </>
  );
}

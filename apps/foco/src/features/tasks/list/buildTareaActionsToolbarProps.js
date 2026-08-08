/**
 * Props compartidas de TareaActions para DetailPopup y ActionsPopover.
 */
export function buildTareaActionsToolbarProps({
  tarea,
  actions,
  hideEdit = false,
  onEdit,
  onDelete,
  onAttach,
  onGoogleSync,
  syncingToGoogle = false,
  googleTasksSync,
  wrap = (fn) => fn,
}) {
  if (!tarea) return null;

  return {
    tarea: {
      ...tarea,
      prioridad: actions.prioridadLocal ?? tarea.prioridad,
      estado: actions.estadoLocal ?? tarea.estado,
      owners: actions.ownersLocal ?? tarea.owners,
    },
    hideEdit,
    onEdit: onEdit ? wrap(onEdit) : undefined,
    onDelete: onDelete ? wrap(onDelete) : undefined,
    onPush: actions.handlePush ? wrap(actions.handlePush) : undefined,
    onDelegate: actions.handleDelegate,
    onTogglePriority: actions.handleTogglePriority
      ? wrap(actions.handleTogglePriority)
      : undefined,
    onAttach,
    onComplete: actions.handleComplete ? wrap(actions.handleComplete) : undefined,
    onReactivate: actions.handleReactivate ? wrap(actions.handleReactivate) : undefined,
    onCancel: actions.handleCancel ? wrap(actions.handleCancel) : undefined,
    onGoogleSync,
    syncingToGoogle,
    googleTasksSync,
  };
}

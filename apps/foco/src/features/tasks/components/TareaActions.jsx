import React from 'react';
import { Box } from '@mui/material';
import {
  EditOutlined as EditIcon,
  DeleteOutlined as DeleteIcon,
  EventRepeatOutlined as PushIcon,
  PersonAddOutlined as DelegateIcon,
  CheckCircleOutlined as CompleteIcon,
  RefreshOutlined as ReactivateIcon,
  CancelOutlined as CancelIcon,
  Google as GoogleIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { SystemButtons } from '@shared/components/common/SystemButtons';
import {
  TAREA_FORM_CHEVRON_ICON_SIZE,
  TareaFormPriorityToggle,
  TareaFormAttachButton,
} from '@shared/components/forms/tareaFormUi';
import { getNextPushTooltip } from '../utils/taskPushSchedule';

const TareaActions = ({
  tarea,
  onEdit,
  onDelete,
  onPush,
  onDelegate,
  onTogglePriority,
  onAttach,
  onComplete,
  onReactivate,
  onCancel,
  onGoogleSync,
  syncingToGoogle = false,
  googleTasksSync,
  hideEdit = false,
  variant = 'full',
  isCreateMode = false,
}) => {
  const actions = [];
  const isEvento = tarea?.tipo === 'EVENTO';
  const isHighPriority = tarea?.prioridad === 'ALTA';
  const estado = String(tarea?.estado || '').toUpperCase();
  const isCancelled = estado === 'CANCELADA';
  const isCompleted = Boolean(tarea?.completada) || estado === 'COMPLETADA';

  const guardCreate = (action) => (
    isCreateMode ? { ...action, disabled: true } : action
  );

  const attachAction = onAttach ? {
    key: 'attach',
    icon: <TareaFormAttachButton onChange={onAttach} />,
    label: 'Adjuntar',
    tooltip: 'Adjuntar',
  } : null;

  const priorityAction = !isEvento && onTogglePriority ? {
    key: 'priority',
    icon: (
      <TareaFormPriorityToggle
        prioridad={tarea.prioridad}
        onChange={() => onTogglePriority(tarea)}
      />
    ),
    label: isHighPriority ? 'Prioridad baja' : 'Prioridad alta',
    tooltip: isHighPriority ? 'Cambiar a prioridad baja' : 'Cambiar a prioridad alta',
  } : null;

  const googleAction = (onGoogleSync || isCreateMode) ? {
    key: 'googleSync',
    icon: syncingToGoogle
      ? <SyncIcon className="animate-spin" sx={{ fontSize: TAREA_FORM_CHEVRON_ICON_SIZE }} />
      : <GoogleIcon sx={{ fontSize: TAREA_FORM_CHEVRON_ICON_SIZE }} />,
    label: googleTasksSync?.enabled
      ? (googleTasksSync?.googleTaskId ? 'Sincronizado con Google Tasks' : 'Sync Google activado')
      : 'Sincronizar con Google Tasks',
    tooltip: isCreateMode
      ? 'Guarda la tarea primero'
      : (googleTasksSync?.enabled
        ? 'Sincronizar ahora con Google Tasks'
        : 'Activá sync en el formulario o sincronizá ahora'),
    color: (googleTasksSync?.enabled || googleTasksSync?.googleTaskId) ? 'success.main' : 'text.secondary',
    hoverColor: (googleTasksSync?.enabled || googleTasksSync?.googleTaskId) ? 'success.main' : 'text.primary',
    disabled: syncingToGoogle || isCreateMode || isCancelled,
    onClick: onGoogleSync,
  } : null;

  if (variant === 'form') {
    if (attachAction) actions.push(attachAction);
    if (priorityAction) actions.push(priorityAction);
  } else if (isCancelled) {
    actions.push({
      key: 'reactivate',
      icon: <ReactivateIcon />,
      label: 'Reactivar',
      tooltip: 'Reactivar',
      onClick: () => onReactivate?.(tarea),
    });
    if (googleAction) actions.push(googleAction);
  } else if (!isCompleted) {
    // Completar → Prioridad → Empujar → Delegar → Adjuntar → Google → Cancelar → Eliminar
    actions.push(
      guardCreate({
        key: 'complete',
        icon: <CompleteIcon />,
        label: 'Completar todo',
        tooltip: isCreateMode ? 'Guarda la tarea primero' : 'Completar todo',
        onClick: () => onComplete?.(tarea),
      }),
    );
    if (priorityAction) actions.push(guardCreate(priorityAction));
    actions.push(
      guardCreate({
        key: 'push',
        icon: <PushIcon />,
        label: 'Empujar',
        tooltip: isCreateMode ? 'Guarda la tarea primero' : getNextPushTooltip(tarea),
        onClick: () => onPush?.(tarea),
      }),
      guardCreate({
        key: 'delegate',
        icon: <DelegateIcon />,
        label: 'Delegar',
        tooltip: isCreateMode ? 'Guarda la tarea primero' : 'Delegar / agregar owner',
        onClick: () => onDelegate?.(tarea),
      }),
    );
    if (attachAction) actions.push(attachAction);
    if (googleAction) actions.push(googleAction);
    actions.push(
      guardCreate({
        key: 'cancel',
        icon: <CancelIcon />,
        label: 'Cancelar',
        tooltip: isCreateMode ? 'Guarda la tarea primero' : 'Cancelar (queda en Archivo)',
        onClick: () => onCancel?.(tarea),
      }),
    );

    if (!hideEdit) {
      actions.push(guardCreate({
        key: 'edit',
        icon: <EditIcon />,
        label: 'Editar',
        tooltip: isCreateMode ? 'Guarda la tarea primero' : 'Editar',
        onClick: () => onEdit?.(tarea),
      }));
    }
  } else {
    actions.push({
      key: 'reactivate',
      icon: <ReactivateIcon />,
      label: 'Reactivar',
      tooltip: 'Reactivar',
      onClick: () => onReactivate(tarea),
    });
    if (attachAction) actions.push(attachAction);
    if (priorityAction) actions.push(priorityAction);
    if (googleAction) actions.push(googleAction);
  }

  if (variant !== 'form') {
    actions.push(guardCreate({
      key: 'delete',
      icon: <DeleteIcon />,
      label: 'Eliminar',
      tooltip: isCreateMode ? 'Guarda la tarea primero' : 'Eliminar',
      onClick: () => onDelete?.(tarea._id),
      confirm: !isCreateMode,
      confirmText: 'la tarea',
    }));
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', px: 1 }}>
        <SystemButtons actions={actions} size="small" />
      </Box>
    </Box>
  );
};

export default TareaActions;

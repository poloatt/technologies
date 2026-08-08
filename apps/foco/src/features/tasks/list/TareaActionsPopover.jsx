import React, { useCallback, useRef } from 'react';
import { Box, Popover } from '@mui/material';
import { useSnackbar } from 'notistack';
import TareaActions from '../components/TareaActions';
import TareaDelegateDialog from '../components/TareaDelegateDialog';
import { useTareaDetailActions } from './useTareaDetailActions';
import { buildTareaActionsToolbarProps } from './buildTareaActionsToolbarProps';
import { syncTareaToGoogleInBackground } from '../form';

/**
 * Listón de acciones anclado a una fila (click derecho / long-press).
 */
export default function TareaActionsPopover({
  open,
  anchorEl,
  onClose,
  tarea,
  onEdit,
  onDelete,
  updateWithHistory,
  onUpdateEstado,
  onRefreshData,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const tareaRef = useRef(tarea);
  if (tarea) tareaRef.current = tarea;

  const actions = useTareaDetailActions({
    tarea: tarea || tareaRef.current,
    updateWithHistory,
    onUpdateEstado,
    onRefreshData,
  });

  const activeTarea = tarea || (actions.delegateOpen ? tareaRef.current : null);

  const handleDelete = useCallback(async (id) => {
    await onDelete?.(id);
    onClose?.();
  }, [onDelete, onClose]);

  const handleEdit = useCallback(() => {
    onClose?.();
    onEdit?.(tarea || tareaRef.current);
  }, [onClose, onEdit, tarea]);

  const handleGoogleSync = useCallback(async () => {
    const t = tarea || tareaRef.current;
    if (!t?._id) return;

    let target = t;
    if (!t.googleTasksSync?.enabled) {
      try {
        const updated = await updateWithHistory(
          t._id,
          {
            googleTasksSync: {
              ...(t.googleTasksSync || {}),
              enabled: true,
              needsSync: true,
              syncStatus: 'pending',
            },
          },
          t,
        );
        target = updated || {
          ...t,
          googleTasksSync: {
            ...(t.googleTasksSync || {}),
            enabled: true,
            needsSync: true,
          },
        };
        if (onUpdateEstado && updated) onUpdateEstado(updated);
      } catch (err) {
        enqueueSnackbar(
          err?.response?.data?.error || err?.message || 'No se pudo activar sync con Google',
          { variant: 'error' },
        );
        return;
      }
    }

    syncTareaToGoogleInBackground(target, {
      onSynced: () => {
        enqueueSnackbar('Sincronizada con Google Tasks', { variant: 'success' });
        onRefreshData?.();
      },
      onError: (err) => {
        enqueueSnackbar(
          err?.response?.data?.error || err?.message || 'No se pudo sincronizar con Google',
          { variant: 'error' },
        );
      },
    });
  }, [tarea, updateWithHistory, onUpdateEstado, enqueueSnackbar, onRefreshData]);

  const wrapAndClose = (fn) => async (...args) => {
    try {
      await fn?.(...args);
    } finally {
      onClose?.();
    }
  };

  if (!activeTarea) return null;

  const excludeOwnerIds = [
    activeTarea.usuario?._id || activeTarea.usuario,
    ...(actions.ownersLocal || []).map((o) => o?._id || o?.id || o),
  ].filter(Boolean);

  const toolbarProps = buildTareaActionsToolbarProps({
    tarea: activeTarea,
    actions,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onAttach: () => {
      onClose?.();
      onEdit?.(activeTarea);
    },
    onGoogleSync: handleGoogleSync,
    googleTasksSync: activeTarea.googleTasksSync,
    wrap: wrapAndClose,
  });

  return (
    <>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              px: 0.5,
              py: 0.75,
              boxShadow: 6,
            },
          },
        }}
      >
        <Box sx={{ maxWidth: '100vw' }}>
          {toolbarProps ? <TareaActions {...toolbarProps} /> : null}
        </Box>
      </Popover>
      <TareaDelegateDialog
        open={actions.delegateOpen}
        onClose={() => {
          actions.setDelegateOpen(false);
          onClose?.();
        }}
        onSelect={async (user) => {
          await actions.handleAddOwner(user);
        }}
        excludeIds={excludeOwnerIds}
      />
    </>
  );
}

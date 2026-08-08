import clienteAxios from '@shared/config/axios';

/**
 * Sincroniza una tarea guardada con Google Tasks si tiene sync habilitado.
 */
export async function syncTareaToGoogleAfterSave(tareaOrId) {
  const tarea = typeof tareaOrId === 'object' ? tareaOrId : null;
  const id = typeof tareaOrId === 'string' ? tareaOrId : (tarea?._id || tarea?.id);
  const sync = tarea?.googleTasksSync || {};
  const shouldSync = sync.enabled || sync.needsSync || Boolean(sync.googleTaskId);

  if (!id || !shouldSync) {
    return { synced: false };
  }

  await clienteAxios.post(`/api/google-tasks/sync/task/${id}`);
  return { synced: true };
}

/**
 * Versión no bloqueante: dispara la sync con Google en background tras guardar,
 * para no retrasar el cierre del formulario ni el refetch. Notifica por callbacks.
 */
export function syncTareaToGoogleInBackground(tareaOrId, { onSynced, onError } = {}) {
  syncTareaToGoogleAfterSave(tareaOrId)
    .then((result) => {
      if (result?.synced && typeof onSynced === 'function') {
        onSynced(result);
      }
    })
    .catch((err) => {
      if (typeof onError === 'function') {
        onError(err);
      }
    });
}

/**
 * Tras complete/reactivate/cancel (u otro cambio de estado): fuerza elegibilidad
 * de export aunque el response no traiga needsSync aún.
 */
export function syncTareaStatusToGoogleInBackground(updated, fallbackTarea, opts) {
  const base = updated || fallbackTarea;
  if (!base) return;
  const prevSync = fallbackTarea?.googleTasksSync || {};
  const nextSync = {
    ...prevSync,
    ...(base.googleTasksSync || {}),
  };
  if (nextSync.enabled || nextSync.googleTaskId) {
    nextSync.needsSync = true;
    if (!nextSync.syncStatus || nextSync.syncStatus === 'synced') {
      nextSync.syncStatus = 'pending';
    }
  }
  syncTareaToGoogleInBackground({ ...base, googleTasksSync: nextSync }, opts);
}

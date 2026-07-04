import clienteAxios from '@shared/config/axios';
import { getDefaultListRangeDates } from '../../../domain/agendaHorizons';

/**
 * Lista acotada para /tareas (Ahora/Luego).
 */
export async function fetchTasksForList({
  view,
  includeCompleted = false,
  from,
  to,
  signal,
} = {}) {
  const range = from && to ? { from, to } : getDefaultListRangeDates();
  const params = {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    includeCompleted: includeCompleted ? 'true' : 'false',
  };
  if (view === 'ahora' || view === 'luego') {
    params.view = view;
  }
  const response = await clienteAxios.get('/api/tareas/list', { params, signal });
  return response.data.docs || [];
}

/**
 * Calendario /tareas: solo rango visible.
 */
export async function fetchTasksForAgendaRange({ from, to, includeCompleted = false, signal } = {}) {
  const response = await clienteAxios.get('/api/tareas/agenda', {
    params: {
      from: from.toISOString(),
      to: to.toISOString(),
      includeCompleted: includeCompleted ? 'true' : 'false',
    },
    signal,
    timeout: 20000,
  });
  return response.data.docs || [];
}

export async function fetchCompletedTasks({ page = 1, limit = 100, signal } = {}) {
  const response = await clienteAxios.get('/api/tareas', {
    params: { estado: 'COMPLETADA', page, limit },
    signal,
  });
  return response.data;
}

export async function fetchObjetivosLight({ signal } = {}) {
  const response = await clienteAxios.get('/api/objetivos', {
    params: { light: 'true' },
    signal,
  });
  return response.data.docs || [];
}

export async function createTask(data) {
  const response = await clienteAxios.post('/api/tareas', data);
  return response.data;
}

export async function updateTask(id, data) {
  const response = await clienteAxios.put(`/api/tareas/${id}`, data);
  return response.data;
}

export async function deleteTask(id) {
  const response = await clienteAxios.delete(`/api/tareas/${id}`);
  return response.data;
}

export async function fetchTaskById(id) {
  const response = await clienteAxios.get(`/api/tareas/${id}`);
  return response.data;
}

export async function fetchTasksByObjetivo(objetivoId, { limit = 500, signal } = {}) {
  const response = await clienteAxios.get(`/api/tareas/objetivo/${objetivoId}`, {
    params: { limit },
    signal,
  });
  return response.data.docs || [];
}

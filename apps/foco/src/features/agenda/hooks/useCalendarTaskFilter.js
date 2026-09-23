import { useMemo } from 'react';
import { isTaskCancelled } from '@shared/utils/agendaRules';

/**
 * Filtro de calendario: las completadas se quedan en la grilla (estilo Google).
 * Solo se ocultan canceladas. No aplica Ahora/Luego (eso es para /tareas).
 */
export function useCalendarTaskFilter(tasks) {
  const filteredTasks = useMemo(() => {
    const list = Array.isArray(tasks) ? tasks : [];
    return list.filter((t) => !isTaskCancelled(t));
  }, [tasks]);

  return { filteredTasks, showCompleted: true };
}

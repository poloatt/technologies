import { useEffect, useMemo, useState } from 'react';
import { isTaskCompleted, isTaskCancelled } from '@shared/utils/agendaRules';

/**
 * Filtro de calendario: solo ocultar/mostrar completadas.
 * No aplica Ahora/Luego (eso es para /tareas y hábitos).
 */
export function useCalendarTaskFilter(tasks) {
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const handleSetShowCompleted = (event) => {
      const { value } = event.detail || {};
      if (typeof value === 'boolean') setShowCompleted(value);
    };
    window.addEventListener('setShowCompleted', handleSetShowCompleted);
    return () => window.removeEventListener('setShowCompleted', handleSetShowCompleted);
  }, []);

  const filteredTasks = useMemo(() => {
    const list = Array.isArray(tasks) ? tasks : [];
    return list.filter((t) => {
      if (isTaskCancelled(t)) return false;
      if (!showCompleted && isTaskCompleted(t)) return false;
      return true;
    });
  }, [tasks, showCompleted]);

  return { filteredTasks, showCompleted };
}

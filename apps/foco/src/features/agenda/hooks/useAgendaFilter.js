import { useEffect, useMemo, useState } from 'react';
import { isInAhora, isInLuego, isTaskCompleted, isTaskCancelled } from '@shared/utils/agendaRules';

/**
 * Filtrado UI Ahora/Luego sobre tareas ya acotadas por API /list.
 */
export function useAgendaFilter(tasks) {
  const [agendaView, setAgendaView] = useState('ahora');
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const handleAgendaViewChanged = (event) => {
      const { view } = event.detail || {};
      if (view === 'ahora' || view === 'luego') setAgendaView(view);
    };
    const handleSetShowCompleted = (event) => {
      const { value } = event.detail || {};
      if (typeof value === 'boolean') setShowCompleted(value);
    };

    window.addEventListener('agendaViewChanged', handleAgendaViewChanged);
    window.addEventListener('setShowCompleted', handleSetShowCompleted);

    return () => {
      window.removeEventListener('agendaViewChanged', handleAgendaViewChanged);
      window.removeEventListener('setShowCompleted', handleSetShowCompleted);
    };
  }, []);

  const filteredTasks = useMemo(() => {
    const tasksArray = Array.isArray(tasks) ? tasks : [];
    const now = new Date();

    return tasksArray.filter((t) => {
      if (isTaskCancelled(t)) return false;
      if (!showCompleted && isTaskCompleted(t)) return false;
      if (agendaView === 'ahora') return isInAhora(t, now);
      if (agendaView === 'luego') return isInLuego(t, now);
      return false;
    });
  }, [tasks, agendaView, showCompleted]);

  return {
    filteredTasks,
    agendaView,
    showCompleted,
    setShowCompleted,
  };
}

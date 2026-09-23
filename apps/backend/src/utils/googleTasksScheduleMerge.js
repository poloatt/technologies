import { Tareas } from '../models/index.js';
import { parseScheduleFromNotes, taskHasTimedSchedule } from '../../../shared/utils/googleTasksScheduleNotes.js';

/**
 * Fusiona due de Google (solo día) con horario local/timed sin pisar la hora del usuario.
 * El día siempre sigue a Google; el reloj de pared (notes o fechaInicio) se conserva.
 */
export function mergeGoogleDueWithLocalSchedule(tarea, googleDueRaw) {
  if (!googleDueRaw || !tarea) return;

  const dueDate = Tareas.parseGoogleDueDate(googleDueRaw);
  if (!dueDate) return;

  const sync = tarea.googleTasksSync || {};
  const scheduleFromNotes = parseScheduleFromNotes(tarea.descripcion || '');
  const hasTimed = taskHasTimedSchedule(tarea) || Boolean(scheduleFromNotes?.fechaInicio);
  const needsSync = sync.needsSync === true;

  if (!hasTimed && !needsSync) {
    tarea.fechaVencimiento = dueDate;
    tarea.fechaInicio = dueDate;
    return;
  }

  const clockSource = scheduleFromNotes?.fechaInicio
    || (tarea.fechaInicio instanceof Date
      ? tarea.fechaInicio
      : (tarea.fechaInicio ? new Date(tarea.fechaInicio) : null));

  if (!clockSource || Number.isNaN(clockSource.getTime())) {
    tarea.fechaInicio = dueDate;
    tarea.fechaVencimiento = dueDate;
    return;
  }

  const newStart = new Date(dueDate);
  newStart.setHours(
    clockSource.getHours(),
    clockSource.getMinutes(),
    clockSource.getSeconds(),
    0,
  );
  tarea.fechaInicio = newStart;

  const endSource = scheduleFromNotes?.fechaFin
    || tarea.fechaFin
    || tarea.fechaVencimiento;
  const localEnd = endSource instanceof Date ? endSource : (endSource ? new Date(endSource) : null);

  if (localEnd && !Number.isNaN(localEnd.getTime()) && localEnd.getTime() > clockSource.getTime()) {
    const durationMs = localEnd.getTime() - clockSource.getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);
    tarea.fechaVencimiento = newEnd;
    if (tarea.fechaFin || scheduleFromNotes?.fechaFin) tarea.fechaFin = newEnd;
  } else {
    tarea.fechaVencimiento = newStart;
  }

  if (!tarea.googleTasksSync) tarea.googleTasksSync = {};
  tarea.googleTasksSync.hasTimedSchedule = true;
}

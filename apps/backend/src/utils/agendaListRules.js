/**
 * Reglas Ahora/Luego para filtrado en servidor (alineado con @shared/utils/agendaRules).
 */

export function parseTaskDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function isTaskCompleted(t) {
  if (!t) return false;
  if (t.completada === true || t.completada === 'true') return true;
  if (String(t.estado || '').toUpperCase() === 'COMPLETADA') return true;
  const gCompleted = t.googleTasksSync?.completed;
  if (gCompleted instanceof Date) return !Number.isNaN(gCompleted.getTime());
  if (typeof gCompleted === 'string' && gCompleted.trim()) return true;
  return false;
}

export function isTaskCancelled(t) {
  if (!t) return false;
  return String(t.estado || '').toUpperCase() === 'CANCELADA';
}

export function isTaskArchived(t) {
  return isTaskCompleted(t) || isTaskCancelled(t);
}

export function getTaskDue(t) {
  const due = parseTaskDate(
    t?.fechaVencimiento || t?.vencimiento || t?.dueDate || t?.fecha,
  );
  if (due) return due;
  if (String(t?.tipo || '').toUpperCase() === 'EVENTO') {
    return parseTaskDate(t?.fechaFin);
  }
  return null;
}

export function getTaskStart(t) {
  return parseTaskDate(t?.fechaInicio || t?.inicio || t?.start);
}

function getEndOfTomorrow(now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfTomorrow = new Date(startOfToday);
  endOfTomorrow.setDate(startOfToday.getDate() + 1);
  endOfTomorrow.setHours(23, 59, 59, 999);
  return endOfTomorrow;
}

export function isInAhora(task, now = new Date()) {
  const due = getTaskDue(task);
  const start = getTaskStart(task);
  const endOfTomorrow = getEndOfTomorrow(now);
  if (!due && !start) return true;
  if (due) return due <= endOfTomorrow;
  return start <= endOfTomorrow;
}

export function isInLuego(task, now = new Date()) {
  const due = getTaskDue(task);
  const start = getTaskStart(task);
  const endOfTomorrow = getEndOfTomorrow(now);
  if (!due && !start) return false;
  if (due) return due > endOfTomorrow;
  return start > endOfTomorrow;
}

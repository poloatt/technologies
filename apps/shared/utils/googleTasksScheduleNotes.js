import { isDateOnlyDueInstant, parseTaskDate } from './taskDateUtils.js';

const SCHEDULE_HEADER = 'Horario Attadia:';
const END_MARKERS = ['Subtareas:', 'Objetivo:', 'Proyecto:', 'Recurrencia:', '---', SCHEDULE_HEADER];

const isGoogleTaskOrigin = (task) => Boolean(
  task?.googleTasksSync?.googleTaskId
  || task?.googleTasksSync?.enabled
  || task?.googleTasksSync?.googleTaskListId,
);

/** Tarea con horario de pared (notes Attadia, flag o fechas locales). */
export function taskHasTimedSchedule(task) {
  if (task?.googleTasksSync?.hasTimedSchedule) return true;

  const schedule = parseScheduleFromNotes(task?.descripcion || '');
  if (schedule?.fechaInicio) return true;

  const start = parseTaskDate(task?.fechaInicio || task?.inicio || task?.start);
  const end = parseTaskDate(task?.fechaFin || task?.fechaVencimiento || task?.vencimiento);
  if (start && end && isTimedScheduleInstant(start, end)) return true;

  if (start && isGoogleTaskOrigin(task) && !isDateOnlyDueInstant(null, start)) {
    return true;
  }

  return false;
}

export const parseScheduleFromNotes = (notes) => {
  const text = String(notes || '');
  const headerIdx = text.indexOf(SCHEDULE_HEADER);
  if (headerIdx === -1) return null;

  const block = text.slice(headerIdx + SCHEDULE_HEADER.length);
  const inicioMatch = block.match(/inicio:\s*(\S+)/i);
  const finMatch = block.match(/fin:\s*(\S+)/i);
  if (!inicioMatch) return null;

  const fechaInicio = new Date(inicioMatch[1]);
  if (Number.isNaN(fechaInicio.getTime())) return null;

  let fechaFin = null;
  if (finMatch) {
    const parsedFin = new Date(finMatch[1]);
    if (!Number.isNaN(parsedFin.getTime())) fechaFin = parsedFin;
  }

  return healLegacyHourSchedule({ fechaInicio, fechaFin });
};

/** Default histórico Attadia = 60 min → normalizar a 30. */
export function healLegacyHourSchedule(schedule) {
  if (!schedule?.fechaInicio) return schedule;
  const start = schedule.fechaInicio instanceof Date
    ? schedule.fechaInicio
    : new Date(schedule.fechaInicio);
  if (Number.isNaN(start.getTime())) return schedule;

  let fin = schedule.fechaFin
    ? (schedule.fechaFin instanceof Date ? schedule.fechaFin : new Date(schedule.fechaFin))
    : null;
  if (fin && Number.isNaN(fin.getTime())) fin = null;

  if (fin && fin.getTime() - start.getTime() === 60 * 60 * 1000) {
    fin = new Date(start.getTime() + 30 * 60 * 1000);
  }

  return { fechaInicio: start, fechaFin: fin };
}

export const stripScheduleFromNotes = (notes) => {
  const text = String(notes || '');
  const headerIdx = text.indexOf(SCHEDULE_HEADER);
  if (headerIdx === -1) return text.trim();

  const before = text.slice(0, headerIdx).trimEnd();
  const afterBlock = text.slice(headerIdx + SCHEDULE_HEADER.length);
  const nextMarkerIdx = END_MARKERS.slice(1).reduce((min, marker) => {
    const idx = afterBlock.indexOf(`\n${marker}`);
    return idx === -1 ? min : Math.min(min, idx);
  }, afterBlock.length);
  const after = afterBlock.slice(nextMarkerIdx).trim();
  return [before, after].filter(Boolean).join('\n\n').trim();
};

export const appendScheduleToNotes = (notes, fechaInicio, fechaFin) => {
  const base = stripScheduleFromNotes(notes);
  const inicioIso = fechaInicio instanceof Date
    ? fechaInicio.toISOString()
    : new Date(fechaInicio).toISOString();
  const finIso = fechaFin instanceof Date
    ? fechaFin.toISOString()
    : new Date(fechaFin).toISOString();

  const block = `${SCHEDULE_HEADER}\ninicio: ${inicioIso}\nfin: ${finIso}`;
  return base ? `${base}\n\n${block}` : block;
};

export const isTimedScheduleInstant = (start, end) => {
  if (!start || !end) return false;
  const s = start instanceof Date ? start : new Date(start);
  const e = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
  const durationMs = e.getTime() - s.getTime();
  const notCanonicalMidday = !(s.getHours() === 12 && s.getMinutes() === 0 && s.getSeconds() === 0);
  return durationMs >= 30 * 60 * 1000 || notCanonicalMidday;
};

export { isGoogleTaskOrigin };

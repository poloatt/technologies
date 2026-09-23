import { Tareas, TareaSeries } from '../models/index.js';
import { isTaskCompleted } from './agendaListRules.js';
import { expandSerie } from './recurrenceUtils.js';

function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function taskStartDate(task) {
  const raw = task?.fechaInicio || task?.fechaVencimiento;
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function taskDurationMs(task, start) {
  const endRaw = task?.fechaFin;
  if (!endRaw || !start) return 0;
  const end = endRaw instanceof Date ? endRaw : new Date(endRaw);
  if (Number.isNaN(end.getTime()) || end <= start) return 0;
  const ms = end.getTime() - start.getTime();
  if (ms > 8 * 60 * 60 * 1000) return 0;
  return ms;
}

/** 00:15 o mediodía sin duración: relleno de Google Tasks, no un horario de grilla. */
export function isPlaceholderWallClock(date, { hasDuration = false } = {}) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  if (hasDuration && d.getHours() >= 6) return false;
  if (d.getHours() < 6) return true;
  if (!hasDuration && d.getHours() === 12 && d.getMinutes() === 0 && d.getSeconds() === 0) return true;
  if (!hasDuration && d.toISOString().endsWith('T12:00:00.000Z')) return true;
  return false;
}

export function taskUsesPlaceholderClock(task) {
  const start = taskStartDate(task);
  if (!start) return false;
  return isPlaceholderWallClock(start, { hasDuration: taskDurationMs(task, start) > 0 });
}

/** Reloj usable de una serie: prioriza la instancia abierta con hora real. */
export function pickRealWallClock(tasks = []) {
  const ranked = [];
  for (const task of tasks) {
    const start = taskStartDate(task);
    if (!start) continue;
    const durationMs = taskDurationMs(task, start);
    if (isPlaceholderWallClock(start, { hasDuration: durationMs > 0 })) continue;
    const estado = String(task.estado || '').toUpperCase();
    const rank = estado === 'CANCELADA' ? 2 : (isTaskCompleted(task) ? 1 : 0);
    ranked.push({
      hours: start.getHours(),
      minutes: start.getMinutes(),
      durationMs: durationMs || 30 * 60 * 1000,
      rank,
      updated: new Date(task.updatedAt || 0).getTime(),
    });
  }
  ranked.sort((a, b) => (a.rank - b.rank) || (b.updated - a.updated));
  return ranked[0] || null;
}

function isDateOnlySerieAnchor(anchor) {
  if (!anchor || Number.isNaN(anchor.getTime())) return false;
  if (anchor.getMinutes() !== 0 || anchor.getSeconds() !== 0) return false;
  return anchor.getHours() === 12 || anchor.getHours() === 0;
}

/** Aplica la hora de la serie (p. ej. due de Google) a cada ocurrencia del RRULE. */
function occurrenceWithSerieTime(occ, serieDtstart) {
  const occDate = occ instanceof Date ? new Date(occ.getTime()) : new Date(occ);
  if (Number.isNaN(occDate.getTime())) return null;

  const anchor = serieDtstart ? new Date(serieDtstart) : null;
  if (anchor && !Number.isNaN(anchor.getTime())) {
    if (isDateOnlySerieAnchor(anchor)) {
      occDate.setHours(12, 0, 0, 0);
    } else {
      occDate.setHours(
        anchor.getHours(),
        anchor.getMinutes(),
        anchor.getSeconds(),
        anchor.getMilliseconds(),
      );
    }
  } else if (occDate.getHours() === 0 && occDate.getMinutes() === 0) {
    occDate.setHours(12, 0, 0, 0);
  }
  return occDate;
}

/** Alinea la hora de una ocurrencia con dtstart (p. ej. mediodía local en Google Tasks). */
export function applySerieTimeToOccurrence(occ, dtstart) {
  const d = new Date(occ);
  const ref = dtstart instanceof Date ? dtstart : new Date(dtstart);
  if (!Number.isNaN(ref.getTime())) {
    if (isDateOnlySerieAnchor(ref)) {
      d.setHours(12, 0, 0, 0);
    } else {
      d.setHours(ref.getHours(), ref.getMinutes(), ref.getSeconds(), ref.getMilliseconds());
    }
  } else {
    d.setHours(12, 0, 0, 0);
  }
  return d;
}

/** Reloj de pared del ancla Google (fechaInicio timed o noon). */
function resolveAnchorWallClock(anchor) {
  if (!anchor) return null;
  const startRaw = anchor.fechaInicio || anchor.fechaVencimiento;
  if (!startRaw) return null;
  const start = startRaw instanceof Date ? startRaw : new Date(startRaw);
  if (Number.isNaN(start.getTime())) return null;
  const endRaw = anchor.fechaFin || anchor.fechaVencimiento;
  const end = endRaw
    ? (endRaw instanceof Date ? endRaw : new Date(endRaw))
    : null;
  const timed = Boolean(
    anchor.googleTasksSync?.hasTimedSchedule
    || (!isDateOnlySerieAnchor(start) && (start.getHours() !== 12 || start.getMinutes() !== 0)),
  );
  return { start, end: end && !Number.isNaN(end.getTime()) ? end : null, timed };
}

function applyWallClockToOccurrence(occ, serieDtstart, anchorClock) {
  const occDate = occ instanceof Date ? new Date(occ.getTime()) : new Date(occ);
  if (Number.isNaN(occDate.getTime())) return null;

  if (anchorClock?.timed && anchorClock.start) {
    occDate.setHours(
      anchorClock.start.getHours(),
      anchorClock.start.getMinutes(),
      anchorClock.start.getSeconds(),
      anchorClock.start.getMilliseconds(),
    );
    return occDate;
  }

  return occurrenceWithSerieTime(occDate, serieDtstart);
}

function serieIdStr(serieId) {
  if (serieId == null) return '';
  return String(serieId._id ?? serieId);
}

/**
 * Una fila por serie y día: preferir ancla (googleTaskId) frente a instancias materializadas.
 */
export function dedupeSerieInstancesForAgenda(tasks = []) {
  const list = Array.isArray(tasks) ? tasks : [];
  const anchorBySerie = new Map();

  for (const t of list) {
    if (!t.serieId) continue;
    const sid = serieIdStr(t.serieId);
    if (sid && t.googleTasksSync?.googleTaskId) {
      anchorBySerie.set(sid, t);
    }
  }

  const keptPerSerieDay = new Set();

  return list.filter((t) => {
    if (!t.serieId) return true;

    const sid = serieIdStr(t.serieId);
    const anchor = anchorBySerie.get(sid);
    if (anchor && String(t._id) === String(anchor._id)) {
      if (!taskUsesPlaceholderClock(anchor)) return true;
      const anchorDay = dayKey(taskStartDate(anchor));
      const betterSameDay = list.some((other) => {
        if (String(other._id) === String(anchor._id)) return false;
        if (serieIdStr(other.serieId) !== sid) return false;
        const otherStart = taskStartDate(other);
        if (!otherStart || dayKey(otherStart) !== anchorDay) return false;
        return !taskUsesPlaceholderClock(other);
      });
      return !betterSameDay;
    }
    if (anchor) {
      const raw = t.fechaVencimiento || t.fechaInicio;
      const anchorRaw = anchor.fechaVencimiento || anchor.fechaInicio;
      if (raw && anchorRaw && dayKey(raw) === dayKey(anchorRaw)) {
        if (taskUsesPlaceholderClock(anchor) && !taskUsesPlaceholderClock(t)) {
          const key = `${sid}|${dayKey(raw)}`;
          if (keptPerSerieDay.has(key)) return false;
          keptPerSerieDay.add(key);
          return true;
        }
        return false;
      }
      const key = `${sid}|${dayKey(raw)}`;
      if (keptPerSerieDay.has(key)) return false;
      keptPerSerieDay.add(key);
      return true;
    }

    const raw = t.fechaVencimiento || t.fechaInicio;
    const key = `${sid}|${dayKey(raw)}`;
    if (keptPerSerieDay.has(key)) return false;
    keptPerSerieDay.add(key);
    return true;
  });
}

/** Misma tarea de Google repetida en BD (sin serieId): una fila por googleTaskId y día. */
export function dedupeAgendaTasksByGoogleDay(tasks = []) {
  const list = Array.isArray(tasks) ? tasks : [];
  const seen = new Set();
  return list.filter((t) => {
    if (t?.virtual) return true;
    const gtid = t?.googleTasksSync?.googleTaskId;
    if (!gtid) return true;
    const raw = t.fechaVencimiento || t.fechaInicio;
    if (!raw) return true;
    const key = `${gtid}|${dayKey(raw)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isGoogleOriginSerie(serie) {
  return Boolean(serie?.googleSerieKey);
}

/**
 * Anclas Google por serie (fuera del rango visible del calendario).
 */
export async function loadGoogleAnchorsBySerie(userId, serieIds = []) {
  const ids = (Array.isArray(serieIds) ? serieIds : [])
    .map((id) => String(id?._id ?? id))
    .filter(Boolean);
  if (!ids.length || !userId) return new Map();

  const anchors = await Tareas.find({
    usuario: userId,
    serieId: { $in: ids },
    'googleTasksSync.googleTaskId': { $exists: true, $ne: null },
  })
    .select('serieId completada estado fechaInicio fechaFin fechaVencimiento googleTasksSync')
    .lean();

  const map = new Map();
  for (const t of anchors) {
    const sid = serieIdStr(t.serieId);
    if (!sid || map.has(sid)) continue;
    map.set(sid, t);
  }
  return map;
}

/**
 * Ocurrencias virtuales (no persistidas) para el calendario — modelo tipo Google Tasks.
 */
export function buildVirtualTasksForRange(
  series = [],
  rangeFrom,
  rangeTo,
  existingTasks = [],
  externalAnchorsBySerie = new Map(),
) {
  const from = new Date(rangeFrom);
  const to = new Date(rangeTo);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  const occupied = new Set();
  const anchorBySerie = new Map();

  for (const t of existingTasks) {
    const sid = serieIdStr(t.serieId);
    if (!sid) continue;
    const d = t.fechaVencimiento || t.fechaInicio;
    if (d) occupied.add(`${sid}|${dayKey(d)}`);
    if (t.googleTasksSync?.googleTaskId) {
      anchorBySerie.set(sid, t);
    }
  }

  if (externalAnchorsBySerie instanceof Map) {
    for (const [sid, anchor] of externalAnchorsBySerie) {
      if (!anchorBySerie.has(sid)) anchorBySerie.set(sid, anchor);
    }
  }

  const virtual = [];

  for (const serie of series) {
    if (!serie?.activa || !serie.rrule) continue;

    const sid = String(serie._id);
    const anchor = anchorBySerie.get(sid);
    const googleSerie = isGoogleOriginSerie(serie);

    if (googleSerie && !anchor) continue;
    if (anchor && isTaskCompleted(anchor)) continue;

    // Google Tasks solo tiene la instancia actual. Expandir el RRULE en el rango
    // reinyecta tareas de hace años (GSUITE, B corp, recibos 2019) en la semana visible.
    const exportInstances = serie.googleTasksSync?.exportInstances === true;
    if (googleSerie && !exportInstances) continue;

    const dtstart = new Date(serie.dtstart);
    if (Number.isNaN(dtstart.getTime())) continue;

    let occurrences;
    try {
      occurrences = expandSerie(serie.rrule, dtstart, from, to);
    } catch {
      continue;
    }

    const anchorClock = resolveAnchorWallClock(anchor);

    for (const occ of occurrences) {
      const occAt = applyWallClockToOccurrence(occ, dtstart, anchorClock);
      if (!occAt) continue;

      const dk = dayKey(occAt);
      const key = `${sid}|${dk}`;
      if (occupied.has(key)) continue;
      occupied.add(key);

      virtual.push({
        _id: `virtual:${serie._id}:${dk}`,
        titulo: serie.titulo,
        descripcion: serie.descripcion || '',
        usuario: serie.usuario,
        objetivo: serie.objetivo,
        serieId: serie._id,
        fechaInicio: occAt,
        fechaVencimiento: occAt,
        fechaFin: anchorClock?.end
          ? new Date(
            occAt.getTime() + (anchorClock.end.getTime() - anchorClock.start.getTime()),
          )
          : undefined,
        tipo: 'TAREA',
        estado: 'PENDIENTE',
        completada: false,
        virtual: true,
        esRecurrente: true,
        googleTasksSync: {
          enabled: false,
          googleTaskListId: serie.googleTasksSync?.googleTaskListId || null,
          hasTimedSchedule: Boolean(anchorClock?.timed),
        },
      });
    }
  }

  return virtual;
}

export async function loadSeriesForAgenda(userId, { from, to } = {}) {
  const query = {
    usuario: userId,
    activa: true,
    rrule: { $exists: true, $ne: '' },
  };

  // Descartar series que no pueden tener ocurrencias en el rango visible:
  // - dtstart posterior al fin del rango
  // - serie finalizada (hasta) antes del inicio del rango
  if (to) {
    query.dtstart = { $lte: new Date(to) };
  }
  if (from) {
    query.$or = [
      { hasta: { $exists: false } },
      { hasta: null },
      { hasta: { $gte: new Date(from) } },
    ];
  }

  return TareaSeries.find(query)
    .populate('objetivo', 'nombre estado')
    .lean();
}

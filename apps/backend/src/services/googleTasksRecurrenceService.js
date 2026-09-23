import { Tareas, TareaSeries } from '../models/index.js';
import logger from '../utils/logger.js';
import {
  appendRecurrenceToNotes,
  buildGoogleSerieKey,
  collectDueDatesFromTasks,
  expandSerie,
  inferRecurrenceFromGoogleNotes,
  ensureWeeklyByday,
  inferRruleFromDueDates,
  cleanDescriptionFromGoogleNotes,
  parseRecurrenceFromNotes,
  resolveRruleFromNotes,
  sameCalendarDay,
  weekdayToRruleByday,
} from '../utils/recurrenceUtils.js';
import { applySerieTimeToOccurrence, isPlaceholderWallClock, pickRealWallClock } from '../utils/calendarVirtualUtils.js';
import { isTaskCompleted } from '../utils/agendaListRules.js';
import { mergeGoogleDueWithLocalSchedule } from '../utils/googleTasksScheduleMerge.js';

const HORIZON_DAYS = parseInt(process.env.GTASKS_SERIES_HORIZON_DAYS || '90', 10);
const EXPAND_LOOKBACK_DAYS = parseInt(process.env.GTASKS_SERIES_LOOKBACK_DAYS || '14', 10);
/** Mínimo de fechas distintas para inferir RRULE solo por due dates. */
const MIN_INFERRED_DUE_DATES = parseInt(process.env.GTASKS_MIN_INFERRED_DUE_DATES || '2', 10);
/**
 * Opt-in: inferir semanal cuando Google solo devuelve 1 fila por título.
 * Por defecto false — evita crear cientos de TareaSeries en tareas con fecha única.
 */
const ASSUME_GOOGLE_RECURRING_SINGLE =
  process.env.GTASKS_ASSUME_GOOGLE_RECURRING_SINGLE === 'true';

function isDateOnlyLike(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  if (date.getMinutes() !== 0 || date.getSeconds() !== 0) return false;
  return date.getHours() === 12 || date.getHours() === 0;
}

function hasExplicitRecurrenceEvidence({
  rruleFromNotes,
  rruleFromGoogleNotes,
  googleRruleForKey,
  inferredFromDueDates,
  rruleFromStoredHint,
}) {
  return Boolean(
    rruleFromNotes
    || rruleFromGoogleNotes
    || googleRruleForKey
    || inferredFromDueDates
    || rruleFromStoredHint,
  );
}

/**
 * Reconcilia tareas importadas de una TaskList en series recurrentes.
 */
export async function reconcileSeriesFromGoogle(userId, objetivoId, taskListId, googleMainTasks = []) {
  const stats = { seriesCreated: 0, seriesUpdated: 0, instancesLinked: 0 };

  const googleDuesByKey = new Map();
  const googleRruleByKey = new Map();
  const googleById = new Map();
  const normalizeGoogleTitle = (title) =>
    String(title || '')
      .replace(/^\s*(\[[^\]]+\]\s*)+/g, '')
      .replace(/\s+(\[[^\]]+\])\s+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

  for (const gt of googleMainTasks) {
    if (gt?.parent) continue;
    if (gt?.id) googleById.set(gt.id, gt);
    const key = buildGoogleSerieKey(taskListId, normalizeGoogleTitle(gt.title));
    const fromNotes = resolveRruleFromNotes(gt.notes || '');
    if (fromNotes) googleRruleByKey.set(key, fromNotes);
    const due = Tareas.parseGoogleDueDate(gt.due);
    if (!due) continue;
    if (!googleDuesByKey.has(key)) googleDuesByKey.set(key, []);
    googleDuesByKey.get(key).push(due);
  }

  const tareas = await Tareas.find({
    usuario: userId,
    objetivo: objetivoId,
    'googleTasksSync.googleTaskListId': taskListId,
    esExcepcionSerie: { $ne: true },
  });

  const groups = new Map();
  for (const tarea of tareas) {
    const key = buildGoogleSerieKey(taskListId, tarea.titulo);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tarea);
  }

  for (const [googleSerieKey, group] of groups) {
    let rruleFromNotes = null;
    let rruleFromGoogleNotes = null;
    let rruleFromStoredHint = null;

    for (const t of group) {
      const rawNotes =
        googleById.get(t.googleTasksSync?.googleTaskId)?.notes
        ?? t.descripcion
        ?? '';
      const parsed = parseRecurrenceFromNotes(rawNotes);
      if (parsed.rrule) rruleFromNotes = parsed.rrule;
      const googleHint = inferRecurrenceFromGoogleNotes(rawNotes);
      if (googleHint) rruleFromGoogleNotes = googleHint;
      if (t.googleTasksSync?.recurrenceHint) {
        rruleFromStoredHint = String(t.googleTasksSync.recurrenceHint);
      }
    }

    let dueDates = collectDueDatesFromTasks(group);
    const extraGoogleDues = googleDuesByKey.get(googleSerieKey) || [];
    if (extraGoogleDues.length) {
      dueDates = collectDueDatesFromTasks([
        ...group,
        ...extraGoogleDues.map((d) => ({ fechaVencimiento: d })),
      ]);
    }
    for (const t of group) {
      const hist = Array.isArray(t.googleDueHistory) ? t.googleDueHistory : [];
      if (hist.length) {
        dueDates = collectDueDatesFromTasks([
          ...dueDates.map((d) => ({ fechaVencimiento: d })),
          ...hist.map((d) => ({ fechaVencimiento: d })),
        ]);
      }
    }
    const inferredFromDueDates = dueDates.length >= MIN_INFERRED_DUE_DATES
      ? inferRruleFromDueDates(dueDates)
      : null;
    const googleRruleForKey = googleRruleByKey.get(googleSerieKey) || null;
    let rrule = rruleFromNotes
      || googleRruleForKey
      || rruleFromGoogleNotes
      || rruleFromStoredHint
      || inferredFromDueDates;

    const googleAnchors = group.filter((t) => t.googleTasksSync?.googleTaskId);
    const recurrenceAnchor = googleAnchors[0] || group[0];

    if (
      !rrule
      && ASSUME_GOOGLE_RECURRING_SINGLE
      && googleAnchors.length === 1
      && (recurrenceAnchor.fechaVencimiento || recurrenceAnchor.fechaInicio)
    ) {
      const anchor = recurrenceAnchor.fechaVencimiento || recurrenceAnchor.fechaInicio;
      const anchorDate = anchor instanceof Date ? anchor : new Date(anchor);
      const byday = weekdayToRruleByday(anchorDate);
      if (byday) {
        rrule = `FREQ=WEEKLY;INTERVAL=1;BYDAY=${byday}`;
      }
    }

    if (!rrule) continue;

    // Ancla local COMPLETADA no desactiva la serie si Google sigue en needsAction
    // (due ya roló a la próxima semana).
    const googleAnchorTask = googleById.get(recurrenceAnchor.googleTasksSync?.googleTaskId);
    const googleStillOpen = Boolean(
      googleAnchorTask
      && googleAnchorTask.status !== 'completed'
      && !googleAnchorTask.deleted,
    );
    if (isTaskCompleted(recurrenceAnchor) && !googleStillOpen) {
      const existingSerie = await TareaSeries.findOne({ usuario: userId, googleSerieKey });
      if (existingSerie?.activa) {
        existingSerie.activa = false;
        await existingSerie.save();
      }
      continue;
    }

    const evidenceArgs = {
      rruleFromNotes,
      rruleFromGoogleNotes,
      googleRruleForKey,
      inferredFromDueDates,
      rruleFromStoredHint,
    };

    const fromAssumeHeuristic =
      ASSUME_GOOGLE_RECURRING_SINGLE
      && googleAnchors.length === 1
      && !hasExplicitRecurrenceEvidence(evidenceArgs);

    if (!hasExplicitRecurrenceEvidence(evidenceArgs) && !fromAssumeHeuristic) {
      continue;
    }

    const titulo = recurrenceAnchor.titulo || group[0].titulo;
    const dtstart = dueDates.length
      ? new Date(Math.min(...dueDates.map((d) => d.getTime())))
      : recurrenceAnchor.fechaVencimiento
        || recurrenceAnchor.fechaInicio
        || group[0].fechaInicio
        || new Date();

    rrule = ensureWeeklyByday(rrule, dtstart);

    let serie = await TareaSeries.findOne({ usuario: userId, googleSerieKey });

    if (!serie) {
      serie = new TareaSeries({
        titulo,
        descripcion: cleanDescriptionFromGoogleNotes(group[0].descripcion || ''),
        usuario: userId,
        objetivo: objetivoId,
        rrule,
        dtstart,
        googleSerieKey,
        googleTasksSync: {
          enabled: true,
          googleTaskListId: taskListId,
          exportInstances: false,
          lastSyncDate: new Date(),
        },
      });
      await serie.save();
      stats.seriesCreated++;
    } else {
      const prevRrule = serie.rrule;
      const prevTitulo = serie.titulo;
      const prevDt = serie.dtstart ? new Date(serie.dtstart).getTime() : null;
      const nextDt = dtstart instanceof Date ? dtstart.getTime() : new Date(dtstart).getTime();

      serie.rrule = rrule;
      serie.dtstart = dtstart;
      serie.titulo = titulo;
      if (!serie.activa) {
        serie.activa = true;
      }
      serie.googleTasksSync = serie.googleTasksSync || {};
      serie.googleTasksSync.googleTaskListId = taskListId;
      serie.googleTasksSync.exportInstances = false;
      serie.googleTasksSync.lastSyncDate = new Date();

      const changed =
        prevRrule !== rrule
        || prevTitulo !== titulo
        || prevDt !== nextDt
        || serie.isModified('activa');

      if (changed) {
        await serie.save();
        stats.seriesUpdated++;
      }
    }

    const anchorGt = googleById.get(recurrenceAnchor.googleTasksSync?.googleTaskId);
    const anchorDue = anchorGt?.due ? Tareas.parseGoogleDueDate(anchorGt.due) : null;

    for (const t of group) {
      const rawNotes =
        googleById.get(t.googleTasksSync?.googleTaskId)?.notes
        ?? t.descripcion
        ?? '';
      const cleaned = cleanDescriptionFromGoogleNotes(rawNotes);
      const wasLinked = String(t.serieId) === String(serie._id);
      const isAnchor = String(t._id) === String(recurrenceAnchor._id);
      const dueFromGoogle =
        isAnchor && anchorDue
          ? anchorDue
          : googleById.get(t.googleTasksSync?.googleTaskId)?.due
            ? Tareas.parseGoogleDueDate(googleById.get(t.googleTasksSync.googleTaskId).due)
            : null;
      const needsDueSync =
        dueFromGoogle
        && (() => {
          const local = t.fechaVencimiento || t.fechaInicio;
          if (!local) return true;
          const localDt = local instanceof Date ? local : new Date(local);
          return Math.abs(localDt.getTime() - dueFromGoogle.getTime()) > 60_000;
        })();
      const gt = googleById.get(t.googleTasksSync?.googleTaskId);
      let needsStatusSync = false;
      if (gt) {
        const googleCompleted = gt.status === 'completed' || gt.hidden === true;
        const localCompleted =
          Boolean(t.completada)
          || String(t.estado || '').toUpperCase() === 'COMPLETADA';
        needsStatusSync = googleCompleted !== localCompleted;
        // La fila de Google es una sola. needsAction es el próximo turno, no desmarca la ocurrencia ya hecha.
        if (needsStatusSync && localCompleted && !googleCompleted && t.serieId) {
          needsStatusSync = false;
        }
        if (needsStatusSync) {
          t.completada = googleCompleted;
          t.estado = googleCompleted ? 'COMPLETADA' : 'PENDIENTE';
          if (gt.completed) {
            t.googleTasksSync = t.googleTasksSync || {};
            t.googleTasksSync.completed = new Date(gt.completed);
          }
        }
      }

      const needsSave =
        !wasLinked
        || (t.descripcion || '') !== cleaned
        || needsDueSync
        || needsStatusSync;

      if (!needsSave) continue;

      t.$locals = { ...(t.$locals || {}), skipGoogleSyncMark: true };
      t.serieId = serie._id;
      t.descripcion = cleaned;
      if (dueFromGoogle) {
        const rawDue =
          (isAnchor && anchorGt?.due)
            ? anchorGt.due
            : googleById.get(t.googleTasksSync?.googleTaskId)?.due;
        if (typeof t.recordGoogleDueSnapshot === 'function') {
          t.recordGoogleDueSnapshot(dueFromGoogle);
        }
        if (rawDue) {
          // Preserva horario local (Horario Attadia); Google due es solo día
          mergeGoogleDueWithLocalSchedule(t, rawDue);
        } else {
          t.fechaVencimiento = dueFromGoogle;
          t.fechaInicio = dueFromGoogle;
        }
      }
      if (
        !wasLinked
        && t.googleTasksSync?.enabled
        && serie.googleTasksSync?.exportInstances === true
      ) {
        t.googleTasksSync.needsSync = true;
      }
      await t.save();
      if (!wasLinked) stats.instancesLinked++;
    }
  }

  logger.sync?.(
    `🔁 Series reconciliadas (list=${taskListId}): +${stats.seriesCreated} nuevas, ${stats.seriesUpdated} actualizadas, ${stats.instancesLinked} instancias`,
  );

  return stats;
}

/**
 * Expande una serie en instancias locales (calendario) y opcionalmente las exporta a Google.
 * @param {{ horizonDays?: number, syncToGoogle?: boolean, rangeFrom?: Date, rangeTo?: Date }} options
 */
export async function expandAndSyncSeries(googleTasksService, userId, serie, options = {}) {
  const horizonDays = options.horizonDays ?? HORIZON_DAYS;
  const syncToGoogle = options.syncToGoogle !== false;
  const exportInstances = serie?.googleTasksSync?.exportInstances === true;
  const stats = { instancesCreated: 0, instancesSynced: 0, errors: [] };

  if (!serie?.activa || !serie.rrule) return stats;
  if (!exportInstances) return stats;

  let from;
  let to;
  if (options.rangeFrom && options.rangeTo) {
    from = new Date(options.rangeFrom);
    to = new Date(options.rangeTo);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    from = new Date(today);
    from.setDate(from.getDate() - EXPAND_LOOKBACK_DAYS);
    const dtstart = new Date(serie.dtstart);
    if (!isNaN(dtstart.getTime()) && dtstart < from) {
      from.setTime(dtstart.getTime());
      from.setHours(0, 0, 0, 0);
    }
    to = new Date(today);
    to.setDate(to.getDate() + horizonDays);
  }

  const occurrences = expandSerie(serie.rrule, new Date(serie.dtstart), from, to);

  for (const occDate of occurrences) {
    try {
      const dayStart = new Date(occDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(occDate);
      dayEnd.setHours(23, 59, 59, 999);

      let tarea = await Tareas.findOne({
        usuario: userId,
        serieId: serie._id,
        esExcepcionSerie: { $ne: true },
        $or: [
          { fechaInicio: { $gte: dayStart, $lte: dayEnd } },
          { fechaVencimiento: { $gte: dayStart, $lte: dayEnd } },
        ],
      });

      if (!tarea) {
        const occAt = applySerieTimeToOccurrence(occDate, serie.dtstart);
        tarea = new Tareas({
          titulo: serie.titulo,
          descripcion: appendRecurrenceToNotes(serie.descripcion || '', serie.rrule),
          usuario: userId,
          objetivo: serie.objetivo,
          serieId: serie._id,
          fechaInicio: occAt,
          fechaVencimiento: occAt,
          prioridad: 'BAJA',
          googleTasksSync: {
            enabled: exportInstances && serie.googleTasksSync?.enabled !== false,
            syncStatus: exportInstances ? 'pending' : 'synced',
            needsSync: exportInstances,
            googleTaskListId: serie.googleTasksSync?.googleTaskListId,
          },
        });
        await tarea.save();
        stats.instancesCreated++;
      } else if (!tarea.descripcion?.includes('Recurrencia:')) {
        tarea.descripcion = appendRecurrenceToNotes(tarea.descripcion || '', serie.rrule);
        if (exportInstances) {
          tarea.googleTasksSync = tarea.googleTasksSync || {};
          tarea.googleTasksSync.needsSync = true;
        }
        await tarea.save();
      }

      if (
        syncToGoogle
        && exportInstances
        && googleTasksService
        && tarea.googleTasksSync?.enabled
        && tarea.objetivo
      ) {
        await googleTasksService.syncTaskToGoogle(tarea._id, userId);
        stats.instancesSynced++;
      }
    } catch (err) {
      stats.errors.push(`${serie.titulo}@${occDate.toISOString()}: ${err.message}`);
    }
  }

  return stats;
}

export async function reconcileAllSeriesForUser(userId) {
  const series = await TareaSeries.find({ usuario: userId, activa: true });
  const totals = { seriesCreated: 0, seriesUpdated: 0, instancesLinked: 0 };

  const lists = new Set();
  for (const s of series) {
    if (s.googleTasksSync?.googleTaskListId) {
      lists.add(`${s.objetivo}|${s.googleTasksSync.googleTaskListId}`);
    }
  }

  const tareas = await Tareas.find({
    usuario: userId,
    'googleTasksSync.googleTaskListId': { $exists: true, $ne: null },
  });

  for (const t of tareas) {
    if (t.objetivo && t.googleTasksSync?.googleTaskListId) {
      lists.add(`${t.objetivo}|${t.googleTasksSync.googleTaskListId}`);
    }
  }

  for (const key of lists) {
    const [objetivoId, taskListId] = key.split('|');
    const r = await reconcileSeriesFromGoogle(userId, objetivoId, taskListId);
    totals.seriesCreated += r.seriesCreated;
    totals.seriesUpdated += r.seriesUpdated;
    totals.instancesLinked += r.instancesLinked;
  }

  return totals;
}

export async function expandAllSeriesForUser(googleTasksService, userId, options = {}) {
  const series = await TareaSeries.find({
    usuario: userId,
    activa: true,
    'googleTasksSync.enabled': { $ne: false },
    'googleTasksSync.exportInstances': true,
  });

  const totals = { instancesCreated: 0, instancesSynced: 0, errors: [] };

  for (const serie of series) {
    const r = await expandAndSyncSeries(googleTasksService, userId, serie, options);
    totals.instancesCreated += r.instancesCreated;
    totals.instancesSynced += r.instancesSynced;
    totals.errors.push(...r.errors);
  }

  return totals;
}

function rollWindowMs(rrule) {
  const src = String(rrule || '');
  const freq = src.match(/FREQ=([A-Z]+)/)?.[1] || 'WEEKLY';
  const interval = Number(src.match(/INTERVAL=(\d+)/)?.[1] || 1) || 1;
  const days = { DAILY: 1, WEEKLY: 7, MONTHLY: 31, YEARLY: 366 }[freq] || 7;
  // Al menos 14 días para no perder un diario completado hace unos días;
  // tope 21 días para no reabrir series viejas.
  const spanDays = Math.min(Math.max(days * interval * 2, 14), 21);
  return spanDays * 24 * 60 * 60 * 1000;
}

/** La ocurrencia anterior tiene que ser reciente: no reabrir series de hace años. */
export function isWithinRollWindow(anchorDate, rrule, now = new Date()) {
  const dt = anchorDate instanceof Date ? anchorDate : new Date(anchorDate);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.getTime() >= now.getTime() - rollWindowMs(rrule);
}

/**
 * Próxima fecha de una serie.
 * after-complete: la siguiente a partir de hoy (aunque sea futura).
 * current-if-due: solo si ese turno ya empezó (hoy o antes); si no, null.
 */
export function pickNextOccurrenceDate({
  rrule,
  dtstart,
  anchorDate,
  now = new Date(),
  mode = 'after-complete',
}) {
  if (!rrule || !anchorDate || !isWithinRollWindow(anchorDate, rrule, now)) return null;
  const anchor = new Date(anchorDate);
  if (Number.isNaN(anchor.getTime())) return null;
  const from = new Date(anchor);
  from.setDate(from.getDate() + 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + HORIZON_DAYS);
  const start = dtstart instanceof Date ? dtstart : new Date(dtstart);
  const upcoming = expandSerie(rrule, start, from, to);
  if (!upcoming.length) return null;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);

  if (mode === 'current-if-due') {
    const due = upcoming.filter((d) => new Date(d).getTime() <= endOfToday.getTime());
    if (!due.length) return null;
    return new Date(due[due.length - 1]);
  }

  const next = upcoming.find((d) => new Date(d).getTime() >= startOfToday.getTime());
  return new Date(next || upcoming[upcoming.length - 1]);
}

function applyAnchorWallClock(nextDue, anchorTask, serieDtstart) {
  let due = applySerieTimeToOccurrence(nextDue, serieDtstart);
  const anchorStart = anchorTask?.fechaInicio instanceof Date
    ? anchorTask.fechaInicio
    : (anchorTask?.fechaInicio ? new Date(anchorTask.fechaInicio) : null);
  if (
    anchorStart
    && !Number.isNaN(anchorStart.getTime())
    && (anchorTask.googleTasksSync?.hasTimedSchedule || !isDateOnlyLike(anchorStart))
  ) {
    due = new Date(due);
    due.setHours(anchorStart.getHours(), anchorStart.getMinutes(), anchorStart.getSeconds(), 0);
  }
  return due;
}

function occurrenceEnd(anchorTask, nextStart) {
  const prevStart = anchorTask?.fechaInicio instanceof Date
    ? anchorTask.fechaInicio
    : (anchorTask?.fechaInicio ? new Date(anchorTask.fechaInicio) : null);
  const prevEndRaw = anchorTask?.fechaFin || anchorTask?.fechaVencimiento;
  const prevEnd = prevEndRaw instanceof Date ? prevEndRaw : (prevEndRaw ? new Date(prevEndRaw) : null);
  if (prevStart && prevEnd && !Number.isNaN(prevEnd.getTime()) && prevEnd > prevStart) {
    return new Date(nextStart.getTime() + (prevEnd.getTime() - prevStart.getTime()));
  }
  return nextStart;
}

/**
 * Crea la próxima ocurrencia pendiente sin mover la anterior.
 * La fila ya completada (o la atrasada sin hacer) se queda en su fecha.
 */
export async function materializeNextOpenOccurrence(userId, tarea, options = {}) {
  const mode = options.mode || 'after-complete';
  const now = options.now instanceof Date ? options.now : new Date();
  if (!tarea?.serieId || tarea.esExcepcionSerie) return null;

  const serie = await TareaSeries.findOne({ _id: tarea.serieId, usuario: userId });
  if (!serie?.rrule) return null;

  const anchorRaw = tarea.fechaVencimiento || tarea.fechaInicio;
  const nextDay = pickNextOccurrenceDate({
    rrule: serie.rrule,
    dtstart: serie.dtstart,
    anchorDate: anchorRaw,
    now,
    mode,
  });
  if (!nextDay) return null;

  let nextDue = applyAnchorWallClock(nextDay, tarea, serie.dtstart);
  let nextEnd = occurrenceEnd(tarea, nextDue);
  if (isPlaceholderWallClock(nextDue, { hasDuration: nextEnd > nextDue })) {
    const clock = await resolveSerieRealClock(userId, serie._id);
    if (clock) {
      nextDue = new Date(nextDue);
      nextDue.setHours(clock.hours, clock.minutes, 0, 0);
      nextEnd = new Date(nextDue.getTime() + clock.durationMs);
    }
  }
  const dayStart = new Date(nextDue);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(nextDue);
  dayEnd.setHours(23, 59, 59, 999);

  const existing = await Tareas.findOne({
    usuario: userId,
    serieId: serie._id,
    esExcepcionSerie: { $ne: true },
    estado: { $ne: 'CANCELADA' },
    $or: [
      { fechaInicio: { $gte: dayStart, $lte: dayEnd } },
      { fechaVencimiento: { $gte: dayStart, $lte: dayEnd } },
    ],
  });
  if (existing) return existing;

  const exportInstances = serie.googleTasksSync?.exportInstances === true;
  const nueva = new Tareas({
    titulo: tarea.titulo || serie.titulo,
    descripcion: tarea.descripcion || appendRecurrenceToNotes(serie.descripcion || '', serie.rrule),
    usuario: userId,
    objetivo: tarea.objetivo || serie.objetivo,
    serieId: serie._id,
    fechaInicio: nextDue,
    fechaFin: nextEnd.getTime() !== nextDue.getTime() ? nextEnd : undefined,
    fechaVencimiento: nextEnd,
    prioridad: tarea.prioridad || 'BAJA',
    estado: 'PENDIENTE',
    completada: false,
    googleTasksSync: {
      enabled: exportInstances,
      syncStatus: exportInstances ? 'pending' : 'synced',
      needsSync: exportInstances,
      hasTimedSchedule: Boolean(tarea.googleTasksSync?.hasTimedSchedule),
      googleTaskListId: tarea.googleTasksSync?.googleTaskListId || serie.googleTasksSync?.googleTaskListId,
      localOccurrence: true,
    },
  });
  await nueva.save();

  // #region agent log
  fetch('http://127.0.0.1:7888/ingest/f576597c-5e27-437e-8e5f-1cd13a8697b4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b064c0' },
    body: JSON.stringify({
      sessionId: 'b064c0',
      runId: 'post-fix',
      hypothesisId: mode === 'current-if-due' ? 'D' : 'C',
      location: 'googleTasksRecurrenceService.js:materializeNextOpenOccurrence',
      message: 'spawned next occurrence',
      data: {
        title: String(nueva.titulo || '').slice(0, 60),
        mode,
        anchor: anchorRaw ? new Date(anchorRaw).toISOString() : null,
        next: nextDue.toISOString(),
        keptPrevious: true,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (exportInstances && options.syncToGoogle !== false && options.googleTasksService && nueva.objetivo) {
    try {
      await options.googleTasksService.syncTaskToGoogle(nueva._id, userId);
    } catch (err) {
      logger.warn?.(`No se pudo exportar siguiente ocurrencia de serie: ${err.message}`);
    }
  }

  return nueva;
}

async function resolveSerieRealClock(userId, serieId) {
  const open = await Tareas.find({
    usuario: userId,
    serieId,
    estado: { $ne: 'CANCELADA' },
  }).select('fechaInicio fechaFin fechaVencimiento estado completada updatedAt').lean();
  const fromOpen = pickRealWallClock(open);
  if (fromOpen) return fromOpen;
  const cancelled = await Tareas.find({
    usuario: userId,
    serieId,
    estado: 'CANCELADA',
  })
    .select('fechaInicio fechaFin fechaVencimiento estado completada updatedAt')
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();
  return pickRealWallClock(cancelled);
}

/**
 * Mueve instancias periódicas que quedaron en 00:15 / mediodía-sin-hora
 * al horario real de la serie, para que entren en la grilla y no en todo el día.
 */
export async function realignPlaceholderRecurringClocks(userId) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 14);
  const to = new Date(now);
  to.setDate(to.getDate() + 45);

  const pending = await Tareas.find({
    usuario: userId,
    serieId: { $exists: true, $ne: null },
    esExcepcionSerie: { $ne: true },
    estado: { $nin: ['COMPLETADA', 'CANCELADA'] },
    completada: { $ne: true },
    fechaInicio: { $gte: from, $lte: to },
  }).limit(120);

  const bySerie = new Map();
  for (const tarea of pending) {
    const sid = String(tarea.serieId);
    if (!bySerie.has(sid)) bySerie.set(sid, []);
    bySerie.get(sid).push(tarea);
  }

  let updated = 0;
  for (const [sid, group] of bySerie) {
    if (!group.some((tarea) => {
      const start = tarea.fechaInicio ? new Date(tarea.fechaInicio) : null;
      const end = tarea.fechaFin ? new Date(tarea.fechaFin) : null;
      const hasDuration = Boolean(start && end && end > start);
      return start && isPlaceholderWallClock(start, { hasDuration });
    })) continue;

    const clock = await resolveSerieRealClock(userId, sid);
    if (!clock) continue;

    for (const tarea of group) {
      const start = tarea.fechaInicio ? new Date(tarea.fechaInicio) : null;
      if (!start || Number.isNaN(start.getTime())) continue;
      const end = tarea.fechaFin ? new Date(tarea.fechaFin) : null;
      const hasDuration = Boolean(end && end > start);
      if (!isPlaceholderWallClock(start, { hasDuration })) continue;

      const next = new Date(start);
      next.setHours(clock.hours, clock.minutes, 0, 0);
      const nextEnd = new Date(next.getTime() + clock.durationMs);
      tarea.fechaInicio = next;
      tarea.fechaFin = nextEnd;
      tarea.fechaVencimiento = nextEnd;
      if (!tarea.googleTasksSync) tarea.googleTasksSync = {};
      tarea.googleTasksSync.hasTimedSchedule = true;
      tarea.$locals = { ...(tarea.$locals || {}), skipGoogleSyncMark: true };
      await tarea.save();
      updated += 1;
    }
  }
  return updated;
}

/**
 * Si la ocurrencia anterior sigue pendiente y el turno nuevo ya llegó, agrega ese turno
 * sin borrar la atrasada.
 */
export async function ensureOpenRecurringPeriods(userId, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const windowStart = new Date(start);
  windowStart.setDate(windowStart.getDate() - 21);

  const open = await Tareas.find({
    usuario: userId,
    serieId: { $exists: true, $ne: null },
    esExcepcionSerie: { $ne: true },
    estado: { $nin: ['COMPLETADA', 'CANCELADA'] },
    completada: { $ne: true },
    $or: [
      { fechaVencimiento: { $gte: windowStart, $lt: start } },
      { fechaInicio: { $gte: windowStart, $lt: start } },
    ],
  }).limit(80);

  let created = 0;
  for (const tarea of open) {
    const before = await Tareas.countDocuments({
      usuario: userId,
      serieId: tarea.serieId,
      esExcepcionSerie: { $ne: true },
      estado: { $ne: 'CANCELADA' },
    });
    const next = await materializeNextOpenOccurrence(userId, tarea, { mode: 'current-if-due', now });
    if (!next) continue;
    const after = await Tareas.countDocuments({
      usuario: userId,
      serieId: tarea.serieId,
      esExcepcionSerie: { $ne: true },
      estado: { $ne: 'CANCELADA' },
    });
    if (after > before) created += 1;
  }
  return created;
}

/**
 * Tras completar una instancia, genera la siguiente ocurrencia local y la exporta.
 * La instancia completada no se reescribe: queda hecha en su fecha.
 * @param {{ syncToGoogle?: boolean }} options
 */
export async function generateNextSerieInstance(googleTasksService, tarea, userId, options = {}) {
  const syncToGoogle = options.syncToGoogle !== false;
  if (!tarea?.serieId || tarea.esExcepcionSerie) return null;

  let serie = await TareaSeries.findOne({ _id: tarea.serieId, usuario: userId });
  if (!serie?.rrule) return null;
  if (!serie.activa) {
    serie.activa = true;
    await serie.save();
  }

  const exportInstances = serie.googleTasksSync?.exportInstances === true;

  if (!exportInstances) {
    return materializeNextOpenOccurrence(userId, tarea, {
      mode: 'after-complete',
      syncToGoogle: false,
      googleTasksService,
    });
  }

  const completedRaw = tarea.fechaVencimiento || tarea.fechaInicio || new Date();
  const from = new Date(completedRaw);
  from.setDate(from.getDate() + 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + HORIZON_DAYS);

  const upcoming = expandSerie(serie.rrule, new Date(serie.dtstart), from, to);
  if (!upcoming.length) return null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const nextDate = upcoming.find((d) => {
    const x = d instanceof Date ? d : new Date(d);
    return x.getTime() >= startOfToday.getTime();
  }) || upcoming[upcoming.length - 1];
  const nextDue = applyAnchorWallClock(nextDate, tarea, serie.dtstart);

  const dayStart = new Date(nextDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(nextDate);
  dayEnd.setHours(23, 59, 59, 999);

  const existing = await Tareas.findOne({
    usuario: userId,
    serieId: serie._id,
    esExcepcionSerie: { $ne: true },
    $or: [
      { fechaInicio: { $gte: dayStart, $lte: dayEnd } },
      { fechaVencimiento: { $gte: dayStart, $lte: dayEnd } },
    ],
  });

  if (existing) {
    return existing;
  }

  const nueva = new Tareas({
    titulo: serie.titulo,
    descripcion: appendRecurrenceToNotes(serie.descripcion || '', serie.rrule),
    usuario: userId,
    objetivo: serie.objetivo,
    serieId: serie._id,
    fechaInicio: nextDue,
    fechaVencimiento: nextDue,
    prioridad: 'BAJA',
    googleTasksSync: {
      enabled: exportInstances,
      syncStatus: exportInstances ? 'pending' : 'synced',
      needsSync: exportInstances,
      googleTaskListId: serie.googleTasksSync?.googleTaskListId,
    },
  });

  await nueva.save();

  if (exportInstances && syncToGoogle && googleTasksService && nueva.objetivo) {
    try {
      await googleTasksService.syncTaskToGoogle(nueva._id, userId);
    } catch (err) {
      logger.warn?.(`No se pudo exportar siguiente ocurrencia de serie: ${err.message}`);
    }
  }

  return nueva;
}

export { HORIZON_DAYS };

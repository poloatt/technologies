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
import { applySerieTimeToOccurrence } from '../utils/calendarVirtualUtils.js';
import { isTaskCompleted } from '../utils/agendaListRules.js';
import { mergeGoogleDueWithLocalSchedule } from '../utils/googleTasksScheduleMerge.js';

const HORIZON_DAYS = parseInt(process.env.GTASKS_SERIES_HORIZON_DAYS || '90', 10);
const EXPAND_LOOKBACK_DAYS = parseInt(process.env.GTASKS_SERIES_LOOKBACK_DAYS || '14', 10);
/** Mínimo de fechas distintas para inferir RRULE solo por due dates (evita weekly con 2 filas históricas). */
const MIN_INFERRED_DUE_DATES = parseInt(process.env.GTASKS_MIN_INFERRED_DUE_DATES || '4', 10);
/**
 * Opt-in: inferir semanal cuando Google solo devuelve 1 fila por título.
 * Por defecto false — evita crear cientos de TareaSeries en tareas con fecha única.
 */
const ASSUME_GOOGLE_RECURRING_SINGLE =
  process.env.GTASKS_ASSUME_GOOGLE_RECURRING_SINGLE === 'true';

function hasExplicitRecurrenceEvidence({
  rruleFromNotes,
  rruleFromGoogleNotes,
  googleRruleForKey,
  inferredFromDueDates,
}) {
  return Boolean(
    rruleFromNotes
    || rruleFromGoogleNotes
    || googleRruleForKey
    || inferredFromDueDates,
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

    for (const t of group) {
      const rawNotes =
        googleById.get(t.googleTasksSync?.googleTaskId)?.notes
        ?? t.descripcion
        ?? '';
      const parsed = parseRecurrenceFromNotes(rawNotes);
      if (parsed.rrule) rruleFromNotes = parsed.rrule;
      const googleHint = inferRecurrenceFromGoogleNotes(rawNotes);
      if (googleHint) rruleFromGoogleNotes = googleHint;
    }

    let dueDates = collectDueDatesFromTasks(group);
    const extraGoogleDues = googleDuesByKey.get(googleSerieKey) || [];
    if (extraGoogleDues.length) {
      dueDates = collectDueDatesFromTasks([
        ...group,
        ...extraGoogleDues.map((d) => ({ fechaVencimiento: d })),
      ]);
    }
    const inferredFromDueDates = dueDates.length >= MIN_INFERRED_DUE_DATES
      ? inferRruleFromDueDates(dueDates)
      : null;
    const googleRruleForKey = googleRruleByKey.get(googleSerieKey) || null;
    let rrule = rruleFromNotes || googleRruleForKey || rruleFromGoogleNotes || inferredFromDueDates;

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

    if (isTaskCompleted(recurrenceAnchor)) {
      const existingSerie = await TareaSeries.findOne({ usuario: userId, googleSerieKey });
      if (existingSerie?.activa) {
        existingSerie.activa = false;
        await existingSerie.save();
      }
      continue;
    }

    const fromAssumeHeuristic =
      ASSUME_GOOGLE_RECURRING_SINGLE
      && googleAnchors.length === 1
      && !hasExplicitRecurrenceEvidence({
        rruleFromNotes,
        rruleFromGoogleNotes,
        googleRruleForKey,
        inferredFromDueDates,
      });

    if (
      !hasExplicitRecurrenceEvidence({
        rruleFromNotes,
        rruleFromGoogleNotes,
        googleRruleForKey,
        inferredFromDueDates,
      })
      && !fromAssumeHeuristic
    ) {
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
      serie.googleTasksSync = serie.googleTasksSync || {};
      serie.googleTasksSync.googleTaskListId = taskListId;
      serie.googleTasksSync.exportInstances = false;
      serie.googleTasksSync.lastSyncDate = new Date();

      const changed =
        prevRrule !== rrule
        || prevTitulo !== titulo
        || prevDt !== nextDt;

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
        const googleCompleted = gt.status === 'completed';
        const localCompleted =
          Boolean(t.completada)
          || String(t.estado || '').toUpperCase() === 'COMPLETADA';
        needsStatusSync = googleCompleted !== localCompleted;
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

/**
 * Tras completar una instancia, genera la siguiente ocurrencia local y la exporta.
 */
export async function generateNextSerieInstance(googleTasksService, tarea, userId) {
  if (!tarea?.serieId || tarea.esExcepcionSerie) return null;

  const serie = await TareaSeries.findOne({ _id: tarea.serieId, usuario: userId, activa: true });
  if (!serie?.rrule) return null;

  const exportInstances = serie.googleTasksSync?.exportInstances === true;

  const completedRaw = tarea.fechaVencimiento || tarea.fechaInicio || new Date();
  const from = new Date(completedRaw);
  from.setDate(from.getDate() + 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + HORIZON_DAYS);

  const upcoming = expandSerie(serie.rrule, new Date(serie.dtstart), from, to);
  if (!upcoming.length) return null;

  const nextDate = upcoming[0];
  const nextDue = applySerieTimeToOccurrence(nextDate, serie.dtstart);

  if (!exportInstances) {
    let anchor = tarea.googleTasksSync?.googleTaskId ? tarea : null;
    if (!anchor) {
      anchor = await Tareas.findOne({
        usuario: userId,
        serieId: serie._id,
        esExcepcionSerie: { $ne: true },
        'googleTasksSync.googleTaskId': { $exists: true, $ne: null },
      });
    }
    if (!anchor) {
      anchor = await Tareas.findOne({
        usuario: userId,
        serieId: serie._id,
        esExcepcionSerie: { $ne: true },
      }).sort({ 'googleTasksSync.googleTaskId': -1, fechaVencimiento: 1 });
    }
    if (!anchor) return null;

    anchor.fechaInicio = nextDue;
    anchor.fechaVencimiento = nextDue;
    anchor.estado = 'PENDIENTE';
    anchor.completada = false;
    await anchor.save();

    if (googleTasksService && anchor.googleTasksSync?.enabled) {
      try {
        await googleTasksService.syncTaskToGoogle(anchor._id, userId);
      } catch (err) {
        logger.warn?.(`No se pudo sincronizar ancla tras completar serie: ${err.message}`);
      }
    }
    return anchor;
  }

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

  const occAt = applySerieTimeToOccurrence(nextDate, serie.dtstart);
  const nueva = new Tareas({
    titulo: serie.titulo,
    descripcion: appendRecurrenceToNotes(serie.descripcion || '', serie.rrule),
    usuario: userId,
    objetivo: serie.objetivo,
    serieId: serie._id,
    fechaInicio: occAt,
    fechaVencimiento: occAt,
    prioridad: 'BAJA',
    googleTasksSync: {
      enabled: exportInstances,
      syncStatus: exportInstances ? 'pending' : 'synced',
      needsSync: exportInstances,
      googleTaskListId: serie.googleTasksSync?.googleTaskListId,
    },
  });

  await nueva.save();

  if (exportInstances && nueva.objetivo) {
    try {
      await googleTasksService.syncTaskToGoogle(nueva._id, userId);
    } catch (err) {
      logger.warn?.(`No se pudo exportar siguiente ocurrencia de serie: ${err.message}`);
    }
  }

  return nueva;
}

export { HORIZON_DAYS };

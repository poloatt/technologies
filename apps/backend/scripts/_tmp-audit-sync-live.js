/**
 * Read-only audit: Mongo tareas vs Google Tasks + Google Calendar.
 * No writes except OAuth token refresh if Google rotates the access token.
 */
import mongoose from 'mongoose';
import { google } from 'googleapis';
import config from '../src/config/config.js';
import { Users, Tareas, Objetivos } from '../src/models/index.js';
import { parseScheduleFromNotes } from '../../shared/utils/googleTasksScheduleNotes.js';

const EMAIL = process.argv.find((a) => a.startsWith('--user='))?.split('=')[1] || 'polo@poloatt.com';
const WINDOW_PAST_DAYS = 7;
const WINDOW_FUTURE_DAYS = 21;

function dayKeyTZ(date, tz) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function timeKeyTZ(date, tz) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

function utcDateKey(value) {
  if (!value) return null;
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function isUtcMidnight(value) {
  if (!value) return false;
  const raw = value instanceof Date ? value.toISOString() : String(value);
  return /T00:00:00(\.000)?Z$/i.test(raw);
}

function inWindow(day, fromDay, toDay) {
  return day && day >= fromDay && day <= toDay;
}

function normTitle(raw) {
  return String(raw || '')
    .replace(/^\s*(\[[^\]]+\]\s*)+/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s{2,}/g, ' ')
    .toLowerCase();
}

function pushCapped(bucket, item, cap = 25) {
  bucket.count += 1;
  if (bucket.samples.length < cap) bucket.samples.push(item);
}

function bucket() {
  return { count: 0, samples: [] };
}

async function listAll(fn) {
  const items = [];
  let pageToken;
  do {
    const res = await fn(pageToken);
    items.push(...(res.data.items || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return items;
}

async function main() {
  await mongoose.connect(config.mongoUrl);
  const user = await Users.findOne({ email: EMAIL }).lean();
  if (!user) throw new Error(`Usuario no encontrado: ${EMAIL}`);

  const tz = user.preferences?.timezone || 'America/Argentina/Buenos_Aires';
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - WINDOW_PAST_DAYS);
  const to = new Date(now);
  to.setDate(to.getDate() + WINDOW_FUTURE_DAYS);
  const fromDay = dayKeyTZ(from, tz);
  const toDay = dayKeyTZ(to, tz);

  const objetivos = await Objetivos.find({ usuario: user._id }).lean();
  const tareas = await Tareas.find({ usuario: user._id }).lean();
  const objetivoById = new Map(objetivos.map((o) => [String(o._id), o]));
  const listToObjetivo = new Map();
  for (const o of objetivos) {
    const id = o.googleTasksSync?.googleTaskListId;
    if (id) listToObjetivo.set(id, o);
  }

  const report = {
    user: EMAIL,
    timezone: tz,
    window: { fromDay, toDay },
    config: {
      tasksEnabled: Boolean(user.googleTasksConfig?.enabled),
      tasksDirection: user.googleTasksConfig?.syncDirection || null,
      tasksLastSync: user.googleTasksConfig?.lastSync || null,
      tasksTokenError: user.googleTasksConfig?.tokenError || null,
      calendarEnabled: Boolean(user.googleCalendarConfig?.enabled),
      calendarDirection: user.googleCalendarConfig?.syncDirection || null,
      calendarLastSync: user.googleCalendarConfig?.lastSync || null,
      calendarTokenError: user.googleCalendarConfig?.tokenError || null,
      selectedCalendarIds: user.googleCalendarConfig?.selectedCalendarIds || [],
    },
    counts: {},
    tasks: {},
    calendar: {},
    cross: {},
    unknownTaskKeys: [],
  };

  const tasksOauth = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    `${config.backendUrl}/api/google-tasks/callback`,
  );
  tasksOauth.setCredentials({
    access_token: user.googleTasksConfig?.accessToken,
    refresh_token: user.googleTasksConfig?.refreshToken,
  });
  const tasksApi = google.tasks({ version: 'v1', auth: tasksOauth });

  const taskLists = user.googleTasksConfig?.accessToken
    ? await listAll((pageToken) => tasksApi.tasklists.list({ maxResults: 100, pageToken }))
    : [];

  const googleTasks = [];
  const taskKeysSeen = new Set();
  for (const list of taskLists) {
    const items = await listAll((pageToken) => tasksApi.tasks.list({
      tasklist: list.id,
      showCompleted: true,
      showHidden: true,
      showDeleted: false,
      maxResults: 100,
      pageToken,
    }));
    for (const item of items) {
      for (const k of Object.keys(item)) taskKeysSeen.add(k);
      googleTasks.push({ ...item, taskListId: list.id, taskListTitle: list.title });
    }
  }
  report.unknownTaskKeys = [...taskKeysSeen].sort();

  const localByGoogleId = new Map();
  const dupLocalGoogleIds = bucket();
  for (const t of tareas) {
    const gid = t.googleTasksSync?.googleTaskId;
    if (!gid) continue;
    if (localByGoogleId.has(gid)) {
      pushCapped(dupLocalGoogleIds, {
        googleTaskId: gid,
        titles: [localByGoogleId.get(gid).titulo, t.titulo],
      });
    } else {
      localByGoogleId.set(gid, t);
    }
  }

  const googleById = new Map(googleTasks.map((g) => [g.id, g]));
  const linkedListIds = new Set(listToObjetivo.keys());

  const missingInGoogle = bucket();
  const titleMismatch = bucket();
  const statusMismatch = bucket();
  const dueDayMismatch = bucket();
  const scheduleNotesMismatch = bucket();
  const timedFlagStale = bucket();
  const legacy60 = bucket();
  const googleChildTasks = bucket();
  const googleNotLocal = bucket();
  const listMismatch = bucket();
  const needsSyncStuck = bucket();
  const duplicateGoogleTitleDue = bucket();
  const allDayButTimedNotes = bucket();
  const timedButDateOnlyDue = bucket();

  const byTitleDue = new Map();
  for (const g of googleTasks) {
    if (g.status === 'completed' || g.deleted) continue;
    const key = `${g.taskListId}::${normTitle(g.title)}::${utcDateKey(g.due) || 'nodue'}`;
    if (!byTitleDue.has(key)) byTitleDue.set(key, []);
    byTitleDue.get(key).push(g);
  }
  for (const group of byTitleDue.values()) {
    if (group.length < 2) continue;
    pushCapped(duplicateGoogleTitleDue, {
      title: group[0].title,
      list: group[0].taskListTitle,
      due: utcDateKey(group[0].due),
      n: group.length,
    });
  }

  for (const t of tareas) {
    const gid = t.googleTasksSync?.googleTaskId;
    const sync = t.googleTasksSync || {};
    if (sync.needsSync && sync.lastSyncDate) {
      const ageH = (now - new Date(sync.lastSyncDate)) / 36e5;
      if (ageH > 6) {
        pushCapped(needsSyncStuck, {
          titulo: t.titulo,
          estado: t.estado,
          ageHours: Math.round(ageH),
          syncStatus: sync.syncStatus,
        });
      }
    } else if (sync.needsSync && !sync.lastSyncDate && gid) {
      pushCapped(needsSyncStuck, {
        titulo: t.titulo,
        estado: t.estado,
        ageHours: null,
        syncStatus: sync.syncStatus,
      });
    }

    if (!gid) continue;
    const g = googleById.get(gid);
    const localDay = dayKeyTZ(t.fechaInicio, tz);
    const focus = inWindow(localDay, fromDay, toDay) || inWindow(utcDateKey(g?.due), fromDay, toDay);
    if (!g) {
      if (focus || sync.syncStatus !== 'deleted') {
        pushCapped(missingInGoogle, {
          titulo: t.titulo,
          estado: t.estado,
          localDay,
          listId: sync.googleTaskListId || null,
        });
      }
      continue;
    }

    if (normTitle(t.titulo) !== normTitle(g.title)) {
      pushCapped(titleMismatch, { local: t.titulo, google: g.title, localDay });
    }

    const localDone = t.estado === 'COMPLETADA' || t.completada === true;
    const googleDone = g.status === 'completed';
    if (localDone !== googleDone && focus) {
      pushCapped(statusMismatch, {
        titulo: t.titulo,
        local: t.estado,
        google: g.status,
        needsSync: Boolean(sync.needsSync),
        day: localDay,
      });
    }

    const gDueDay = utcDateKey(g.due);
    const localDueDay = dayKeyTZ(t.fechaVencimiento || t.fechaInicio, tz);
    if (gDueDay && localDueDay && gDueDay !== localDueDay && (focus || inWindow(gDueDay, fromDay, toDay))) {
      pushCapped(dueDayMismatch, {
        titulo: t.titulo,
        googleDueUtcDate: gDueDay,
        localDay: localDueDay,
        fechaInicio: t.fechaInicio,
        googleDue: g.due,
        utcMidnight: isUtcMidnight(g.due),
      });
    }

    const gSchedule = parseScheduleFromNotes(g.notes || '');
    const localSchedule = parseScheduleFromNotes(t.descripcion || '');
    const gStart = gSchedule?.fechaInicio ? gSchedule.fechaInicio.toISOString() : null;
    const lStart = t.fechaInicio ? new Date(t.fechaInicio).toISOString() : null;
    const lEnd = t.fechaFin ? new Date(t.fechaFin).toISOString() : null;
    if (gStart && lStart && Math.abs(new Date(gStart) - new Date(lStart)) > 60_000 && focus) {
      pushCapped(scheduleNotesMismatch, {
        titulo: t.titulo,
        googleNotesStart: gStart,
        googleNotesEnd: gSchedule?.fechaFin ? gSchedule.fechaFin.toISOString() : null,
        localInicio: lStart,
        localFin: lEnd,
        localNotesStart: localSchedule?.fechaInicio ? localSchedule.fechaInicio.toISOString() : null,
      });
    }

    const notesTimed = Boolean(gSchedule?.fechaInicio || localSchedule?.fechaInicio);
    const flag = Boolean(sync.hasTimedSchedule);
    if (flag !== notesTimed && focus) {
      const start = new Date(t.fechaInicio);
      const end = t.fechaFin ? new Date(t.fechaFin) : null;
      const durationMin = end ? Math.round((end - start) / 60000) : null;
      const dateOnlyLocal = !end || durationMin >= 12 * 60;
      if (flag && !notesTimed && dateOnlyLocal) {
        pushCapped(timedFlagStale, { titulo: t.titulo, hasTimedSchedule: flag, day: localDay, durationMin });
      }
      if (!flag && notesTimed) {
        pushCapped(allDayButTimedNotes, {
          titulo: t.titulo,
          day: localDay,
          notesStart: (gSchedule || localSchedule).fechaInicio.toISOString(),
          notesEnd: (gSchedule || localSchedule).fechaFin
            ? (gSchedule || localSchedule).fechaFin.toISOString()
            : null,
        });
      }
    }

    if (t.fechaInicio && t.fechaFin) {
      const mins = Math.round((new Date(t.fechaFin) - new Date(t.fechaInicio)) / 60000);
      if (mins === 60 && focus && (flag || notesTimed)) {
        pushCapped(legacy60, {
          titulo: t.titulo,
          day: localDay,
          inicio: timeKeyTZ(t.fechaInicio, tz),
          fin: timeKeyTZ(t.fechaFin, tz),
        });
      }
    }

    if (g.parent) {
      pushCapped(googleChildTasks, { titulo: g.title, parent: g.parent, list: g.taskListTitle });
    }

    const expectedList = objetivoById.get(String(t.objetivo))?.googleTasksSync?.googleTaskListId;
    if (expectedList && sync.googleTaskListId && expectedList !== sync.googleTaskListId) {
      pushCapped(listMismatch, { titulo: t.titulo, taskList: sync.googleTaskListId, objetivoList: expectedList });
    }
    if (sync.googleTaskListId && g.taskListId && sync.googleTaskListId !== g.taskListId) {
      pushCapped(listMismatch, { titulo: t.titulo, localList: sync.googleTaskListId, googleList: g.taskListTitle });
    }

    if (notesTimed && isUtcMidnight(g.due) && focus) {
      pushCapped(timedButDateOnlyDue, {
        titulo: t.titulo,
        due: g.due,
        notesStart: timeKeyTZ((gSchedule || localSchedule).fechaInicio, tz),
        localInicio: timeKeyTZ(t.fechaInicio, tz),
        day: localDay,
      });
    }
  }

  for (const g of googleTasks) {
    if (g.deleted || localByGoogleId.has(g.id)) continue;
    if (!linkedListIds.has(g.taskListId)) continue;
    const day = utcDateKey(g.due);
    if (g.status === 'completed' && !inWindow(day, fromDay, toDay)) continue;
    if (!inWindow(day, fromDay, toDay) && g.status !== 'needsAction') continue;
    const schedule = parseScheduleFromNotes(g.notes || '');
    pushCapped(googleNotLocal, {
      titulo: g.title,
      list: g.taskListTitle,
      status: g.status,
      due: g.due || null,
      hasScheduleNotes: Boolean(schedule),
      scheduleStart: schedule?.fechaInicio ? timeKeyTZ(schedule.fechaInicio, tz) : null,
      parent: g.parent || null,
    });
  }

  report.counts.objetivos = objetivos.length;
  report.counts.objetivosConLista = listToObjetivo.size;
  report.counts.googleTaskLists = taskLists.length;
  report.counts.googleTasks = googleTasks.length;
  report.counts.localTareas = tareas.length;
  report.counts.localConGoogleTaskId = localByGoogleId.size;

  const unlinkedLists = taskLists
    .filter((l) => !linkedListIds.has(l.id))
    .map((l) => l.title);

  report.tasks = {
    unlinkedGoogleLists: unlinkedLists,
    duplicateLocalGoogleTaskId: dupLocalGoogleIds,
    missingInGoogle,
    googleNotInLocal: googleNotLocal,
    titleMismatch,
    statusMismatch,
    dueDayMismatch,
    scheduleNotesVsLocalDates: scheduleNotesMismatch,
    staleHasTimedSchedule: timedFlagStale,
    notesTimedButFlagOff: allDayButTimedNotes,
    durationStill60: legacy60,
    googleChildTasks,
    listMismatch,
    needsSyncStuck,
    duplicateGoogleTitleDue,
    timedLocalButGoogleDueDateOnly: timedButDateOnlyDue,
  };

  const calOauth = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    `${config.backendUrl}/api/google-tasks/callback`,
  );
  calOauth.setCredentials({
    access_token: user.googleCalendarConfig?.accessToken,
    refresh_token: user.googleCalendarConfig?.refreshToken,
  });
  const calendar = google.calendar({ version: 'v3', auth: calOauth });

  let calendarList = [];
  let events = [];
  let calendarError = null;
  if (user.googleCalendarConfig?.accessToken) {
    try {
      calendarList = await listAll((pageToken) => calendar.calendarList.list({ pageToken, maxResults: 250 }));
      const selected = new Set(user.googleCalendarConfig.selectedCalendarIds?.length
        ? user.googleCalendarConfig.selectedCalendarIds
        : ['primary']);
      const ids = calendarList
        .filter((c) => selected.has(c.id) || (selected.has('primary') && c.primary))
        .map((c) => c.id);
      const timeMin = new Date(`${fromDay}T00:00:00-03:00`);
      const timeMax = new Date(`${toDay}T23:59:59-03:00`);
      for (const calendarId of ids) {
        const items = await listAll((pageToken) => calendar.events.list({
          calendarId,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          showDeleted: true,
          maxResults: 250,
          pageToken,
        }));
        for (const ev of items) events.push({ ...ev, calendarId });
      }
    } catch (err) {
      calendarError = err.message;
    }
  }

  const localEvents = tareas.filter((t) => t.tipo === 'EVENTO' || t.googleCalendarSync?.googleEventId);
  const localByEventId = new Map();
  const dupEventIds = bucket();
  for (const t of localEvents) {
    const id = t.googleCalendarSync?.googleEventId;
    if (!id) continue;
    if (localByEventId.has(id)) {
      pushCapped(dupEventIds, { id, titles: [localByEventId.get(id).titulo, t.titulo] });
    } else localByEventId.set(id, t);
  }
  const googleEventById = new Map(events.filter((e) => e.status !== 'cancelled').map((e) => [e.id, e]));

  const eventMissingLocal = bucket();
  const eventMissingGoogle = bucket();
  const allDayMismatch = bucket();
  const timeMismatch = bucket();
  const cancelledStillLocal = bucket();
  const labelMissing = bucket();
  const eventAlsoTask = bucket();

  for (const ev of events) {
    if (ev.status === 'cancelled') {
      const local = localByEventId.get(ev.id);
      if (local && local.estado !== 'CANCELADA') {
        pushCapped(cancelledStillLocal, { titulo: ev.summary, localEstado: local.estado });
      }
      continue;
    }
    const local = localByEventId.get(ev.id);
    const gAllDay = Boolean(ev.start?.date && !ev.start?.dateTime);
    const start = ev.start?.dateTime || ev.start?.date;
    const end = ev.end?.dateTime || ev.end?.date;
    if (!local) {
      pushCapped(eventMissingLocal, {
        titulo: ev.summary || '(sin título)',
        calendarId: ev.calendarId,
        allDay: gAllDay,
        start,
        end,
        eventType: ev.eventType || null,
      });
      continue;
    }
    const localAllDay = Boolean(local.googleCalendarSync?.allDay);
    if (localAllDay !== gAllDay) {
      pushCapped(allDayMismatch, {
        titulo: local.titulo,
        localAllDay,
        googleAllDay: gAllDay,
        localInicio: local.fechaInicio,
        googleStart: start,
      });
    }
    if (!gAllDay && ev.start?.dateTime && local.fechaInicio) {
      const delta = Math.abs(new Date(ev.start.dateTime) - new Date(local.fechaInicio));
      const endDelta = ev.end?.dateTime && local.fechaFin
        ? Math.abs(new Date(ev.end.dateTime) - new Date(local.fechaFin))
        : 0;
      if (delta > 60_000 || endDelta > 60_000) {
        pushCapped(timeMismatch, {
          titulo: local.titulo,
          googleStart: ev.start.dateTime,
          googleEnd: ev.end?.dateTime || null,
          localInicio: local.fechaInicio,
          localFin: local.fechaFin || null,
          localAllDay,
        });
      }
    }
    if ((ev.eventLabelId || ev.colorId) && !local.googleCalendarSync?.eventLabelName && !local.googleCalendarSync?.backgroundColor) {
      pushCapped(labelMissing, {
        titulo: local.titulo,
        eventLabelId: ev.eventLabelId || null,
        colorId: ev.colorId || null,
      });
    }
  }

  for (const t of localEvents) {
    const id = t.googleCalendarSync?.googleEventId;
    const day = dayKeyTZ(t.fechaInicio, tz);
    if (!id || !inWindow(day, fromDay, toDay)) continue;
    if (!googleEventById.has(id) && !events.some((e) => e.id === id)) {
      pushCapped(eventMissingGoogle, {
        titulo: t.titulo,
        day,
        calendarId: t.googleCalendarSync?.googleCalendarId || null,
        allDay: Boolean(t.googleCalendarSync?.allDay),
      });
    }
    if (t.googleTasksSync?.googleTaskId) {
      pushCapped(eventAlsoTask, { titulo: t.titulo, day, tipo: t.tipo });
    }
  }

  const tareasWithBoth = tareas.filter((t) => t.tipo === 'TAREA' && t.googleCalendarSync?.googleEventId);
  report.calendar = {
    error: calendarError,
    calendars: calendarList.map((c) => ({
      id: c.id,
      summary: c.summary,
      primary: Boolean(c.primary),
      selected: (user.googleCalendarConfig?.selectedCalendarIds || []).includes(c.id) || (c.primary && (user.googleCalendarConfig?.selectedCalendarIds || []).includes('primary')),
    })),
    googleEventsInWindow: events.filter((e) => e.status !== 'cancelled').length,
    localEventos: localEvents.length,
    duplicateLocalEventId: dupEventIds,
    googleNotInLocal: eventMissingLocal,
    localNotInGoogle: eventMissingGoogle,
    allDayMismatch,
    timeMismatch,
    cancelledStillLocal,
    labelMissing,
  };
  report.cross = {
    tareaAlsoCalendarEvent: {
      count: tareasWithBoth.length,
      samples: tareasWithBoth.slice(0, 15).map((t) => ({ titulo: t.titulo, tipo: t.tipo })),
    },
    eventoAlsoGoogleTask: eventAlsoTask,
  };

  const interesting = (node) => {
    if (!node || typeof node !== 'object') return node;
    if ('count' in node && 'samples' in node) {
      return node.count ? node : undefined;
    }
    return node;
  };

  const digest = {
    window: report.window,
    timezone: tz,
    counts: report.counts,
    config: report.config,
    issueCounts: {},
  };
  for (const [group, value] of Object.entries({ ...report.tasks, ...report.calendar, ...report.cross })) {
    if (value && typeof value === 'object' && typeof value.count === 'number') {
      digest.issueCounts[group] = value.count;
    }
  }

  const weekFrom = '2026-09-22';
  const weekTo = '2026-09-28';
  const week = [];
  for (const t of tareas) {
    const gid = t.googleTasksSync?.googleTaskId;
    if (!gid) continue;
    const day = dayKeyTZ(t.fechaInicio, tz);
    if (!inWindow(day, weekFrom, weekTo)) continue;
    const g = googleById.get(gid);
    const gSchedule = parseScheduleFromNotes(g?.notes || '');
    const localSchedule = parseScheduleFromNotes(t.descripcion || '');
    const start = t.fechaInicio ? new Date(t.fechaInicio) : null;
    const end = t.fechaFin ? new Date(t.fechaFin) : null;
    const mins = start && end ? Math.round((end - start) / 60000) : null;
    week.push({
      day,
      titulo: t.titulo,
      estado: t.estado,
      googleStatus: g?.status || 'MISSING',
      localTime: start ? timeKeyTZ(start, tz) : null,
      localEnd: end ? timeKeyTZ(end, tz) : null,
      mins,
      hasTimedSchedule: Boolean(t.googleTasksSync?.hasTimedSchedule),
      notesTime: gSchedule?.fechaInicio
        ? timeKeyTZ(gSchedule.fechaInicio, tz)
        : (localSchedule?.fechaInicio ? timeKeyTZ(localSchedule.fechaInicio, tz) : null),
      notesEnd: gSchedule?.fechaFin
        ? timeKeyTZ(gSchedule.fechaFin, tz)
        : (localSchedule?.fechaFin ? timeKeyTZ(localSchedule.fechaFin, tz) : null),
      googleDue: g?.due || null,
      needsSync: Boolean(t.googleTasksSync?.needsSync),
      serie: Boolean(t.serieId),
    });
  }
  week.sort((a, b) => (a.day + (a.localTime || '')).localeCompare(b.day + (b.localTime || '')));

  const needsSyncByEstado = {};
  for (const t of tareas) {
    if (!t.googleTasksSync?.needsSync) continue;
    needsSyncByEstado[t.estado] = (needsSyncByEstado[t.estado] || 0) + 1;
  }

  const fs = await import('node:fs');
  const out = { digest, needsSyncByEstado, week, unknownTaskKeys: report.unknownTaskKeys };
  fs.writeFileSync(new URL('./_tmp-audit-out.json', import.meta.url), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ digest, needsSyncByEstado, weekCount: week.length }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('AUDIT_ERROR', err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});

import { Tareas } from '../models/index.js';
import * as agendaListRules from './agendaListRules.js';
import { isGoogleCalendarImportedEvent } from './googleCalendarEventMapper.js';
import {
  buildVirtualTasksForRange,
  dedupeAgendaTasksByGoogleDay,
  dedupeSerieInstancesForAgenda,
  loadGoogleAnchorsBySerie,
  loadSeriesForAgenda,
} from './calendarVirtualUtils.js';

const LIST_VIRTUAL_LOOKBACK_DAYS = parseInt(
  process.env.GTASKS_LIST_VIRTUAL_LOOKBACK_DAYS || '7',
  10,
);
const LIST_VIRTUAL_HORIZON_DAYS = parseInt(
  process.env.GTASKS_LIST_VIRTUAL_HORIZON_DAYS || '90',
  10,
);

function buildUserAccessClause(userId) {
  return {
    $or: [
      { usuario: userId },
      { owners: userId },
    ],
  };
}

function buildOverlapQuery(userId, from, to) {
  return {
    $and: [
      buildUserAccessClause(userId),
      {
        $or: [
          { fechaVencimiento: { $gte: from, $lte: to } },
          { fechaInicio: { $gte: from, $lte: to } },
          {
            tipo: 'EVENTO',
            fechaInicio: { $lte: to },
            fechaFin: { $gte: from },
          },
        ],
      },
    ],
  };
}

/**
 * Tareas para calendario: anclas reales + ocurrencias virtuales (sin materializar en BD).
 */
export async function getTareasForAgendaRange(userId, rangeFrom, rangeTo) {
  const from = new Date(rangeFrom);
  const to = new Date(rangeTo);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  // Series y tareas reales son independientes: se cargan en paralelo.
  // El frontend solo usa el id de serieId (no rrule/activa/dtstart), por eso no
  // se popula serieId. Se excluyen campos pesados no usados por el calendario
  // (subtareas SÍ se conservan: el form de edición las necesita).
  const [series, realDocs] = await Promise.all([
    loadSeriesForAgenda(userId, { from, to }),
    Tareas.find(buildOverlapQuery(userId, from, to))
      .select('-googleDueHistory -archivos -googleTasksSync.syncErrors')
      .populate('objetivo', 'nombre estado')
      .populate('owners', 'nombre email')
      .sort({ fechaInicio: 1 })
      .lean({ virtuals: true }),
  ]);

  const deduped = dedupeAgendaTasksByGoogleDay(dedupeSerieInstancesForAgenda(realDocs));
  const anchorsBySerie = await loadGoogleAnchorsBySerie(
    userId,
    series.map((s) => s._id),
  );
  const virtual = buildVirtualTasksForRange(series, from, to, deduped, anchorsBySerie);
  const seenIds = new Set();
  const merged = [];
  for (const doc of [...deduped, ...virtual]) {
    const id = String(doc._id);
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    merged.push(doc);
  }

  return merged.map(transformAgendaDoc);
}

/**
 * Añade ocurrencias virtuales de series activas a la lista de tareas (/tareas).
 */
export async function appendVirtualRecurrenceTasks(userId, realDocs = []) {
  const list = Array.isArray(realDocs) ? realDocs : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(today);
  from.setDate(from.getDate() - LIST_VIRTUAL_LOOKBACK_DAYS);
  const to = new Date(today);
  to.setDate(to.getDate() + LIST_VIRTUAL_HORIZON_DAYS);
  to.setHours(23, 59, 59, 999);

  const series = await loadSeriesForAgenda(userId, { from, to });
  const deduped = dedupeSerieInstancesForAgenda(list);
  const anchorsBySerie = await loadGoogleAnchorsBySerie(
    userId,
    series.map((s) => s._id),
  );
  const virtual = buildVirtualTasksForRange(series, from, to, deduped, anchorsBySerie);

  const seenIds = new Set(list.map((d) => String(d._id)));
  const merged = [...list];
  for (const v of virtual) {
    const id = String(v._id);
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    merged.push(v);
  }
  return merged;
}

export function getDefaultListRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(today);
  from.setDate(from.getDate() - LIST_VIRTUAL_LOOKBACK_DAYS);
  const to = new Date(today);
  to.setDate(to.getDate() + LIST_VIRTUAL_HORIZON_DAYS);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function transformAgendaDoc(doc) {
  const objetivoRef = doc.objetivo?._id ?? doc.objetivo;
  const objetivo =
    objetivoRef != null
      ? {
          ...(typeof doc.objetivo === 'object' && doc.objetivo !== null ? doc.objetivo : {}),
          id: String(objetivoRef),
        }
      : null;

  return {
    ...doc,
    id: String(doc._id),
    esRecurrente: Boolean(doc.esRecurrente || doc.virtual),
    objetivo,
    isGoogleTasksEnabled: doc.googleTasksSync?.enabled || false,
    googleTasksSyncStatus: doc.googleTasksSync?.syncStatus || null,
  };
}

/**
 * Filtra documentos de lista por vista Ahora/Luego (testeable sin BD).
 */
export function filterDocsForListView(docs, options = {}, now = new Date()) {
  const { isInAhora, isInLuego, isTaskCompleted, isTaskCancelled } = agendaListRules;
  const includeCompleted = options.includeCompleted === true;
  const view = options.view;

  return docs.filter((t) => {
    // Canceladas solo viven en Archivo — nunca en Ahora/Luego.
    if (isTaskCancelled(t)) return false;
    // Desvinculadas de Google (eliminadas allí) no deben aparecer en activas.
    if (t.googleTasksSync?.syncStatus === 'unlinked') return false;
    if (!includeCompleted && isTaskCompleted(t)) return false;
    if (view === 'ahora') return isInAhora(t, now);
    if (view === 'luego') return isInLuego(t, now);
    return true;
  });
}

/**
 * Lista agenda (/tareas): rango acotado + virtuales, sin paginar todo el universo.
 */
export async function getTareasForListRange(userId, rangeFrom, rangeTo, options = {}) {
  const docs = await getTareasForAgendaRange(userId, rangeFrom, rangeTo);
  const withoutCalendarEvents = docs.filter((d) => !isGoogleCalendarImportedEvent(d));
  return filterDocsForListView(withoutCalendarEvents, options);
}

export { buildOverlapQuery };

import { google } from 'googleapis';
import { Users, Tareas } from '../models/index.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import {
  FALLBACK_EVENT_COLORS,
  mapGoogleEventToTareaFields,
} from '../utils/googleCalendarEventMapper.js';

const LOOKBACK_DAYS = parseInt(process.env.GCAL_LOOKBACK_DAYS || process.env.GTASKS_LIST_VIRTUAL_LOOKBACK_DAYS || '14', 10);
const HORIZON_DAYS = parseInt(process.env.GCAL_HORIZON_DAYS || process.env.GTASKS_LIST_VIRTUAL_HORIZON_DAYS || '120', 10);
const GCAL_API = 'https://www.googleapis.com/calendar/v3';

class GoogleCalendarService {
  constructor() {
    this.oauthClients = new Map();
    this.calendarClients = new Map();
    this._eventColorMapByUser = new Map();
  }

  getOAuthClient(userId) {
    const uid = String(userId);
    if (!this.oauthClients.has(uid)) {
      const oauth = new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        `${config.backendUrl}/api/google-tasks/callback`,
      );
      if (typeof oauth.setMaxListeners === 'function') {
        oauth.setMaxListeners(50);
      }
      this.oauthClients.set(uid, oauth);
    }
    return this.oauthClients.get(uid);
  }

  getCalendarApi(userId) {
    const uid = String(userId);
    if (!this.calendarClients.has(uid)) {
      const oauth = this.getOAuthClient(uid);
      this.calendarClients.set(
        uid,
        google.calendar({ version: 'v3', auth: oauth }),
      );
    }
    return this.calendarClients.get(uid);
  }

  async setUserCredentials(userId) {
    const uid = String(userId);
    const user = await Users.findById(userId);
    if (!user?.googleCalendarConfig?.accessToken) {
      throw new Error('Usuario no tiene configuración de Google Calendar');
    }

    const oauth = this.getOAuthClient(uid);
    oauth.setCredentials({
      access_token: user.googleCalendarConfig.accessToken,
      refresh_token: user.googleCalendarConfig.refreshToken,
    });

    if (!oauth._attadiaCalendarTokensListener) {
      oauth.on('tokens', async (tokens) => {
        if (!tokens.access_token) return;
        logger.sync(`🔄 Tokens Calendar actualizados para usuario ${uid}`);
        const current = await Users.findById(userId);
        const update = {
          'googleCalendarConfig.accessToken': tokens.access_token,
          'googleCalendarConfig.refreshToken':
            tokens.refresh_token || current?.googleCalendarConfig?.refreshToken,
          'googleCalendarConfig.lastTokenRefresh': new Date(),
          'googleCalendarConfig.tokenError': null,
          'googleCalendarConfig.tokenErrorDate': null,
        };
        await Users.findByIdAndUpdate(userId, update);
      });
      oauth._attadiaCalendarTokensListener = true;
    }

    return user;
  }

  buildSyncWindow(options = {}) {
    const now = new Date();
    const from = options.from ? new Date(options.from) : new Date(now);
    const to = options.to ? new Date(options.to) : new Date(now);

    if (!options.from) {
      from.setDate(from.getDate() - LOOKBACK_DAYS);
      from.setHours(0, 0, 0, 0);
    }
    if (!options.to) {
      to.setDate(to.getDate() + HORIZON_DAYS);
      to.setHours(23, 59, 59, 999);
    }

    return { from, to };
  }

  async listAllEvents(calendarId, userId, timeMin, timeMax) {
    // Raw HTTP: googleapis@131 no tipa eventLabelVersion / eventLabelId.
    const oauth = this.getOAuthClient(userId);
    const items = [];
    let pageToken;

    do {
      const { data } = await oauth.request({
        url: `${GCAL_API}/calendars/${encodeURIComponent(calendarId)}/events`,
        method: 'GET',
        params: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          showDeleted: true,
          maxResults: 250,
          pageToken,
          eventLabelVersion: 1,
        },
      });
      items.push(...(data.items || []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    return items;
  }

  /**
   * Labels con nombre del calendario (Estudio, Salud, …).
   * @returns {{ byId: Record<string, { id: string, name: string|null, backgroundColor: string|null }> }}
   */
  async getCalendarEventLabels(calendarId, userId) {
    const oauth = this.getOAuthClient(userId);
    try {
      const { data } = await oauth.request({
        url: `${GCAL_API}/calendars/${encodeURIComponent(calendarId)}`,
        method: 'GET',
      });
      const byId = {};
      for (const label of data?.labelProperties?.eventLabels || []) {
        if (!label?.id) continue;
        byId[label.id] = {
          id: label.id,
          name: label.name ? String(label.name).trim() : null,
          backgroundColor: label.backgroundColor || null,
        };
      }
      return { byId };
    } catch (err) {
      logger.warn(`No se pudieron leer labels de ${calendarId}: ${err.message}`);
      return { byId: {} };
    }
  }

  async getEventColorMap(userId) {
    const uid = String(userId);
    if (this._eventColorMapByUser.has(uid)) {
      return this._eventColorMapByUser.get(uid);
    }
    try {
      const calendar = this.getCalendarApi(userId);
      const response = await calendar.colors.get({});
      const event = response.data?.event || {};
      const map = { ...FALLBACK_EVENT_COLORS };
      for (const [id, swatch] of Object.entries(event)) {
        if (swatch?.background) map[id] = swatch.background;
      }
      this._eventColorMapByUser.set(uid, map);
      return map;
    } catch (err) {
      logger.warn(`No se pudo leer colors.get: ${err.message}`);
      return { ...FALLBACK_EVENT_COLORS };
    }
  }

  async getCalendarListBackgroundMap(userId) {
    const calendar = this.getCalendarApi(userId);
    const response = await calendar.calendarList.list({ minAccessRole: 'reader' });
    const map = {};
    for (const cal of response.data.items || []) {
      if (!cal?.id) continue;
      map[cal.id] = cal.backgroundColor || null;
      if (cal.primary) map.primary = cal.backgroundColor || null;
    }
    return map;
  }

  async listCalendars(userId) {
    await this.setUserCredentials(userId);
    const calendar = this.getCalendarApi(userId);
    const response = await calendar.calendarList.list({ minAccessRole: 'reader' });
    return (response.data.items || []).map((cal) => ({
      id: cal.id,
      summary: cal.summary,
      primary: Boolean(cal.primary),
      backgroundColor: cal.backgroundColor,
      selected: Boolean(cal.selected),
    }));
  }

  /** Id real del calendario principal (Google alias `primary` → email/id). */
  async resolvePrimaryCalendarId(userId) {
    const calendars = await this.listCalendars(userId);
    const primary = calendars.find((c) => c.primary);
    return primary?.id || 'primary';
  }

  /** Reemplaza `primary` por el id real y deduplica. */
  normalizeSelectedCalendarIds(ids, primaryRealId) {
    const fallback = primaryRealId || 'primary';
    const out = [];
    const seen = new Set();
    for (const id of ids || []) {
      const resolved = id === 'primary' ? fallback : id;
      if (!resolved || seen.has(resolved)) continue;
      seen.add(resolved);
      out.push(resolved);
    }
    return out.length ? out : [fallback];
  }

  /** Ids locales a aceptar al buscar EVENTOs (legacy `primary` + id real). */
  calendarIdLookupKeys(calendarId, primaryRealId) {
    if (calendarId === 'primary' || (primaryRealId && calendarId === primaryRealId)) {
      return [...new Set([calendarId, primaryRealId, 'primary'].filter(Boolean))];
    }
    return [calendarId];
  }

  appearanceUnchanged(existingSync, mappedSync) {
    return (existingSync?.eventLabelId || null) === (mappedSync?.eventLabelId || null)
      && (existingSync?.eventLabelName || null) === (mappedSync?.eventLabelName || null)
      && (existingSync?.colorId || null) === (mappedSync?.colorId || null)
      && (existingSync?.backgroundColor || null) === (mappedSync?.backgroundColor || null);
  }

  async syncEventsFromGoogle(userId, options = {}) {
    const user = await this.setUserCredentials(userId);
    if (!user.googleCalendarConfig?.enabled) {
      throw new Error('Google Calendar no está habilitado para este usuario');
    }

    const primaryRealId = await this.resolvePrimaryCalendarId(userId);
    const rawIds = user.googleCalendarConfig.selectedCalendarIds?.length
      ? user.googleCalendarConfig.selectedCalendarIds
      : ['primary'];
    const calendarIds = this.normalizeSelectedCalendarIds(rawIds, primaryRealId);
    if (JSON.stringify(rawIds) !== JSON.stringify(calendarIds)) {
      await Users.findByIdAndUpdate(userId, {
        'googleCalendarConfig.selectedCalendarIds': calendarIds,
      });
    }

    const { from, to } = this.buildSyncWindow(options);
    const results = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      errors: [],
      calendars: calendarIds.length,
    };

    const eventColorsById = await this.getEventColorMap(userId);
    let calendarBgById = {};
    try {
      calendarBgById = await this.getCalendarListBackgroundMap(userId);
    } catch (err) {
      logger.warn(`calendarList para colores default: ${err.message}`);
    }

    for (const calendarId of calendarIds) {
      try {
        const lookupKeys = this.calendarIdLookupKeys(calendarId, primaryRealId);
        const { byId: labelsById } = await this.getCalendarEventLabels(calendarId, userId);
        const events = await this.listAllEvents(calendarId, userId, from, to);
        const calendarBackgroundColor = calendarBgById[calendarId]
          || (calendarId === primaryRealId ? calendarBgById.primary : null)
          || null;

        for (const event of events) {
          try {
            const mapped = mapGoogleEventToTareaFields(event, calendarId, {
              labelsById,
              eventColorsById,
              calendarBackgroundColor,
            });
            if (!mapped) {
              results.skipped++;
              continue;
            }

            if (mapped.cancelled) {
              const deleted = await Tareas.deleteOne({
                usuario: userId,
                'googleCalendarSync.googleEventId': mapped.googleEventId,
                'googleCalendarSync.googleCalendarId': { $in: lookupKeys },
              });
              if (deleted.deletedCount) results.deleted++;
              continue;
            }

            const existing = await Tareas.findOne({
              usuario: userId,
              'googleCalendarSync.googleEventId': mapped.googleCalendarSync.googleEventId,
              'googleCalendarSync.googleCalendarId': { $in: lookupKeys },
            });

            if (existing) {
              if (existing.googleCalendarSync?.etag === mapped.googleCalendarSync.etag
                && existing.titulo === mapped.titulo
                && existing.descripcion === mapped.descripcion
                && Boolean(existing.googleCalendarSync?.allDay) === Boolean(mapped.googleCalendarSync?.allDay)
                && existing.fechaInicio?.getTime() === mapped.fechaInicio?.getTime()
                && existing.fechaFin?.getTime() === mapped.fechaFin?.getTime()
                && existing.googleCalendarSync?.googleCalendarId === calendarId
                && this.appearanceUnchanged(existing.googleCalendarSync, mapped.googleCalendarSync)) {
                results.skipped++;
                continue;
              }

              existing.titulo = mapped.titulo;
              existing.descripcion = mapped.descripcion;
              existing.tipo = 'EVENTO';
              existing.fechaInicio = mapped.fechaInicio;
              existing.fechaFin = mapped.fechaFin;
              existing.fechaVencimiento = mapped.fechaVencimiento;
              existing.googleCalendarSync = {
                ...existing.googleCalendarSync?.toObject?.() || existing.googleCalendarSync,
                ...mapped.googleCalendarSync,
                googleCalendarId: calendarId,
              };
              await existing.save();
              results.updated++;
            } else {
              await Tareas.create({
                ...mapped,
                usuario: userId,
                prioridad: 'BAJA',
              });
              results.created++;
            }
          } catch (eventErr) {
            results.errors.push(`${event.summary || event.id}: ${eventErr.message}`);
          }
        }
      } catch (calErr) {
        results.errors.push(`Calendario ${calendarId}: ${calErr.message}`);
      }
    }

    // Conservar legacy `primary` mientras migramos ids reales
    const keepCalendarIds = calendarIds.includes(primaryRealId)
      ? [...new Set([...calendarIds, 'primary'])]
      : calendarIds;

    // EVENTOs de calendarios ya no seleccionados → eliminar import local
    const deselected = await Tareas.find({
      usuario: userId,
      tipo: 'EVENTO',
      'googleCalendarSync.googleEventId': { $exists: true, $ne: null },
      'googleCalendarSync.googleCalendarId': { $nin: keepCalendarIds },
    }).select('_id').lean();

    for (const doc of deselected) {
      await Tareas.deleteOne({ _id: doc._id });
      results.deleted++;
    }

    await Users.findByIdAndUpdate(userId, {
      'googleCalendarConfig.lastSync': new Date(),
    });

    logger.sync(`📅 Calendar sync: +${results.created} ~${results.updated} -${results.deleted} (${results.skipped} sin cambios)`);
    return results;
  }
}

export default new GoogleCalendarService();

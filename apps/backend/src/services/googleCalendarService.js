import { google } from 'googleapis';
import { Users, Tareas } from '../models/index.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { mapGoogleEventToTareaFields } from '../utils/googleCalendarEventMapper.js';

const LOOKBACK_DAYS = parseInt(process.env.GCAL_LOOKBACK_DAYS || process.env.GTASKS_LIST_VIRTUAL_LOOKBACK_DAYS || '14', 10);
const HORIZON_DAYS = parseInt(process.env.GCAL_HORIZON_DAYS || process.env.GTASKS_LIST_VIRTUAL_HORIZON_DAYS || '120', 10);

class GoogleCalendarService {
  constructor() {
    this.oauthClients = new Map();
    this.calendarClients = new Map();
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
        if (tokens.refresh_token && current?.googleTasksConfig?.enabled) {
          update['googleTasksConfig.accessToken'] = tokens.access_token;
          update['googleTasksConfig.refreshToken'] = tokens.refresh_token;
          update['googleTasksConfig.lastTokenRefresh'] = new Date();
        }
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
    const calendar = this.getCalendarApi(userId);
    const items = [];
    let pageToken;

    do {
      const response = await calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        showDeleted: true,
        maxResults: 250,
        pageToken,
      });
      items.push(...(response.data.items || []));
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    return items;
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

  async syncEventsFromGoogle(userId, options = {}) {
    const user = await this.setUserCredentials(userId);
    if (!user.googleCalendarConfig?.enabled) {
      throw new Error('Google Calendar no está habilitado para este usuario');
    }

    const calendarIds = user.googleCalendarConfig.selectedCalendarIds?.length
      ? user.googleCalendarConfig.selectedCalendarIds
      : ['primary'];

    const { from, to } = this.buildSyncWindow(options);
    const results = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      errors: [],
      calendars: calendarIds.length,
    };

    const seenKeys = new Set();

    for (const calendarId of calendarIds) {
      try {
        const events = await this.listAllEvents(calendarId, userId, from, to);

        for (const event of events) {
          try {
            const mapped = mapGoogleEventToTareaFields(event, calendarId);
            if (!mapped) {
              results.skipped++;
              continue;
            }

            if (mapped.cancelled) {
              const deleted = await Tareas.deleteOne({
                usuario: userId,
                'googleCalendarSync.googleEventId': mapped.googleEventId,
                'googleCalendarSync.googleCalendarId': calendarId,
              });
              if (deleted.deletedCount) results.deleted++;
              continue;
            }

            const key = `${calendarId}::${mapped.googleCalendarSync.googleEventId}`;
            seenKeys.add(key);

            const existing = await Tareas.findOne({
              usuario: userId,
              'googleCalendarSync.googleEventId': mapped.googleCalendarSync.googleEventId,
              'googleCalendarSync.googleCalendarId': calendarId,
            });

            if (existing) {
              if (existing.googleCalendarSync?.etag === mapped.googleCalendarSync.etag
                && existing.titulo === mapped.titulo
                && existing.descripcion === mapped.descripcion
                && existing.fechaInicio?.getTime() === mapped.fechaInicio?.getTime()
                && existing.fechaFin?.getTime() === mapped.fechaFin?.getTime()) {
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

    const importedInWindow = await Tareas.find({
      usuario: userId,
      tipo: 'EVENTO',
      'googleCalendarSync.googleEventId': { $exists: true, $ne: null },
      $or: [
        { fechaInicio: { $gte: from, $lte: to } },
        {
          tipo: 'EVENTO',
          fechaInicio: { $lte: to },
          fechaFin: { $gte: from },
        },
      ],
    }).select('_id googleCalendarSync').lean();

    for (const doc of importedInWindow) {
      const calId = doc.googleCalendarSync?.googleCalendarId;
      const evId = doc.googleCalendarSync?.googleEventId;
      if (!calId || !evId) continue;
      const key = `${calId}::${evId}`;
      if (!seenKeys.has(key) && calendarIds.includes(calId)) {
        await Tareas.deleteOne({ _id: doc._id });
        results.deleted++;
      }
    }

    await Users.findByIdAndUpdate(userId, {
      'googleCalendarConfig.lastSync': new Date(),
    });

    logger.sync(`📅 Calendar sync: +${results.created} ~${results.updated} -${results.deleted} (${results.skipped} sin cambios)`);
    return results;
  }
}

export default new GoogleCalendarService();

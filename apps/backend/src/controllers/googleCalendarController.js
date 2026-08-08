import { Users } from '../models/index.js';
import config from '../config/config.js';
import { getUserId } from '../utils/authUtils.js';
import googleCalendarService from '../services/googleCalendarService.js';
import { signOAuthState } from '../utils/oauthState.js';

const GOOGLE_OAUTH_REDIRECT_URI = `${config.backendUrl}/api/google-tasks/callback`;
export const CALENDAR_OAUTH_STATE_PREFIX = 'cal:';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';

const postMessageOrigin = () => {
  try {
    return new URL(config.frontendUrl).origin;
  } catch {
    return '*';
  }
};

function callbackHtml(scriptBody, bodyText) {
  const origin = postMessageOrigin();
  return `<!DOCTYPE html><html><body><script>
    try { window.opener && window.opener.postMessage(${scriptBody}, ${JSON.stringify(origin)}); } catch (e) {}
    window.close();
  </script>
  <p>${bodyText}</p></body></html>`;
}

let google = null;
let oauth2Client = null;

try {
  const googleModule = await import('googleapis');
  google = googleModule.google;
  oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    GOOGLE_OAUTH_REDIRECT_URI,
  );
} catch (error) {
  console.warn('⚠️ googleapis no disponible para Google Calendar:', error.message);
}

const isGoogleCalendarEnabled = () => Boolean(
  google && oauth2Client && config.google?.clientId && config.google?.clientSecret,
);

function buildAuthScopes(user) {
  const scopes = [CALENDAR_SCOPE];
  if (user?.googleTasksConfig?.accessToken || user?.googleTasksConfig?.enabled) {
    scopes.unshift(TASKS_SCOPE);
  }
  return [...new Set(scopes)];
}

export const getAuthUrl = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (!isGoogleCalendarEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'Google Calendar no está disponible. Verifica googleapis y GOOGLE_CLIENT_ID/SECRET.',
      });
    }

    const userId = getUserId(req.user);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    const user = await Users.findById(userId);
    const scopes = buildAuthScopes(user);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: signOAuthState({ userId, kind: 'cal' }),
      prompt: 'consent',
      login_hint: user?.email,
    });

    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('Error en getAuthUrl Calendar:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

export async function completeCalendarOAuth(userId, code) {
  const { tokens } = await oauth2Client.getToken(code);

  const update = {
    'googleCalendarConfig.enabled': true,
    'googleCalendarConfig.accessToken': tokens.access_token,
    'googleCalendarConfig.refreshToken': tokens.refresh_token,
    'googleCalendarConfig.lastSync': new Date(),
    'googleCalendarConfig.tokenError': null,
    'googleCalendarConfig.tokenErrorDate': null,
  };

  if (!tokens.refresh_token) {
    const user = await Users.findById(userId).select('googleCalendarConfig.refreshToken');
    if (user?.googleCalendarConfig?.refreshToken) {
      update['googleCalendarConfig.refreshToken'] = user.googleCalendarConfig.refreshToken;
    }
  }

  if (tokens.access_token) {
    update['googleTasksConfig.accessToken'] = tokens.access_token;
    if (tokens.refresh_token) {
      update['googleTasksConfig.refreshToken'] = tokens.refresh_token;
    }
  }

  await Users.findByIdAndUpdate(userId, update);

  let syncResults = null;
  try {
    syncResults = await googleCalendarService.syncEventsFromGoogle(userId);
  } catch (syncErr) {
    console.warn('Error en sync inicial Calendar:', syncErr.message);
  }

  const message = syncResults
    ? `Google Calendar conectado. ${syncResults.created} eventos importados, ${syncResults.updated} actualizados`
    : 'Google Calendar conectado correctamente';

  return {
    scriptBody: `{ type: 'google_calendar_auth', status: 'success', message: ${JSON.stringify(message)} }`,
    bodyText: '¡Google Calendar conectado! Puedes cerrar esta ventana.',
  };
}

export const handleCallback = async (req, res) => {
  try {
    const { code, state, error: authError } = req.query;

    if (authError) {
      return res.send(callbackHtml(
        "{ type: 'google_calendar_auth', status: 'error', message: 'Autorización denegada' }",
        'Autorización denegada. Puedes cerrar esta ventana.',
      ));
    }

    if (!code) {
      return res.send(callbackHtml(
        "{ type: 'google_calendar_auth', status: 'error', message: 'Código no proporcionado' }",
        'Error: No se recibió código de autorización.',
      ));
    }

    const stateStr = String(state || '');
    const userId = stateStr.startsWith(CALENDAR_OAUTH_STATE_PREFIX)
      ? stateStr.slice(CALENDAR_OAUTH_STATE_PREFIX.length)
      : stateStr;
    if (!userId || userId === 'undefined') {
      return res.send(callbackHtml(
        "{ type: 'google_calendar_auth', status: 'error', message: 'Usuario no identificado' }",
        'Error: Usuario no identificado.',
      ));
    }

    if (!isGoogleCalendarEnabled()) {
      return res.send(callbackHtml(
        "{ type: 'google_calendar_auth', status: 'error', message: 'Google Calendar no disponible' }",
        'Google Calendar no está disponible.',
      ));
    }

    const { scriptBody, bodyText } = await completeCalendarOAuth(userId, code);
    return res.send(callbackHtml(scriptBody, bodyText));
  } catch (error) {
    console.error('Error en callback Calendar:', error);
    return res.send(callbackHtml(
      "{ type: 'google_calendar_auth', status: 'error', message: 'Error al procesar autorización' }",
      'Ocurrió un error al procesar la autorización.',
    ));
  }
};

export const getStatus = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    const dbUser = userId ? await Users.findById(userId).select('googleCalendarConfig') : null;
    const cfg = dbUser?.googleCalendarConfig || {};

    res.json({
      success: true,
      status: {
        enabled: cfg.enabled || false,
        lastSync: cfg.lastSync || null,
        selectedCalendarIds: cfg.selectedCalendarIds?.length
          ? cfg.selectedCalendarIds
          : ['primary'],
        syncDirection: cfg.syncDirection || 'from_google',
        available: isGoogleCalendarEnabled(),
      },
    });
  } catch (error) {
    console.error('Error al obtener estado Calendar:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estado' });
  }
};

export const updateConfig = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    const { selectedCalendarIds, syncDirection } = req.body;
    const update = {};

    if (Array.isArray(selectedCalendarIds) && selectedCalendarIds.length > 0) {
      update['googleCalendarConfig.selectedCalendarIds'] = selectedCalendarIds;
    }
    if (syncDirection === 'from_google' || syncDirection === 'bidirectional') {
      update['googleCalendarConfig.syncDirection'] = syncDirection;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, error: 'Nada que actualizar' });
    }

    await Users.findByIdAndUpdate(userId, update);
    res.json({ success: true, message: 'Configuración de Calendar actualizada' });
  } catch (error) {
    console.error('Error al actualizar config Calendar:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar configuración' });
  }
};

export const disconnect = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    await Users.findByIdAndUpdate(userId, {
      'googleCalendarConfig.enabled': false,
      'googleCalendarConfig.accessToken': null,
      'googleCalendarConfig.refreshToken': null,
      'googleCalendarConfig.lastSync': null,
    });
    res.json({ success: true, message: 'Google Calendar desconectado' });
  } catch (error) {
    console.error('Error al desconectar Calendar:', error);
    res.status(500).json({ success: false, error: 'Error al desconectar' });
  }
};

export const manualSync = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    const results = await googleCalendarService.syncEventsFromGoogle(userId);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error en sync Calendar:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al sincronizar Google Calendar',
    });
  }
};

export const getCalendars = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    const calendars = await googleCalendarService.listCalendars(userId);
    res.json({ success: true, calendars });
  } catch (error) {
    console.error('Error al listar calendarios:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al listar calendarios',
    });
  }
};

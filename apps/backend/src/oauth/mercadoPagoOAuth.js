import fetch from 'node-fetch';
import crypto from 'crypto';
import config from '../config/config.js';
import logger from '../utils/logger.js';

/**
 * PKCE (RFC 7636) — requerido si la app MP tiene "Authorization code con PKCE" habilitado.
 * Docs MP (2025/2026):
 * https://www.mercadopago.com.ar/developers/es/docs/security/oauth/creation
 */

/** code_verifier: 43–128 chars (base64url de 32 bytes ≈ 43). */
export function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

/** code_challenge S256 = BASE64URL(SHA256(verifier)) */
export function generateCodeChallenge(codeVerifier) {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

export function createPkcePair() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256'
  };
}

/**
 * URL de autorización OAuth (siempre con PKCE S256).
 * @returns {{ authUrl: string, state: string, codeVerifier: string }}
 */
export function getAuthUrl(redirectUri, state = null) {
  const clientId = config.mercadopago.clientId;
  if (!clientId) {
    logger.error('MERCADOPAGO_CLIENT_ID no está configurado', null, { redirectUri });
    throw new Error('MERCADOPAGO_CLIENT_ID no está configurado');
  }

  const stateParam = state || crypto.randomBytes(32).toString('hex');
  const { codeVerifier, codeChallenge, codeChallengeMethod } = createPkcePair();

  // Formato docs MP (authorization code + PKCE). Sin prompt=consent (no documentado; puede 400).
  // Scopes read/offline_access para wallet personal.
  const scopes = ['read', 'offline_access'].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    platform_id: 'mp',
    redirect_uri: redirectUri,
    state: stateParam,
    scope: scopes,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod
  });

  // Host oficial docs: auth.mercadopago.com (AR puede redirigir a .com.ar en el browser)
  const authUrl = `https://auth.mercadopago.com/authorization?${params.toString()}`;

  logger.info('[MercadoPago] URL de autorización generada', {
    clientId: clientId ? 'configurado' : 'no configurado',
    redirectUri,
    hasState: !!stateParam,
    scopes,
    pkce: true,
    codeChallengeMethod,
    authUrl: authUrl.substring(0, 160) + '...'
  });

  return { authUrl, state: stateParam, codeVerifier };
}

export async function exchangeCodeForToken({ code, redirectUri, codeVerifier = null }) {
  const startTime = Date.now();

  const clientId = config.mercadopago.clientId;
  const clientSecret = config.mercadopago.clientSecret;

  if (!clientId || !clientSecret) {
    logger.error('Configuración de MercadoPago incompleta', null, {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      redirectUri
    });
    throw new Error('Configuración de MercadoPago incompleta. Verifica MERCADOPAGO_CLIENT_ID y MERCADOPAGO_CLIENT_SECRET');
  }

  logger.info('[MercadoPago] Iniciando intercambio de código por token', {
    clientId: clientId ? 'configurado' : 'no configurado',
    clientSecret: clientSecret ? 'configurado' : 'no configurado',
    code: code ? 'presente' : 'ausente',
    hasCodeVerifier: !!codeVerifier,
    redirectUri
  });

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri
  });

  if (codeVerifier) {
    params.set('code_verifier', codeVerifier);
  }

  try {
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    logger.info('[MercadoPago] Respuesta de intercambio de token recibida', {
      status: response.status,
      hasAccessToken: !!data.access_token,
      hasRefreshToken: !!data.refresh_token,
      hasUserId: !!data.user_id,
      error: data.error,
      errorDescription: data.error_description,
      duration
    });

    if (!response.ok) {
      logger.error('Error en intercambio de token', null, {
        status: response.status,
        error: data.error,
        errorDescription: data.error_description,
        duration
      });
      throw new Error(`Error ${response.status}: ${data.error_description || data.error || 'Error desconocido'}`);
    }

    if (!data.access_token) {
      logger.error('No se pudo obtener access token', null, {
        errorDescription: data.error_description,
        duration
      });
      throw new Error(data.error_description || 'No se pudo obtener access token');
    }

    logger.info('[MercadoPago] Intercambio de token exitoso', {
      event: 'mercadopago_token_exchange',
      userId: data.user_id,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      scope: data.scope,
      duration,
      success: true
    });

    return data;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error en exchangeCodeForToken', error, {
      duration,
      redirectUri
    });
    throw error;
  }
}

/**
 * Refresca el access_token de MercadoPago usando el refresh_token
 * @param {Object} params
 * @param {string} params.refreshToken - El refresh_token recibido previamente
 * @returns {Promise<Object>} - Nuevo access_token y refresh_token
 *
 * Documentación oficial:
 * https://www.mercadopago.com.ar/developers/en/reference/oauth/_oauth_token/post
 */
export async function refreshAccessToken({ refreshToken }) {
  const startTime = Date.now();

  const clientId = config.mercadopago.clientId;
  const clientSecret = config.mercadopago.clientSecret;

  if (!clientId || !clientSecret) {
    logger.error('Configuración de MercadoPago incompleta para refresh', null, {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret
    });
    throw new Error('Configuración de MercadoPago incompleta. Verifica MERCADOPAGO_CLIENT_ID y MERCADOPAGO_CLIENT_SECRET');
  }

  logger.info('[MercadoPago] Iniciando refresh de token', {
    hasRefreshToken: !!refreshToken
  });

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken
  });

  try {
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    if (!response.ok) {
      logger.error('Error en refresh de token', null, {
        status: response.status,
        error: data.error,
        errorDescription: data.error_description,
        duration
      });
      throw new Error(`Error ${response.status}: ${data.error_description || data.error || 'Error desconocido'}`);
    }

    if (!data.access_token) {
      logger.error('No se pudo refrescar access token', null, {
        errorDescription: data.error_description,
        duration
      });
      throw new Error(data.error_description || 'No se pudo refrescar access token');
    }

    logger.info('[MercadoPago] Refresh de token exitoso', {
      event: 'mercadopago_token_refresh',
      userId: data.user_id,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      duration,
      success: true
    });

    return data;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error en refreshAccessToken', error, { duration });
    throw error;
  }
}

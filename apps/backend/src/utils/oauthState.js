import crypto from 'crypto';
import config from '../config/config.js';

const MAX_AGE_MS = 15 * 60 * 1000;

function getSecret() {
  return config.jwtSecret || config.sessionSecret || 'fallback_oauth_state_secret';
}

/**
 * Firma state OAuth: kind:userId:timestamp:hmac
 * kind: "tasks" | "cal"
 */
export function signOAuthState({ userId, kind = 'tasks' }) {
  const id = String(userId || '');
  const k = kind === 'cal' ? 'cal' : 'tasks';
  const ts = String(Date.now());
  const payload = `${k}:${id}:${ts}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

/**
 * Verifica state firmado. Retorna { userId, kind } o null.
 * Acepta legacy `cal:<userId>` / `<userId>` solo si ALLOW_LEGACY_OAUTH_STATE=true.
 */
export function verifyOAuthState(state) {
  const raw = String(state || '').trim();
  if (!raw || raw === 'undefined') return null;

  const parts = raw.split(':');
  if (parts.length >= 4) {
    const kind = parts[0] === 'cal' ? 'cal' : parts[0] === 'tasks' ? 'tasks' : null;
    const sig = parts[parts.length - 1];
    const ts = parts[parts.length - 2];
    const userId = parts.slice(1, -2).join(':');
    if (!kind || !userId || !/^\d+$/.test(ts) || !/^[a-f0-9]{64}$/i.test(sig)) {
      return null;
    }
    const payload = `${kind}:${userId}:${ts}`;
    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
    try {
      const a = Buffer.from(sig, 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    } catch {
      return null;
    }
    const age = Date.now() - Number(ts);
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null;
    return { userId, kind };
  }

  if (process.env.ALLOW_LEGACY_OAUTH_STATE === 'true') {
    if (raw.startsWith('cal:')) {
      const userId = raw.slice(4);
      return userId ? { userId, kind: 'cal' } : null;
    }
    return { userId: raw, kind: 'tasks' };
  }

  return null;
}

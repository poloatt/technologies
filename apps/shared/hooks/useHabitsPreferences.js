import { useEffect, useState } from 'react';
import clienteAxios from '../config/axios.js';

const PREFS_CACHE_KEY = 'attadia_habits_prefs_v1';

let cachedHabitsPreferences;
let cachedHabitChains;
let cachedUserId;
let hasFetchedFromNetwork = false;
let prefsInFlightPromise = null;

function getCurrentCachedUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('cachedUser');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id || parsed?._id || null;
  } catch {
    return null;
  }
}

function readPrefsStorageCache() {
  if (typeof window === 'undefined') return null;
  const userId = getCurrentCachedUserId();
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(PREFS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.userId !== userId) return null;
    return {
      habits: parsed.habits && typeof parsed.habits === 'object' ? parsed.habits : {},
      habitChains: Array.isArray(parsed.habitChains) ? parsed.habitChains : [],
    };
  } catch {
    return null;
  }
}

function writePrefsStorageCache(habits, habitChains) {
  if (typeof window === 'undefined') return;
  const userId = getCurrentCachedUserId();
  if (!userId) return;
  try {
    localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify({
      userId,
      habits: habits || {},
      habitChains: Array.isArray(habitChains) ? habitChains : [],
      ts: Date.now(),
    }));
  } catch {
    // Silenciar errores de cuota/serialización
  }
}

function clearPrefsStorageCache() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PREFS_CACHE_KEY);
  } catch {
    // noop
  }
}

function hydrateMemoryFromStorageIfNeeded() {
  const userId = getCurrentCachedUserId();
  if (cachedUserId && userId && cachedUserId !== userId) {
    cachedHabitsPreferences = undefined;
    cachedHabitChains = undefined;
    hasFetchedFromNetwork = false;
  }
  if (cachedHabitsPreferences !== undefined) return;
  const stored = readPrefsStorageCache();
  if (stored) {
    cachedHabitsPreferences = stored.habits;
    cachedHabitChains = stored.habitChains;
    cachedUserId = userId;
  }
}

export function invalidateHabitsPreferencesCache() {
  cachedHabitsPreferences = undefined;
  cachedHabitChains = undefined;
  hasFetchedFromNetwork = false;
  prefsInFlightPromise = null;
  clearPrefsStorageCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('habitsPreferencesInvalidated'));
  }
}

export function setHabitsPreferencesCache(prefs) {
  const userId = getCurrentCachedUserId();
  if (prefs && typeof prefs === 'object' && !Array.isArray(prefs) && 'habits' in prefs) {
    cachedHabitsPreferences = prefs.habits ?? {};
    cachedHabitChains = Array.isArray(prefs.habitChains) ? prefs.habitChains : [];
    cachedUserId = userId;
    writePrefsStorageCache(cachedHabitsPreferences, cachedHabitChains);
    return;
  }
  cachedHabitsPreferences = prefs ?? {};
  cachedHabitChains = cachedHabitChains ?? [];
  cachedUserId = userId;
  writePrefsStorageCache(cachedHabitsPreferences, cachedHabitChains);
}

export function setHabitChainsCache(chains) {
  cachedHabitChains = Array.isArray(chains) ? chains : [];
  writePrefsStorageCache(cachedHabitsPreferences ?? {}, cachedHabitChains);
}

export function getCachedHabitsPreferences() {
  hydrateMemoryFromStorageIfNeeded();
  return cachedHabitsPreferences;
}

export function getCachedHabitChains() {
  hydrateMemoryFromStorageIfNeeded();
  return cachedHabitChains;
}

export function fetchHabitsPreferencesFromApi({ force = false } = {}) {
  if (!force && prefsInFlightPromise) {
    return prefsInFlightPromise;
  }

  const run = clienteAxios.get('/api/users/preferences/habits')
    .then((response) => {
      const data = response.data || {};
      cachedHabitsPreferences = data.habits || {};
      cachedHabitChains = Array.isArray(data.habitChains) ? data.habitChains : [];
      cachedUserId = getCurrentCachedUserId();
      hasFetchedFromNetwork = true;
      writePrefsStorageCache(cachedHabitsPreferences, cachedHabitChains);
      return {
        habits: cachedHabitsPreferences,
        habitChains: cachedHabitChains,
      };
    })
    .catch(() => {
      cachedHabitsPreferences = cachedHabitsPreferences ?? {};
      cachedHabitChains = cachedHabitChains ?? [];
      return {
        habits: cachedHabitsPreferences,
        habitChains: cachedHabitChains,
      };
    })
    .finally(() => {
      if (prefsInFlightPromise === run) {
        prefsInFlightPromise = null;
      }
    });

  prefsInFlightPromise = run;
  return run;
}

export async function updateHabitChainsOnApi(habitChains) {
  const response = await clienteAxios.put('/api/users/habit-chains', { habitChains });
  const next = Array.isArray(response.data?.habitChains) ? response.data.habitChains : habitChains;
  cachedHabitChains = next;
  writePrefsStorageCache(cachedHabitsPreferences ?? {}, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('habitChainsUpdated', { detail: next }));
  }
  return next;
}

/**
 * Preferencias de hábitos del usuario (plantilla + cadenas).
 * Cache en memoria + localStorage (SWR) para render inmediato sin parpadeos.
 */
export default function useHabitsPreferences() {
  hydrateMemoryFromStorageIfNeeded();

  const [habitsPreferences, setHabitsPreferences] = useState(
    () => (cachedHabitsPreferences !== undefined ? cachedHabitsPreferences : null),
  );
  const [habitChains, setHabitChains] = useState(
    () => (cachedHabitChains !== undefined ? cachedHabitChains : null),
  );

  useEffect(() => {
    let cancelled = false;

    const load = (options) => {
      fetchHabitsPreferencesFromApi(options).then(({ habits, habitChains: chains }) => {
        if (!cancelled) {
          setHabitsPreferences(habits);
          setHabitChains(chains);
        }
      });
    };

    if (cachedHabitsPreferences !== undefined) {
      setHabitsPreferences(cachedHabitsPreferences);
      setHabitChains(cachedHabitChains ?? []);
      if (!hasFetchedFromNetwork) {
        load();
      }
    } else {
      load();
    }

    const onInvalidate = () => load({ force: true });
    const onChainsUpdated = (event) => {
      const next = event?.detail ?? cachedHabitChains ?? [];
      setHabitChains(next);
    };

    window.addEventListener('habitsPreferencesInvalidated', onInvalidate);
    window.addEventListener('habitChainsUpdated', onChainsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('habitsPreferencesInvalidated', onInvalidate);
      window.removeEventListener('habitChainsUpdated', onChainsUpdated);
    };
  }, []);

  return {
    habitsPreferences,
    habitChains: habitChains ?? [],
    prefsReady: habitsPreferences !== null && habitChains !== null,
  };
}

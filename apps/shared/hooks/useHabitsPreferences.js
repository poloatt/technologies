import { useEffect, useState } from 'react';
import clienteAxios from '../config/axios.js';

let cachedHabitsPreferences;
let cachedHabitChains;

export function invalidateHabitsPreferencesCache() {
  cachedHabitsPreferences = undefined;
  cachedHabitChains = undefined;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('habitsPreferencesInvalidated'));
  }
}

export function setHabitsPreferencesCache(prefs) {
  if (prefs && typeof prefs === 'object' && !Array.isArray(prefs) && 'habits' in prefs) {
    cachedHabitsPreferences = prefs.habits ?? {};
    cachedHabitChains = Array.isArray(prefs.habitChains) ? prefs.habitChains : [];
    return;
  }
  cachedHabitsPreferences = prefs ?? {};
  cachedHabitChains = cachedHabitChains ?? [];
}

export function setHabitChainsCache(chains) {
  cachedHabitChains = Array.isArray(chains) ? chains : [];
}

export function getCachedHabitsPreferences() {
  return cachedHabitsPreferences;
}

export function getCachedHabitChains() {
  return cachedHabitChains;
}

export function fetchHabitsPreferencesFromApi() {
  return clienteAxios.get('/api/users/preferences/habits')
    .then((response) => {
      const data = response.data || {};
      cachedHabitsPreferences = data.habits || {};
      cachedHabitChains = Array.isArray(data.habitChains) ? data.habitChains : [];
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
    });
}

export async function updateHabitChainsOnApi(habitChains) {
  const response = await clienteAxios.put('/api/users/habit-chains', { habitChains });
  const next = Array.isArray(response.data?.habitChains) ? response.data.habitChains : habitChains;
  cachedHabitChains = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('habitChainsUpdated', { detail: next }));
  }
  return next;
}

/**
 * Preferencias de hábitos del usuario (plantilla + cadenas).
 * Cache en memoria para evitar parpadeos al cambiar Ahora/Luego.
 */
export default function useHabitsPreferences() {
  const [habitsPreferences, setHabitsPreferences] = useState(
    () => (cachedHabitsPreferences !== undefined ? cachedHabitsPreferences : null),
  );
  const [habitChains, setHabitChains] = useState(
    () => (cachedHabitChains !== undefined ? cachedHabitChains : null),
  );

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetchHabitsPreferencesFromApi().then(({ habits, habitChains: chains }) => {
        if (!cancelled) {
          setHabitsPreferences(habits);
          setHabitChains(chains);
        }
      });
    };

    if (cachedHabitsPreferences !== undefined) {
      setHabitsPreferences(cachedHabitsPreferences);
      setHabitChains(cachedHabitChains ?? []);
    } else {
      load();
    }

    const onInvalidate = () => load();
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

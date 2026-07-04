import { useEffect, useState } from 'react';
import clienteAxios from '../config/axios.js';

let cachedHabitsPreferences;

export function invalidateHabitsPreferencesCache() {
  cachedHabitsPreferences = undefined;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('habitsPreferencesInvalidated'));
  }
}

export function setHabitsPreferencesCache(prefs) {
  cachedHabitsPreferences = prefs ?? {};
}

function fetchHabitsPreferencesFromApi() {
  return clienteAxios.get('/api/users/preferences/habits')
    .then((response) => response.data?.habits || {})
    .catch(() => ({}));
}

/**
 * Preferencias de hábitos del usuario (plantilla).
 * Cache en memoria para evitar parpadeos al cambiar Ahora/Luego.
 */
export default function useHabitsPreferences() {
  const [habitsPreferences, setHabitsPreferences] = useState(
    () => (cachedHabitsPreferences !== undefined ? cachedHabitsPreferences : null),
  );

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetchHabitsPreferencesFromApi().then((prefs) => {
        cachedHabitsPreferences = prefs;
        if (!cancelled) setHabitsPreferences(prefs);
      });
    };

    if (cachedHabitsPreferences !== undefined) {
      setHabitsPreferences(cachedHabitsPreferences);
    } else {
      load();
    }

    const onInvalidate = () => load();
    window.addEventListener('habitsPreferencesInvalidated', onInvalidate);

    return () => {
      cancelled = true;
      window.removeEventListener('habitsPreferencesInvalidated', onInvalidate);
    };
  }, []);

  return {
    habitsPreferences,
    prefsReady: habitsPreferences !== null,
  };
}

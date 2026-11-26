import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { useSnackbar } from 'notistack';
import clienteAxios from '../config/axios';
import { getHabitId, findHabitIndexInSection, habitIdsMatch } from '@shared/habits';

const HABITS_CACHE_KEY = 'attadia_habits_v1';
const EMPTY_HABITS = {
  bodyCare: [],
  nutricion: [],
  ejercicio: [],
  cleaning: [],
};

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

function readHabitsStorageCache() {
  if (typeof window === 'undefined') return null;
  const userId = getCurrentCachedUserId();
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(HABITS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.userId !== userId) return null;
    return {
      habits: parsed.habits && typeof parsed.habits === 'object' ? parsed.habits : EMPTY_HABITS,
      customSections: Array.isArray(parsed.customSections) ? parsed.customSections : [],
    };
  } catch {
    return null;
  }
}

function writeHabitsStorageCache(habits, customSections) {
  if (typeof window === 'undefined') return;
  const userId = getCurrentCachedUserId();
  if (!userId) return;
  try {
    localStorage.setItem(HABITS_CACHE_KEY, JSON.stringify({
      userId,
      habits: habits || EMPTY_HABITS,
      customSections: Array.isArray(customSections) ? customSections : [],
      ts: Date.now(),
    }));
  } catch {
    // Silenciar errores de cuota/serialización
  }
}

// Crear el contexto
const HabitsContext = createContext();

/**
 * Hook personalizado para usar el contexto de hábitos
 */
export const useHabits = () => {
  const context = useContext(HabitsContext);
  if (!context) {
    throw new Error('useHabits debe usarse dentro de un HabitsProvider');
  }
  return context;
};

// Provider del contexto
export const HabitsProvider = ({ children }) => {
  const initialCacheRef = useRef(undefined);
  if (initialCacheRef.current === undefined) {
    initialCacheRef.current = readHabitsStorageCache();
  }
  const initialCache = initialCacheRef.current;

  const [habits, setHabits] = useState(() => initialCache?.habits || EMPTY_HABITS);
  const [customSections, setCustomSections] = useState(() => initialCache?.customSections || []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [habitsReady, setHabitsReady] = useState(() => Boolean(initialCache));
  const [error, setError] = useState(null);
  const hasCachedDataRef = useRef(Boolean(initialCache));
  const customSectionsRef = useRef(customSections);
  customSectionsRef.current = customSections;
  const habitsRef = useRef(habits);
  habitsRef.current = habits;
  // Deduplica llamadas concurrentes a fetchHabits (varios componentes la disparan al montar)
  const fetchHabitsInFlightRef = useRef(null);

  const { enqueueSnackbar } = useSnackbar();

  /**
   * Obtener hábitos personalizados del usuario
   */
  const fetchHabits = useCallback(async () => {
    if (fetchHabitsInFlightRef.current) {
      return fetchHabitsInFlightRef.current;
    }

    const run = (async () => {
      try {
        if (!hasCachedDataRef.current) {
          setLoading(true);
        }
        setError(null);

        const response = await clienteAxios.get('/api/users/habits');
        const payload = response.data;
        const nextHabits = payload?.habits || payload || EMPTY_HABITS;
        const nextCustomSections = Array.isArray(payload?.customSections)
          ? payload.customSections
          : [];

        hasCachedDataRef.current = true;
        setHabits(nextHabits);
        setCustomSections(nextCustomSections);
        writeHabitsStorageCache(nextHabits, nextCustomSections);

        return { habits: nextHabits, customSections: nextCustomSections };
      } catch (error) {
        console.error('[HabitsContext] Error al obtener hábitos:', error);
        const isOffline =
          !error.response
          || error.message?.includes('conexión')
          || error.message?.includes('servidor');
        setError(error.response?.data?.error || error.message || 'Error al obtener hábitos');
        if (!isOffline) {
          enqueueSnackbar('Error al cargar hábitos', { variant: 'error' });
        }
        return null;
      } finally {
        setHabitsReady(true);
        setLoading(false);
      }
    })();

    fetchHabitsInFlightRef.current = run;
    try {
      return await run;
    } finally {
      fetchHabitsInFlightRef.current = null;
    }
  }, [enqueueSnackbar]);

  /**
   * Agregar nuevo hábito
   */
  const addHabit = useCallback(async (section, habit) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await clienteAxios.post('/api/users/habits', {
        section,
        habit
      });
      
      // Actualizar estado local
      setHabits(prev => {
        const next = {
          ...prev,
          [section]: [...(prev[section] || []), response.data.habit]
        };
        writeHabitsStorageCache(next, customSectionsRef.current);
        return next;
      });
      
      enqueueSnackbar('Hábito agregado correctamente', { variant: 'success' });
      return response.data.habit;
    } catch (error) {
      console.error('[HabitsContext] Error al agregar hábito:', error);
      const errorMsg = error.response?.data?.error || 'Error al agregar hábito';
      setError(errorMsg);
      enqueueSnackbar(errorMsg, { variant: 'error' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  /**
   * Actualizar hábito existente
   */
  const updateHabit = useCallback(async (habitId, section, updates) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await clienteAxios.put(`/api/users/habits/${habitId}`, {
        section,
        habit: updates
      });
      
      // Actualizar estado local
      setHabits(prev => {
        const next = {
          ...prev,
          [section]: (prev[section] || []).map(h =>
            (h.id || h._id) === habitId ? response.data.habit : h
          )
        };
        writeHabitsStorageCache(next, customSectionsRef.current);
        return next;
      });
      
      enqueueSnackbar('Hábito actualizado correctamente', { variant: 'success' });
      return response.data.habit;
    } catch (error) {
      console.error('[HabitsContext] Error al actualizar hábito:', error);
      const errorMsg = error.response?.data?.error || 'Error al actualizar hábito';
      setError(errorMsg);
      enqueueSnackbar(errorMsg, { variant: 'error' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  /**
   * Eliminar hábito
   */
  const deleteHabit = useCallback(async (habitId, section) => {
    try {
      setLoading(true);
      setError(null);

      const sectionHabits = habits[section] || [];
      const habitIndex = findHabitIndexInSection(sectionHabits, habitId);
      const habit = habitIndex >= 0 ? sectionHabits[habitIndex] : null;
      const canonicalId = getHabitId(habit) || String(habitId);

      await clienteAxios.delete(`/api/users/habits/${encodeURIComponent(canonicalId)}`, {
        data: { section },
      });

      setHabits((prev) => {
        const next = {
          ...prev,
          [section]: (prev[section] || []).filter((h) => !habitIdsMatch(h, habitId)),
        };
        writeHabitsStorageCache(next, customSectionsRef.current);
        return next;
      });
      
      enqueueSnackbar('Hábito eliminado correctamente', { variant: 'success' });
    } catch (error) {
      console.error('[HabitsContext] Error al eliminar hábito:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Error al eliminar hábito';
      setError(errorMsg);
      enqueueSnackbar(errorMsg, { variant: 'error' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, habits]);

  /**
   * Reordenar hábitos en una sección
   */
  const reorderHabits = useCallback(async (section, habitIds) => {
    try {
      setLoading(true);
      setError(null);

      const response = await clienteAxios.put('/api/users/habits/reorder', {
        section,
        habitIds
      });

      setHabits(prev => {
        const next = {
          ...prev,
          [section]: response.data.habits
        };
        writeHabitsStorageCache(next, customSectionsRef.current);
        return next;
      });
      
      enqueueSnackbar('Hábitos reordenados correctamente', { variant: 'success' });
      return response.data.habits;
    } catch (error) {
      console.error('[HabitsContext] Error al reordenar hábitos:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Error al reordenar hábitos';
      const errorDetails = error.response?.data;
      console.error('[HabitsContext] Detalles del error:', errorDetails);
      setError(errorMsg);
      enqueueSnackbar(`${errorMsg}${errorDetails?.invalidIds ? ` (IDs inválidos: ${errorDetails.invalidIds.join(', ')})` : ''}`, { variant: 'error' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  /**
   * Crear nuevo grupo de hábitos personalizado
   */
  const addHabitSection = useCallback(async ({ label, icon }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await clienteAxios.post('/api/users/habit-sections', {
        label,
        icon,
      });

      const section = response.data?.section;
      const nextCustomSections = response.data?.customSections || [];

      if (section?.id) {
        setHabits((prev) => ({
          ...prev,
          [section.id]: prev[section.id] || [],
        }));
      }
      setCustomSections(nextCustomSections);

      enqueueSnackbar('Grupo creado correctamente', { variant: 'success' });
      return section;
    } catch (error) {
      console.error('[HabitsContext] Error al crear grupo:', error);
      const errorMsg = error.response?.data?.error || 'Error al crear grupo';
      setError(errorMsg);
      enqueueSnackbar(errorMsg, { variant: 'error' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  const updateHabitSection = useCallback(async (sectionId, { label, icon }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await clienteAxios.put(`/api/users/habit-sections/${encodeURIComponent(sectionId)}`, {
        label,
        icon,
      });

      const nextCustomSections = response.data?.customSections || [];
      setCustomSections(nextCustomSections);

      enqueueSnackbar('Grupo actualizado correctamente', { variant: 'success' });
      return response.data?.section;
    } catch (error) {
      console.error('[HabitsContext] Error al actualizar grupo:', error);
      const errorMsg = error.response?.data?.error || 'Error al actualizar grupo';
      setError(errorMsg);
      enqueueSnackbar(errorMsg, { variant: 'error' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  const deleteHabitSection = useCallback(async (sectionId) => {
    try {
      setLoading(true);
      setError(null);

      const response = await clienteAxios.delete(`/api/users/habit-sections/${encodeURIComponent(sectionId)}`);
      const nextCustomSections = response.data?.customSections || [];
      setCustomSections(nextCustomSections);
      setHabits((prev) => {
        if (!prev?.[sectionId]) return prev;
        const next = { ...prev };
        delete next[sectionId];
        return next;
      });

      enqueueSnackbar('Grupo eliminado correctamente', { variant: 'success' });
      return true;
    } catch (error) {
      console.error('[HabitsContext] Error al eliminar grupo:', error);
      const errorMsg = error.response?.data?.error || 'Error al eliminar grupo';
      setError(errorMsg);
      enqueueSnackbar(errorMsg, { variant: 'error' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  const value = useMemo(() => ({
    habits,
    customSections,
    loading,
    habitsReady,
    error,
    fetchHabits,
    addHabit,
    addHabitSection,
    updateHabitSection,
    deleteHabitSection,
    updateHabit,
    deleteHabit,
    reorderHabits,
  }), [habits, customSections, loading, habitsReady, error, fetchHabits, addHabit, addHabitSection, updateHabitSection, deleteHabitSection, updateHabit, deleteHabit, reorderHabits]);

  return (
    <HabitsContext.Provider value={value}>
      {children}
    </HabitsContext.Provider>
  );
};


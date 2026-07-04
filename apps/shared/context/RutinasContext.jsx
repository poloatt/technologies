import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import clienteAxios from '../config/axios';
import { startOfDay } from 'date-fns';
import { getNormalizedToday, toISODateString, parseAPIDate, formatDateForAPI } from '../utils/dateUtils';
import { resolveHabitConfigApplyFrom } from '@shared/habits';
import rutinasService from '../services/rutinasService';
import { UISettingsContext } from './UISettingsContext';
import { calculateCompletionPercentage } from '../utils/rutinaCalculations';
import { isHabitCompletedForHistorial } from '../habits/domain/habitCompletionUtils.js';
import { normalizeTimeOfDay } from '../utils/timeOfDayUtils';
import { invalidateHabitsPreferencesCache } from '../hooks/useHabitsPreferences.js';
import { resolveUndoScope } from '../config/undoScopeConfig';
import { useScopedActionHistory } from '../hooks/useScopedUndo';
import { ACTION_TYPES } from './ActionHistoryContext';
import {
  recordRutinaSectionAction,
  recordRutinaConfigAction,
  recordRutinaCrudAction,
  recordRutinaSectionDiff,
} from '../undo/undoRecordingUtils';

const SCOPES_WITH_SECTION_UNDO = new Set(['tareas', 'rutinas']);

import { HABIT_SECTIONS } from '@shared/habits';

const RUTINA_HISTORIAL_SKIP_KEYS = new Set([
  '_id',
  'id',
  'fecha',
  'config',
  'completitud',
  'completitudPorSeccion',
  'usuario',
  'metadata',
  'orden',
  'createdAt',
  'updatedAt',
  'nombre',
  'notas',
  'tipo',
  'historial',
  'completacionesSemana',
  '_expandedSections',
  '_page',
  '_totalPages',
]);

function collectRutinaHistorialSections(rutina = {}) {
  const keys = new Set(HABIT_SECTIONS);
  Object.keys(rutina.config || {}).forEach((section) => {
    if (section !== '_metadata') keys.add(section);
  });
  Object.keys(rutina).forEach((key) => {
    if (RUTINA_HISTORIAL_SKIP_KEYS.has(key)) return;
    if (rutina[key] && typeof rutina[key] === 'object' && !Array.isArray(rutina[key])) {
      keys.add(key);
    }
  });
  return [...keys];
}

// Construye historial de completaciones por sección/ítem a partir del logger por día
// Forma: historial[section][itemId][YYYY-MM-DD] = true
const buildHistorialFromRutinas = (rutinasList = []) => {
  const historial = {};

  rutinasList.forEach(r => {
    let dateStr = null;
    try {
      dateStr = toISODateString(parseAPIDate(r.fecha));
    } catch {
      dateStr = null;
    }
    if (!dateStr) return;

    collectRutinaHistorialSections(r).forEach((section) => {
      const sec = r?.[section];
      if (!sec || typeof sec !== 'object') return;
      if (!historial[section]) historial[section] = {};
      Object.entries(sec).forEach(([itemId, completed]) => {
        if (!isHabitCompletedForHistorial(completed)) return;
        if (!historial[section][itemId]) historial[section][itemId] = {};
        historial[section][itemId][dateStr] = true;
      });
    });
  });

  return historial;
};

const attachHistorial = (rutinasList = []) => {
  const historial = buildHistorialFromRutinas(rutinasList);
  const rutinasWithHist = rutinasList.map(r => ({ ...r, historial }));
  return { historial, rutinasWithHist };
};

// Crear el contexto
const RutinasContext = createContext();

/**
 * Hook personalizado para usar el contexto de rutinas
 */
export const useRutinas = () => {
  const context = useContext(RutinasContext);
  if (!context) {
    throw new Error('useRutinas debe usarse dentro de un RutinasProvider');
  }
  return context;
};

// Provider del contexto
export const RutinasProvider = ({ children }) => {
  const location = useLocation();
  const undoScope = resolveUndoScope(location.pathname);
  const undoRecorder = useScopedActionHistory(undoScope);

  // Estados básicos
  const [rutina, setRutina] = useState(null);
  const [rutinas, setRutinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewDate, setViewDate] = useState(() => startOfDay(getNormalizedToday()));
  
  const { enqueueSnackbar } = useSnackbar();
  const uiContext = React.useContext(UISettingsContext);
  const autoUpdateHabitPreferences = uiContext?.autoUpdateHabitPreferences || (() => {});

  // Mantener una referencia estable al array de rutinas para evitar dependencias reactivas
  const rutinasRef = React.useRef([]);
  const ensureTodayAttemptedRef = React.useRef(false);
  // Deduplica llamadas concurrentes a fetchRutinas (AgendaCalendarPage + HabitCarouselStrip la disparan al montar)
  const fetchRutinasInFlightRef = React.useRef(null);
  useEffect(() => {
    rutinasRef.current = rutinas;
  }, [rutinas]);

  // Función para manejo de errores
  const handleError = useCallback((error, context, fallbackMessage) => {
    const message = error?.message || fallbackMessage;
    console.error(`[RutinasContext] ${context}:`, error);
    enqueueSnackbar(message, { variant: 'error' });
  }, [enqueueSnackbar]);

  // Cargar rutinas
  const fetchRutinas = useCallback(async (forceReload = false) => {
    if (!forceReload && fetchRutinasInFlightRef.current) {
      return fetchRutinasInFlightRef.current;
    }

    const run = (async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await rutinasService.getRutinas({ limit: 90 });
      const rutinaList = Array.isArray(data) ? data : (data.docs || []);
      
      if (!Array.isArray(rutinaList)) {
        setError('Formato de datos incorrecto');
        return;
      }
      
      // Ordenar rutinas por fecha (más reciente primero)
      const rutinasOrdenadas = [...rutinaList].sort((a, b) => {
        const da = parseAPIDate(a.fecha);
        const db = parseAPIDate(b.fecha);
        return db - da;
      });

      const { historial, rutinasWithHist } = attachHistorial(rutinasOrdenadas);
      
      const totalRutinas = rutinasWithHist.length;
      setTotalPages(totalRutinas);
      setRutinas(rutinasWithHist);
      
      // Auto-crear rutina de hoy si no existe (una vez por sesión, para evitar loops)
      const todayStr = toISODateString(getNormalizedToday());
      const hasToday = rutinasWithHist.some(r => {
        try {
          return toISODateString(parseAPIDate(r.fecha)) === todayStr;
        } catch {
          return false;
        }
      });

      if (!hasToday && !ensureTodayAttemptedRef.current) {
        try {
          // Verificar primero si la rutina de hoy ya existe en el servidor. Evita
          // un POST que devolvería 409 cuando `hasToday` falla por desfase de
          // fecha/zona horaria entre el cliente y el backend.
          try {
            const verify = await clienteAxios.get(
              `/api/rutinas/verify?fecha=${encodeURIComponent(todayStr)}`,
            );
            if (verify.data?.exists && verify.data?.rutinaId) {
              await getRutinaById(verify.data.rutinaId);
              ensureTodayAttemptedRef.current = true;
              return;
            }
          } catch {
            // Si verify falla, continuar con la creación (el POST maneja el 409).
          }

          const created = await rutinasService.createRutina({ fecha: todayStr, useGlobalConfig: true });
          // Refrescar lista y seleccionar la rutina creada
          const merged = [created, ...rutinasWithHist];
          const { historial: newHist, rutinasWithHist: mergedWithHist } = attachHistorial(merged);
          setRutinas(mergedWithHist);
          setTotalPages(mergedWithHist.length);
          setRutina({
            ...created,
            historial: newHist,
            _page: 1,
            _totalPages: mergedWithHist.length
          });
          setCurrentPage(1);
          ensureTodayAttemptedRef.current = true;
          return; // ya seleccionamos hoy
        } catch (e) {
          const status = e?.response?.status;
          const rutinaId = e?.response?.data?.rutinaId;
          if (status === 409 && rutinaId) {
            // Ya existe: cargarla y seleccionarla
            await getRutinaById(rutinaId);
            ensureTodayAttemptedRef.current = true;
            return;
          }
          // Si falla, no bloquear reintento en la próxima fetchRutinas
        }
      }

      // Seleccionar rutina de hoy o la más reciente
      if (rutinasWithHist.length > 0) {
        const indexToday = rutinasWithHist.findIndex(r => {
          try {
            return toISODateString(parseAPIDate(r.fecha)) === todayStr;
          } catch {
            return false;
          }
        });
        const selectedIndex = indexToday >= 0 ? indexToday : 0;
        const selected = rutinasWithHist[selectedIndex];
        setRutina({
          ...selected,
          historial,
          _page: selectedIndex + 1,
          _totalPages: totalRutinas
        });
        setCurrentPage(selectedIndex + 1);
        if (selected?.fecha) {
          try {
            setViewDate(startOfDay(parseAPIDate(selected.fecha)));
          } catch {
            // mantener viewDate
          }
        }
      } else {
        setRutina(null);
        setCurrentPage(1);
      }
      
    } catch (error) {
      console.error('[RutinasContext] Error al cargar rutinas:', error);
      if (!error.cancelado) {
        setError('No se pudieron cargar las rutinas');
        enqueueSnackbar('Error al cargar las rutinas', { variant: 'error' });
      }
    } finally {
      setLoading(false);
    }
    })();

    fetchRutinasInFlightRef.current = run;
    try {
      return await run;
    } finally {
      fetchRutinasInFlightRef.current = null;
    }
  }, [enqueueSnackbar]);

  // Cargar una rutina específica por ID
  const getRutinaById = useCallback(async (rutinaId) => {
    try {
      if (!rutinaId) {
        console.error('[RutinasContext] ID de rutina no proporcionado');
        enqueueSnackbar('Error: ID de rutina no proporcionado', { variant: 'error' });
        return null;
      }

      setLoading(true);
      
      // Verificar si ya tenemos esta rutina en nuestro array (usando ref estable)
      const rutinaEnCache = rutinasRef.current.find(r => r._id === rutinaId);
      
      let rutinaData;
      if (rutinaEnCache) {
        rutinaData = rutinaEnCache;
      } else {
        // Si no está en caché, hacer petición al servidor
        const response = await rutinasService.getRutinaById(rutinaId);
        rutinaData = response;

        // Actualizar el array de rutinas y recalcular historial
        const base = Array.isArray(rutinasRef.current) ? rutinasRef.current : [];
        const newRutinas = [...base];
        const existingIndex = newRutinas.findIndex(r => r._id === rutinaData._id);
        if (existingIndex >= 0) newRutinas[existingIndex] = rutinaData;
        else newRutinas.push(rutinaData);

        newRutinas.sort((a, b) => {
          const da = parseAPIDate(a.fecha);
          const db = parseAPIDate(b.fecha);
          return db - da;
        });

        const { historial, rutinasWithHist } = attachHistorial(newRutinas);
        setRutinas(rutinasWithHist);
        rutinaData = { ...rutinaData, historial };
      }
      
      // Encontrar índice para calcular la página (usando ref estable)
      const index = (rutinasRef.current || []).findIndex(r => r._id === rutinaId);
      const page = index >= 0 ? index + 1 : 1;
      
      // Actualizar la rutina actual
      const rutinaActualizada = {
        ...rutinaData,
        _page: page,
        _totalPages: (rutinasRef.current?.length || 1)
      };
      
      setRutina(rutinaActualizada);
      setCurrentPage(page);
      if (rutinaData?.fecha) {
        try {
          setViewDate(startOfDay(parseAPIDate(rutinaData.fecha)));
        } catch {
          // mantener viewDate actual
        }
      }

      return rutinaActualizada;
    } catch (error) {
      console.error(`[RutinasContext] Error al cargar rutina con ID ${rutinaId}:`, error);
      enqueueSnackbar(`Error al cargar rutina: ${error.message}`, { variant: 'error' });
      return null;
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  const previewRutinaDate = useCallback((date) => {
    if (!date) return;
    setViewDate(startOfDay(date));
    setRutina(null);
  }, []);

  // Navegación entre rutinas (legacy por índice — preferir useRutinaDateNav)
  const handlePrevious = useCallback(() => {
    if (currentPage > 1 && !loading) {
      const newPage = currentPage - 1;
      const index = newPage - 1;
      const targetRutina = rutinas[index];
      
      if (targetRutina && targetRutina._id) {
        setRutina({
          ...targetRutina,
          _page: newPage,
          _totalPages: totalPages
        });
        setCurrentPage(newPage);
      }
    } else {
      enqueueSnackbar('Ya estás en la rutina más reciente', { variant: 'info' });
    }
  }, [currentPage, totalPages, loading, rutinas, enqueueSnackbar]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages && !loading) {
      const newPage = currentPage + 1;
      const index = newPage - 1;
      const targetRutina = rutinas[index];
      
      if (targetRutina && targetRutina._id) {
        setRutina({
          ...targetRutina,
          _page: newPage,
          _totalPages: totalPages
        });
        setCurrentPage(newPage);
      }
    } else {
      enqueueSnackbar('Ya estás en la rutina más antigua', { variant: 'info' });
    }
  }, [currentPage, totalPages, loading, rutinas, enqueueSnackbar]);

  // Parche local de sección (checkmarks) para que la navegación (% y contadores) se actualice sin refresh global
  const patchRutinaSection = useCallback((rutinaId, section, nextSectionData, options = {}) => {
    if (!rutinaId || !section || !nextSectionData) return;

    const { recordUndo = false } = options;

    if (recordUndo && undoScope && SCOPES_WITH_SECTION_UNDO.has(undoScope)) {
      const rutinaBefore = rutinas.find((r) => r._id === rutinaId)
        || (rutina?._id === rutinaId ? rutina : null);
      const beforeSection = (rutinaBefore?.[section] && typeof rutinaBefore[section] === 'object')
        ? rutinaBefore[section]
        : {};
      const afterSection = { ...beforeSection, ...(nextSectionData || {}) };
      recordRutinaSectionDiff(undoRecorder, rutinaId, section, beforeSection, afterSection);
    }

    setRutinas(prevList => {
      if (!Array.isArray(prevList)) return prevList;
      const updated = prevList.map(r => {
        if (!r || r._id !== rutinaId) return r;
        // Importante: merge para soportar updates parciales (ej. { [itemId]: true/false })
        // sin pisar el resto de ítems ya marcados en esa sección.
        const prevSection = (r && r[section] && typeof r[section] === 'object') ? r[section] : {};
        return { ...r, [section]: { ...prevSection, ...(nextSectionData || {}) } };
      });
      // Recalcular historial para PERSONALIZADO y coherencia de completion
      const { rutinasWithHist } = attachHistorial(updated);
      return rutinasWithHist;
    });

    setRutina(prev => {
      if (!prev || prev._id !== rutinaId) return prev;
      const prevSection = (prev && prev[section] && typeof prev[section] === 'object') ? prev[section] : {};
      return { ...prev, [section]: { ...prevSection, ...(nextSectionData || {}) } };
    });
  }, [rutinas, rutina, undoScope, undoRecorder]);

  // Marcar un ítem como completado
  const markItemComplete = useCallback(async (rutinaId, section, data) => {
    if (!rutinaId || !section || !data) {
      console.error('[RutinasContext] Datos incompletos para marcar ítem');
      return;
    }

    const rutinaBefore = rutinas.find((r) => r._id === rutinaId)
      || (rutina?._id === rutinaId ? rutina : null);
    
    try {
      // Actualizar en el servidor
      const response = await rutinasService.markComplete(rutinaId, section, data);

      // Importante: el backend puede actualizar MÁS cosas que el checkmark (ej. contadores de progreso en config).
      // Si solo parcheamos `{ [itemId]: boolean }`, la lógica de visibilidad (cadencia) puede quedar desincronizada
      // hasta el próximo fetch. Por eso, integramos `response` en rutina + lista y recalculamos historial.
      if (response && typeof response === 'object') {
        setRutinas(prevList => {
          if (!Array.isArray(prevList)) return prevList;
          const updated = prevList.map(r => (r && r._id === rutinaId ? { ...r, ...response } : r));
          const { rutinasWithHist } = attachHistorial(updated);
          return rutinasWithHist;
        });

        setRutina(prev => {
          if (!prev || prev._id !== rutinaId) return prev;
          // Mantener paginación si existía
          const next = { ...prev, ...response };
          if (prev._page !== undefined) next._page = prev._page;
          if (prev._totalPages !== undefined) next._totalPages = prev._totalPages;
          // Mantener historial existente si no vino en response (attachHistorial lo recalcula en la lista)
          if (!next.historial && prev.historial) next.historial = prev.historial;
          return next;
        });
      } else {
        // Fallback: al menos reflejar el cambio de checkmarks localmente
        patchRutinaSection(rutinaId, section, data);
      }
      
      // Actualizar completitud localmente
      const index = rutinas.findIndex(r => r._id === rutinaId);
      if (index !== -1) {
        const rutinaActual = rutinas[index];
        const porcentaje = calculateCompletionPercentage(rutinaActual);
        const completitudDecimal = porcentaje / 100;
        
        setRutinas(prev => {
          const nuevasRutinas = [...prev];
          nuevasRutinas[index] = {
            ...nuevasRutinas[index],
            completitud: completitudDecimal
          };
          const { rutinasWithHist } = attachHistorial(nuevasRutinas);
          return rutinasWithHist;
        });
        
        if (rutina && rutina._id === rutinaId) {
          setRutina(prev => ({
            ...prev,
            completitud: completitudDecimal
          }));
        }
      }
      
      if (undoScope && SCOPES_WITH_SECTION_UNDO.has(undoScope)) {
        Object.entries(data).forEach(([itemId, newValue]) => {
          const previousValue = rutinaBefore?.[section]?.[itemId];
          recordRutinaSectionAction(undoRecorder, {
            rutinaId,
            section,
            itemId,
            newValue,
            previousValue,
          });
        });
      }

      return response;
    } catch (error) {
      console.error('[RutinasContext] Error al marcar ítem:', error);
      enqueueSnackbar('Error al marcar ítem', { variant: 'error' });
      throw error;
    }
  }, [rutinas, rutina, enqueueSnackbar, patchRutinaSection, undoScope, undoRecorder]);

  // Parche local de config para un ítem (refresca SOLO lo necesario sin recargar toda la página)
  const patchRutinaItemConfig = useCallback((rutinaId, section, itemId, nextConfig) => {
    if (!rutinaId || !section || !itemId || !nextConfig) {
      return;
    }

    // 1) Rutina seleccionada - CRÍTICO: Crear nuevo objeto para forzar re-render
    setRutina(prev => {
      if (!prev || prev._id !== rutinaId) {
        return prev;
      }
      const prevConfig = prev.config || {};
      const prevSection = prevConfig[section] || {};
      const updated = {
        ...prev,
        config: {
          ...prevConfig,
          [section]: {
            ...prevSection,
            [itemId]: {
              ...(prevSection[itemId] || {}),
              ...nextConfig
            }
          }
        }
      };
      return updated;
    });

    // 2) Lista de rutinas (para que navegación muestre el cambio sin fetch)
    setRutinas(prevList => {
      if (!Array.isArray(prevList) || prevList.length === 0) return prevList;
      return prevList.map(r => {
        if (!r || r._id !== rutinaId) return r;
        const rConfig = r.config || {};
        const rSection = rConfig[section] || {};
        return {
          ...r,
          config: {
            ...rConfig,
            [section]: {
              ...rSection,
              [itemId]: {
                ...(rSection[itemId] || {}),
                ...nextConfig
              }
            }
          }
        };
      });
    });
  }, []);

  // Actualizar preferencia de hábito del usuario (preferencias globales + rutina actual)
  // IMPORTANTE: Esta función debe definirse ANTES de updateItemConfiguration porque updateItemConfiguration la usa
  const updateUserHabitPreference = useCallback(async (
    section,
    itemId,
    config,
    applyToCurrentRutina = true,
    applyFromDate = null,
  ) => {
    const applyFrom = applyFromDate || formatDateForAPI(getNormalizedToday());
    try {
      const normalizedConfig = {
        tipo: (config.tipo || 'DIARIO').toUpperCase(),
        frecuencia: Number(config.frecuencia || 1),
        activo: config.activo !== undefined ? Boolean(config.activo) : true,
        periodo: config.periodo || 'CADA_DIA',
        diasSemana: Array.isArray(config.diasSemana) ? [...config.diasSemana] : [],
        diasMes: Array.isArray(config.diasMes) ? [...config.diasMes] : [],
        horarios: normalizeTimeOfDay(config.horarios),
        esPreferenciaUsuario: true,
        ultimaActualizacion: new Date().toISOString()
      };

      await clienteAxios.put('/api/users/preferences/habits', {
        habits: {
          [section]: {
            [itemId]: normalizedConfig
          }
        },
        applyFrom,
      }, { params: { applyFrom } });

      invalidateHabitsPreferencesCache();

      if (applyToCurrentRutina && rutina?._id) {
        patchRutinaItemConfig(rutina._id, section, itemId, normalizedConfig);
      }

      return { updated: true, config: normalizedConfig };
    } catch (error) {
      console.error('[RutinasContext] Error al actualizar preferencia de hábito:', error);
      enqueueSnackbar('Error al actualizar preferencia', { variant: 'error' });
      return { updated: false, error: error.message };
    }
  }, [rutina, enqueueSnackbar, patchRutinaItemConfig]);

  // Actualizar configuración de ítems
  const updateItemConfiguration = useCallback(async (section, itemId, config, options = {}) => {
    const { isGlobal = autoUpdateHabitPreferences, rutinaId = null, applyFromDate = null } = options;
    
    if (!section || !itemId || !config) {
      handleError(new Error('Datos incompletos para actualizar configuración'), 'updateItemConfiguration', 'Datos incompletos');
      return { updated: false, error: "Datos incompletos" };
    }

    const targetRutinaId = rutinaId || rutina?._id;
    if (!targetRutinaId) {
      handleError(new Error('No hay rutina para actualizar'), 'updateItemConfiguration', 'No hay rutina actual');
      return { updated: false, error: "No hay rutina actual" };
    }

    const targetRutinaRecord = rutinas.find((r) => r._id === targetRutinaId)
      || (rutina?._id === targetRutinaId ? rutina : null);
    const effectiveApplyFrom = applyFromDate || resolveHabitConfigApplyFrom(targetRutinaRecord?.fecha || rutina?.fecha);

    try {
      const originalConfig = rutina?.config?.[section]?.[itemId]
        ? { ...rutina.config[section][itemId] }
        : null;

      // Normalizar configuración - incluir todos los campos necesarios
      const normalizedConfig = {
        tipo: (config.tipo || 'DIARIO').toUpperCase(),
        frecuencia: Number(config.frecuencia || 1),
        activo: config.activo !== undefined ? Boolean(config.activo) : true,
        periodo: config.periodo || 'CADA_DIA',
        diasSemana: Array.isArray(config.diasSemana) ? [...config.diasSemana] : [],
        diasMes: Array.isArray(config.diasMes) ? [...config.diasMes] : [],
        horarios: normalizeTimeOfDay(config.horarios),
        esPreferenciaUsuario: config.esPreferenciaUsuario !== undefined ? Boolean(config.esPreferenciaUsuario) : true,
        ultimaActualizacion: new Date().toISOString()
      };

      // Actualizar preferencias globales si es necesario
      // NOTA: updateUserHabitPreference ya actualiza la rutina actual, así que no necesitamos hacerlo dos veces
      // Pero aquí solo actualizamos preferencias, la rutina se actualiza después
      if (isGlobal) {
        try {
          const prefResult = await updateUserHabitPreference(
            section,
            itemId,
            normalizedConfig,
            true,
            effectiveApplyFrom,
          );
          if (!prefResult || !prefResult.updated) {
            console.warn(`[RutinasContext] updateUserHabitPreference no completó correctamente para ${section}.${itemId}`);
          }
        } catch (prefError) {
          console.error(`[RutinasContext] Error al actualizar preferencia global:`, prefError);
        }
      }

      const currentSectionConfig = (rutina?.config?.[section]) || {};
      const mergedSectionConfig = {
        ...currentSectionConfig,
        [itemId]: normalizedConfig,
      };

      const updateData = {
        _id: targetRutinaId,
        config: {
          [section]: mergedSectionConfig,
        },
      };

      await clienteAxios.put(`/api/rutinas/${targetRutinaId}`, updateData);
      patchRutinaItemConfig(targetRutinaId, section, itemId, normalizedConfig);

      if (undoScope === 'rutinas') {
        recordRutinaConfigAction(undoRecorder, {
          rutinaId: targetRutinaId,
          section,
          itemId,
          newConfig: normalizedConfig,
          originalConfig,
          isGlobal,
        });
      }
      
      enqueueSnackbar(
        effectiveApplyFrom === formatDateForAPI(getNormalizedToday())
          ? 'Configuración guardada'
          : `Configuración aplicada desde ${effectiveApplyFrom}`,
        { variant: 'success' },
      );
      return { updated: true, config: normalizedConfig, applyFrom: effectiveApplyFrom };
        
    } catch (error) {
      handleError(error, 'updateItemConfiguration', 'Error inesperado al actualizar configuración');
      return { updated: false, error: error.message };
    }
  }, [rutina, rutinas, enqueueSnackbar, handleError, autoUpdateHabitPreferences, patchRutinaItemConfig, updateUserHabitPreference, undoScope, undoRecorder]);

  // Eliminar una rutina
  const deleteRutina = useCallback(async (rutinaId) => {
    if (!rutinaId) {
      console.warn('[RutinasContext] ID de rutina no proporcionado para eliminar');
      return false;
    }
    try {
      setLoading(true);
      const rutinaToDelete = rutinas.find((r) => r._id === rutinaId) || rutina;
      await rutinasService.deleteRutina(rutinaId);
      setRutinas(prevRutinas => {
        const newRutinas = prevRutinas.filter(r => r._id !== rutinaId);
        const { rutinasWithHist } = attachHistorial(newRutinas);
        if (rutina && rutina._id === rutinaId) {
          if (rutinasWithHist.length > 0) {
            setRutina({
              ...rutinasWithHist[0],
              _page: 1,
              _totalPages: rutinasWithHist.length
            });
            setCurrentPage(1);
          } else {
            setRutina(null);
            setCurrentPage(1);
          }
        }
        setTotalPages(rutinasWithHist.length);
        return rutinasWithHist;
      });
      if (undoScope === 'rutinas' && rutinaToDelete) {
        recordRutinaCrudAction(undoRecorder, ACTION_TYPES.DELETE, null, rutinaToDelete);
      }
      enqueueSnackbar('Rutina eliminada correctamente', { variant: 'success' });
      return true;
    } catch (error) {
      console.error(`[RutinasContext] Error al eliminar rutina:`, error);
      enqueueSnackbar(`Error al eliminar rutina: ${error.message}`, { variant: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  }, [rutina, rutinas, enqueueSnackbar, undoScope, undoRecorder]);

  // Sincronizar rutina con configuración global
  const syncRutinaWithGlobal = useCallback(async (rutinaId) => {
    if (!rutinaId || rutinaId === 'new') {
      console.warn('[RutinasContext] No se puede sincronizar una rutina sin ID');
      return Promise.reject(new Error('ID de rutina inválido'));
    }
    
    try {
      setLoading(true);
      const resultado = await rutinasService.syncRutinaWithGlobal(rutinaId);
      
      if (resultado.updated) {
        enqueueSnackbar('Rutina sincronizada correctamente con configuración global', { variant: 'success' });
        if (rutina && rutina._id === rutinaId) {
          getRutinaById(rutinaId);
        }
      } else {
        enqueueSnackbar('No fue necesario sincronizar la rutina', { variant: 'info' });
      }
      
      return resultado;
    } catch (error) {
      console.error(`[RutinasContext] Error sincronizando rutina:`, error);
      enqueueSnackbar(`Error: ${error.message}`, { variant: 'error' });
      return { updated: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, rutina, getRutinaById]);

  // La rutina inicial ya se establece en fetchRutinas; evitamos re-ejecuciones aquí para no duplicar llamadas
  // y reducir renders redundantes en desarrollo con React.StrictMode

  // Valores a exponer en el contexto
  const contextValue = useMemo(() => ({
    rutina,
    rutinas,
    loading,
    error,
    currentPage,
    totalPages,
    viewDate,
    setViewDate,
    previewRutinaDate,
    setRutina,
    fetchRutinas,
    getRutinaById,
    markItemComplete,
    handlePrevious,
    handleNext,
    updateItemConfiguration,
    patchRutinaItemConfig,
    patchRutinaSection,
    deleteRutina,
    syncRutinaWithGlobal,
    updateUserHabitPreference
  }), [
    rutina,
    rutinas,
    loading,
    error,
    currentPage,
    totalPages,
    viewDate,
    previewRutinaDate,
    setRutina,
    fetchRutinas,
    getRutinaById,
    markItemComplete,
    handlePrevious,
    handleNext,
    updateItemConfiguration,
    patchRutinaItemConfig,
    patchRutinaSection,
    deleteRutina,
    syncRutinaWithGlobal,
    updateUserHabitPreference
  ]);

  return (
    <RutinasContext.Provider value={contextValue}>
      {children}
    </RutinasContext.Provider>
  );
};

export default RutinasContext;
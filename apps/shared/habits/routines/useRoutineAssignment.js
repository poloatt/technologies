import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { updateHabitChainsOnApi } from '../../hooks/useHabitsPreferences.js';
import {
  EMPTY_ROUTINE_ASSIGNMENT,
  applyChainFormSave,
  buildChainFormState,
  validateRoutineAssignment,
} from './routineAssignmentUtils.js';

/**
 * Hook de gestión de rutinas: estado de asignación/apilamiento, dirty y persistencia.
 */
export default function useRoutineAssignment({
  habitChains = [],
  prefsReady = false,
  section = '',
  habitId = null,
  active = true,
  mode = 'edit',
} = {}) {
  const [config, setConfig] = useState(EMPTY_ROUTINE_ASSIGNMENT);
  const syncKeyRef = useRef('');
  const savedBaselineRef = useRef(EMPTY_ROUTINE_ASSIGNMENT);

  const savedConfig = useMemo(() => {
    if (mode === 'create' || !active || !prefsReady || !habitId || !section) {
      return EMPTY_ROUTINE_ASSIGNMENT;
    }
    return buildChainFormState(habitChains, section, habitId);
  }, [mode, active, prefsReady, habitId, section, habitChains]);

  const syncKey = `${active}:${mode}:${habitId || ''}:${section}`;

  useEffect(() => {
    if (!active || !prefsReady) {
      syncKeyRef.current = '';
      savedBaselineRef.current = EMPTY_ROUTINE_ASSIGNMENT;
      setConfig(EMPTY_ROUTINE_ASSIGNMENT);
      return;
    }

    const isNewTarget = syncKey !== syncKeyRef.current;

    if (mode === 'create' || !habitId) {
      syncKeyRef.current = syncKey;
      savedBaselineRef.current = EMPTY_ROUTINE_ASSIGNMENT;
      setConfig(EMPTY_ROUTINE_ASSIGNMENT);
      return;
    }

    if (isNewTarget) {
      syncKeyRef.current = syncKey;
      savedBaselineRef.current = savedConfig;
      setConfig(savedConfig);
      return;
    }

    setConfig((current) => {
      const isDirty = JSON.stringify(current) !== JSON.stringify(savedBaselineRef.current);
      if (isDirty) return current;
      savedBaselineRef.current = savedConfig;
      return savedConfig;
    });
  }, [active, prefsReady, mode, habitId, syncKey, savedConfig]);

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(savedConfig),
    [config, savedConfig],
  );

  const validate = useCallback(
    () => validateRoutineAssignment(config),
    [config],
  );

  const reset = useCallback(() => {
    savedBaselineRef.current = savedConfig;
    setConfig(savedConfig);
  }, [savedConfig]);

  const persist = useCallback(async (targetSection, targetHabitId) => {
    if (!prefsReady || !targetSection || !targetHabitId) return;
    const nextChains = applyChainFormSave(habitChains, targetSection, targetHabitId, config);
    await updateHabitChainsOnApi(nextChains);
  }, [habitChains, config, prefsReady]);

  return {
    config,
    setConfig,
    savedConfig,
    isDirty,
    validate,
    reset,
    persist,
  };
}

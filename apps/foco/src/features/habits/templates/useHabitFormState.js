import { useState, useCallback } from 'react';
import { DEFAULT_HABIT_ICON } from '@shared/utils/habitIcons';
import { normalizeTimeOfDay } from '@shared/utils/timeOfDayUtils';
import { DEFAULT_HABIT_CONFIG } from '@shared/habits/form';

export function useHabitFormState() {
  const [habitSection, setHabitSection] = useState('bodyCare');
  const [habitIcon, setHabitIcon] = useState(DEFAULT_HABIT_ICON);
  const [habitConfig, setHabitConfig] = useState(DEFAULT_HABIT_CONFIG);

  const handleConfigChange = useCallback((newConfig) => {
    setHabitConfig((prev) => ({
      ...prev,
      ...newConfig,
      horarios: normalizeTimeOfDay(
        newConfig.horarios !== undefined ? newConfig.horarios : prev.horarios,
      ),
    }));
  }, []);

  const handleIconChange = useCallback((name, clearError) => {
    setHabitIcon(name);
    if (clearError) clearError('icon');
  }, []);

  const validateHabitForm = useCallback((titulo, errors, setErrors) => {
    const next = { ...errors };
    if (!titulo?.trim()) next.titulo = 'El nombre es requerido';
    if (!habitIcon) next.icon = 'Selecciona un icono';
    setErrors(next);
    return !next.titulo && !next.icon;
  }, [habitIcon]);

  const resetHabitForm = useCallback(() => {
    setHabitSection('bodyCare');
    setHabitIcon(DEFAULT_HABIT_ICON);
    setHabitConfig(DEFAULT_HABIT_CONFIG);
  }, []);

  return {
    habitSection,
    setHabitSection,
    habitIcon,
    setHabitIcon,
    habitConfig,
    setHabitConfig,
    handleConfigChange,
    handleIconChange,
    validateHabitForm,
    resetHabitForm,
    DEFAULT_HABIT_ICON,
  };
}

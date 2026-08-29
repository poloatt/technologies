import {
  NEW_HABIT_CHAIN_VALUE,
  normalizeHabitStep,
  stepsEqual,
  buildChainFormState,
  applyChainFormSave,
  buildChainSelectOptions,
} from '../domain/habitChainUtils.js';

export {
  NEW_HABIT_CHAIN_VALUE,
  buildChainFormState,
  applyChainFormSave,
  buildChainSelectOptions,
};

/** Estado vacío de asignación de rutina (sin apilamiento). */
export const EMPTY_ROUTINE_ASSIGNMENT = {
  enabled: false,
  linkedSteps: [],
  chainId: null,
  label: '',
};

export function resolveRoutineSelectValue(config = EMPTY_ROUTINE_ASSIGNMENT) {
  if (!config.enabled) return '';
  if (config.chainId === NEW_HABIT_CHAIN_VALUE) return NEW_HABIT_CHAIN_VALUE;
  if (config.chainId) return config.chainId;
  return NEW_HABIT_CHAIN_VALUE;
}

export function createNewRoutineAssignment() {
  return {
    enabled: true,
    linkedSteps: [],
    chainId: NEW_HABIT_CHAIN_VALUE,
    label: '',
  };
}

/**
 * Aplica selección del dropdown de rutina (sin rutina / existente / nueva).
 */
export function applyRoutineSelectChange(value, {
  habitChains = [],
  currentSection = '',
  currentHabitId = null,
  currentConfig = EMPTY_ROUTINE_ASSIGNMENT,
} = {}) {
  if (!value) {
    return { ...EMPTY_ROUTINE_ASSIGNMENT };
  }

  if (value === NEW_HABIT_CHAIN_VALUE) {
    return {
      enabled: true,
      linkedSteps: currentConfig.linkedSteps || [],
      chainId: NEW_HABIT_CHAIN_VALUE,
      label: currentConfig.label || '',
    };
  }

  const chain = (habitChains || []).find((entry) => entry.id === value);
  if (!chain) return currentConfig;

  const linkedSteps = (chain.steps || [])
    .map(normalizeHabitStep)
    .filter(Boolean)
    .filter((step) => !stepsEqual(step, { section: currentSection, habitId: currentHabitId }));

  return {
    enabled: true,
    linkedSteps,
    chainId: value,
    label: chain.label || '',
  };
}

export function validateRoutineAssignment(config = EMPTY_ROUTINE_ASSIGNMENT) {
  if (!config.enabled) return null;
  if (config.chainId === NEW_HABIT_CHAIN_VALUE && (config.label || '').trim()) {
    return null;
  }
  if (!(config.linkedSteps?.length)) {
    return 'Selecciona al menos un hábito para apilar';
  }
  return null;
}

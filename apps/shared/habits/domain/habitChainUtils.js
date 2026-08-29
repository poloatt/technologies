import { getHabitId, findUserHabit, getHabitSectionKeys } from './habitSectionIds.js';
import { getHabitDisplayLabel } from './habitDisplayLabels.js';
import { isHabitCompletedForHistorial } from './habitCompletionUtils.js';

export const HABIT_CHAIN_TYPES = ['stack', 'dependency'];

export const NEW_HABIT_CHAIN_VALUE = '__new__';

/** @typedef {{ section: string, habitId: string }} HabitChainStep */
/** @typedef {{ id: string, label?: string, type: 'stack'|'dependency', steps: HabitChainStep[] }} HabitChain */

export function normalizeHabitStep(step) {
  if (!step?.section || !step?.habitId) return null;
  return { section: String(step.section), habitId: String(step.habitId) };
}

export function stepsEqual(a, b) {
  return a?.section === b?.section && a?.habitId === b?.habitId;
}

export function generateChainId() {
  return `chain_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function findChainForHabit(chains = [], section, habitId) {
  if (!Array.isArray(chains)) return null;
  const target = { section, habitId };
  return chains.find((chain) => Array.isArray(chain?.steps)
    && chain.steps.some((step) => stepsEqual(normalizeHabitStep(step), target))) || null;
}

export function getChainStepIndex(chain, section, habitId) {
  if (!chain?.steps) return -1;
  return chain.steps.findIndex((step) => stepsEqual(normalizeHabitStep(step), { section, habitId }));
}

export function getPreviousStep(chain, stepIndex) {
  if (!chain?.steps || stepIndex <= 0) return null;
  return normalizeHabitStep(chain.steps[stepIndex - 1]);
}

export function getNextStep(chain, stepIndex) {
  if (!chain?.steps || stepIndex < 0 || stepIndex >= chain.steps.length - 1) return null;
  return normalizeHabitStep(chain.steps[stepIndex + 1]);
}

export function getHabitStepValue(rutina, section, habitId, localDataBySection = null) {
  if (!rutina || !section || !habitId) return undefined;
  const local = localDataBySection?.[section]?.[habitId];
  if (local !== undefined) return local;
  return rutina?.[section]?.[habitId];
}

export function isStepCompletedToday(rutina, section, habitId, localDataBySection = null) {
  const value = getHabitStepValue(rutina, section, habitId, localDataBySection);
  return isHabitCompletedForHistorial(value);
}

export function isChainStepLocked(chain, stepIndex, rutina, localDataBySection = null) {
  if (!chain || chain.type !== 'dependency') return false;
  if (stepIndex <= 0) return false;
  const prev = getPreviousStep(chain, stepIndex);
  if (!prev) return false;
  return !isStepCompletedToday(rutina, prev.section, prev.habitId, localDataBySection);
}

function resolveFirstPendingStepIndex(chain, rutina, localDataBySection = null) {
  if (!chain?.steps?.length) return -1;
  for (let i = 0; i < chain.steps.length; i += 1) {
    const step = normalizeHabitStep(chain.steps[i]);
    if (!step) continue;
    if (!isStepCompletedToday(rutina, step.section, step.habitId, localDataBySection)) {
      return i;
    }
  }
  return -1;
}

export function resolveHabitChainContext(
  chains = [],
  section,
  habitId,
  rutina,
  localDataBySection = null,
) {
  const chain = findChainForHabit(chains, section, habitId);
  if (!chain) return null;

  const stepIndex = getChainStepIndex(chain, section, habitId);
  if (stepIndex < 0) return null;

  const firstPendingIndex = resolveFirstPendingStepIndex(chain, rutina, localDataBySection);

  return {
    id: chain.id,
    label: chain.label || '',
    type: chain.type || 'stack',
    stepIndex,
    stepCount: chain.steps.length,
    isLocked: isChainStepLocked(chain, stepIndex, rutina, localDataBySection),
    isNextInChain: firstPendingIndex === stepIndex,
    prevStep: getPreviousStep(chain, stepIndex),
    nextStep: getNextStep(chain, stepIndex),
  };
}

export function enrichEntryWithChainContext(entry, chains, rutina, localDataBySection = null) {
  if (!entry?.section || !entry?.itemId) return entry;
  const chain = resolveHabitChainContext(
    chains,
    entry.section,
    entry.itemId,
    rutina,
    localDataBySection,
  );
  if (!chain) return entry;
  return { ...entry, chain };
}

/**
 * Agrupa entradas visibles para render: hábitos apilados (stack) comparten fila.
 * @returns {Array<{ kind: 'single', entry: object } | { kind: 'stack', chainId: string, entries: object[] }>}
 */
/**
 * Enriquece hábitos del listado del Habits Manager con contexto de cadena (sin rutina).
 */
export function buildManagerHabitListItems(habits = [], section, habitChains = []) {
  return habits.map((habit) => {
    const chain = findChainForHabit(habitChains, section, habit.id);
    let chainContext = null;
    if (chain?.type === 'stack') {
      const stepIndex = getChainStepIndex(chain, section, habit.id);
      if (stepIndex >= 0) {
        chainContext = {
          id: chain.id,
          label: chain.label || '',
          type: 'stack',
          stepIndex,
          stepCount: chain.steps.length,
        };
      }
    }
    return {
      itemId: habit.id,
      section,
      habit,
      chain: chainContext,
    };
  });
}

/** Agrupa hábitos del Habits Manager en filas simples o apiladas (stack). */
export function groupHabitsIntoDisplayRows(habits = [], section, habitChains = []) {
  return groupEntriesIntoDisplayRows(buildManagerHabitListItems(habits, section, habitChains));
}

export function groupEntriesIntoDisplayRows(items = []) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const stackGroups = new Map();

  items.forEach((entry, index) => {
    const chain = entry?.chain;
    if (chain?.type === 'stack' && chain.id && chain.stepCount > 1) {
      if (!stackGroups.has(chain.id)) {
        stackGroups.set(chain.id, { entries: [], firstIndex: index });
      }
      const group = stackGroups.get(chain.id);
      group.entries.push(entry);
      group.firstIndex = Math.min(group.firstIndex, index);
    }
  });

  stackGroups.forEach((group) => {
    group.entries.sort((a, b) => (a.chain?.stepIndex ?? 0) - (b.chain?.stepIndex ?? 0));
  });

  const renderedStacks = new Set();
  const rows = [];

  items.forEach((entry, index) => {
    const chain = entry?.chain;
    if (chain?.type === 'stack' && chain.id && chain.stepCount > 1) {
      if (renderedStacks.has(chain.id)) return;
      const group = stackGroups.get(chain.id);
      if (!group || group.firstIndex !== index) return;
      renderedStacks.add(chain.id);
      if (group.entries.length <= 1) {
        rows.push({ kind: 'single', entry: group.entries[0] });
      } else {
        rows.push({ kind: 'stack', chainId: chain.id, entries: group.entries });
      }
      return;
    }
    rows.push({ kind: 'single', entry });
  });

  return rows;
}

export function removeHabitFromChains(chains = [], section, habitId) {
  const next = [];
  (chains || []).forEach((chain) => {
    const steps = (chain.steps || [])
      .map(normalizeHabitStep)
      .filter(Boolean)
      .filter((step) => !stepsEqual(step, { section, habitId }));
    if (steps.length >= 2) {
      next.push({ ...chain, steps });
    } else if (steps.length === 1) {
      // Cadena de un solo paso → disolver
    }
  });
  return next;
}

/**
 * Aplica configuración del formulario de encadenamiento al guardar un hábito.
 * @param {object} formChain — { enabled, linkedSteps: [{ section, habitId }] }
 */
export function applyChainFormSave(chains = [], section, habitId, formChain = {}) {
  let next = removeHabitFromChains(chains, section, habitId);

  const linkedSteps = (formChain.linkedSteps || [])
    .map(normalizeHabitStep)
    .filter(Boolean);

  if (!formChain.enabled || linkedSteps.length === 0) {
    return next;
  }

  const newStep = { section, habitId };

  linkedSteps.forEach((step) => {
    next = removeHabitFromChains(next, step.section, step.habitId);
  });

  const steps = [];
  const seen = new Set();
  [...linkedSteps, newStep].forEach((step) => {
    const key = `${step.section}:${step.habitId}`;
    if (seen.has(key)) return;
    seen.add(key);
    steps.push(step);
  });

  if (steps.length < 2) {
    return next;
  }

  const hostChain = findChainForHabit(chains, linkedSteps[0].section, linkedSteps[0].habitId);
  const preferredId = formChain.chainId && formChain.chainId !== NEW_HABIT_CHAIN_VALUE
    ? formChain.chainId
    : null;

  next.push({
    id: preferredId || hostChain?.id || generateChainId(),
    label: (formChain.label ?? hostChain?.label ?? '').trim(),
    type: 'stack',
    steps,
  });

  return next.filter((chain) => Array.isArray(chain.steps) && chain.steps.length >= 2);
}

export function buildChainFormState(chains = [], section, habitId) {
  const chain = findChainForHabit(chains, section, habitId);
  if (!chain) {
    return {
      enabled: false,
      linkedSteps: [],
      chainId: null,
      label: '',
    };
  }

  const linkedSteps = (chain.steps || [])
    .map(normalizeHabitStep)
    .filter(Boolean)
    .filter((step) => !stepsEqual(step, { section, habitId }));

  return {
    enabled: true,
    linkedSteps,
    chainId: chain.id,
    label: chain.label || '',
  };
}

export function listAllUserHabits(habits = {}) {
  const items = [];
  getHabitSectionKeys(habits).forEach((section) => {
    (habits[section] || []).forEach((habit) => {
      const habitId = getHabitId(habit);
      if (!habitId || habit.activo === false) return;
      items.push({
        section,
        habitId,
        label: getHabitDisplayLabel(section, habitId, habits),
        habit,
      });
    });
  });
  return items;
}

export function getChainDisplayLabel(chain, habits = {}) {
  if (chain?.label?.trim()) return chain.label.trim();
  const first = normalizeHabitStep(chain?.steps?.[0]);
  if (!first) return 'Rutina encadenada';
  const count = chain.steps?.length || 0;
  const firstLabel = getHabitDisplayLabel(first.section, first.habitId, habits);
  return count > 1 ? `${firstLabel} + ${count - 1} pasos` : firstLabel;
}

export function buildChainSelectOptions(habitChains = [], habits = {}) {
  return (habitChains || [])
    .filter((chain) => chain?.type === 'stack' && Array.isArray(chain.steps) && chain.steps.length >= 2)
    .map((chain) => ({
      value: chain.id,
      label: getChainDisplayLabel(chain, habits),
    }));
}

export function updateHabitChainLabel(chains = [], chainId, label) {
  const trimmed = (label || '').trim();
  if (!chainId || !trimmed) return chains;
  return (chains || []).map((chain) => (
    chain.id === chainId ? { ...chain, label: trimmed } : chain
  ));
}

export function validateHabitChains(chains = [], habits = {}) {
  const errors = [];
  if (!Array.isArray(chains)) {
    return ['habitChains debe ser un array'];
  }

  const seenHabits = new Set();

  chains.forEach((chain, chainIndex) => {
    if (!chain?.id) {
      errors.push(`Cadena ${chainIndex}: falta id`);
    }
    if (!HABIT_CHAIN_TYPES.includes(chain?.type)) {
      errors.push(`Cadena ${chain?.id || chainIndex}: type inválido`);
    }
    if (!Array.isArray(chain?.steps) || chain.steps.length < 2) {
      errors.push(`Cadena ${chain?.id || chainIndex}: requiere al menos 2 pasos`);
      return;
    }

    chain.steps.forEach((step, stepIndex) => {
      const norm = normalizeHabitStep(step);
      if (!norm) {
        errors.push(`Cadena ${chain.id}: paso ${stepIndex} inválido`);
        return;
      }
      const key = `${norm.section}:${norm.habitId}`;
      if (seenHabits.has(key)) {
        errors.push(`Hábito ${key} está en más de una cadena`);
      }
      seenHabits.add(key);

      const userHabit = findUserHabit(norm.section, norm.habitId, habits);
      if (!userHabit || userHabit.activo === false) {
        errors.push(`Cadena ${chain.id}: hábito ${key} no existe o está inactivo`);
      }
    });
  });

  return errors;
}

export function resolveNextActionableStep(chain, rutina, localDataBySection = null) {
  if (!chain?.steps?.length) return null;
  const pendingIndex = resolveFirstPendingStepIndex(chain, rutina, localDataBySection);
  if (pendingIndex < 0) return null;
  const step = normalizeHabitStep(chain.steps[pendingIndex]);
  if (!step) return null;
  if (isChainStepLocked(chain, pendingIndex, rutina, localDataBySection)) {
    return null;
  }
  return step;
}

export function shouldBlockChainToggle(chainContext) {
  return Boolean(chainContext?.isLocked);
}

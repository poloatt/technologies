import { getHabitId, findUserHabit, getHabitSectionKeys } from './habitSectionIds.js';
import { getHabitDisplayLabel } from './habitDisplayLabels.js';

export const NEW_HABIT_CHAIN_VALUE = '__new__';

export const ROUTINE_CHIP_LABEL = 'Rutina';

/** @typedef {{ section: string, habitId: string }} HabitChainStep */
/** @typedef {{ id: string, label?: string, type?: string, steps: HabitChainStep[] }} HabitChain */

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

export function isGroupedRoutineChain(chain) {
  if (!chain?.id || !Array.isArray(chain.steps)) return false;
  if (chain.steps.length >= 2) return true;
  return Boolean((chain.label || '').trim());
}

/** True when entry.chain (from resolveHabitChainContext) is a grouped routine. */
export function isEntryGroupedRoutineChain(chain) {
  if (!chain?.id) return false;
  if (chain.stepCount > 1) return true;
  return Boolean((chain.label || '').trim());
}

/** Nombre visible de la rutina (etiqueta del usuario o fallback). */
export function resolveRoutineDisplayName(chain) {
  const trimmed = (chain?.label || '').trim();
  if (trimmed) return trimmed;
  return ROUTINE_CHIP_LABEL;
}

/** @deprecated alias — usar resolveRoutineDisplayName */
export function resolveStackRoutineLabel(chain) {
  return resolveRoutineDisplayName(chain);
}

export function resolveHabitChainContext(
  chains = [],
  section,
  habitId,
) {
  if (!Array.isArray(chains)) return null;
  const target = { section, habitId };
  const chainIndex = chains.findIndex((chain) => Array.isArray(chain?.steps)
    && chain.steps.some((step) => stepsEqual(normalizeHabitStep(step), target)));
  if (chainIndex < 0) return null;

  const chain = chains[chainIndex];
  const stepIndex = getChainStepIndex(chain, section, habitId);
  if (stepIndex < 0) return null;

  return {
    id: chain.id,
    label: chain.label || '',
    stepIndex,
    stepCount: chain.steps.length,
    chainIndex,
  };
}

export function enrichEntryWithChainContext(entry, chains) {
  if (!entry?.section || !entry?.itemId) return entry;
  const chain = resolveHabitChainContext(chains, entry.section, entry.itemId);
  if (!chain) return entry;
  return { ...entry, chain };
}

/**
 * Enriquece hábitos del listado del Habits Manager con contexto de rutina.
 */
export function buildManagerHabitListItems(habits = [], section, habitChains = []) {
  return habits.map((habit) => {
    const chain = findChainForHabit(habitChains, section, habit.id);
    let chainContext = null;
    if (chain) {
      const stepIndex = getChainStepIndex(chain, section, habit.id);
      if (stepIndex >= 0) {
        chainContext = {
          id: chain.id,
          label: chain.label || '',
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

/** Agrupa hábitos del Habits Manager en filas simples o rutinas. */
export function groupHabitsIntoDisplayRows(habits = [], section, habitChains = []) {
  return groupEntriesIntoDisplayRows(buildManagerHabitListItems(habits, section, habitChains));
}

const FRANJA_ORDER = { MAÑANA: 0, TARDE: 1, NOCHE: 2 };

function compareStackEntries(a, b) {
  const stepDiff = (a.chain?.stepIndex ?? 0) - (b.chain?.stepIndex ?? 0);
  if (stepDiff !== 0) return stepDiff;
  const franjaA = FRANJA_ORDER[String(a.franjaKey || '').toUpperCase()] ?? 99;
  const franjaB = FRANJA_ORDER[String(b.franjaKey || '').toUpperCase()] ?? 99;
  return franjaA - franjaB;
}

/**
 * Agrupa entradas visibles: hábitos de la misma rutina comparten fila.
 * Orden interno estable por `chain.stepIndex` (y franja como desempate).
 * Mientras quede ≥1 hábito pendiente de una rutina multi-paso, se mantiene el
 * grupo (barra de título) para no saltar a fila simple al completar parcial.
 * Con `orderStacksByChain: true`, las rutinas van primero según el orden fijo de
 * `habitChains` (`chain.chainIndex`) y los hábitos sueltos debajo — nunca saltan
 * al marcar ítems.
 * @returns {Array<{ kind: 'single', entry: object } | { kind: 'stack', chainId: string, entries: object[] }>}
 */
export function groupEntriesIntoDisplayRows(items = [], options = {}) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const { orderStacksByChain = false } = options;

  const stackGroups = new Map();

  items.forEach((entry, index) => {
    const chain = entry?.chain;
    if (chain?.id && chain.stepCount > 1) {
      if (!stackGroups.has(chain.id)) {
        stackGroups.set(chain.id, {
          chainId: chain.id,
          entries: [],
          firstIndex: index,
          chainIndex: Number.isFinite(chain.chainIndex) ? chain.chainIndex : Number.MAX_SAFE_INTEGER,
        });
      }
      const group = stackGroups.get(chain.id);
      group.entries.push(entry);
      group.firstIndex = Math.min(group.firstIndex, index);
      if (Number.isFinite(chain.chainIndex)) {
        group.chainIndex = Math.min(group.chainIndex, chain.chainIndex);
      }
    }
  });

  stackGroups.forEach((group) => {
    group.entries.sort(compareStackEntries);
  });

  if (orderStacksByChain) {
    const stackRows = [...stackGroups.values()]
      .sort((a, b) => (a.chainIndex - b.chainIndex) || (a.firstIndex - b.firstIndex))
      .map((group) => ({ kind: 'stack', chainId: group.chainId, entries: group.entries }));

    const singleRows = items
      .filter((entry) => !(entry?.chain?.id && entry.chain.stepCount > 1))
      .map((entry) => ({ kind: 'single', entry }));

    return [...stackRows, ...singleRows];
  }

  const renderedStacks = new Set();
  const rows = [];

  items.forEach((entry, index) => {
    const chain = entry?.chain;
    if (chain?.id && chain.stepCount > 1) {
      if (renderedStacks.has(chain.id)) return;
      const group = stackGroups.get(chain.id);
      if (!group || group.firstIndex !== index) return;
      renderedStacks.add(chain.id);
      // Mantener chrome de rutina aunque quede un solo pendiente.
      rows.push({ kind: 'stack', chainId: chain.id, entries: group.entries });
      return;
    }
    rows.push({ kind: 'single', entry });
  });

  return rows;
}

export const RUTINA_STACK_SORTABLE_PREFIX = 'stack:';

export function getRutinaStackSortableId(chainId) {
  return `${RUTINA_STACK_SORTABLE_PREFIX}${chainId}`;
}

export function resolveDisplayRowSortableId(row) {
  if (row?.kind === 'stack') return getRutinaStackSortableId(row.chainId);
  return row?.entry?.itemId ?? null;
}

/** Reordena ítems planos moviendo filas simples o rutinas completas (drag id activo/soltado). */
export function reorderFlatEntriesByDisplayRowDnD(items = [], activeId, overId) {
  if (!activeId || !overId || activeId === overId) return null;

  const displayRows = groupEntriesIntoDisplayRows(items);
  const sortIds = displayRows.map(resolveDisplayRowSortableId);
  const oldIndex = sortIds.indexOf(activeId);
  const newIndex = sortIds.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0) return null;

  const reorderedRows = [...displayRows];
  const [moved] = reorderedRows.splice(oldIndex, 1);
  reorderedRows.splice(newIndex, 0, moved);

  return reorderedRows.flatMap((row) => {
    if (row.kind === 'stack') {
      return row.entries.map((entry) => entry.itemId);
    }
    return [row.entry.itemId];
  });
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
      // Rutina de un solo paso → disolver
    }
  });
  return next;
}

/**
 * Aplica configuración del formulario de rutina al guardar un hábito.
 * @param {object} formChain — { enabled, linkedSteps: [{ section, habitId }] }
 */
export function applyChainFormSave(chains = [], section, habitId, formChain = {}) {
  let next = removeHabitFromChains(chains, section, habitId);

  const linkedSteps = (formChain.linkedSteps || [])
    .map(normalizeHabitStep)
    .filter(Boolean);

  const isNewNamedRoutine = formChain.chainId === NEW_HABIT_CHAIN_VALUE
    && (formChain.label || '').trim();

  if (!formChain.enabled) {
    return next;
  }

  if (linkedSteps.length === 0 && !isNewNamedRoutine) {
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

  if (steps.length < 1) {
    return next;
  }

  if (steps.length < 2 && !isNewNamedRoutine) {
    return next;
  }

  const hostChain = linkedSteps.length > 0
    ? findChainForHabit(chains, linkedSteps[0].section, linkedSteps[0].habitId)
    : null;
  const preferredId = formChain.chainId && formChain.chainId !== NEW_HABIT_CHAIN_VALUE
    ? formChain.chainId
    : null;

  next.push({
    id: preferredId || hostChain?.id || generateChainId(),
    label: (formChain.label ?? hostChain?.label ?? '').trim(),
    steps,
  });

  return next.filter((chain) => {
    if (!Array.isArray(chain.steps) || chain.steps.length < 1) return false;
    if (chain.steps.length >= 2) return true;
    return Boolean((chain.label || '').trim());
  });
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
  if (!first) return ROUTINE_CHIP_LABEL;
  const count = chain.steps?.length || 0;
  const firstLabel = getHabitDisplayLabel(first.section, first.habitId, habits);
  return count > 1 ? `${firstLabel} + ${count - 1}` : firstLabel;
}

export function buildChainSelectOptions(habitChains = [], habits = {}) {
  return (habitChains || [])
    .filter((chain) => isGroupedRoutineChain(chain))
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
    if (!Array.isArray(chain?.steps) || chain.steps.length < 1) {
      errors.push(`Cadena ${chain?.id || chainIndex}: requiere al menos 1 paso`);
      return;
    }
    if (chain.steps.length < 2 && !(chain.label || '').trim()) {
      errors.push(`Cadena ${chain?.id || chainIndex}: requiere al menos 2 pasos o un nombre`);
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

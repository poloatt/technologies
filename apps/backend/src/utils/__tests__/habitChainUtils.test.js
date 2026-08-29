import {
  findChainForHabit,
  getChainStepIndex,
  getNextStep,
  getPreviousStep,
  isChainStepLocked,
  resolveHabitChainContext,
  applyChainFormSave,
  buildChainFormState,
  validateHabitChains,
  shouldBlockChainToggle,
  resolveNextActionableStep,
  groupEntriesIntoDisplayRows,
  groupHabitsIntoDisplayRows,
} from '@shared/habits';

const habits = {
  bodyCare: [
    { id: 'shower', label: 'Ducha', activo: true },
    { id: 'skincare', label: 'Skincare', activo: true },
  ],
  cleaning: [
    { id: 'platos', label: 'Platos', activo: true },
  ],
  nutricion: [
    { id: 'cocinar', label: 'Cocinar', activo: true },
  ],
};

const chains = [
  {
    id: 'morning',
    type: 'stack',
    label: 'Rutina mañana',
    steps: [
      { section: 'bodyCare', habitId: 'shower' },
      { section: 'bodyCare', habitId: 'skincare' },
    ],
  },
  {
    id: 'kitchen',
    type: 'dependency',
    steps: [
      { section: 'nutricion', habitId: 'cocinar' },
      { section: 'cleaning', habitId: 'platos' },
    ],
  },
];

const rutina = {
  fecha: '2026-08-28',
  bodyCare: { shower: true },
  nutricion: {},
  cleaning: {},
};

describe('habitChainUtils', () => {
  test('findChainForHabit returns chain containing habit', () => {
    expect(findChainForHabit(chains, 'bodyCare', 'skincare')?.id).toBe('morning');
    expect(findChainForHabit(chains, 'cleaning', 'missing')).toBeNull();
  });

  test('getChainStepIndex and neighbors', () => {
    const chain = chains[0];
    expect(getChainStepIndex(chain, 'bodyCare', 'skincare')).toBe(1);
    expect(getPreviousStep(chain, 1)).toEqual({ section: 'bodyCare', habitId: 'shower' });
    expect(getNextStep(chain, 0)).toEqual({ section: 'bodyCare', habitId: 'skincare' });
  });

  test('dependency lock when predecessor not completed today', () => {
    const chain = chains[1];
    expect(isChainStepLocked(chain, 0, rutina)).toBe(false);
    expect(isChainStepLocked(chain, 1, rutina)).toBe(true);
  });

  test('resolveHabitChainContext marks locked and next', () => {
    const ctx = resolveHabitChainContext(chains, 'cleaning', 'platos', rutina);
    expect(ctx.isLocked).toBe(true);
    expect(ctx.isNextInChain).toBe(false);

    const stackCtx = resolveHabitChainContext(chains, 'bodyCare', 'skincare', rutina);
    expect(stackCtx.isLocked).toBe(false);
    expect(stackCtx.isNextInChain).toBe(true);
  });

  test('shouldBlockChainToggle only when locked', () => {
    const locked = resolveHabitChainContext(chains, 'cleaning', 'platos', rutina);
    expect(shouldBlockChainToggle(locked)).toBe(true);
    expect(shouldBlockChainToggle(null)).toBe(false);
  });

  test('resolveNextActionableStep skips locked dependency tail', () => {
    const chain = chains[1];
    expect(resolveNextActionableStep(chain, rutina)).toEqual({
      section: 'nutricion',
      habitId: 'cocinar',
    });
  });

  test('applyChainFormSave builds stack from multi-select + current habit', () => {
    const next = applyChainFormSave(chains, 'bodyCare', 'tooth', {
      enabled: true,
      linkedSteps: [
        { section: 'bodyCare', habitId: 'shower' },
        { section: 'bodyCare', habitId: 'skincare' },
      ],
    });
    const morning = next.find((c) => c.id === 'morning') || next[0];
    expect(morning.type).toBe('stack');
    expect(morning.steps.map((s) => s.habitId)).toEqual(['shower', 'skincare', 'tooth']);
  });

  test('buildChainFormState returns linked steps when habit is in chain', () => {
    expect(buildChainFormState(chains, 'bodyCare', 'skincare')).toMatchObject({
      enabled: true,
      linkedSteps: [{ section: 'bodyCare', habitId: 'shower' }],
    });
  });

  test('validateHabitChains rejects duplicate habits across chains', () => {
    const invalid = [
      ...chains,
      {
        id: 'dup',
        type: 'stack',
        steps: [
          { section: 'bodyCare', habitId: 'shower' },
          { section: 'bodyCare', habitId: 'skincare' },
        ],
      },
    ];
    const errors = validateHabitChains(invalid, habits);
    expect(errors.some((e) => e.includes('más de una cadena'))).toBe(true);
  });

  test('groupEntriesIntoDisplayRows groups stack habits on one row', () => {
    const items = [
      { itemId: 'solo', section: 'bodyCare' },
      {
        itemId: 'shower',
        section: 'bodyCare',
        chain: { id: 'morning', type: 'stack', stepIndex: 0, stepCount: 2 },
      },
      { itemId: 'other', section: 'bodyCare' },
      {
        itemId: 'skincare',
        section: 'bodyCare',
        chain: { id: 'morning', type: 'stack', stepIndex: 1, stepCount: 2 },
      },
    ];

    const rows = groupEntriesIntoDisplayRows(items);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ kind: 'single', entry: items[0] });
    expect(rows[1].kind).toBe('stack');
    expect(rows[1].chainId).toBe('morning');
    expect(rows[1].entries.map((e) => e.itemId)).toEqual(['shower', 'skincare']);
    expect(rows[2]).toEqual({ kind: 'single', entry: items[2] });
  });

  test('groupHabitsIntoDisplayRows groups stack habits from manager list', () => {
    const sectionHabits = [
      { id: 'solo', label: 'Solo', activo: true },
      { id: 'shower', label: 'Ducha', activo: true },
      { id: 'other', label: 'Otro', activo: true },
      { id: 'skincare', label: 'Skincare', activo: true },
    ];

    const rows = groupHabitsIntoDisplayRows(sectionHabits, 'bodyCare', chains);
    expect(rows).toHaveLength(3);
    expect(rows[0].kind).toBe('single');
    expect(rows[0].entry.habit.id).toBe('solo');
    expect(rows[1].kind).toBe('stack');
    expect(rows[1].entries.map((e) => e.habit.id)).toEqual(['shower', 'skincare']);
    expect(rows[2].kind).toBe('single');
    expect(rows[2].entry.habit.id).toBe('other');
  });

  test('groupEntriesIntoDisplayRows keeps dependency habits separate', () => {
    const items = [
      {
        itemId: 'cocinar',
        section: 'nutricion',
        chain: { id: 'kitchen', type: 'dependency', stepIndex: 0, stepCount: 2 },
      },
      {
        itemId: 'platos',
        section: 'cleaning',
        chain: { id: 'kitchen', type: 'dependency', stepIndex: 1, stepCount: 2 },
      },
    ];

    const rows = groupEntriesIntoDisplayRows(items);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.kind === 'single')).toBe(true);
  });
});

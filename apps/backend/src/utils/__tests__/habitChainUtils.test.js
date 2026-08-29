import {
  findChainForHabit,
  getChainStepIndex,
  resolveHabitChainContext,
  applyChainFormSave,
  buildChainFormState,
  validateHabitChains,
  groupEntriesIntoDisplayRows,
  groupHabitsIntoDisplayRows,
  resolveRoutineDisplayName,
  isEntryGroupedRoutineChain,
  ROUTINE_CHIP_LABEL,
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
    label: 'Rutina mañana',
    steps: [
      { section: 'bodyCare', habitId: 'shower' },
      { section: 'bodyCare', habitId: 'skincare' },
    ],
  },
  {
    id: 'kitchen',
    steps: [
      { section: 'nutricion', habitId: 'cocinar' },
      { section: 'cleaning', habitId: 'platos' },
    ],
  },
];

describe('habitChainUtils', () => {
  test('findChainForHabit returns chain containing habit', () => {
    expect(findChainForHabit(chains, 'bodyCare', 'skincare')?.id).toBe('morning');
    expect(findChainForHabit(chains, 'cleaning', 'missing')).toBeNull();
  });

  test('getChainStepIndex returns step position', () => {
    const chain = chains[0];
    expect(getChainStepIndex(chain, 'bodyCare', 'skincare')).toBe(1);
  });

  test('resolveHabitChainContext exposes step metadata without lock state', () => {
    const ctx = resolveHabitChainContext(chains, 'cleaning', 'platos');
    expect(ctx).toMatchObject({
      id: 'kitchen',
      stepIndex: 1,
      stepCount: 2,
    });
    expect(ctx).not.toHaveProperty('isLocked');
    expect(ctx).not.toHaveProperty('isNextInChain');
  });

  test('resolveRoutineDisplayName prefers label and falls back to chip label', () => {
    expect(resolveRoutineDisplayName(chains[0])).toBe('Rutina mañana');
    expect(resolveRoutineDisplayName({ steps: [{ section: 'a', habitId: 'b' }] })).toBe(ROUTINE_CHIP_LABEL);
  });

  test('isEntryGroupedRoutineChain mirrors grouped routine rules on entry context', () => {
    const ctx = resolveHabitChainContext(chains, 'bodyCare', 'shower');
    expect(isEntryGroupedRoutineChain(ctx)).toBe(true);
    expect(isEntryGroupedRoutineChain({ id: 'solo', stepCount: 1, label: '' })).toBe(false);
    expect(isEntryGroupedRoutineChain({ id: 'named', stepCount: 1, label: 'Express' })).toBe(true);
  });

  test('applyChainFormSave builds routine from multi-select + current habit', () => {
    const next = applyChainFormSave(chains, 'bodyCare', 'tooth', {
      enabled: true,
      linkedSteps: [
        { section: 'bodyCare', habitId: 'shower' },
        { section: 'bodyCare', habitId: 'skincare' },
      ],
    });
    const morning = next.find((c) => c.id === 'morning') || next[0];
    expect(morning.steps.map((s) => s.habitId)).toEqual(['shower', 'skincare', 'tooth']);
    expect(morning.type).toBeUndefined();
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
        steps: [
          { section: 'bodyCare', habitId: 'shower' },
          { section: 'bodyCare', habitId: 'skincare' },
        ],
      },
    ];
    const errors = validateHabitChains(invalid, habits);
    expect(errors.some((e) => e.includes('más de una cadena'))).toBe(true);
  });

  test('groupEntriesIntoDisplayRows groups routine habits on one row', () => {
    const items = [
      { itemId: 'solo', section: 'bodyCare' },
      {
        itemId: 'shower',
        section: 'bodyCare',
        chain: { id: 'morning', stepIndex: 0, stepCount: 2 },
      },
      { itemId: 'other', section: 'bodyCare' },
      {
        itemId: 'skincare',
        section: 'bodyCare',
        chain: { id: 'morning', stepIndex: 1, stepCount: 2 },
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

  test('groupEntriesIntoDisplayRows groups cross-section routines', () => {
    const items = [
      {
        itemId: 'cocinar',
        section: 'nutricion',
        chain: { id: 'kitchen', stepIndex: 0, stepCount: 2 },
      },
      {
        itemId: 'platos',
        section: 'cleaning',
        chain: { id: 'kitchen', stepIndex: 1, stepCount: 2 },
      },
    ];

    const rows = groupEntriesIntoDisplayRows(items);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('stack');
    expect(rows[0].entries.map((e) => e.itemId)).toEqual(['cocinar', 'platos']);
  });

  test('groupHabitsIntoDisplayRows groups routine habits from manager list', () => {
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
});

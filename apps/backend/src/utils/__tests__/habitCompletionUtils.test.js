import {
  buildEmptyHabitCompletionValue,
  ensureHabitCompletionShape,
  getHabitCompletionSlotCount,
  getHabitCompletedSlotCount,
} from '@shared/habits';

describe('buildEmptyHabitCompletionValue', () => {
  it('returns boolean false for daily habit without horarios', () => {
    expect(buildEmptyHabitCompletionValue({ tipo: 'DIARIO', frecuencia: 2 })).toBe(false);
  });

  it('returns object with one key per franja for daily habits', () => {
    expect(buildEmptyHabitCompletionValue({
      tipo: 'DIARIO',
      frecuencia: 2,
      horarios: ['MAÑANA', 'NOCHE'],
    })).toEqual({ MAÑANA: false, NOCHE: false });
  });

  it('returns boolean false for weekly habits even with horarios', () => {
    expect(buildEmptyHabitCompletionValue({
      tipo: 'SEMANAL',
      horarios: ['MAÑANA'],
    })).toBe(false);
  });
});

describe('ensureHabitCompletionShape', () => {
  it('migrates boolean false to object when horarios are configured', () => {
    expect(ensureHabitCompletionShape(false, {
      tipo: 'DIARIO',
      horarios: ['MAÑANA', 'TARDE'],
    })).toEqual({ MAÑANA: false, TARDE: false });
  });

  it('migrates boolean true to all franjas completed', () => {
    expect(ensureHabitCompletionShape(true, {
      tipo: 'DIARIO',
      horarios: ['MAÑANA', 'NOCHE'],
    })).toEqual({ MAÑANA: true, NOCHE: true });
  });

  it('adds missing franjas to existing object', () => {
    expect(ensureHabitCompletionShape({ MAÑANA: true }, {
      tipo: 'DIARIO',
      horarios: ['MAÑANA', 'NOCHE'],
    })).toEqual({ MAÑANA: true, NOCHE: false });
  });
});

describe('habit completion slot metrics', () => {
  const config = { tipo: 'DIARIO', horarios: ['MAÑANA', 'NOCHE'] };

  it('counts franjas from config when value is boolean', () => {
    expect(getHabitCompletionSlotCount(false, config)).toBe(2);
    expect(getHabitCompletedSlotCount(false, config)).toBe(0);
    expect(getHabitCompletedSlotCount(true, config)).toBe(2);
  });

  it('counts franjas from object keys', () => {
    const value = { MAÑANA: true, NOCHE: false };
    expect(getHabitCompletionSlotCount(value, config)).toBe(2);
    expect(getHabitCompletedSlotCount(value, config)).toBe(1);
  });
});

import {
  computeCarouselToggleValue,
  computeFranjaToggleValue,
  habitRequiresExpandedCarouselToggle,
  isHabitPartiallyCompletedToday,
  isHabitFullyCompletedToday,
} from '@shared/habits';

describe('habitCompletionUtils', () => {
  describe('isHabitPartiallyCompletedToday', () => {
    const horarios = ['MAÑANA', 'NOCHE'];

    it('is true when some franjas are done but not all', () => {
      expect(isHabitPartiallyCompletedToday({ MAÑANA: true, NOCHE: false }, horarios)).toBe(true);
    });

    it('is false when fully complete or empty', () => {
      expect(isHabitPartiallyCompletedToday({ MAÑANA: true, NOCHE: true }, horarios)).toBe(false);
      expect(isHabitPartiallyCompletedToday({ MAÑANA: false, NOCHE: false }, horarios)).toBe(false);
      expect(isHabitFullyCompletedToday({ MAÑANA: true, NOCHE: true }, horarios)).toBe(true);
    });
  });
});

describe('habitToggleUtils', () => {
  describe('habitRequiresExpandedCarouselToggle', () => {
    it('requires expand for daily frecuencia > 1', () => {
      expect(habitRequiresExpandedCarouselToggle({ tipo: 'DIARIO', frecuencia: 2 })).toBe(true);
      expect(habitRequiresExpandedCarouselToggle({ tipo: 'DIARIO', frecuencia: 1 })).toBe(false);
    });

    it('requires expand for multiple horarios even with frecuencia 1', () => {
      expect(habitRequiresExpandedCarouselToggle({
        tipo: 'DIARIO',
        frecuencia: 1,
        horarios: ['MAÑANA', 'NOCHE'],
      })).toBe(true);
    });

    it('does not require expand for weekly habits', () => {
      expect(habitRequiresExpandedCarouselToggle({
        tipo: 'SEMANAL',
        frecuencia: 2,
        horarios: ['MAÑANA', 'NOCHE'],
      })).toBe(false);
    });
  });

  describe('computeCarouselToggleValue', () => {
    it('toggles boolean daily habit', () => {
      expect(computeCarouselToggleValue({
        itemValue: false,
        horariosConfig: [],
        normalizedHorario: null,
      })).toBe(true);

      expect(computeCarouselToggleValue({
        itemValue: true,
        horariosConfig: [],
        normalizedHorario: null,
      })).toBe(false);
    });

    it('toggles specific horario in object format', () => {
      const result = computeCarouselToggleValue({
        itemValue: { MAÑANA: false, TARDE: false },
        horariosConfig: ['MAÑANA', 'TARDE'],
        normalizedHorario: 'MAÑANA',
      });

      expect(result).toEqual({ MAÑANA: true, TARDE: false });
    });

    it('toggles single configured franja without collapsing to boolean', () => {
      const result = computeCarouselToggleValue({
        itemValue: { MAÑANA: false },
        horariosConfig: ['MAÑANA'],
        normalizedHorario: 'MAÑANA',
      });

      expect(result).toEqual({ MAÑANA: true });
      expect(typeof result).toBe('object');
    });

    it('unmarks one franja without destroying object shape', () => {
      const result = computeCarouselToggleValue({
        itemValue: { MAÑANA: true, NOCHE: false },
        horariosConfig: ['MAÑANA', 'NOCHE'],
        normalizedHorario: 'MAÑANA',
      });

      expect(result).toEqual({ MAÑANA: false, NOCHE: false });
    });

    it('no-ops multi-franja partial when horario is missing (avoids boolean collapse)', () => {
      const value = { MAÑANA: true, NOCHE: false };
      expect(computeCarouselToggleValue({
        itemValue: value,
        horariosConfig: ['MAÑANA', 'NOCHE'],
        normalizedHorario: null,
      })).toEqual(value);
    });

    it('unmarks last completed franja when fully done and horario is missing', () => {
      expect(computeCarouselToggleValue({
        itemValue: { MAÑANA: true, TARDE: true, NOCHE: true },
        horariosConfig: ['MAÑANA', 'TARDE', 'NOCHE'],
        normalizedHorario: null,
      })).toEqual({ MAÑANA: true, TARDE: true, NOCHE: false });
    });

    it('toggles overdue MAÑANA franja when explicitly passed', () => {
      const result = computeCarouselToggleValue({
        itemValue: { MAÑANA: false, NOCHE: false },
        horariosConfig: ['MAÑANA', 'NOCHE'],
        normalizedHorario: 'MAÑANA',
      });

      expect(result).toEqual({ MAÑANA: true, NOCHE: false });
    });

    it('does not reset other franjas when toggling one in object format', () => {
      const result = computeFranjaToggleValue({
        itemValue: { MAÑANA: true, NOCHE: false },
        horariosConfig: ['MAÑANA', 'NOCHE'],
        normalizedHorario: 'NOCHE',
      });

      expect(result).toEqual({ MAÑANA: true, NOCHE: true });
    });

    it('preserves other franjas when uncompleting one from legacy true', () => {
      const result = computeFranjaToggleValue({
        itemValue: true,
        horariosConfig: ['MAÑANA', 'NOCHE'],
        normalizedHorario: 'MAÑANA',
      });

      expect(result).toEqual({ MAÑANA: false, NOCHE: true });
    });
  });
});

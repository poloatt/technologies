import {
  formatRutinaDayLabel,
  formatRutinaDaySubtitle,
  getRutinaDayMode,
  getRutinaCompletionStats,
  isForwardConfigScope,
  isRutinaHistorical,
  isRutinaToday,
  resolveHabitConfigApplyFrom,
  resolveRutinaNavigateTarget,
} from '@shared/habits';

const mockRutinas = [
  { _id: 'r3', fecha: '2026-06-22T00:00:00.000Z' },
  { _id: 'r2', fecha: '2026-06-21T00:00:00.000Z' },
  { _id: 'r1', fecha: '2026-06-20T00:00:00.000Z' },
];

const mockToday = new Date('2026-06-22T12:00:00.000Z');

describe('rutinasPageUtils', () => {
  describe('resolveRutinaNavigateTarget', () => {
    it('prev moves one calendar day older', () => {
      const target = resolveRutinaNavigateTarget({
        direction: 'prev',
        rutinas: mockRutinas,
        activeRutinaId: 'r2',
        today: mockToday,
      });
      expect(target).toEqual({ type: 'select', rutinaId: 'r1', date: '2026-06-20' });
    });

    it('next moves one calendar day newer', () => {
      const target = resolveRutinaNavigateTarget({
        direction: 'next',
        rutinas: mockRutinas,
        activeRutinaId: 'r2',
        today: mockToday,
      });
      expect(target).toEqual({ type: 'select', rutinaId: 'r3', date: '2026-06-22' });
    });

    it('next into future without record previews', () => {
      const target = resolveRutinaNavigateTarget({
        direction: 'next',
        rutinas: mockRutinas,
        activeRutinaId: 'r3',
        today: mockToday,
      });
      expect(target).toEqual({ type: 'preview', date: '2026-06-23' });
    });

    it('prev into past without cache ensures', () => {
      const target = resolveRutinaNavigateTarget({
        direction: 'prev',
        rutinas: mockRutinas,
        activeRutinaId: 'r1',
        today: mockToday,
      });
      expect(target).toEqual({ type: 'ensure', date: '2026-06-19' });
    });

    it('today selects existing record for date', () => {
      const target = resolveRutinaNavigateTarget({
        direction: 'today',
        date: '2026-06-21',
        rutinas: mockRutinas,
        today: mockToday,
      });
      expect(target).toEqual({ type: 'select', rutinaId: 'r2', date: '2026-06-21' });
    });

    it('today normalizes ISO date strings from navigate events', () => {
      const target = resolveRutinaNavigateTarget({
        direction: 'today',
        date: '2026-06-21T00:00:00.000Z',
        rutinas: mockRutinas,
        today: mockToday,
      });
      expect(target).toEqual({ type: 'select', rutinaId: 'r2', date: '2026-06-21' });
    });

    it('today without record ensures for past date', () => {
      const target = resolveRutinaNavigateTarget({
        direction: 'today',
        date: '2026-06-19',
        rutinas: mockRutinas,
        today: mockToday,
      });
      expect(target).toEqual({ type: 'ensure', date: '2026-06-19' });
    });
  });

  describe('day mode helpers', () => {
    const today = new Date('2026-06-22T12:00:00.000Z');

    it('detects today', () => {
      expect(isRutinaToday('2026-06-22T00:00:00.000Z', today)).toBe(true);
      expect(getRutinaDayMode('2026-06-22T00:00:00.000Z', today)).toBe('today');
    });

    it('detects historical', () => {
      expect(isRutinaHistorical('2026-06-20T00:00:00.000Z', today)).toBe(true);
      expect(getRutinaDayMode('2026-06-20T00:00:00.000Z', today)).toBe('historical');
    });

    it('detects future', () => {
      expect(getRutinaDayMode('2026-06-23T00:00:00.000Z', today)).toBe('future');
    });
  });

  describe('formatRutinaDaySubtitle', () => {
    it('joins date and percentage without position', () => {
      const subtitle = formatRutinaDaySubtitle({
        fecha: '2026-06-22T00:00:00.000Z',
        percentage: 67,
      });
      expect(subtitle).toContain('67%');
      expect(subtitle).not.toContain('registro');
      expect(formatRutinaDayLabel('2026-06-22T00:00:00.000Z')).toBeTruthy();
    });
  });

  describe('getRutinaCompletionStats', () => {
    it('returns zero stats without rutina', () => {
      expect(getRutinaCompletionStats(null)).toEqual({
        percentage: 0,
        completed: 0,
        total: 0,
      });
    });
  });

  describe('resolveHabitConfigApplyFrom', () => {
    const today = new Date('2026-06-22T12:00:00.000Z');

    it('uses rutina fecha as apply-from date', () => {
      expect(resolveHabitConfigApplyFrom(
        { fecha: '2026-06-15T00:00:00.000Z' },
        today,
      )).toBe('2026-06-15');
    });

    it('falls back to today when fecha is missing', () => {
      expect(resolveHabitConfigApplyFrom(null, today)).toBe('2026-06-22');
    });
  });

  describe('isForwardConfigScope', () => {
    it('accepts forward and legacy today scopes', () => {
      expect(isForwardConfigScope('forward')).toBe(true);
      expect(isForwardConfigScope('today')).toBe(true);
      expect(isForwardConfigScope('day')).toBe(false);
    });
  });
});

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
    const fixedToday = new Date('2026-11-26T12:00:00.000Z'); // Jueves (getDay = 4)
    const todayStr = '2026-11-26T00:00:00.000Z';
    const historicalStr = '2026-11-24T00:00:00.000Z'; // Martes (getDay = 2)

    const baseHabits = {
      bodyCare: [
        { id: 'h_daily', label: 'Lavarse', activo: true, orden: 1 },
        { id: 'h_multifranja', label: 'Skin Care', activo: true, orden: 2 },
      ],
      nutricion: [],
      ejercicio: [
        { id: 'h_weekly_mon', label: 'Gym Lunes', activo: true, orden: 1 },
      ],
      cleaning: [],
    };

    const basePrefs = {
      bodyCare: {
        h_daily: { tipo: 'DIARIO', frecuencia: 1, activo: true, periodo: 'CADA_DIA' },
        h_multifranja: {
          tipo: 'DIARIO',
          frecuencia: 2,
          activo: true,
          periodo: 'CADA_DIA',
          horarios: ['MAÑANA', 'NOCHE'],
        },
      },
      ejercicio: {
        // Solo lunes (1): no toca ni martes (2) ni jueves (4)
        h_weekly_mon: {
          tipo: 'SEMANAL',
          frecuencia: 1,
          activo: true,
          periodo: 'CADA_SEMANA',
          diasSemana: [1],
        },
      },
    };

    it('returns zero stats without rutina', () => {
      expect(getRutinaCompletionStats(null)).toEqual({
        percentage: 0,
        completed: 0,
        total: 0,
        deferredCount: 0,
      });
    });

    it('reaches 100% on today when all scheduled habits/slots are marked', () => {
      const rutina = {
        _id: 'r-today',
        fecha: todayStr,
        bodyCare: {
          h_daily: true,
          h_multifranja: { MAÑANA: true, NOCHE: true },
        },
        ejercicio: {
          h_weekly_mon: false,
        },
        // Ya completado el lunes 2026-11-23 → sin deuda el jueves
        historial: {
          ejercicio: {
            h_weekly_mon: { '2026-11-23': true },
          },
        },
        config: basePrefs,
      };

      expect(getRutinaCompletionStats(rutina, baseHabits, basePrefs, { today: fixedToday })).toEqual({
        percentage: 100,
        completed: 3,
        total: 3,
        deferredCount: 0,
      });
    });

    it('counts multi-franja daily habits by slot (1/2 = 50%, 2/2 = 100%)', () => {
      const habitsOnlyMulti = {
        bodyCare: [{ id: 'h_multifranja', label: 'Skin Care', activo: true }],
        nutricion: [],
        ejercicio: [],
        cleaning: [],
      };
      const prefsOnlyMulti = {
        bodyCare: {
          h_multifranja: {
            tipo: 'DIARIO',
            frecuencia: 2,
            activo: true,
            periodo: 'CADA_DIA',
            horarios: ['MAÑANA', 'NOCHE'],
          },
        },
      };

      const partialRutina = {
        _id: 'r-multi-1',
        fecha: todayStr,
        bodyCare: { h_multifranja: { MAÑANA: true, NOCHE: false } },
        config: prefsOnlyMulti,
      };
      expect(getRutinaCompletionStats(partialRutina, habitsOnlyMulti, prefsOnlyMulti, { today: fixedToday })).toEqual({
        percentage: 50,
        completed: 1,
        total: 2,
        deferredCount: 0,
      });

      const fullRutina = {
        ...partialRutina,
        bodyCare: { h_multifranja: { MAÑANA: true, NOCHE: true } },
      };
      expect(getRutinaCompletionStats(fullRutina, habitsOnlyMulti, prefsOnlyMulti, { today: fixedToday })).toEqual({
        percentage: 100,
        completed: 2,
        total: 2,
        deferredCount: 0,
      });
    });

    it('reaches 100% on historical day excluding habits not scheduled for that date', () => {
      const historicalRutina = {
        _id: 'r-hist',
        fecha: historicalStr,
        bodyCare: {
          h_daily: true,
          h_multifranja: { MAÑANA: true, NOCHE: true },
        },
        ejercicio: {
          h_weekly_mon: false, // Solo lunes, no tocaba el martes
        },
        historial: {
          ejercicio: {
            h_weekly_mon: { '2026-11-23': true },
          },
        },
        config: basePrefs,
      };

      expect(getRutinaCompletionStats(historicalRutina, baseHabits, basePrefs, { today: fixedToday })).toEqual({
        percentage: 100,
        completed: 3,
        total: 3,
        deferredCount: 0,
      });
    });

    it('excludes postponed, ignored, and pushed habits/franjas from denominator', () => {
      const prevRutinaWithPush = {
        _id: 'r-prev',
        fecha: '2026-11-25T00:00:00.000Z',
        habitDeferrals: {
          cleaning: {
            h_pushed: { action: 'push', activeUntil: '2026-11-30' },
          },
        },
      };

      const habitsWithDefer = {
        bodyCare: [
          { id: 'h_daily', label: 'Lavarse', activo: true },
          { id: 'h_multifranja', label: 'Skin Care', activo: true },
          { id: 'h_ignored', label: 'Ignorado', activo: true },
        ],
        nutricion: [],
        ejercicio: [],
        cleaning: [
          { id: 'h_pushed', label: 'Empujado', activo: true },
        ],
      };

      const prefsWithDefer = {
        bodyCare: {
          h_daily: { tipo: 'DIARIO', frecuencia: 1, activo: true, periodo: 'CADA_DIA' },
          h_multifranja: {
            tipo: 'DIARIO',
            frecuencia: 2,
            activo: true,
            periodo: 'CADA_DIA',
            horarios: ['MAÑANA', 'NOCHE'],
          },
          h_ignored: { tipo: 'DIARIO', frecuencia: 1, activo: true, periodo: 'CADA_DIA' },
        },
        cleaning: {
          h_pushed: { tipo: 'DIARIO', frecuencia: 1, activo: true, periodo: 'CADA_DIA' },
        },
      };

      const rutina = {
        _id: 'r-today-defer',
        fecha: todayStr,
        bodyCare: {
          h_daily: true,
          h_multifranja: { MAÑANA: true, NOCHE: false },
          h_ignored: false,
        },
        cleaning: {
          h_pushed: false,
        },
        habitDeferrals: {
          bodyCare: {
            h_multifranja: { action: 'postpone', franja: 'NOCHE', targetDate: '2026-11-27' },
            h_ignored: { action: 'ignore' },
          },
        },
        config: prefsWithDefer,
      };

      expect(getRutinaCompletionStats(rutina, habitsWithDefer, prefsWithDefer, {
        today: fixedToday,
        allRutinas: [prevRutinaWithPush, rutina],
      })).toEqual({
        percentage: 100,
        completed: 2,
        total: 2,
        deferredCount: 3,
      });
    });

    it('includes habits from customSections in completion stats', () => {
      const customSections = [{ id: 'estudio', label: 'Estudio' }];
      const habitsWithCustom = {
        bodyCare: [{ id: 'h_daily', label: 'Lavarse', activo: true }],
        nutricion: [],
        ejercicio: [],
        cleaning: [],
        estudio: [{ id: 'h_leer', label: 'Leer', activo: true }],
      };
      const prefsWithCustom = {
        bodyCare: {
          h_daily: { tipo: 'DIARIO', frecuencia: 1, activo: true, periodo: 'CADA_DIA' },
        },
        estudio: {
          h_leer: { tipo: 'DIARIO', frecuencia: 1, activo: true, periodo: 'CADA_DIA' },
        },
      };
      const rutina = {
        _id: 'r-custom',
        fecha: todayStr,
        bodyCare: { h_daily: true },
        estudio: { h_leer: false },
        config: prefsWithCustom,
      };

      expect(getRutinaCompletionStats(rutina, habitsWithCustom, prefsWithCustom, {
        today: fixedToday,
        customSections,
      })).toEqual({
        percentage: 50,
        completed: 1,
        total: 2,
        deferredCount: 0,
      });
    });

    it('does not inflate today progress with periodic habits completed on another day (doneByQuota)', () => {
      const rutina = {
        _id: 'r-quota',
        fecha: todayStr,
        bodyCare: {
          h_daily: false,
          h_multifranja: { MAÑANA: false, NOCHE: false },
        },
        ejercicio: {
          h_weekly_mon: false,
        },
        historial: {
          ejercicio: {
            h_weekly_mon: { '2026-11-23': true },
          },
        },
        config: basePrefs,
      };

      expect(getRutinaCompletionStats(rutina, baseHabits, basePrefs, { today: fixedToday })).toEqual({
        percentage: 0,
        completed: 0,
        total: 3,
        deferredCount: 0,
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

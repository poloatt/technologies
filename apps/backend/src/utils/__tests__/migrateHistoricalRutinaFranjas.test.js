import { buildHistoricalFranjaMigrationPayload } from '@shared/habits';

describe('buildHistoricalFranjaMigrationPayload', () => {
  it('migrates prefs franjas onto historical days with empty snapshot horarios', () => {
    const rutina = {
      _id: 'r1',
      fecha: '2020-01-15T00:00:00.000Z',
      bodyCare: { cuidadoBucal: false },
      config: {
        bodyCare: {
          cuidadoBucal: {
            tipo: 'DIARIO',
            frecuencia: 1,
            periodo: 'CADA_DIA',
            horarios: [],
            activo: true,
          },
        },
      },
    };

    const habitsPreferences = {
      bodyCare: {
        cuidadoBucal: {
          tipo: 'DIARIO',
          frecuencia: 2,
          horarios: ['MAÑANA', 'NOCHE'],
        },
      },
    };

    // Prefs actuales definen las repeticiones del día: persistir slots + valor por franja.
    expect(buildHistoricalFranjaMigrationPayload(rutina, habitsPreferences)).toEqual({
      _id: 'r1',
      config: {
        bodyCare: {
          cuidadoBucal: {
            tipo: 'DIARIO',
            frecuencia: 1,
            periodo: 'CADA_DIA',
            horarios: ['MAÑANA', 'NOCHE'],
            activo: true,
          },
        },
      },
      bodyCare: {
        cuidadoBucal: { MAÑANA: false, NOCHE: false },
      },
    });
  });

  it('derives franjas from snapshot frecuencia when horarios are empty', () => {
    const rutina = {
      _id: 'r1b',
      fecha: '2020-01-15T00:00:00.000Z',
      bodyCare: { cuidadoBucal: true },
      config: {
        bodyCare: {
          cuidadoBucal: {
            tipo: 'DIARIO',
            frecuencia: 2,
            periodo: 'CADA_DIA',
            horarios: [],
            activo: true,
          },
        },
      },
    };

    const payload = buildHistoricalFranjaMigrationPayload(rutina, {});
    expect(payload).toEqual({
      _id: 'r1b',
      config: {
        bodyCare: {
          cuidadoBucal: {
            tipo: 'DIARIO',
            frecuencia: 2,
            periodo: 'CADA_DIA',
            horarios: ['MAÑANA', 'TARDE'],
            activo: true,
          },
        },
      },
      bodyCare: {
        cuidadoBucal: { MAÑANA: true, TARDE: true },
      },
    });
  });

  it('keeps fully-complete multi-franja values when reshaping adds no pending slots', () => {
    const rutina = {
      _id: 'r1c',
      fecha: '2020-01-15T00:00:00.000Z',
      bodyCare: { cuidadoBucal: { MAÑANA: true } },
      config: {
        bodyCare: {
          cuidadoBucal: {
            tipo: 'DIARIO',
            frecuencia: 1,
            periodo: 'CADA_DIA',
            horarios: ['MAÑANA'],
            activo: true,
          },
        },
      },
    };

    expect(buildHistoricalFranjaMigrationPayload(rutina, {
      bodyCare: {
        cuidadoBucal: {
          tipo: 'DIARIO',
          frecuencia: 2,
          horarios: ['MAÑANA', 'NOCHE'],
        },
      },
    })).toBeNull();
  });

  it('returns null for today rutinas', () => {
    const rutina = {
      _id: 'r2',
      fecha: new Date().toISOString(),
      bodyCare: { agua: false },
    };
    expect(buildHistoricalFranjaMigrationPayload(rutina, {})).toBeNull();
  });
});

import { buildHistoricalFranjaMigrationPayload } from '@shared/habits';

describe('buildHistoricalFranjaMigrationPayload', () => {
  it('builds config and completion patches for historical rutinas without franjas', () => {
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

    const payload = buildHistoricalFranjaMigrationPayload(rutina, habitsPreferences);
    expect(payload).toEqual({
      _id: 'r1',
      config: {
        bodyCare: {
          cuidadoBucal: {
            tipo: 'DIARIO',
            frecuencia: 2,
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

  it('returns null for today rutinas', () => {
    const rutina = {
      _id: 'r2',
      fecha: new Date().toISOString(),
      bodyCare: { agua: false },
    };
    expect(buildHistoricalFranjaMigrationPayload(rutina, {})).toBeNull();
  });
});

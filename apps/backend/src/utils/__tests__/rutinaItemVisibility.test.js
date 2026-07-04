import { shouldShowRutinaItem } from '@shared/habits';

function buildRutina(overrides = {}) {
  return {
    fecha: new Date(2026, 5, 23, 12, 0, 0, 0).toISOString(),
    bodyCare: {},
    config: {
      bodyCare: {
        weekly: {
          tipo: 'SEMANAL',
          frecuencia: 1,
          activo: true,
          diasSemana: [1],
        },
      },
    },
    historial: { bodyCare: { weekly: {} } },
    ...overrides,
  };
}

describe('rutinaItemVisibility', () => {
  it('shows weekly carry-over on Tuesday when Monday was missed', () => {
    const rutina = buildRutina();
    expect(shouldShowRutinaItem('bodyCare', 'weekly', rutina)).toBe(true);
  });

  it('hides weekly habit after catch-up completion in period', () => {
    const rutina = buildRutina({
      bodyCare: { weekly: true },
      historial: {
        bodyCare: { weekly: { '2026-06-23': true } },
      },
    });
    expect(shouldShowRutinaItem('bodyCare', 'weekly', rutina)).toBe(false);
  });

  it('hides inactive habits', () => {
    const rutina = buildRutina({
      config: {
        bodyCare: {
          weekly: {
            tipo: 'SEMANAL',
            frecuencia: 1,
            activo: false,
            diasSemana: [1],
          },
        },
      },
    });
    expect(shouldShowRutinaItem('bodyCare', 'weekly', rutina)).toBe(false);
  });
});

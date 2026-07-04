import { getRutinaFranjaItems, computeRutinaToggleValue } from '@shared/habits';

describe('getRutinaFranjaItems', () => {
  const rutina = {
    fecha: '2026-06-30',
    bodyCare: { cuidadoBucal: { MAÑANA: false, NOCHE: false } },
    config: {
      bodyCare: {
        cuidadoBucal: {
          tipo: 'DIARIO',
          periodo: 'CADA_DIA',
          frecuencia: 2,
          horarios: ['MAÑANA', 'NOCHE'],
          activo: true,
        },
      },
    },
  };

  const habits = {
    bodyCare: [{ id: 'cuidadoBucal', label: 'Cuidado bucal', icon: 'Shower', activo: true, orden: 0 }],
    nutricion: [],
    ejercicio: [],
    cleaning: [],
  };

  it('expands daily habits with multiple franjas into separate entries', () => {
    const items = getRutinaFranjaItems({
      section: 'bodyCare',
      rutina,
      habits,
      habitsPreferences: {},
    });

    const bucal = items.filter((i) => i.itemId === 'cuidadoBucal');
    expect(bucal).toHaveLength(2);
    expect(bucal.map((i) => i.horario).sort()).toEqual(['MAÑANA', 'NOCHE']);
  });
});

describe('computeRutinaToggleValue', () => {
  const rutina = {
    bodyCare: { cuidadoBucal: { MAÑANA: false, NOCHE: false } },
    config: {
      bodyCare: {
        cuidadoBucal: {
          tipo: 'DIARIO',
          frecuencia: 2,
          horarios: ['MAÑANA', 'NOCHE'],
        },
      },
    },
  };

  it('toggles explicit franja without using current time window', () => {
    const result = computeRutinaToggleValue({
      section: 'bodyCare',
      itemId: 'cuidadoBucal',
      rutina,
      horario: 'MAÑANA',
    });

    expect(result).toEqual({ MAÑANA: true, NOCHE: false });
  });
});

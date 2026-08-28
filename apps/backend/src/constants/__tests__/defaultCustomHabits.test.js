import { buildEmptyCompletionSections } from '../defaultCustomHabits.js';

describe('buildEmptyCompletionSections', () => {
  const customHabits = {
    bodyCare: [{ id: 'cuidadoBucal', label: 'Cuidado bucal', activo: true }],
    nutricion: [{ id: 'agua', label: 'Agua', activo: true }],
    ejercicio: [],
    cleaning: [],
  };

  it('initializes boolean false without config', () => {
    const sections = buildEmptyCompletionSections(customHabits, ['bodyCare', 'nutricion']);
    expect(sections.bodyCare.cuidadoBucal).toBe(false);
    expect(sections.nutricion.agua).toBe(false);
  });

  it('initializes object per franja when config has horarios', () => {
    const configMap = {
      bodyCare: {
        cuidadoBucal: {
          tipo: 'DIARIO',
          frecuencia: 2,
          horarios: ['MAÑANA', 'NOCHE'],
        },
      },
    };

    const sections = buildEmptyCompletionSections(customHabits, ['bodyCare', 'nutricion'], configMap);
    expect(sections.bodyCare.cuidadoBucal).toEqual({ MAÑANA: false, NOCHE: false });
    expect(sections.nutricion.agua).toBe(false);
  });
});

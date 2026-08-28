import { calculateRutinaCompletitud } from '../rutinaCompletitudUtils.js';

describe('calculateRutinaCompletitud', () => {
  it('counts each franja as separate task for multi-horario daily habits', () => {
    const rutina = {
      bodyCare: { cuidadoBucal: { MAÑANA: true, NOCHE: false } },
      nutricion: {},
      ejercicio: {},
      cleaning: {},
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

    const result = calculateRutinaCompletitud(rutina);
    expect(result.completitud).toBe(0.5);
    expect(result.completitudPorSeccion.bodyCare).toBe(0.5);
  });

  it('uses config horarios count for legacy boolean values', () => {
    const rutina = {
      bodyCare: { cuidadoBucal: true },
      nutricion: {},
      ejercicio: {},
      cleaning: {},
      config: {
        bodyCare: {
          cuidadoBucal: {
            tipo: 'DIARIO',
            frecuencia: 2,
            horarios: ['MAÑANA', 'NOCHE'],
            activo: true,
          },
        },
      },
    };

    const result = calculateRutinaCompletitud(rutina);
    expect(result.completitud).toBe(1);
  });
});

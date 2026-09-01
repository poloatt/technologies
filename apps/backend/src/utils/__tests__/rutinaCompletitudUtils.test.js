import { calculateRutinaCompletitud, buildRutinaUpdateSetOps } from '../rutinaCompletitudUtils.js';
import { buildRutinaUpdatePatches, collectRutinaUpdateSectionKeys } from '../rutinaUpdatePatches.js';

describe('buildRutinaUpdateSetOps', () => {
  const currentRutina = {
    bodyCare: {},
    nutricion: {},
    ejercicio: {},
    cleaning: {},
    config: { bodyCare: {}, nutricion: {}, ejercicio: {}, cleaning: {} },
  };

  it('sets habitDeferrals without conflicting nested paths', () => {
    const habitDeferrals = {
      bodyCare: {
        shower: { action: 'ignore', franja: 'MAÑANA' },
      },
    };
    const body = { habitDeferrals };
    const sectionKeys = collectRutinaUpdateSectionKeys(currentRutina, body);
    const patches = buildRutinaUpdatePatches(currentRutina, body, sectionKeys);
    const updateOps = buildRutinaUpdateSetOps(patches, body, currentRutina);

    expect(updateOps.habitDeferrals).toEqual(habitDeferrals);
    expect(updateOps['habitDeferrals.bodyCare']).toBeUndefined();
  });

  it('sets postponedFranjas without conflicting nested paths', () => {
    const postponedFranjas = {
      bodyCare: { shower: ['TARDE'] },
    };
    const body = { postponedFranjas };
    const sectionKeys = collectRutinaUpdateSectionKeys(currentRutina, body);
    const patches = buildRutinaUpdatePatches(currentRutina, body, sectionKeys);
    const updateOps = buildRutinaUpdateSetOps(patches, body, currentRutina);

    expect(updateOps.postponedFranjas).toEqual(postponedFranjas);
    expect(updateOps['postponedFranjas.bodyCare']).toBeUndefined();
  });
});

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

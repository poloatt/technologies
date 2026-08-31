import { describe, it, expect } from '@jest/globals';
import {
  isDailyMultiFranjaConfig,
  resolveCompletedDailyFranjas,
  resolveHistoricalDoneFranjaBadges,
} from '@shared/habits';

describe('historical done multi-franja badges', () => {
  const multiFranjaConfig = {
    tipo: 'DIARIO',
    periodo: 'CADA_DIA',
    frecuencia: 1,
    activo: true,
    horarios: ['MAÑANA', 'TARDE', 'NOCHE'],
  };

  const historicalRutina = {
    fecha: new Date(2026, 7, 30, 12, 0, 0).toISOString(),
    bodyCare: {
      skincare: { MAÑANA: true, TARDE: true, NOCHE: true },
    },
  };

  it('detects daily multi-franja config', () => {
    expect(isDailyMultiFranjaConfig(multiFranjaConfig)).toBe(true);
    expect(isDailyMultiFranjaConfig({ tipo: 'DIARIO', horarios: ['MAÑANA'] })).toBe(false);
  });

  it('returns all completed franjas for consolidated historical done', () => {
    const badges = resolveHistoricalDoneFranjaBadges({
      rutina: historicalRutina,
      config: multiFranjaConfig,
      itemValue: historicalRutina.bodyCare.skincare,
    });
    expect(badges).toEqual(['MAÑANA', 'TARDE', 'NOCHE']);
  });

  it('returns single franja badge for partial historical done entry', () => {
    const badges = resolveHistoricalDoneFranjaBadges({
      rutina: historicalRutina,
      config: multiFranjaConfig,
      itemValue: { MAÑANA: true, TARDE: false, NOCHE: false },
      franjaKey: 'MAÑANA',
    });
    expect(badges).toEqual(['MAÑANA']);
  });

  it('does not apply on today view', () => {
    const todayRutina = {
      ...historicalRutina,
      fecha: new Date(2026, 7, 31, 12, 0, 0).toISOString(),
    };
    expect(resolveHistoricalDoneFranjaBadges({
      rutina: todayRutina,
      config: multiFranjaConfig,
      itemValue: todayRutina.bodyCare.skincare,
    })).toBeNull();
  });

  it('resolveCompletedDailyFranjas preserves schedule order', () => {
    expect(resolveCompletedDailyFranjas(
      { NOCHE: true, MAÑANA: true, TARDE: false },
      multiFranjaConfig,
    )).toEqual(['MAÑANA', 'NOCHE']);
  });
});

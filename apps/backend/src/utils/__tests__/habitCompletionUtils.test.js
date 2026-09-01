import { describe, it, expect } from '@jest/globals';
import {
  isDailyMultiFranjaConfig,
  resolveCompletedDailyFranjas,
  resolveDoneFranjaBadges,
  resolveHistoricalDoneFranjaBadges,
} from '@shared/habits';

describe('done multi-franja badges', () => {
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

  it('returns all completed franjas for consolidated done entry', () => {
    const badges = resolveDoneFranjaBadges({
      config: multiFranjaConfig,
      itemValue: historicalRutina.bodyCare.skincare,
    });
    expect(badges).toEqual(['MAÑANA', 'TARDE', 'NOCHE']);
  });

  it('returns single franja badge for partial done entry', () => {
    const badges = resolveDoneFranjaBadges({
      config: multiFranjaConfig,
      itemValue: { MAÑANA: true, TARDE: false, NOCHE: false },
      franjaKey: 'MAÑANA',
    });
    expect(badges).toEqual(['MAÑANA']);
  });

  it('applies on today view via resolveDoneFranjaBadges', () => {
    const todayRutina = {
      ...historicalRutina,
      fecha: new Date(2026, 7, 31, 12, 0, 0).toISOString(),
    };
    expect(resolveDoneFranjaBadges({
      config: multiFranjaConfig,
      itemValue: todayRutina.bodyCare.skincare,
    })).toEqual(['MAÑANA', 'TARDE', 'NOCHE']);
  });

  it('resolveHistoricalDoneFranjaBadges still gates on historical day', () => {
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

  it('resolveCompletedDailyFranjas preserves schedule order', () => {
    expect(resolveCompletedDailyFranjas(
      { NOCHE: true, MAÑANA: true, TARDE: false },
      multiFranjaConfig,
    )).toEqual(['MAÑANA', 'NOCHE']);
  });
});

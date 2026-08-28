import {
  resolveHabitCadenceBucket,
  getCadenceBucketLabel,
} from '@shared/habits';

describe('resolveHabitCadenceBucket', () => {
  it('maps standard tipos', () => {
    expect(resolveHabitCadenceBucket({ tipo: 'DIARIO' })).toBe('DIARIO');
    expect(resolveHabitCadenceBucket({ tipo: 'SEMANAL' })).toBe('SEMANAL');
    expect(resolveHabitCadenceBucket({ tipo: 'MENSUAL' })).toBe('MENSUAL');
    expect(resolveHabitCadenceBucket({ tipo: 'TRIMESTRAL' })).toBe('TRIMESTRAL');
    expect(resolveHabitCadenceBucket({ tipo: 'SEMESTRAL' })).toBe('SEMESTRAL');
    expect(resolveHabitCadenceBucket({ tipo: 'ANUAL' })).toBe('ANUAL');
  });

  it('maps personalizado by periodo', () => {
    expect(resolveHabitCadenceBucket({ tipo: 'PERSONALIZADO', periodo: 'CADA_TRIMESTRE' })).toBe('TRIMESTRAL');
    expect(resolveHabitCadenceBucket({ tipo: 'PERSONALIZADO', periodo: 'CADA_ANO' })).toBe('ANUAL');
  });

  it('returns readable labels', () => {
    expect(getCadenceBucketLabel('DIARIO')).toBe('Diario');
    expect(getCadenceBucketLabel('TRIMESTRAL')).toBe('Trimestral');
  });
});

import {
  buildPostponedFranjasUpdate,
  canPostponeHabitFranja,
  getPostponeMenuLabel,
  isFranjaPostponed,
  resolvePostponeTargetFranja,
} from '@shared/habits';

describe('rutinaPostponeUtils', () => {
  const rutina = {
    _id: 'r1',
    fecha: new Date().toISOString(),
    bodyCare: { shower: { MAÑANA: false, TARDE: false } },
    config: {
      bodyCare: {
        shower: { tipo: 'DIARIO', horarios: ['MAÑANA', 'TARDE'], activo: true },
      },
    },
  };

  it('buildPostponedFranjasUpdate adds franja without duplicates', () => {
    const first = buildPostponedFranjasUpdate(rutina, 'bodyCare', 'shower', 'MAÑANA');
    expect(first.bodyCare.shower).toEqual(['MAÑANA']);

    const rutinaWithPostpone = { ...rutina, postponedFranjas: first };
    const second = buildPostponedFranjasUpdate(rutinaWithPostpone, 'bodyCare', 'shower', 'MAÑANA');
    expect(second.bodyCare.shower).toEqual(['MAÑANA']);
  });

  it('isFranjaPostponed detects postponed franja', () => {
    const postponed = buildPostponedFranjasUpdate(rutina, 'bodyCare', 'shower', 'TARDE');
    expect(isFranjaPostponed({ postponedFranjas: postponed }, 'bodyCare', 'shower', 'TARDE')).toBe(true);
    expect(isFranjaPostponed({ postponedFranjas: postponed }, 'bodyCare', 'shower', 'MAÑANA')).toBe(false);
  });

  it('resolvePostponeTargetFranja returns next pending slot', () => {
    const next = resolvePostponeTargetFranja({
      config: rutina.config.bodyCare.shower,
      itemValue: rutina.bodyCare.shower,
      focusHorario: 'MAÑANA',
      currentTimeOfDay: 'MAÑANA',
    });
    expect(next).toBe('TARDE');
  });

  it('getPostponeMenuLabel formats action copy', () => {
    expect(getPostponeMenuLabel('TARDE')).toMatch(/Posponer a/i);
  });

  it('canPostponeHabitFranja is true for daily habit in Ahora with next franja', () => {
    expect(canPostponeHabitFranja({
      rutina,
      section: 'bodyCare',
      itemId: 'shower',
      config: rutina.config.bodyCare.shower,
      itemValue: rutina.bodyCare.shower,
      focusHorario: 'MAÑANA',
      currentTimeOfDay: 'MAÑANA',
      allowPostpone: true,
    })).toBe(true);
  });
});

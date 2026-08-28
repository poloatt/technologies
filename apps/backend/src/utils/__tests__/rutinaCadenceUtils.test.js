import {
  groupRutinaHabitsByCadence,
  groupDailyCadenceByFranja,
  groupWeeklyCadenceByWeekday,
  resolveRutinaScheduleBucket,
  resolveCadenceViewBucket,
  isEntryDueOnRutinaDay,
} from '@shared/habits';

const monday = new Date(2026, 5, 22, 12, 0, 0, 0); // lunes (getDay=1)

function makeWeeklyRutina(overrides = {}) {
  return {
    _id: 'r1',
    fecha: monday.toISOString(),
    bodyCare: { weekly: false },
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

const habits = {
  bodyCare: [
    { id: 'weekly', label: 'Semanal', icon: 'Spa', activo: true, orden: 0 },
  ],
};

const iconsMap = {
  bodyCare: { weekly: () => null },
};

describe('cadence view — dynamic Diario promotion', () => {
  it('promotes weekly habit due today to Diario bucket, not Semanal', () => {
    const rutina = makeWeeklyRutina();
    const buckets = groupRutinaHabitsByCadence({ rutina, habits, iconsMap });
    const diario = buckets.find((b) => b.id === 'DIARIO');
    const semanal = buckets.find((b) => b.id === 'SEMANAL');

    expect(diario?.today.map((e) => e.itemId)).toEqual(['weekly']);
    expect(semanal).toBeUndefined();
  });

  it('resolveCadenceViewBucket returns DIARIO for weekly due today', () => {
    const rutina = makeWeeklyRutina();
    const entry = {
      config: rutina.config.bodyCare.weekly,
      isScheduled: true,
      isCadenciaDebt: false,
    };
    expect(resolveCadenceViewBucket(entry, rutina)).toBe('DIARIO');
  });

  it('assigns promoted weekly habit to active franja in Diario layout', () => {
    const rutina = makeWeeklyRutina();
    const diario = groupRutinaHabitsByCadence({ rutina, habits, iconsMap })
      .find((b) => b.id === 'DIARIO');

    const franjaGroups = groupDailyCadenceByFranja(diario, rutina);
    expect(franjaGroups.some((g) => g.today.some((e) => e.itemId === 'weekly'))).toBe(true);
  });

  it('keeps weekly habit on other weekday in Semanal with day subgroup', () => {
    const rutina = makeWeeklyRutina({
      config: {
        bodyCare: {
          weekly: {
            tipo: 'SEMANAL',
            frecuencia: 1,
            activo: true,
            diasSemana: [2],
          },
        },
      },
    });
    const semanal = groupRutinaHabitsByCadence({ rutina, habits, iconsMap })
      .find((b) => b.id === 'SEMANAL');

    expect(semanal?.notToday.map((e) => e.itemId)).toEqual(['weekly']);

    const weekdayGroups = groupWeeklyCadenceByWeekday(semanal, rutina);
    const martes = weekdayGroups.find((g) => g.weekdayKey === 2);
    expect(martes?.pending.map((e) => e.itemId)).toEqual(['weekly']);
  });

  it('isEntryDueOnRutinaDay when isScheduled is false but diasSemana matches', () => {
    const rutina = makeWeeklyRutina();
    const entry = {
      section: 'bodyCare',
      itemId: 'weekly',
      config: rutina.config.bodyCare.weekly,
      itemValue: false,
      isScheduled: false,
      isCadenciaDebt: false,
    };
    expect(isEntryDueOnRutinaDay(entry, rutina)).toBe(true);
    expect(resolveRutinaScheduleBucket(entry, { rutina })).toBe('today');
    expect(resolveCadenceViewBucket(entry, rutina)).toBe('DIARIO');
  });
});

import {
  groupRutinaHabitsByCadence,
  groupDailyCadenceByFranja,
  groupDailyCadenceBucketByFranjaSchedule,
  groupWeeklyCadenceByWeekday,
  resolveRutinaScheduleBucket,
  resolveCadenceViewBucket,
  isEntryDueOnRutinaDay,
  buildDailyCadenceDisplaySections,
  reorderFlatEntriesByDisplayRowDnD,
} from '@shared/habits';
import { getNormalizedToday } from '@shared/utils/dateUtils.js';

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

  it('on historical day resolves partially completed multi-franja to done', () => {
    const rutina = makeWeeklyRutina({ fecha: new Date(2026, 5, 20).toISOString() });
    const entry = {
      section: 'bodyCare',
      itemId: 'teeth',
      config: {
        tipo: 'DIARIO',
        frecuencia: 1,
        activo: true,
        horarios: ['MAÑANA', 'NOCHE'],
      },
      itemValue: { MAÑANA: true, NOCHE: false },
    };
    expect(resolveRutinaScheduleBucket(entry, { rutina })).toBe('done');
  });

  it('on today keeps partially completed multi-franja in today', () => {
    const rutina = makeWeeklyRutina({ fecha: getNormalizedToday().toISOString() });
    const entry = {
      section: 'bodyCare',
      itemId: 'teeth',
      config: {
        tipo: 'DIARIO',
        frecuencia: 1,
        activo: true,
        horarios: ['MAÑANA', 'NOCHE'],
      },
      itemValue: { MAÑANA: true, NOCHE: false },
    };
    expect(resolveRutinaScheduleBucket(entry, { rutina })).toBe('today');
  });

  it('places quota-satisfied weekly habit in Hecho, not notToday, in Semanal bucket', () => {
    const sunday = new Date(2026, 5, 21, 12, 0, 0, 0);
    const rutina = makeWeeklyRutina({
      fecha: sunday.toISOString(),
      historial: { bodyCare: { weekly: { '2026-06-16': true } } },
    });
    const semanal = groupRutinaHabitsByCadence({ rutina, habits, iconsMap })
      .find((b) => b.id === 'SEMANAL');

    expect(semanal?.done.map((e) => e.itemId)).toEqual(['weekly']);
    expect(semanal?.notToday.map((e) => e.itemId)).toEqual([]);

    const weekdayGroups = groupWeeklyCadenceByWeekday(semanal, rutina);
    expect(weekdayGroups.flatMap((g) => g.done).map((e) => e.itemId)).toContain('weekly');
    expect(weekdayGroups.flatMap((g) => g.pending).map((e) => e.itemId)).not.toContain('weekly');
  });

  it('places quota-satisfied monthly habit in Hecho, not notToday, in Mensual bucket', () => {
    const day20 = new Date(2026, 5, 20, 12, 0, 0, 0);
    const rutina = {
      _id: 'r1',
      fecha: day20.toISOString(),
      bodyCare: { monthly: false },
      config: {
        bodyCare: {
          monthly: {
            tipo: 'MENSUAL',
            frecuencia: 1,
            activo: true,
            diasMes: [1, 15],
          },
        },
      },
      historial: { bodyCare: { monthly: { '2026-06-01': true } } },
    };
    const habitsMonthly = {
      bodyCare: [{ id: 'monthly', label: 'Mensual', icon: 'Spa', activo: true, orden: 0 }],
    };
    const iconsMonthly = { bodyCare: { monthly: () => null } };

    const mensual = groupRutinaHabitsByCadence({
      rutina,
      habits: habitsMonthly,
      iconsMap: iconsMonthly,
    }).find((b) => b.id === 'MENSUAL');

    expect(mensual?.done.map((e) => e.itemId)).toEqual(['monthly']);
    expect(mensual?.notToday.map((e) => e.itemId)).toEqual([]);
  });

  it('places quota-satisfied weekly habit in Diario franja Hecho, not notToday', () => {
    const sunday = new Date(2026, 5, 21, 12, 0, 0, 0);
    const rutina = makeWeeklyRutina({
      fecha: sunday.toISOString(),
      historial: { bodyCare: { weekly: { '2026-06-16': true } } },
    });
    const diario = groupRutinaHabitsByCadence({ rutina, habits, iconsMap })
      .find((b) => b.id === 'DIARIO');

    expect(diario).toBeUndefined();

    const rutinaWithDaily = makeWeeklyRutina({
      fecha: sunday.toISOString(),
      bodyCare: { shower: false, weekly: false },
      config: {
        bodyCare: {
          shower: { tipo: 'DIARIO', frecuencia: 1, activo: true },
          weekly: {
            tipo: 'SEMANAL',
            frecuencia: 1,
            activo: true,
            diasSemana: [1],
          },
        },
      },
      historial: { bodyCare: { weekly: { '2026-06-16': true } } },
    });
    const habitsBoth = {
      bodyCare: [
        { id: 'shower', label: 'Ducha', icon: 'Shower', activo: true, orden: 0 },
        { id: 'weekly', label: 'Semanal', icon: 'Spa', activo: true, orden: 1 },
      ],
    };
    const iconsBoth = { bodyCare: { shower: () => null, weekly: () => null } };

    const diarioBucket = groupRutinaHabitsByCadence({
      rutina: rutinaWithDaily,
      habits: habitsBoth,
      iconsMap: iconsBoth,
    }).find((b) => b.id === 'DIARIO');

    const franjaGroups = groupDailyCadenceByFranja(diarioBucket, rutinaWithDaily);
    const notTodayIds = franjaGroups.flatMap((g) => g.notToday.map((e) => e.itemId));
    const doneIds = franjaGroups.flatMap((g) => g.done.map((e) => e.itemId));

    expect(notTodayIds).not.toContain('weekly');
    expect(doneIds).not.toContain('weekly');
  });
});

describe('groupDailyCadenceBucketByFranjaSchedule', () => {
  const mondayBucket = {
    today: [
      {
        itemId: 'morning',
        section: 'bodyCare',
        config: { tipo: 'DIARIO', frecuencia: 1, activo: true, horarios: ['MAÑANA'] },
        itemValue: false,
        franjaKey: 'MAÑANA',
      },
      {
        itemId: 'afternoon',
        section: 'bodyCare',
        config: { tipo: 'DIARIO', frecuencia: 1, activo: true, horarios: ['TARDE'] },
        itemValue: false,
        franjaKey: 'TARDE',
      },
    ],
    done: [],
    notToday: [],
  };

  it('on historical day puts all pending in ahora without sinHacer/luego', () => {
    const rutina = makeWeeklyRutina({ fecha: new Date(2026, 5, 20).toISOString() });
    const grouped = groupDailyCadenceBucketByFranjaSchedule(mondayBucket, rutina);

    expect(grouped.sinHacer).toEqual([]);
    expect(grouped.luego).toEqual([]);
    expect(grouped.ahora.map((e) => e.itemId).sort()).toEqual(['afternoon', 'morning']);
  });

  it('on historical day moves marked multi-franja habits to done, not sin marcar', () => {
    const historicalDate = new Date(2026, 5, 20).toISOString();
    const rutina = {
      _id: 'r1',
      fecha: historicalDate,
      bodyCare: {
        teeth: { MAÑANA: true, NOCHE: false },
        shower: false,
      },
      config: {
        bodyCare: {
          teeth: {
            tipo: 'DIARIO',
            frecuencia: 1,
            activo: true,
            horarios: ['MAÑANA', 'NOCHE'],
          },
          shower: { tipo: 'DIARIO', frecuencia: 1, activo: true },
        },
      },
    };
    const habitsMulti = {
      bodyCare: [
        { id: 'teeth', label: 'Dientes', icon: 'Brush', activo: true, orden: 0 },
        { id: 'shower', label: 'Ducha', icon: 'Shower', activo: true, orden: 1 },
      ],
    };
    const iconsMulti = {
      bodyCare: { teeth: () => null, shower: () => null },
    };

    const diario = groupRutinaHabitsByCadence({
      rutina,
      habits: habitsMulti,
      iconsMap: iconsMulti,
    }).find((b) => b.id === 'DIARIO');

    expect(diario?.done.map((e) => e.itemId)).toContain('teeth');
    expect(diario?.today.map((e) => e.itemId)).not.toContain('teeth');
    expect(diario?.today.map((e) => e.itemId)).toContain('shower');

    const grouped = groupDailyCadenceBucketByFranjaSchedule(diario, rutina);
    expect(grouped.ahora.map((e) => e.itemId)).not.toContain('teeth');
    expect(grouped.ahora.map((e) => e.itemId)).toContain('shower');
  });
});

describe('buildDailyCadenceDisplaySections', () => {
  const groupsByKey = {
    MAÑANA: { franjaKey: 'MAÑANA', franjaLabel: 'Mañana', today: [{ itemId: 'a' }], notToday: [], done: [] },
    TARDE: { franjaKey: 'TARDE', franjaLabel: 'Tarde', today: [{ itemId: 'b' }], notToday: [], done: [] },
    NOCHE: { franjaKey: 'NOCHE', franjaLabel: 'Noche', today: [{ itemId: 'c' }], notToday: [], done: [] },
  };

  it('mañana activa: Mañana (lista), Tarde y Noche (carrusel)', () => {
    const sections = buildDailyCadenceDisplaySections({
      groupsByKey,
      activeFranja: 'MAÑANA',
      isViewingToday: true,
    });
    expect(sections.map((s) => s.id)).toEqual(['MAÑANA', 'TARDE', 'NOCHE']);
    expect(sections.find((s) => s.id === 'MAÑANA').isActive).toBe(true);
    expect(sections.find((s) => s.id === 'TARDE').isActive).toBe(false);
  });

  it('tarde activa: Mañana, Ahora (lista), Noche', () => {
    const sections = buildDailyCadenceDisplaySections({
      groupsByKey,
      activeFranja: 'TARDE',
      isViewingToday: true,
      labels: { ahora: 'Ahora', sinHacer: 'Sin hacer' },
    });
    expect(sections.map((s) => ({ id: s.id, label: s.label, isActive: s.isActive }))).toEqual([
      { id: 'MAÑANA', label: 'Mañana', isActive: false },
      { id: 'AHORA', label: 'Ahora', isActive: true },
      { id: 'NOCHE', label: 'Noche', isActive: false },
    ]);
  });

  it('noche activa: Sin hacer (merge mañana+tarde), Noche (lista)', () => {
    const sections = buildDailyCadenceDisplaySections({
      groupsByKey,
      activeFranja: 'NOCHE',
      isViewingToday: true,
      labels: { ahora: 'Ahora', sinHacer: 'Sin hacer' },
    });
    expect(sections.map((s) => s.id)).toEqual(['SIN_HACER', 'NOCHE']);
    expect(sections[0].group.today.map((e) => e.itemId)).toEqual(['a', 'b']);
    expect(sections[1].isActive).toBe(true);
  });

  it('día histórico: orden fijo Mañana → Tarde → Noche sin sección activa', () => {
    const sections = buildDailyCadenceDisplaySections({
      groupsByKey,
      activeFranja: 'TARDE',
      isViewingToday: false,
    });
    expect(sections.every((s) => !s.isActive)).toBe(true);
    expect(sections.map((s) => s.id)).toEqual(['MAÑANA', 'TARDE', 'NOCHE']);
  });
});

describe('reorderFlatEntriesByDisplayRowDnD', () => {
  const items = [
    { itemId: 'a', chain: null },
    { itemId: 'b', chain: { type: 'stack', id: 'c1', stepCount: 2, stepIndex: 0 } },
    { itemId: 'c', chain: { type: 'stack', id: 'c1', stepCount: 2, stepIndex: 1 } },
    { itemId: 'd', chain: null },
  ];

  it('mueve una rutina apilada como bloque', () => {
    const result = reorderFlatEntriesByDisplayRowDnD(items, 'stack:c1', 'a');
    expect(result).toEqual(['b', 'c', 'a', 'd']);
  });

  it('intercambia hábito suelto con rutina', () => {
    const result = reorderFlatEntriesByDisplayRowDnD(items, 'd', 'stack:c1');
    expect(result).toEqual(['a', 'd', 'b', 'c']);
  });
});

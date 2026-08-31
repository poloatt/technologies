import {
  categorizeSectionHabits,
  groupSectionHabitsByDaySchedule,
  groupRutinaHabitsByCadence,
  getSectionCarouselItems,
  sortSectionHabitsByFixedOrder,
  getDefaultSelectedSection,
  partitionDoneEntriesByRutinaDay,
  isHabitCompletedOnRutinaDay,
  resolveRutinaScheduleBucket,
  buildRutinaGlobalDoneItems,
  getRutinaMarkedDoneTodayEntries,
  mapRutinaDoneEntriesToCarouselItems,
  filterRutinaDoneSectionEntries,
  isHabitMarkedCompleteForConfig,
  RUTINA_SECTION_LABELS,
  HABIT_SECTIONS,
  getHabitDisplayLabel,
} from '@shared/habits';
import { jest } from '@jest/globals';
import { getNormalizedToday, formatDateForAPI } from '@shared/utils/dateUtils.js';
import { addDays, getDay, startOfWeek } from 'date-fns';

function makeRutina(overrides = {}) {
  return {
    _id: 'r1',
    fecha: '2026-06-22T15:00:00.000Z',
    bodyCare: {},
    nutricion: {},
    ejercicio: {},
    cleaning: {},
    config: {
      bodyCare: {
        shower: { tipo: 'DIARIO', frecuencia: 1, activo: true },
        weekly: { tipo: 'SEMANAL', frecuencia: 1, activo: true, diasSemana: [1] },
      },
      nutricion: {
        water: { tipo: 'DIARIO', frecuencia: 1, activo: true },
      },
    },
    historial: { bodyCare: { weekly: {} } },
    ...overrides,
  };
}

function makeQuotaMetWeeklyRutina(overrides = {}) {
  const today = getNormalizedToday();
  const todayDow = getDay(today);
  const scheduledDow = todayDow === 1 ? 2 : 1;
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const scheduledDate = addDays(weekStart, scheduledDow === 0 ? 6 : scheduledDow - 1);
  return makeRutina({
    fecha: today.toISOString(),
    historial: {
      bodyCare: {
        weekly: { [formatDateForAPI(scheduledDate)]: true },
      },
    },
    config: {
      bodyCare: {
        shower: { tipo: 'DIARIO', frecuencia: 1, activo: true },
        weekly: { tipo: 'SEMANAL', frecuencia: 1, activo: true, diasSemana: [scheduledDow] },
      },
      nutricion: {
        water: { tipo: 'DIARIO', frecuencia: 1, activo: true },
      },
    },
    ...overrides,
  });
}

const mockHabits = {
  bodyCare: [
    { id: 'shower', label: 'Ducha', icon: 'Shower', activo: true, orden: 0 },
    { id: 'weekly', label: 'Semanal', icon: 'Spa', activo: true, orden: 1 },
  ],
  nutricion: [
    { id: 'water', label: 'Agua', icon: 'WaterDrop', activo: true, orden: 0 },
  ],
  ejercicio: [],
  cleaning: [],
};

describe('rutinaDesktopUtils', () => {
  describe('categorizeSectionHabits', () => {
    it('places completed daily habit in completed bucket', () => {
      const rutina = makeRutina({
        bodyCare: { shower: true },
      });
      const { completed, incomplete, notScheduled } = categorizeSectionHabits({
        section: 'bodyCare',
        rutina,
        habits: mockHabits,
      });
      expect(completed.map((h) => h.itemId)).toContain('shower');
      expect(incomplete.map((h) => h.itemId)).not.toContain('shower');
      expect(notScheduled).toHaveLength(0);
    });

    it('uses user-edited label on categorized entries', () => {
      const habits = {
        ...mockHabits,
        bodyCare: [
          { id: 'shower', label: 'Mi ducha personalizada', icon: 'Shower', activo: true, orden: 0 },
        ],
      };
      const { incomplete } = categorizeSectionHabits({
        section: 'bodyCare',
        rutina: makeRutina(),
        habits,
      });
      expect(incomplete.find((h) => h.itemId === 'shower')?.label).toBe('Mi ducha personalizada');
    });

    it('enriches entries with routine context without lock state', () => {
      const habits = {
        ...mockHabits,
        bodyCare: [
          { id: 'shower', label: 'Ducha', icon: 'Shower', activo: true, orden: 0 },
          { id: 'skincare', label: 'Skincare', icon: 'Spa', activo: true, orden: 1 },
        ],
      };
      const habitChains = [{
        id: 'morning',
        steps: [
          { section: 'bodyCare', habitId: 'shower' },
          { section: 'bodyCare', habitId: 'skincare' },
        ],
      }];
      const rutina = makeRutina({
        bodyCare: { shower: false, skincare: false },
        config: {
          bodyCare: {
            shower: { tipo: 'DIARIO', frecuencia: 1, activo: true },
            skincare: { tipo: 'DIARIO', frecuencia: 1, activo: true },
          },
        },
      });
      const { incomplete } = categorizeSectionHabits({
        section: 'bodyCare',
        rutina,
        habits,
        habitChains,
      });
      const shower = incomplete.find((e) => e.itemId === 'shower');
      const skincare = incomplete.find((e) => e.itemId === 'skincare');
      expect(shower?.chain).toMatchObject({ id: 'morning', stepIndex: 0, stepCount: 2 });
      expect(skincare?.chain).toMatchObject({ id: 'morning', stepIndex: 1, stepCount: 2 });
      expect(shower?.chain).not.toHaveProperty('isLocked');
      expect(skincare?.chain).not.toHaveProperty('isLocked');
    });

    it('places incomplete scheduled habit in incomplete bucket', () => {
      const rutina = makeRutina();
      const { incomplete } = categorizeSectionHabits({
        section: 'bodyCare',
        rutina,
        habits: mockHabits,
      });
      expect(incomplete.map((h) => h.itemId)).toContain('shower');
    });

    it('places extra completed habit in completed even if not scheduled', () => {
      const rutina = makeRutina({
        bodyCare: { weekly: true },
      });
      const { completed, notScheduled } = categorizeSectionHabits({
        section: 'bodyCare',
        rutina,
        habits: mockHabits,
      });
      expect(completed.map((h) => h.itemId)).toContain('weekly');
      expect(notScheduled.map((h) => h.itemId)).not.toContain('weekly');
    });

    it('places overdue morning habit in pendientes, not no programados hoy', () => {
      const rutina = makeRutina({
        fecha: getNormalizedToday().toISOString(),
        config: {
          bodyCare: {
            shower: {
              tipo: 'DIARIO',
              frecuencia: 1,
              activo: true,
              horarios: ['MAÑANA'],
            },
            weekly: { tipo: 'SEMANAL', frecuencia: 1, activo: true, diasSemana: [1] },
          },
          nutricion: {
            water: { tipo: 'DIARIO', frecuencia: 1, activo: true },
          },
        },
      });
      const { incomplete, notScheduled } = categorizeSectionHabits({
        section: 'bodyCare',
        rutina,
        habits: mockHabits,
      });
      expect(incomplete.map((h) => h.itemId)).toContain('shower');
      expect(notScheduled.map((h) => h.itemId)).not.toContain('shower');
    });

    it('places habit with passed slot pending in pendientes when between configured franjas', () => {
      const rutina = makeRutina({
        fecha: getNormalizedToday().toISOString(),
        bodyCare: { shower: { MAÑANA: false } },
        config: {
          bodyCare: {
            shower: {
              tipo: 'DIARIO',
              frecuencia: 1,
              activo: true,
              horarios: ['MAÑANA', 'NOCHE'],
            },
            weekly: { tipo: 'SEMANAL', frecuencia: 1, activo: true, diasSemana: [1] },
          },
          nutricion: {
            water: { tipo: 'DIARIO', frecuencia: 1, activo: true },
          },
        },
      });
      const { incomplete, notScheduled } = categorizeSectionHabits({
        section: 'bodyCare',
        rutina,
        habits: mockHabits,
      });
      expect(incomplete.map((h) => h.itemId)).toContain('shower');
      expect(notScheduled.map((h) => h.itemId)).not.toContain('shower');
    });

    it('marks weekly Monday carry-over as isCadenciaDebt on Tuesday', () => {
      const today = getNormalizedToday();
      const todayDow = getDay(today);
      const scheduledDow = todayDow === 1 ? 1 : (todayDow === 0 ? 6 : todayDow - 1);
      const rutina = makeRutina({
        fecha: today.toISOString(),
        historial: { bodyCare: { weekly: {} } },
        config: {
          bodyCare: {
            shower: { tipo: 'DIARIO', frecuencia: 1, activo: true },
            weekly: { tipo: 'SEMANAL', frecuencia: 1, activo: true, diasSemana: [scheduledDow] },
          },
          nutricion: {
            water: { tipo: 'DIARIO', frecuencia: 1, activo: true },
          },
        },
      });
      const { incomplete, notScheduled } = categorizeSectionHabits({
        section: 'bodyCare',
        rutina,
        habits: mockHabits,
      });
      const weekly = incomplete.find((h) => h.itemId === 'weekly');
      if (todayDow === scheduledDow) {
        expect(weekly?.isCadenciaDebt).toBeFalsy();
      } else {
        expect(weekly).toBeTruthy();
        expect(weekly.isCadenciaDebt).toBe(true);
      }
      expect(notScheduled.map((h) => h.itemId)).not.toContain('weekly');
    });
  });

  describe('groupSectionHabitsByDaySchedule', () => {
    it('groups scheduled habits under Hoy and off-schedule under notToday', () => {
      const rutina = makeRutina({
        bodyCare: { shower: true },
      });
      const { today, done, todayCompleted, todayPending, notToday } = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina,
        habits: mockHabits,
      });
      expect(today.map((h) => h.itemId)).toEqual(['weekly']);
      expect(done.map((h) => h.itemId)).toContain('shower');
      expect(todayCompleted.map((h) => h.itemId)).toContain('shower');
      expect(todayPending.map((h) => h.itemId)).toContain('weekly');
      expect(notToday.map((h) => h.itemId)).not.toContain('shower');
      expect(notToday.map((h) => h.itemId)).not.toContain('weekly');
    });

    it('keeps fixed orden within Hoy when toggling completion', () => {
      const rutinaPending = makeRutina();
      const rutinaDone = makeRutina({ bodyCare: { shower: true } });
      const pending = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina: rutinaPending,
        habits: mockHabits,
      });
      const doneState = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina: rutinaDone,
        habits: mockHabits,
      });
      expect(pending.today.map((h) => h.itemId)).toEqual(['shower', 'weekly']);
      expect(doneState.today.map((h) => h.itemId)).toEqual(['weekly']);
      expect(doneState.done.map((h) => h.itemId)).toEqual(['shower']);
    });

    it('places quota-satisfied off-schedule habits in Hecho, not notToday', () => {
      const rutina = makeQuotaMetWeeklyRutina();
      const { notToday, today, done } = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina,
        habits: mockHabits,
      });
      expect(done.map((h) => h.itemId)).toContain('weekly');
      expect(notToday.map((h) => h.itemId)).not.toContain('weekly');
      expect(today.map((h) => h.itemId)).toContain('shower');
    });

    it('keeps cadencia debt in today with fixed orden (not debt-first)', () => {
      const today = getNormalizedToday();
      const todayDow = getDay(today);
      // Si hoy es lunes (inicio de semana), el semanal toca hoy; si no, un día anterior → deuda.
      const scheduledDow = todayDow === 1 ? 1 : (todayDow === 0 ? 6 : todayDow - 1);
      const expectDebt = scheduledDow !== todayDow;
      const rutina = makeRutina({
        fecha: today.toISOString(),
        historial: { bodyCare: { weekly: {} } },
        config: {
          bodyCare: {
            shower: { tipo: 'DIARIO', frecuencia: 1, activo: true },
            weekly: { tipo: 'SEMANAL', frecuencia: 1, activo: true, diasSemana: [scheduledDow] },
          },
        },
      });
      const { today: todayItems, todayPending } = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina,
        habits: mockHabits,
      });
      const ids = todayItems.map((h) => h.itemId);
      expect(ids).toEqual(['shower', 'weekly']);
      expect(Boolean(todayPending.find((h) => h.itemId === 'weekly')?.isCadenciaDebt)).toBe(expectDebt);
    });

    it('places interval personalizado habit (cada 4d) in Hecho when resting, not notToday', () => {
      const today = getNormalizedToday();
      const lastDone = addDays(today, -3);
      const rutina = makeRutina({
        fecha: today.toISOString(),
        bodyCare: { shave: false },
        config: {
          bodyCare: {
            shower: { tipo: 'DIARIO', frecuencia: 1, activo: true },
            weekly: { tipo: 'SEMANAL', frecuencia: 1, activo: true, diasSemana: [1] },
            shave: {
              tipo: 'PERSONALIZADO',
              periodo: 'CADA_DIA',
              frecuencia: 4,
              activo: true,
            },
          },
          nutricion: {
            water: { tipo: 'DIARIO', frecuencia: 1, activo: true },
          },
        },
        historial: { bodyCare: { shave: { [formatDateForAPI(lastDone)]: true } } },
      });
      const habitsWithShave = {
        ...mockHabits,
        bodyCare: [
          ...mockHabits.bodyCare,
          { id: 'shave', label: 'Shave', icon: 'BodyTrim', activo: true, orden: 2 },
        ],
      };
      const { done, notToday } = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina,
        habits: habitsWithShave,
      });
      expect(done.map((h) => h.itemId)).toContain('shave');
      expect(notToday.map((h) => h.itemId)).not.toContain('shave');
      const shaveEntry = done.find((h) => h.itemId === 'shave');
      expect(shaveEntry?.config?.horarios || []).toHaveLength(0);
    });

    it('keeps pending daily multi-franja habits in Hoy even when isScheduled is false', () => {
      const rutina = makeRutina({
        fecha: getNormalizedToday().toISOString(),
        bodyCare: {
          haircare: { MAÑANA: false, NOCHE: false },
          skincare: { MAÑANA: false, NOCHE: false },
        },
        config: {
          bodyCare: {
            shower: { tipo: 'DIARIO', frecuencia: 1, activo: true, diasSemana: [1] },
            weekly: { tipo: 'SEMANAL', frecuencia: 1, activo: true, diasSemana: [1] },
            haircare: {
              tipo: 'DIARIO',
              frecuencia: 2,
              activo: true,
              horarios: ['MAÑANA', 'NOCHE'],
              progresoActual: 2,
            },
            skincare: {
              tipo: 'DIARIO',
              frecuencia: 2,
              activo: true,
              horarios: ['MAÑANA', 'NOCHE'],
              progresoActual: 2,
            },
          },
          nutricion: {
            water: { tipo: 'DIARIO', frecuencia: 1, activo: true },
          },
        },
      });
      const habits = {
        ...mockHabits,
        bodyCare: [
          ...mockHabits.bodyCare,
          { id: 'haircare', label: 'Hair care', icon: 'Face', activo: true, orden: 3 },
          { id: 'skincare', label: 'Skin Care', icon: 'Spa', activo: true, orden: 4 },
        ],
      };
      const { today, notToday } = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina,
        habits,
      });
      expect(today.map((h) => h.itemId)).toEqual(expect.arrayContaining(['haircare', 'skincare']));
      expect(notToday.map((h) => h.itemId)).not.toContain('haircare');
      expect(notToday.map((h) => h.itemId)).not.toContain('skincare');
    });

    it('historical: weekly habit with incomplete snapshot uses prefs and stays notToday off-schedule', () => {
      // 2020-01-15 was Wednesday (getDay === 3); farmacia scheduled Mondays only.
      const rutina = makeRutina({
        fecha: '2020-01-15T12:00:00.000Z',
        nutricion: { farmacia: false },
        config: {
          nutricion: {
            farmacia: { activo: true },
          },
        },
      });
      const habits = {
        nutricion: [
          { id: 'farmacia', label: 'Compras farmacia', icon: 'LocalPharmacy', activo: true, orden: 0 },
        ],
      };
      const habitsPreferences = {
        nutricion: {
          farmacia: {
            tipo: 'SEMANAL',
            frecuencia: 1,
            periodo: 'CADA_SEMANA',
            diasSemana: [1],
            activo: true,
          },
        },
      };

      const { today, notToday, done } = groupSectionHabitsByDaySchedule({
        section: 'nutricion',
        rutina,
        habits,
        habitsPreferences,
      });

      expect(today.map((h) => h.itemId)).not.toContain('farmacia');
      expect(done.map((h) => h.itemId)).not.toContain('farmacia');
      const farmacia = notToday.find((h) => h.itemId === 'farmacia');
      expect(farmacia).toBeTruthy();
      expect(farmacia.config.tipo).toBe('SEMANAL');
    });
  });

  describe('getSectionCarouselItems', () => {
    it('excludes done habits from carousel', () => {
      const rutinaPending = makeRutina();
      const rutinaDone = makeRutina({ bodyCare: { shower: true } });
      const pendingIds = getSectionCarouselItems({
        section: 'bodyCare',
        rutina: rutinaPending,
        habits: mockHabits,
      }).map((h) => h.itemId);
      const doneIds = getSectionCarouselItems({
        section: 'bodyCare',
        rutina: rutinaDone,
        habits: mockHabits,
      }).map((h) => h.itemId);
      expect(pendingIds).toEqual(['shower', 'weekly']);
      expect(doneIds).toEqual(['weekly']);
    });

    it('orders ahora before luego before notToday', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 7, 17, 8, 0, 0)); // lunes

      const rutina = makeRutina({
        fecha: new Date(2026, 7, 17, 12, 0, 0).toISOString(),
        config: {
          bodyCare: {
            shower: { tipo: 'DIARIO', frecuencia: 1, activo: true, horarios: ['MAÑANA'] },
            nightly: { tipo: 'DIARIO', frecuencia: 1, activo: true, horarios: ['NOCHE'] },
            weekly: { tipo: 'SEMANAL', frecuencia: 1, activo: true, diasSemana: [1] },
            tuesdayOnly: { tipo: 'SEMANAL', frecuencia: 1, activo: true, diasSemana: [2] },
          },
          nutricion: { water: { tipo: 'DIARIO', frecuencia: 1, activo: true } },
        },
      });
      const habits = {
        ...mockHabits,
        bodyCare: [
          { id: 'shower', label: 'Mañana', icon: 'Shower', activo: true, orden: 0 },
          { id: 'nightly', label: 'Noche', icon: 'Bedtime', activo: true, orden: 1 },
          { id: 'weekly', label: 'Semanal', icon: 'Spa', activo: true, orden: 2 },
          { id: 'tuesdayOnly', label: 'Martes', icon: 'Event', activo: true, orden: 3 },
        ],
      };
      const items = getSectionCarouselItems({
        section: 'bodyCare',
        rutina,
        habits,
        currentTimeOfDay: 'MAÑANA',
      });
      expect(items.map((h) => h.carouselSlot)).toEqual(['ahora', 'ahora', 'luego', 'notToday']);
      expect(items.map((h) => h.itemId)).toEqual(['shower', 'weekly', 'nightly', 'tuesdayOnly']);
      jest.useRealTimers();
    });

    it('removes done habits from carousel when marking cadencia debt complete', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 7, 20, 12, 0, 0)); // miércoles; semanal tocaba lunes

      const todayIso = new Date(2026, 7, 20, 12, 0, 0).toISOString();
      const rutinaPending = makeRutina({
        fecha: todayIso,
        historial: { bodyCare: { weekly: {} } },
        config: {
          bodyCare: {
            shower: { tipo: 'DIARIO', frecuencia: 1, activo: true },
            weekly: { tipo: 'SEMANAL', frecuencia: 1, activo: true, diasSemana: [1] },
          },
          nutricion: {
            water: { tipo: 'DIARIO', frecuencia: 1, activo: true },
          },
        },
      });
      const rutinaDone = makeRutina({
        fecha: todayIso,
        bodyCare: { weekly: true },
        historial: { bodyCare: { weekly: { '2026-08-20': true } } },
        config: rutinaPending.config,
      });
      const pending = getSectionCarouselItems({
        section: 'bodyCare',
        rutina: rutinaPending,
        habits: mockHabits,
      });
      const done = getSectionCarouselItems({
        section: 'bodyCare',
        rutina: rutinaDone,
        habits: mockHabits,
      });
      expect(pending.map((h) => h.itemId)).toEqual(['shower', 'weekly']);
      expect(done.map((h) => h.itemId)).toEqual(['shower']);
      jest.useRealTimers();
    });

    it('removes done habits from carousel when marking scheduled-day habits complete', () => {
      const rutinaPending = makeRutina();
      const rutinaDone = makeRutina({
        bodyCare: { shower: true, weekly: true },
        historial: {
          bodyCare: {
            shower: { '2026-06-22': true },
            weekly: { '2026-06-22': true },
          },
        },
      });
      const pending = getSectionCarouselItems({
        section: 'bodyCare',
        rutina: rutinaPending,
        habits: mockHabits,
        currentTimeOfDay: 'MAÑANA',
      });
      const done = getSectionCarouselItems({
        section: 'bodyCare',
        rutina: rutinaDone,
        habits: mockHabits,
        currentTimeOfDay: 'MAÑANA',
      });
      expect(pending.map((h) => h.itemId)).toEqual(['shower', 'weekly']);
      expect(done.map((h) => h.itemId)).toEqual([]);
    });

    it('historical: excludes off-schedule habits with cadencia debt from carousel', () => {
      const rutina = makeRutina({
        fecha: '2020-01-15T12:00:00.000Z', // Wednesday; weekly is Monday-only
        nutricion: { farmacia: false },
        config: {
          nutricion: {
            farmacia: { activo: true },
          },
        },
      });
      const habits = {
        nutricion: [
          { id: 'farmacia', label: 'Compras farmacia', icon: 'LocalPharmacy', activo: true, orden: 0 },
        ],
      };
      const habitsPreferences = {
        nutricion: {
          farmacia: {
            tipo: 'SEMANAL',
            frecuencia: 1,
            periodo: 'CADA_SEMANA',
            diasSemana: [1],
            activo: true,
          },
        },
      };

      const items = getSectionCarouselItems({
        section: 'nutricion',
        rutina,
        habits,
        habitsPreferences,
      });

      expect(items.map((h) => h.itemId)).not.toContain('farmacia');
    });
  });

  describe('cadencia debt drag is dynamic across historical days', () => {
    const peluqueriaConfig = {
      activo: true,
      tipo: 'MENSUAL',
      periodo: 'CADA_MES',
      frecuencia: 1,
      diasMes: [15],
    };
    const peluqueriaHabits = {
      bodyCare: [
        { id: 'peluqueria', label: 'Peluquería', icon: 'ContentCut', activo: true, orden: 0 },
      ],
    };
    const peluqueriaIcons = {
      bodyCare: { peluqueria: () => null },
    };

    function makePeluqueriaRutina(fechaIso) {
      return {
        _id: 'r-pelu',
        fecha: fechaIso,
        bodyCare: { peluqueria: false },
        config: {
          bodyCare: {
            peluqueria: peluqueriaConfig,
          },
        },
        historial: { bodyCare: { peluqueria: {} } },
      };
    }

    it('shows unmarked habit only on historical scheduled day, not on intermediate days', () => {
      const scheduledDay = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina: makePeluqueriaRutina(new Date(2026, 7, 15, 12, 0, 0).toISOString()),
        habits: peluqueriaHabits,
        iconsMap: peluqueriaIcons,
      });
      const intermediateDay = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina: makePeluqueriaRutina(new Date(2026, 7, 20, 12, 0, 0).toISOString()),
        habits: peluqueriaHabits,
        iconsMap: peluqueriaIcons,
      });

      expect(scheduledDay.today.map((h) => h.itemId)).toContain('peluqueria');
      expect(scheduledDay.today.find((h) => h.itemId === 'peluqueria')?.isCadenciaDebt).toBeFalsy();
      expect(intermediateDay.today.map((h) => h.itemId)).not.toContain('peluqueria');
      expect(intermediateDay.notToday.map((h) => h.itemId)).toContain('peluqueria');
    });

    it('flexible monthly: hidden on historical Aug 30, visible in DIARIO on today Aug 31', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 7, 31, 12, 0, 0));

      const flexConfig = {
        activo: true,
        tipo: 'MENSUAL',
        periodo: 'CADA_MES',
        frecuencia: 1,
        diasMes: [],
        horarios: [],
      };
      const habitsPelu = {
        bodyCare: [{ id: 'peluqueria', label: 'Peluquería', icon: 'Salon', activo: true, orden: 0 }],
      };
      const iconsPelu = { bodyCare: { peluqueria: () => null } };

      const historicalRutina = {
        _id: 'r-hist',
        fecha: new Date(2026, 7, 30, 12, 0, 0).toISOString(),
        bodyCare: { peluqueria: false },
        config: { bodyCare: { peluqueria: flexConfig } },
        historial: { bodyCare: { peluqueria: {} } },
      };
      const historicalGrouped = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina: historicalRutina,
        habits: habitsPelu,
        iconsMap: iconsPelu,
      });
      expect(historicalGrouped.today.map((h) => h.itemId)).not.toContain('peluqueria');

      const todayRutina = {
        ...historicalRutina,
        _id: 'r-today',
        fecha: new Date(2026, 7, 31, 12, 0, 0).toISOString(),
      };
      const todayGrouped = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina: todayRutina,
        habits: habitsPelu,
        iconsMap: iconsPelu,
      });
      const todayBuckets = groupRutinaHabitsByCadence({
        rutina: todayRutina,
        habits: habitsPelu,
        iconsMap: iconsPelu,
      });
      const diario = todayBuckets.find((b) => b.id === 'DIARIO');

      expect(todayGrouped.today.map((h) => h.itemId)).toContain('peluqueria');
      expect(diario?.today.map((h) => h.itemId)).toContain('peluqueria');

      jest.useRealTimers();
    });

    it('interval personalizado 30d: hidden on historical mid-rest, visible in DIARIO when due', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 7, 31, 12, 0, 0));

      const intervalConfig = {
        activo: true,
        tipo: 'PERSONALIZADO',
        periodo: 'CADA_DIA',
        frecuencia: 30,
        horarios: ['TARDE'],
      };
      const habitsPelu = {
        bodyCare: [{ id: 'peluqueria', label: 'Peluquería', icon: 'Salon', activo: true, orden: 0 }],
      };
      const iconsPelu = { bodyCare: { peluqueria: () => null } };
      const historial = { '2026-08-01': true };

      const historicalRutina = {
        _id: 'r-hist',
        fecha: new Date(2026, 7, 30, 12, 0, 0).toISOString(),
        bodyCare: { peluqueria: false },
        config: { bodyCare: { peluqueria: intervalConfig } },
        historial: { bodyCare: { peluqueria: historial } },
      };
      const historicalGrouped = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina: historicalRutina,
        habits: habitsPelu,
        iconsMap: iconsPelu,
      });
      expect(historicalGrouped.today.map((h) => h.itemId)).not.toContain('peluqueria');

      const todayRutina = {
        ...historicalRutina,
        _id: 'r-today',
        fecha: new Date(2026, 7, 31, 12, 0, 0).toISOString(),
      };
      const todayGrouped = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina: todayRutina,
        habits: habitsPelu,
        iconsMap: iconsPelu,
      });
      const todayBuckets = groupRutinaHabitsByCadence({
        rutina: todayRutina,
        habits: habitsPelu,
        iconsMap: iconsPelu,
      });
      const diario = todayBuckets.find((b) => b.id === 'DIARIO');
      const peluToday = todayGrouped.today.find((h) => h.itemId === 'peluqueria');

      expect(todayGrouped.today.map((h) => h.itemId)).toContain('peluqueria');
      expect(peluToday?.isCadenciaDebt).toBe(true);
      expect(diario?.today.map((h) => h.itemId)).toContain('peluqueria');

      jest.useRealTimers();
    });

    it('fixed monthly day-30: visible on historical 30th and debt in DIARIO on 31st', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 7, 31, 12, 0, 0));

      const fixedConfig = {
        activo: true,
        tipo: 'MENSUAL',
        periodo: 'CADA_MES',
        frecuencia: 1,
        diasMes: [30],
        horarios: [],
      };
      const habitsPelu = {
        bodyCare: [{ id: 'peluqueria', label: 'Peluquería', icon: 'Salon', activo: true, orden: 0 }],
      };
      const iconsPelu = { bodyCare: { peluqueria: () => null } };

      const historicalRutina = {
        _id: 'r-hist',
        fecha: new Date(2026, 7, 30, 12, 0, 0).toISOString(),
        bodyCare: { peluqueria: false },
        config: { bodyCare: { peluqueria: fixedConfig } },
        historial: { bodyCare: { peluqueria: {} } },
      };
      const historicalGrouped = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina: historicalRutina,
        habits: habitsPelu,
        iconsMap: iconsPelu,
      });
      expect(historicalGrouped.today.map((h) => h.itemId)).toContain('peluqueria');

      const todayRutina = {
        ...historicalRutina,
        _id: 'r-today',
        fecha: new Date(2026, 7, 31, 12, 0, 0).toISOString(),
      };
      const todayGrouped = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina: todayRutina,
        habits: habitsPelu,
        iconsMap: iconsPelu,
      });
      const todayBuckets = groupRutinaHabitsByCadence({
        rutina: todayRutina,
        habits: habitsPelu,
        iconsMap: iconsPelu,
      });
      const diario = todayBuckets.find((b) => b.id === 'DIARIO');
      const peluToday = todayGrouped.today.find((h) => h.itemId === 'peluqueria');

      expect(todayGrouped.today.map((h) => h.itemId)).toContain('peluqueria');
      expect(peluToday?.isCadenciaDebt).toBe(true);
      expect(diario?.today.map((h) => h.itemId)).toContain('peluqueria');

      jest.useRealTimers();
    });

    it('promotes debt to DIARIO today only, not on historical intermediate cadence buckets', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 7, 20, 12, 0, 0)); // miércoles; semanal tocaba lunes

      const todayRutina = makeRutina({
        fecha: new Date(2026, 7, 20, 12, 0, 0).toISOString(),
        historial: { bodyCare: { weekly: {} } },
        config: {
          bodyCare: {
            shower: { tipo: 'DIARIO', frecuencia: 1, activo: true },
            weekly: { tipo: 'SEMANAL', frecuencia: 1, activo: true, diasSemana: [1] },
          },
          nutricion: { water: { tipo: 'DIARIO', frecuencia: 1, activo: true } },
        },
      });

      const historicalRutina = makeRutina({
        fecha: new Date(2026, 7, 19, 12, 0, 0).toISOString(),
        historial: { bodyCare: { weekly: {} } },
        config: todayRutina.config,
      });

      const todayBuckets = groupRutinaHabitsByCadence({
        rutina: todayRutina,
        habits: mockHabits,
      });
      const historicalBuckets = groupRutinaHabitsByCadence({
        rutina: historicalRutina,
        habits: mockHabits,
      });

      const todayDiario = todayBuckets.find((b) => b.id === 'DIARIO');
      const historicalDiario = historicalBuckets.find((b) => b.id === 'DIARIO');
      const weeklyEntryToday = todayDiario?.today.find((h) => h.itemId === 'weekly');
      const weeklyEntryHistorical = historicalDiario?.today.find((h) => h.itemId === 'weekly');

      expect(weeklyEntryToday).toBeTruthy();
      expect(weeklyEntryToday?.isCadenciaDebt).toBe(true);
      expect(weeklyEntryHistorical).toBeFalsy();

      jest.useRealTimers();
    });
  });

  describe('sortSectionHabitsByFixedOrder', () => {
    it('sorts by orden then label', () => {
      const entries = [
        { itemId: 'weekly', label: 'Semanal' },
        { itemId: 'shower', label: 'Ducha' },
      ];
      const sorted = sortSectionHabitsByFixedOrder(entries, {
        section: 'bodyCare',
        habits: mockHabits,
      });
      expect(sorted.map((e) => e.itemId)).toEqual(['shower', 'weekly']);
    });
  });

  describe('getDefaultSelectedSection', () => {
    it('returns first section with incomplete items', () => {
      const rutina = makeRutina();
      expect(getDefaultSelectedSection(rutina, mockHabits)).toBe('bodyCare');
    });

    it('falls back to bodyCare when all complete', () => {
      const rutina = makeRutina({
        bodyCare: { shower: true, weekly: true },
        nutricion: { water: true },
      });
      expect(getDefaultSelectedSection(rutina, mockHabits)).toBe('bodyCare');
    });
  });

  describe('getHabitDisplayLabel', () => {
    it('uses user-edited label over legacy tooltip', () => {
      const habits = {
        ...mockHabits,
        bodyCare: [
          { id: 'bath', label: 'Mi ducha personalizada', icon: 'Bathtub', activo: true, orden: 0 },
        ],
      };
      expect(getHabitDisplayLabel('bodyCare', 'bath', habits)).toBe('Mi ducha personalizada');
    });
  });

  describe('RUTINA_SECTION_LABELS', () => {
    it('has labels for all sections', () => {
      HABIT_SECTIONS.forEach((section) => {
        expect(RUTINA_SECTION_LABELS[section]).toBeTruthy();
      });
    });
  });
});

describe('partitionDoneEntriesByRutinaDay', () => {
  it('places habits completed today in doneOnDay', () => {
    const rutina = makeRutina({
      bodyCare: { shower: true },
    });
    const entry = {
      section: 'bodyCare',
      itemId: 'shower',
      config: rutina.config.bodyCare.shower,
      itemValue: true,
    };
    const { doneOnDay, doneByQuota } = partitionDoneEntriesByRutinaDay([entry], rutina);
    expect(doneOnDay.map((e) => e.itemId)).toEqual(['shower']);
    expect(doneByQuota).toHaveLength(0);
  });

  it('places weekly quota met without today mark in doneByQuota', () => {
    const sunday = new Date(2026, 5, 21, 12, 0, 0, 0);
    const rutina = makeRutina({
      fecha: sunday.toISOString(),
      bodyCare: { weekly: false },
      historial: { bodyCare: { weekly: { '2026-06-16': true } } },
    });
    const entry = {
      section: 'bodyCare',
      itemId: 'weekly',
      config: rutina.config.bodyCare.weekly,
      itemValue: false,
    };
    const { doneOnDay, doneByQuota } = partitionDoneEntriesByRutinaDay([entry], rutina);
    expect(doneOnDay).toHaveLength(0);
    expect(doneByQuota.map((e) => e.itemId)).toEqual(['weekly']);
  });

  it('orders doneOnDay before doneByQuota when both present', () => {
    const sunday = new Date(2026, 5, 21, 12, 0, 0, 0);
    const rutina = makeRutina({
      fecha: sunday.toISOString(),
      bodyCare: { shower: true, weekly: false },
      historial: { bodyCare: { weekly: { '2026-06-16': true } } },
    });
    const entries = [
      {
        section: 'bodyCare',
        itemId: 'weekly',
        config: rutina.config.bodyCare.weekly,
        itemValue: false,
      },
      {
        section: 'bodyCare',
        itemId: 'shower',
        config: rutina.config.bodyCare.shower,
        itemValue: true,
      },
    ];
    const { doneOnDay, doneByQuota } = partitionDoneEntriesByRutinaDay(entries, rutina);
    expect(doneOnDay.map((e) => e.itemId)).toEqual(['shower']);
    expect(doneByQuota.map((e) => e.itemId)).toEqual(['weekly']);
  });

  it('sorts each done partition group by section and label', () => {
    const rutina = makeRutina({
      bodyCare: { shower: true, weekly: true },
      nutricion: { water: true },
    });
    const entries = [
      {
        section: 'nutricion',
        sectionLabel: 'Nutrición',
        itemId: 'water',
        label: 'Agua',
        config: rutina.config.nutricion.water,
        itemValue: true,
      },
      {
        section: 'bodyCare',
        sectionLabel: 'Cuidado Personal',
        itemId: 'shower',
        label: 'Ducha',
        config: rutina.config.bodyCare.shower,
        itemValue: true,
      },
    ];
    const { doneOnDay } = partitionDoneEntriesByRutinaDay(entries, rutina);
    expect(doneOnDay.map((e) => e.itemId)).toEqual(['shower', 'water']);
  });

  it('on historical day keeps partial multi-franja in sin marcar until all franjas done', () => {
    const historicalDate = new Date(2026, 5, 20).toISOString();
    const rutina = makeRutina({
      fecha: historicalDate,
      bodyCare: {
        teeth: { MAÑANA: true, NOCHE: false },
      },
      config: {
        ...makeRutina().config,
        bodyCare: {
          ...makeRutina().config.bodyCare,
          teeth: {
            tipo: 'DIARIO',
            frecuencia: 1,
            activo: true,
            horarios: ['MAÑANA', 'NOCHE'],
          },
        },
      },
    });
    const entry = {
      section: 'bodyCare',
      itemId: 'teeth',
      config: rutina.config.bodyCare.teeth,
      itemValue: { MAÑANA: true, NOCHE: false },
    };
    expect(isHabitCompletedOnRutinaDay({
      ...entry,
      rutina,
    })).toBe(false);
    const { doneOnDay } = partitionDoneEntriesByRutinaDay([entry], rutina);
    expect(doneOnDay.map((e) => e.itemId)).toEqual([]);
  });

  it('on historical day keeps quota-satisfied unmarked habits in sin marcar, not done', () => {
    const historicalDate = new Date(2026, 5, 18).toISOString(); // Thursday
    const rutina = makeRutina({
      fecha: historicalDate,
      bodyCare: { gym: false },
      config: {
        bodyCare: {
          gym: {
            tipo: 'SEMANAL',
            frecuencia: 2,
            periodo: 'CADA_SEMANA',
            diasSemana: [1, 4],
            activo: true,
          },
        },
      },
      historial: {
        bodyCare: {
          gym: { '2026-06-15': true, '2026-06-16': true },
        },
      },
    });
    const entry = {
      section: 'bodyCare',
      itemId: 'gym',
      config: rutina.config.bodyCare.gym,
      itemValue: false,
    };
    expect(resolveRutinaScheduleBucket(entry, { rutina })).toBe('today');
    const { done } = groupSectionHabitsByDaySchedule({
      section: 'bodyCare',
      rutina,
      habits: { bodyCare: [{ id: 'gym', label: 'Gym', icon: 'FitnessCenter', activo: true, orden: 0 }] },
    });
    expect(done.map((h) => h.itemId)).not.toContain('gym');
  });
});

describe('filterRutinaDoneSectionEntries', () => {
  it('includes franja-level partial marks when entry carries franjaKey', () => {
    const rutina = makeRutina({
      bodyCare: {
        teeth: { MAÑANA: true, NOCHE: false },
      },
      config: {
        ...makeRutina().config,
        bodyCare: {
          ...makeRutina().config.bodyCare,
          teeth: {
            tipo: 'DIARIO',
            frecuencia: 1,
            activo: true,
            horarios: ['MAÑANA', 'NOCHE'],
          },
        },
      },
    });
    const entry = {
      section: 'bodyCare',
      itemId: 'teeth',
      config: rutina.config.bodyCare.teeth,
      itemValue: { MAÑANA: true, NOCHE: false },
      franjaKey: 'MAÑANA',
    };
    expect(isHabitCompletedOnRutinaDay({ ...entry, rutina })).toBe(false);
    expect(filterRutinaDoneSectionEntries([entry], rutina).map((e) => e.franjaKey)).toEqual(['MAÑANA']);
  });

  it('excludes partial completion when config has multiple horarios but tipo is not DIARIO', () => {
    const rutina = makeRutina({
      bodyCare: {
        skincare: { MAÑANA: true, TARDE: false },
      },
      config: {
        ...makeRutina().config,
        bodyCare: {
          ...makeRutina().config.bodyCare,
          skincare: {
            tipo: 'PERSONALIZADO',
            periodo: 'CADA_DIA',
            frecuencia: 1,
            activo: true,
            horarios: ['MAÑANA', 'TARDE'],
          },
        },
      },
    });
    const entry = {
      section: 'bodyCare',
      itemId: 'skincare',
      config: rutina.config.bodyCare.skincare,
      itemValue: { MAÑANA: true, TARDE: false },
    };
    expect(isHabitCompletedOnRutinaDay({ ...entry, rutina })).toBe(false);
    expect(resolveRutinaScheduleBucket(entry, { rutina })).toBe('today');
    expect(filterRutinaDoneSectionEntries([entry], rutina)).toEqual([]);
  });

  it('excludes stale franja keys not in config from Hecho', () => {
    const rutina = makeRutina({
      fecha: getNormalizedToday().toISOString(),
      bodyCare: {
        skincare: { MAÑANA: true, TARDE: false },
      },
      config: {
        ...makeRutina().config,
        bodyCare: {
          ...makeRutina().config.bodyCare,
          skincare: {
            tipo: 'DIARIO',
            frecuencia: 1,
            activo: true,
            horarios: ['TARDE'],
          },
        },
      },
    });
    const entry = {
      section: 'bodyCare',
      itemId: 'skincare',
      config: rutina.config.bodyCare.skincare,
      itemValue: { MAÑANA: true, TARDE: false },
    };
    expect(isHabitMarkedCompleteForConfig(entry.config, entry.itemValue)).toBe(false);
    expect(resolveRutinaScheduleBucket(entry, { rutina })).toBe('today');
    expect(filterRutinaDoneSectionEntries([entry], rutina)).toEqual([]);
  });

  it('excludes partial multi-franja entries without franjaKey', () => {
    const rutina = makeRutina({
      bodyCare: {
        teeth: { MAÑANA: true, NOCHE: false },
      },
      config: {
        ...makeRutina().config,
        bodyCare: {
          ...makeRutina().config.bodyCare,
          teeth: {
            tipo: 'DIARIO',
            frecuencia: 1,
            activo: true,
            horarios: ['MAÑANA', 'NOCHE'],
          },
        },
      },
    });
    const entry = {
      section: 'bodyCare',
      itemId: 'teeth',
      config: rutina.config.bodyCare.teeth,
      itemValue: { MAÑANA: true, NOCHE: false },
    };
    expect(filterRutinaDoneSectionEntries([entry], rutina)).toEqual([]);
  });

  it('buildRutinaGlobalDoneItems keeps only marked habits on today', () => {
    const rutina = makeRutina({
      fecha: getNormalizedToday().toISOString(),
      bodyCare: { shower: true, weekly: false },
    });
    const showerEntry = {
      section: 'bodyCare',
      itemId: 'shower',
      config: rutina.config.bodyCare.shower,
      itemValue: true,
    };
    const weeklyEntry = {
      section: 'bodyCare',
      itemId: 'weekly',
      config: rutina.config.bodyCare.weekly,
      itemValue: false,
    };
    const buckets = [
      {
        id: 'DIARIO',
        items: [showerEntry, weeklyEntry],
        done: [showerEntry],
      },
      {
        id: 'SEMANAL',
        items: [weeklyEntry],
        done: [weeklyEntry],
      },
    ];
    expect(buildRutinaGlobalDoneItems(buckets, rutina).map((e) => e.itemId)).toEqual(['shower']);
  });

  it('collapses full-day completions duplicated per franja in Hecho', () => {
    const rutina = makeRutina({
      fecha: new Date(2026, 7, 30, 12, 0, 0).toISOString(),
      bodyCare: {
        skincare: { MAÑANA: true, TARDE: true, NOCHE: true },
      },
      config: {
        ...makeRutina().config,
        bodyCare: {
          ...makeRutina().config.bodyCare,
          skincare: {
            tipo: 'DIARIO',
            frecuencia: 1,
            activo: true,
            horarios: ['MAÑANA', 'TARDE', 'NOCHE'],
          },
        },
      },
    });
    const baseEntry = {
      section: 'bodyCare',
      itemId: 'skincare',
      config: rutina.config.bodyCare.skincare,
      itemValue: rutina.bodyCare.skincare,
    };
    const duplicated = ['MAÑANA', 'TARDE', 'NOCHE'].map((franjaKey) => ({ ...baseEntry, franjaKey }));

    expect(filterRutinaDoneSectionEntries(duplicated, rutina)).toHaveLength(1);
    expect(filterRutinaDoneSectionEntries(duplicated, rutina)[0].franjaKey).toBeUndefined();
  });

  it('keeps fully completed habits in Hecho and drops quota-only on today', () => {
    const rutina = makeRutina({
      fecha: getNormalizedToday().toISOString(),
      bodyCare: { shower: true },
    });
    const marked = {
      section: 'bodyCare',
      itemId: 'shower',
      config: rutina.config.bodyCare.shower,
      itemValue: true,
    };
    const quotaMet = makeQuotaMetWeeklyRutina();
    const weeklyEntry = {
      section: 'bodyCare',
      itemId: 'weekly',
      config: quotaMet.config.bodyCare.weekly,
      itemValue: false,
    };
    expect(filterRutinaDoneSectionEntries([marked], rutina).map((e) => e.itemId)).toEqual(['shower']);
    expect(filterRutinaDoneSectionEntries([weeklyEntry], quotaMet)).toEqual([]);
  });

  it('getRutinaMarkedDoneTodayEntries aligns Rutinas Hecho with Tareas carousel expand', () => {
    const rutina = makeRutina({
      fecha: getNormalizedToday().toISOString(),
      bodyCare: { shower: true },
    });
    const habits = {
      bodyCare: [{ id: 'shower', label: 'Shower', icon: 'Shower', activo: true, orden: 0 }],
    };
    const iconsMap = { bodyCare: { shower: () => null } };

    const doneEntries = getRutinaMarkedDoneTodayEntries({
      rutina,
      habits,
      iconsMap,
    });
    const carouselItems = mapRutinaDoneEntriesToCarouselItems(doneEntries);

    expect(doneEntries.map((e) => e.itemId)).toEqual(['shower']);
    expect(carouselItems).toEqual([{ section: 'bodyCare', itemId: 'shower' }]);
  });
});

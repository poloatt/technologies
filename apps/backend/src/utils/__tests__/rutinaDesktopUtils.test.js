import {
  categorizeSectionHabits,
  groupSectionHabitsByDaySchedule,
  getSectionCarouselItems,
  sortSectionHabitsByFixedOrder,
  getDefaultSelectedSection,
  RUTINA_SECTION_LABELS,
  HABIT_SECTIONS,
  getHabitDisplayLabel,
} from '@shared/habits';
import { getNormalizedToday } from '@shared/utils/dateUtils.js';

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
    ...overrides,
  };
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
      const tuesday = new Date(2026, 5, 23, 12, 0, 0, 0);
      const rutina = makeRutina({
        fecha: tuesday.toISOString(),
        historial: { bodyCare: { weekly: {} } },
      });
      const { incomplete, notScheduled } = categorizeSectionHabits({
        section: 'bodyCare',
        rutina,
        habits: mockHabits,
      });
      const weekly = incomplete.find((h) => h.itemId === 'weekly');
      expect(weekly).toBeTruthy();
      expect(weekly.isCadenciaDebt).toBe(true);
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
      const sunday = new Date(2026, 5, 21, 12, 0, 0, 0);
      const rutina = makeRutina({
        fecha: sunday.toISOString(),
        historial: { bodyCare: { weekly: { '2026-06-16': true } } },
      });
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
      const tuesday = new Date(2026, 5, 23, 12, 0, 0, 0);
      const rutina = makeRutina({
        fecha: tuesday.toISOString(),
        historial: { bodyCare: { weekly: {} } },
      });
      const { today, todayPending } = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina,
        habits: mockHabits,
      });
      const ids = today.map((h) => h.itemId);
      expect(ids).toEqual(['shower', 'weekly']);
      expect(todayPending.find((h) => h.itemId === 'weekly')?.isCadenciaDebt).toBe(true);
    });

    it('places interval personalizado habit (cada 4d) in Hecho when resting, not notToday', () => {
      const today = new Date(2026, 5, 25, 12, 0, 0, 0);
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
        historial: { bodyCare: { shave: { '2026-06-24': true } } },
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
      const rutina = makeRutina({
        fecha: '2026-06-22T00:00:00.000Z',
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
      expect(items.map((h) => h.carouselSlot)).toEqual(['ahora', 'luego', 'luego', 'notToday']);
      expect(items.map((h) => h.itemId)).toEqual(['shower', 'nightly', 'weekly', 'tuesdayOnly']);
    });

    it('removes done habits from carousel when marking cadencia debt complete', () => {
      const tuesday = new Date(2026, 5, 23, 12, 0, 0, 0);
      const rutinaPending = makeRutina({
        fecha: tuesday.toISOString(),
        historial: { bodyCare: { weekly: {} } },
      });
      const rutinaDone = makeRutina({
        fecha: tuesday.toISOString(),
        bodyCare: { weekly: true },
        historial: { bodyCare: { weekly: { '2026-06-23': true } } },
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

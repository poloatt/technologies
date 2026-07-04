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
      const { today, todayCompleted, todayPending, notToday } = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina,
        habits: mockHabits,
      });
      expect(today.map((h) => h.itemId)).toEqual(['shower', 'weekly']);
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
      const done = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina: rutinaDone,
        habits: mockHabits,
      });
      expect(pending.today.map((h) => h.itemId)).toEqual(done.today.map((h) => h.itemId));
    });

    it('places off-schedule habits in notToday', () => {
      const sunday = new Date(2026, 5, 21, 12, 0, 0, 0);
      const rutina = makeRutina({
        fecha: sunday.toISOString(),
        historial: { bodyCare: { weekly: { '2026-06-16': true } } },
      });
      const { notToday, today } = groupSectionHabitsByDaySchedule({
        section: 'bodyCare',
        rutina,
        habits: mockHabits,
      });
      expect(notToday.map((h) => h.itemId)).toContain('weekly');
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
  });

  describe('getSectionCarouselItems', () => {
    it('returns habits in fixed orden regardless of completion', () => {
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
      expect(doneIds).toEqual(pendingIds);
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

    it('keeps carousel slot and order when marking cadencia debt complete', () => {
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
      expect(pending.map((h) => h.itemId)).toEqual(done.map((h) => h.itemId));
      expect(pending.map((h) => h.carouselSlot)).toEqual(done.map((h) => h.carouselSlot));
      expect(done.find((h) => h.itemId === 'weekly')?.carouselSlot).toBe('notToday');
    });

    it('keeps slot when marking a scheduled-day habit complete', () => {
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
      expect(pending.map((h) => h.itemId)).toEqual(done.map((h) => h.itemId));
      expect(pending.map((h) => h.carouselSlot)).toEqual(done.map((h) => h.carouselSlot));
      expect(done.find((h) => h.itemId === 'weekly')?.carouselSlot).not.toBe('notToday');
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

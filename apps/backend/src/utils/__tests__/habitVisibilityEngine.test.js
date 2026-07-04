import { jest } from '@jest/globals';
import {
  getCarouselAhoraItems,
  getCarouselLuegoItems,
  shouldShowInTracker,
  isFlexiblePeriodic,
  getPeriodicCarouselMode,
  resolveCarouselItemConfig,
  resolveRutinaItemConfig,
} from '@shared/habits';
import { startOfWeek, addDays } from 'date-fns';

const sectionIconsMap = {
  iconsMap: {
    ejercicio: { gym: () => null },
  },
  labelsMap: {
    ejercicio: { gym: 'Gym' },
  },
};

const habits = {
  ejercicio: [{ id: 'gym', label: 'Gym', icon: 'FitnessCenter', activo: true, orden: 0 }],
};

function buildRutina(overrides = {}) {
  return {
    _id: 'rutina-1',
    fecha: new Date().toISOString(),
    historial: { ejercicio: { gym: {} } },
    ejercicio: {},
    config: {
      ejercicio: {
        gym: {
          tipo: 'DIARIO',
          frecuencia: 1,
          activo: true,
          periodo: 'CADA_DIA',
          horarios: [],
        },
      },
    },
    ...overrides,
  };
}

function buildGymConfig(overrides = {}) {
  return {
    tipo: 'SEMANAL',
    frecuencia: 3,
    activo: true,
    periodo: 'CADA_SEMANA',
    diasSemana: [],
    horarios: ['MAÑANA'],
    ...overrides,
  };
}

function buildFlexibleGymRutina(overrides = {}) {
  return buildRutina({
    config: {
      ejercicio: {
        gym: buildGymConfig(),
      },
    },
    ...overrides,
  });
}

describe('habitVisibilityEngine', () => {
  describe('getCarouselAhoraItems', () => {
    it('includes pending daily habits', () => {
      const items = getCarouselAhoraItems({
        rutinaHoy: buildRutina(),
        sectionIconsMap,
        habits,
        currentTimeOfDay: 'MAÑANA',
      });
      expect(items).toEqual([{ section: 'ejercicio', itemId: 'gym' }]);
    });

    it('excludes completed daily habits', () => {
      const rutinaHoy = buildRutina({
        ejercicio: { gym: true },
        historial: {
          ejercicio: {
            gym: { [new Date().toISOString().split('T')[0]]: true },
          },
        },
      });

      const items = getCarouselAhoraItems({
        rutinaHoy,
        sectionIconsMap,
        habits,
        currentTimeOfDay: 'MAÑANA',
      });

      expect(items).toEqual([]);
    });

    it('shows overdue morning slot in Ahora during TARDE and night slot in Luego', () => {
      const cuidadoIconsMap = {
        iconsMap: {
          bodyCare: { cuidadoBucal: () => null },
        },
        labelsMap: {
          bodyCare: { cuidadoBucal: 'Cuidado bucal' },
        },
      };
      const cuidadoHabits = {
        bodyCare: [{ id: 'cuidadoBucal', label: 'Cuidado bucal', icon: 'Tooth', activo: true, orden: 0 }],
      };
      const rutinaHoy = buildRutina({
        config: {
          bodyCare: {
            cuidadoBucal: {
              tipo: 'DIARIO',
              frecuencia: 2,
              activo: true,
              periodo: 'CADA_DIA',
              horarios: ['MAÑANA', 'NOCHE'],
            },
          },
        },
      });

      const tardeItems = getCarouselAhoraItems({
        rutinaHoy,
        sectionIconsMap: cuidadoIconsMap,
        habits: cuidadoHabits,
        currentTimeOfDay: 'TARDE',
      });
      expect(tardeItems).toEqual([
        { section: 'bodyCare', itemId: 'cuidadoBucal', horario: 'MAÑANA' },
      ]);

      const tardeLuego = getCarouselLuegoItems({
        rutinaHoy,
        sectionIconsMap: cuidadoIconsMap,
        habits: cuidadoHabits,
        currentTimeOfDay: 'TARDE',
      });
      expect(tardeLuego).toEqual([
        { section: 'bodyCare', itemId: 'cuidadoBucal', horario: 'NOCHE' },
      ]);

      const mananaItems = getCarouselAhoraItems({
        rutinaHoy,
        sectionIconsMap: cuidadoIconsMap,
        habits: cuidadoHabits,
        currentTimeOfDay: 'MAÑANA',
      });
      expect(mananaItems).toEqual([{ section: 'bodyCare', itemId: 'cuidadoBucal', horario: 'MAÑANA' }]);
    });

    it('hides completed current slot from ahora and keeps future slot for luego', () => {
      const iconsMap = {
        iconsMap: { bodyCare: { cuidadoBucal: () => null } },
        labelsMap: { bodyCare: { cuidadoBucal: 'Cuidado bucal' } },
      };
      const habitList = {
        bodyCare: [{ id: 'cuidadoBucal', label: 'Cuidado bucal', icon: 'Tooth', activo: true, orden: 0 }],
      };
      const rutinaHoy = buildRutina({
        bodyCare: { cuidadoBucal: { MAÑANA: true } },
        config: {
          bodyCare: {
            cuidadoBucal: {
              tipo: 'DIARIO',
              frecuencia: 2,
              activo: true,
              periodo: 'CADA_DIA',
              horarios: ['MAÑANA', 'NOCHE'],
            },
          },
        },
      });

      const ahoraItems = getCarouselAhoraItems({
        rutinaHoy,
        sectionIconsMap: iconsMap,
        habits: habitList,
        currentTimeOfDay: 'MAÑANA',
      });
      expect(ahoraItems).toEqual([]);

      const luegoItems = getCarouselLuegoItems({
        rutinaHoy,
        sectionIconsMap: iconsMap,
        habits: habitList,
        currentTimeOfDay: 'MAÑANA',
      });
      expect(luegoItems).toEqual([{ section: 'bodyCare', itemId: 'cuidadoBucal', horario: 'NOCHE' }]);
    });

    it('shows overdue and current slots together in Ahora at NOCHE', () => {
      const iconsMap = {
        iconsMap: { bodyCare: { cuidadoBucal: () => null } },
        labelsMap: { bodyCare: { cuidadoBucal: 'Cuidado bucal' } },
      };
      const habitList = {
        bodyCare: [{ id: 'cuidadoBucal', label: 'Cuidado bucal', icon: 'Tooth', activo: true, orden: 0 }],
      };
      const rutinaHoy = buildRutina({
        config: {
          bodyCare: {
            cuidadoBucal: {
              tipo: 'DIARIO',
              frecuencia: 2,
              activo: true,
              periodo: 'CADA_DIA',
              horarios: ['MAÑANA', 'NOCHE'],
            },
          },
        },
      });

      const ahoraItems = getCarouselAhoraItems({
        rutinaHoy,
        sectionIconsMap: iconsMap,
        habits: habitList,
        currentTimeOfDay: 'NOCHE',
      });
      expect(ahoraItems).toEqual([
        { section: 'bodyCare', itemId: 'cuidadoBucal', horario: 'MAÑANA' },
        { section: 'bodyCare', itemId: 'cuidadoBucal', horario: 'NOCHE' },
      ]);

      const luegoItems = getCarouselLuegoItems({
        rutinaHoy,
        sectionIconsMap: iconsMap,
        habits: habitList,
        currentTimeOfDay: 'NOCHE',
      });
      expect(luegoItems).toEqual([]);
    });

    it('moves pending night slot to ahora when it is NOCHE', () => {
      const iconsMap = {
        iconsMap: { bodyCare: { cuidadoBucal: () => null } },
        labelsMap: { bodyCare: { cuidadoBucal: 'Cuidado bucal' } },
      };
      const habitList = {
        bodyCare: [{ id: 'cuidadoBucal', label: 'Cuidado bucal', icon: 'Tooth', activo: true, orden: 0 }],
      };
      const rutinaHoy = buildRutina({
        bodyCare: { cuidadoBucal: { MAÑANA: true } },
        config: {
          bodyCare: {
            cuidadoBucal: {
              tipo: 'DIARIO',
              frecuencia: 2,
              activo: true,
              periodo: 'CADA_DIA',
              horarios: ['MAÑANA', 'NOCHE'],
            },
          },
        },
      });

      const ahoraItems = getCarouselAhoraItems({
        rutinaHoy,
        sectionIconsMap: iconsMap,
        habits: habitList,
        currentTimeOfDay: 'NOCHE',
      });
      expect(ahoraItems).toEqual([{ section: 'bodyCare', itemId: 'cuidadoBucal', horario: 'NOCHE' }]);

      const luegoItems = getCarouselLuegoItems({
        rutinaHoy,
        sectionIconsMap: iconsMap,
        habits: habitList,
        currentTimeOfDay: 'NOCHE',
      });
      expect(luegoItems).toEqual([]);
    });

    it('puts future-only daily slot in Luego until its window', () => {
      const iconsMap = {
        iconsMap: { bodyCare: { ducha: () => null } },
        labelsMap: { bodyCare: { ducha: 'Ducha' } },
      };
      const habitList = {
        bodyCare: [{ id: 'ducha', label: 'Ducha', icon: 'Shower', activo: true, orden: 0 }],
      };
      const rutinaHoy = buildRutina({
        config: {
          bodyCare: {
            ducha: {
              tipo: 'DIARIO',
              frecuencia: 1,
              activo: true,
              periodo: 'CADA_DIA',
              horarios: ['NOCHE'],
            },
          },
        },
      });

      expect(getCarouselAhoraItems({
        rutinaHoy,
        sectionIconsMap: iconsMap,
        habits: habitList,
        currentTimeOfDay: 'MAÑANA',
      })).toEqual([]);

      expect(getCarouselLuegoItems({
        rutinaHoy,
        sectionIconsMap: iconsMap,
        habits: habitList,
        currentTimeOfDay: 'MAÑANA',
      })).toEqual([{ section: 'bodyCare', itemId: 'ducha', horario: 'NOCHE' }]);
    });
  });

  describe('flexible periodic (gym 3x/sem)', () => {
    it('detects flexible weekly habits without fixed days', () => {
      expect(isFlexiblePeriodic(buildGymConfig())).toBe(true);
      expect(isFlexiblePeriodic(buildGymConfig({ diasSemana: [1] }))).toBe(false);
    });

    it('shows gym in Ahora during MAÑANA with cadence 0/3', () => {
      const rutinaHoy = buildFlexibleGymRutina();
      const params = {
        rutinaHoy,
        sectionIconsMap,
        habits,
        currentTimeOfDay: 'MAÑANA',
      };

      expect(getCarouselAhoraItems(params)).toEqual([{ section: 'ejercicio', itemId: 'gym' }]);
      expect(getCarouselLuegoItems(params)).toEqual([]);
    });

    it('hides gym after marking complete today', () => {
      const today = new Date().toISOString().split('T')[0];
      const rutinaHoy = buildFlexibleGymRutina({
        ejercicio: { gym: true },
        historial: { ejercicio: { gym: { [today]: true } } },
      });
      const params = {
        rutinaHoy,
        sectionIconsMap,
        habits,
        currentTimeOfDay: 'MAÑANA',
      };

      expect(getCarouselAhoraItems(params)).toEqual([]);
      expect(getCarouselLuegoItems(params)).toEqual([]);
    });

    it('shows gym in Luego after MAÑANA window if not completed today', () => {
      const rutinaHoy = buildFlexibleGymRutina();
      const params = {
        rutinaHoy,
        sectionIconsMap,
        habits,
        currentTimeOfDay: 'TARDE',
      };

      expect(getPeriodicCarouselMode(
        buildGymConfig(),
        rutinaHoy,
        'ejercicio',
        'gym',
        'TARDE',
      )).toBe('luego');
      expect(getCarouselAhoraItems(params)).toEqual([]);
      expect(getCarouselLuegoItems(params)).toEqual([{ section: 'ejercicio', itemId: 'gym' }]);
    });

    it('hides gym when weekly quota is met', () => {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const historialGym = [0, 1, 2].reduce((acc, offset) => {
        const fecha = addDays(weekStart, offset).toISOString().split('T')[0];
        acc[fecha] = true;
        return acc;
      }, {});
      const rutinaHoy = buildFlexibleGymRutina({
        historial: { ejercicio: { gym: historialGym } },
      });
      const params = {
        rutinaHoy,
        sectionIconsMap,
        habits,
        currentTimeOfDay: 'MAÑANA',
      };

      expect(getCarouselAhoraItems(params)).toEqual([]);
      expect(getCarouselLuegoItems(params)).toEqual([]);
    });
  });

  describe('periodic frequency placement', () => {
    const peluIconsMap = {
      iconsMap: { bodyCare: { peluqueria: () => null } },
      labelsMap: { bodyCare: { peluqueria: 'Peluquería' } },
    };
    const peluHabits = {
      bodyCare: [{ id: 'peluqueria', label: 'Peluquería', icon: 'Cut', activo: true, orden: 0 }],
    };

    it('shows monthly 1x habit in Luego mid-month (not urgent)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 5, 15, 10, 0, 0));

      const rutinaHoy = buildRutina({
        config: {
          bodyCare: {
            peluqueria: {
              tipo: 'MENSUAL',
              frecuencia: 1,
              activo: true,
              periodo: 'CADA_MES',
              diasMes: [],
              horarios: [],
            },
          },
        },
      });
      const params = {
        rutinaHoy,
        sectionIconsMap: peluIconsMap,
        habits: peluHabits,
        currentTimeOfDay: 'MAÑANA',
      };

      expect(getPeriodicCarouselMode(
        rutinaHoy.config.bodyCare.peluqueria,
        rutinaHoy,
        'bodyCare',
        'peluqueria',
        'MAÑANA',
      )).toBe('luego');
      expect(getCarouselAhoraItems(params)).toEqual([]);
      expect(getCarouselLuegoItems(params)).toEqual([{ section: 'bodyCare', itemId: 'peluqueria' }]);

      jest.useRealTimers();
    });

    it('shows monthly 1x habit in Ahora on last day of month (urgent)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 5, 30, 10, 0, 0));

      const rutinaHoy = buildRutina({
        config: {
          bodyCare: {
            peluqueria: {
              tipo: 'MENSUAL',
              frecuencia: 1,
              activo: true,
              periodo: 'CADA_MES',
              diasMes: [],
              horarios: [],
            },
          },
        },
      });
      const params = {
        rutinaHoy,
        sectionIconsMap: peluIconsMap,
        habits: peluHabits,
        currentTimeOfDay: 'MAÑANA',
      };

      expect(getPeriodicCarouselMode(
        rutinaHoy.config.bodyCare.peluqueria,
        rutinaHoy,
        'bodyCare',
        'peluqueria',
        'MAÑANA',
      )).toBe('ahora');
      expect(getCarouselAhoraItems(params)).toEqual([{ section: 'bodyCare', itemId: 'peluqueria' }]);
      expect(getCarouselLuegoItems(params)).toEqual([]);

      jest.useRealTimers();
    });

    it('shows weekly 1x habit in Luego when not urgent', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 5, 16, 10, 0, 0));

      const rutinaHoy = buildRutina({
        config: {
          ejercicio: {
            gym: {
              tipo: 'SEMANAL',
              frecuencia: 1,
              activo: true,
              periodo: 'CADA_SEMANA',
              diasSemana: [],
              horarios: [],
            },
          },
        },
      });
      const params = {
        rutinaHoy,
        sectionIconsMap,
        habits,
        currentTimeOfDay: 'MAÑANA',
      };

      expect(getCarouselAhoraItems(params)).toEqual([]);
      expect(getCarouselLuegoItems(params)).toEqual([{ section: 'ejercicio', itemId: 'gym' }]);

      jest.useRealTimers();
    });
  });

  describe('getCarouselLuegoItems', () => {
    it('includes flexible weekly habits without horarios in Ahora only', () => {
      const rutinaHoy = buildRutina({
        config: {
          ejercicio: {
            gym: {
              tipo: 'SEMANAL',
              frecuencia: 3,
              activo: true,
              periodo: 'CADA_SEMANA',
              diasSemana: [],
              horarios: [],
            },
          },
        },
      });

      const params = {
        rutinaHoy,
        sectionIconsMap,
        habits,
        currentTimeOfDay: 'MAÑANA',
      };

      expect(getCarouselAhoraItems(params)).toEqual([{ section: 'ejercicio', itemId: 'gym' }]);
      expect(getCarouselLuegoItems(params)).toEqual([]);
    });

    it('excludes simple daily habits without horarios', () => {
      const items = getCarouselLuegoItems({
        rutinaHoy: buildRutina(),
        sectionIconsMap,
        habits,
        currentTimeOfDay: 'MAÑANA',
      });
      expect(items).toEqual([]);
    });
  });

  describe('resolveCarouselItemConfig', () => {
    it('prefers preferences over rutina for tipo and empty horarios', () => {
      const rutinaHoy = buildRutina({
        config: {
          nutricion: {
            protein: {
              tipo: 'SEMANAL',
              frecuencia: 1,
              periodo: 'CADA_SEMANA',
              horarios: ['NOCHE'],
              activo: true,
            },
          },
        },
      });
      const habitsPreferences = {
        nutricion: {
          protein: {
            tipo: 'DIARIO',
            frecuencia: 1,
            periodo: 'CADA_DIA',
            horarios: [],
            activo: true,
          },
        },
      };

      const merged = resolveCarouselItemConfig('nutricion', 'protein', rutinaHoy, habitsPreferences);
      expect(merged.tipo).toBe('DIARIO');
      expect(merged.horarios).toEqual([]);
    });
  });

  describe('preferences vs rutina carousel placement', () => {
    const proteinIconsMap = {
      iconsMap: { nutricion: { protein: () => null } },
      labelsMap: { nutricion: { protein: 'Proteína' } },
    };
    const proteinHabits = {
      nutricion: [{ id: 'protein', label: 'Proteína', icon: 'SetMeal', activo: true, orden: 0 }],
    };

    it('daily protein without franja in prefs shows only in Ahora despite rutina NOCHE', () => {
      const rutinaHoy = buildRutina({
        config: {
          nutricion: {
            protein: {
              tipo: 'SEMANAL',
              frecuencia: 1,
              periodo: 'CADA_SEMANA',
              horarios: ['NOCHE'],
              activo: true,
            },
          },
        },
      });
      const habitsPreferences = {
        nutricion: {
          protein: {
            tipo: 'DIARIO',
            frecuencia: 1,
            periodo: 'CADA_DIA',
            horarios: [],
            activo: true,
          },
        },
      };
      const params = {
        rutinaHoy,
        sectionIconsMap: proteinIconsMap,
        habits: proteinHabits,
        currentTimeOfDay: 'MAÑANA',
        habitsPreferences,
      };

      expect(getCarouselAhoraItems(params)).toEqual([{ section: 'nutricion', itemId: 'protein' }]);
      expect(getCarouselLuegoItems(params)).toEqual([]);
    });

    it('gym 3x/week with future NOCHE franja shows in Luego during MAÑANA', () => {
      const rutinaHoy = buildFlexibleGymRutina({
        config: {
          ejercicio: {
            gym: buildGymConfig({ horarios: ['NOCHE'] }),
          },
        },
      });
      const habitsPreferences = {
        ejercicio: {
          gym: buildGymConfig({ horarios: ['NOCHE'] }),
        },
      };
      const params = {
        rutinaHoy,
        sectionIconsMap,
        habits,
        currentTimeOfDay: 'MAÑANA',
        habitsPreferences,
      };

      expect(getPeriodicCarouselMode(
        resolveCarouselItemConfig('ejercicio', 'gym', rutinaHoy, habitsPreferences),
        rutinaHoy,
        'ejercicio',
        'gym',
        'MAÑANA',
      )).toBe('luego');
      expect(getCarouselAhoraItems(params)).toEqual([]);
      expect(getCarouselLuegoItems(params)).toEqual([{ section: 'ejercicio', itemId: 'gym' }]);
    });
  });

  describe('resolveRutinaItemConfig', () => {
    it('merges user preferences over rutina snapshot for today', () => {
      const rutinaHoy = buildRutina({
        config: {
          ejercicio: {
            gym: {
              tipo: 'DIARIO',
              frecuencia: 1,
              activo: true,
              periodo: 'CADA_DIA',
              horarios: ['MAÑANA'],
            },
          },
        },
      });
      const habitsPreferences = {
        ejercicio: {
          gym: {
            tipo: 'SEMANAL',
            frecuencia: 3,
            periodo: 'CADA_SEMANA',
            horarios: ['NOCHE'],
            activo: true,
          },
        },
      };

      const resolved = resolveRutinaItemConfig('ejercicio', 'gym', rutinaHoy, habitsPreferences);
      expect(resolved.tipo).toBe('SEMANAL');
      expect(resolved.frecuencia).toBe(3);
      expect(resolved.horarios).toEqual(['NOCHE']);
    });

    it('uses rutina snapshot only for historical days', () => {
      const historicalDate = new Date('2020-01-15T12:00:00.000Z');
      const rutinaHistorica = buildRutina({
        fecha: historicalDate.toISOString(),
        config: {
          ejercicio: {
            gym: {
              tipo: 'DIARIO',
              frecuencia: 1,
              activo: true,
              periodo: 'CADA_DIA',
              horarios: ['MAÑANA'],
            },
          },
        },
      });
      const habitsPreferences = {
        ejercicio: {
          gym: {
            tipo: 'SEMANAL',
            frecuencia: 5,
            periodo: 'CADA_SEMANA',
            horarios: ['NOCHE'],
            activo: true,
          },
        },
      };

      const resolved = resolveRutinaItemConfig(
        'ejercicio',
        'gym',
        rutinaHistorica,
        habitsPreferences,
      );
      expect(resolved.tipo).toBe('DIARIO');
      expect(resolved.horarios).toEqual(['MAÑANA']);
    });
  });

  describe('cadencia carry-over carousel', () => {
    const tuesday = new Date(2026, 5, 23, 12, 0, 0, 0);

    it('shows fixed weekly carry-over in Luego on non-scheduled day', () => {
      const rutinaHoy = buildRutina({
        fecha: tuesday.toISOString(),
        config: {
          ejercicio: {
            gym: buildGymConfig({ diasSemana: [1], frecuencia: 1, horarios: [] }),
          },
        },
      });

      const luego = getCarouselLuegoItems({
        rutinaHoy,
        sectionIconsMap,
        habits,
        currentTimeOfDay: 'MAÑANA',
      });
      const ahora = getCarouselAhoraItems({
        rutinaHoy,
        sectionIconsMap,
        habits,
        currentTimeOfDay: 'MAÑANA',
      });

      expect(luego).toEqual([{ section: 'ejercicio', itemId: 'gym' }]);
      expect(ahora).toEqual([]);
    });

    it('shows f>1 fixed weekly carry-over in Luego on non-scheduled day', () => {
      const rutinaHoy = buildRutina({
        fecha: tuesday.toISOString(),
        config: {
          ejercicio: {
            gym: buildGymConfig({ diasSemana: [1, 3], frecuencia: 2, horarios: [] }),
          },
        },
      });

      expect(getPeriodicCarouselMode(
        buildGymConfig({ diasSemana: [1, 3], frecuencia: 2, horarios: [] }),
        rutinaHoy,
        'ejercicio',
        'gym',
        'MAÑANA',
      )).toBe('luego');
    });

    it('counts catch-up completion on non-scheduled day toward weekly quota', () => {
      const rutinaHoy = buildRutina({
        fecha: tuesday.toISOString(),
        ejercicio: { gym: true },
        historial: {
          ejercicio: {
            gym: { '2026-06-23': true },
          },
        },
        config: {
          ejercicio: {
            gym: buildGymConfig({ diasSemana: [1], frecuencia: 1, horarios: [] }),
          },
        },
      });

      expect(getPeriodicCarouselMode(
        buildGymConfig({ diasSemana: [1], frecuencia: 1, horarios: [] }),
        rutinaHoy,
        'ejercicio',
        'gym',
        'MAÑANA',
      )).toBeNull();
    });
  });

  describe('shouldShowInTracker', () => {
    it('shows active habits in tracker', () => {
      expect(shouldShowInTracker('ejercicio', 'gym', buildRutina(), { activo: true })).toBe(true);
    });

    it('hides inactive habits in tracker', () => {
      expect(shouldShowInTracker('ejercicio', 'gym', buildRutina(), { activo: false })).toBe(false);
    });
  });
});

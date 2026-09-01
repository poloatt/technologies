import {
  buildPostponedFranjasUpdate,
  canPostponeHabitFranja,
  canDeferHabit,
  isOverdueDailyFranja,
  getPostponeMenuLabel,
  isFranjaPostponed,
  resolvePostponeTargetFranja,
} from '@shared/habits';
import { formatDateForAPI, getNormalizedToday } from '@shared/utils/dateUtils';
import { VALID_TIME_OF_DAY, getCurrentTimeOfDay } from '@shared/utils/timeOfDayUtils';

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

  it('canDeferHabit stays true when another franja is already done today', () => {
    expect(canDeferHabit({
      rutina: {
        ...rutina,
        fecha: formatDateForAPI(getNormalizedToday()),
        bodyCare: { shower: { MAÑANA: false, TARDE: true } },
      },
      section: 'bodyCare',
      itemId: 'shower',
      config: rutina.config.bodyCare.shower,
      itemValue: { MAÑANA: false, TARDE: true },
      focusHorario: 'MAÑANA',
      allowPostpone: true,
    })).toBe(true);
  });

  it('isOverdueDailyFranja marks earlier slots as overdue today', () => {
    const rutina = { fecha: formatDateForAPI(getNormalizedToday()) };
    const config = { tipo: 'DIARIO', horarios: ['MAÑANA', 'TARDE', 'NOCHE'] };
    const activeIdx = VALID_TIME_OF_DAY.indexOf(getCurrentTimeOfDay());

    VALID_TIME_OF_DAY.forEach((franja, idx) => {
      expect(isOverdueDailyFranja(rutina, config, franja)).toBe(
        idx < activeIdx,
      );
    });
  });
});

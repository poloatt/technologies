import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveActiveQuotaForDay,
  resolveDayLinkedQuota,
  buildPreviewRutinaForDate,
  resolveEffectiveRutinaView,
  shouldHideNotTodayBucket,
  shouldHideFlexibleLuegoProjections,
} from '../../../../shared/habits/domain/resolveRutinaDayView.js';
import { groupSectionHabitsByDaySchedule } from '../../../../shared/habits/desktop/rutinaDesktopUtils.js';

const GYM_CONFIG = {
  activo: true,
  tipo: 'SEMANAL',
  periodo: 'CADA_SEMANA',
  frecuencia: 3,
  diasSemana: [1, 3, 5],
};

const GYM_2X_CONFIG = {
  activo: true,
  tipo: 'SEMANAL',
  periodo: 'CADA_SEMANA',
  frecuencia: 2,
  diasSemana: [1, 4],
};

const PELUQUERIA_CONFIG = {
  activo: true,
  tipo: 'MENSUAL',
  periodo: 'CADA_MES',
  frecuencia: 1,
  diasMes: [15],
};

const PELUQUERIA_INTERVAL_CONFIG = {
  activo: true,
  tipo: 'PERSONALIZADO',
  periodo: 'CADA_DIA',
  frecuencia: 30,
  horarios: ['TARDE'],
};

function dateAt(y, m, d) {
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

describe('resolveActiveQuotaForDay', () => {
  it('gym 3×/sem: 1 completado lunes, jueves no visible', () => {
    const historial = [dateAt(2026, 9, 7)]; // lunes 7 sep 2026
    const thu = dateAt(2026, 9, 10);
    const result = resolveActiveQuotaForDay(thu, GYM_CONFIG, historial);
    assert.equal(result.show, false);
  });

  it('gym 3×/sem: 1 completado lunes, viernes visible cuota 2', () => {
    const historial = [dateAt(2026, 9, 7)];
    const fri = dateAt(2026, 9, 11);
    const result = resolveActiveQuotaForDay(fri, GYM_CONFIG, historial);
    assert.equal(result.show, true);
    assert.equal(result.quotaSlot, 2);
    assert.equal(result.reason, 'scheduled');
  });

  it('gym 2×/sem: miércoles sin completar muestra deuda cuota 1', () => {
    const wed = dateAt(2026, 9, 9);
    const result = resolveActiveQuotaForDay(wed, GYM_2X_CONFIG, []);
    assert.equal(result.show, true);
    assert.equal(result.quotaSlot, 1);
    assert.equal(result.reason, 'debt');
  });

  it('gym 3×/sem en jueves programado: solo cuota del día (no deuda paralela)', () => {
    const historial = [dateAt(2026, 9, 7)];
    const thu = dateAt(2026, 9, 10);
    const configThu = { ...GYM_CONFIG, diasSemana: [1, 3, 4, 5] };
    const result = resolveActiveQuotaForDay(thu, configThu, historial);
    assert.equal(result.show, true);
    assert.equal(result.quotaSlot, 2);
    assert.equal(result.reason, 'scheduled');
  });
});

describe('resolveDayLinkedQuota cadencia debt is dynamic', () => {
  it('historical scheduled day: visible without debt carry-over styling', () => {
    const day15 = dateAt(2026, 8, 15);
    const result = resolveDayLinkedQuota({
      fechaObjetivo: day15,
      config: PELUQUERIA_CONFIG,
      historialCompletado: [],
      dayMode: 'historical',
    });
    assert.equal(result.visible, true);
    assert.equal(result.isCadenciaDebt, false);
    assert.equal(result.linkReason, 'scheduled');
  });

  it('historical off-schedule days: not visible (no repeated drag across past days)', () => {
    const day20 = dateAt(2026, 8, 20);
    const result = resolveDayLinkedQuota({
      fechaObjetivo: day20,
      config: PELUQUERIA_CONFIG,
      historialCompletado: [],
      dayMode: 'historical',
    });
    assert.equal(result.visible, false);
    assert.equal(result.isCadenciaDebt, false);
  });

  it('today after missed monthly slot: single debt surface on current day only', () => {
    const day31 = dateAt(2026, 8, 31);
    const result = resolveDayLinkedQuota({
      fechaObjetivo: day31,
      config: PELUQUERIA_CONFIG,
      historialCompletado: [],
      dayMode: 'today',
    });
    assert.equal(result.visible, true);
    assert.equal(result.isCadenciaDebt, true);
    assert.equal(result.linkReason, 'debt');
  });

  it('interval personalizado 30d: historical mid-rest hidden, today due with debt', () => {
    const lastDone = dateAt(2026, 8, 1);
    const day30 = dateAt(2026, 8, 30);
    const day31 = dateAt(2026, 8, 31);

    const historical = resolveDayLinkedQuota({
      fechaObjetivo: day30,
      config: PELUQUERIA_INTERVAL_CONFIG,
      historialCompletado: [lastDone],
      dayMode: 'historical',
    });
    assert.equal(historical.visible, false);

    const today = resolveDayLinkedQuota({
      fechaObjetivo: day31,
      config: PELUQUERIA_INTERVAL_CONFIG,
      historialCompletado: [lastDone],
      dayMode: 'today',
    });
    assert.equal(today.visible, true);
    assert.equal(today.isCadenciaDebt, true);
    assert.equal(today.linkReason, 'debt');
  });
});

describe('buildPreviewRutinaForDate', () => {
  it('genera stub sin _id con fecha e historial mergeado', () => {
    const rutinas = [{
      fecha: '2026-08-28',
      historial: {
        ejercicio: {
          gym: { '2026-09-07': true },
        },
      },
    }];
    const habits = {
      ejercicio: [{ id: 'gym', activo: true, label: 'Gym' }],
    };
    const preview = buildPreviewRutinaForDate({
      date: '2026-09-05',
      habits,
      habitsPreferences: {
        ejercicio: {
          gym: GYM_CONFIG,
        },
      },
      rutinas,
    });

    assert.ok(preview);
    assert.equal(preview.isPreview, true);
    assert.equal(preview.fecha, '2026-09-05');
    assert.equal(preview._id, undefined);
    assert.equal(preview.historial.ejercicio.gym['2026-09-07'], true);
  });
});

describe('resolveEffectiveRutinaView', () => {
  it('usa preview cuando viewDate es futuro y no hay log', () => {
    const view = resolveEffectiveRutinaView({
      rutina: null,
      viewDate: dateAt(2026, 9, 10),
      habits: { ejercicio: [{ id: 'gym', activo: true }] },
      habitsPreferences: { ejercicio: { gym: GYM_CONFIG } },
      rutinas: [],
    });
    assert.equal(view.isPreview, true);
    assert.equal(view.readOnly, true);
    assert.equal(view.dayMode, 'future');
    assert.ok(view.rutina?.fecha);
  });
});

describe('focused today filtering', () => {
  it('oculta notToday en dayMode today', () => {
    assert.equal(shouldHideNotTodayBucket('today'), true);
    assert.equal(shouldHideFlexibleLuegoProjections('today'), true);
    assert.equal(shouldHideFlexibleLuegoProjections('historical'), true);
    assert.equal(shouldHideNotTodayBucket('historical'), false);
  });

  it('agrupa sin notToday visibles para hábito off-schedule en hoy', () => {
    const rutina = {
      fecha: '2026-09-10',
      config: {
        ejercicio: {
          gym: GYM_CONFIG,
          shower: { activo: true, tipo: 'DIARIO', periodo: 'CADA_DIA', frecuencia: 1 },
        },
      },
      historial: {
        ejercicio: {
          gym: { '2026-09-07': true },
        },
      },
      ejercicio: {
        gym: false,
        shower: false,
      },
    };

    const grouped = groupSectionHabitsByDaySchedule({
      section: 'ejercicio',
      rutina,
      habits: {
        ejercicio: [
          { id: 'gym', activo: true },
          { id: 'shower', activo: true },
        ],
      },
    });

    assert.ok(grouped.today.some((e) => e.itemId === 'shower'));
    assert.equal(grouped.today.some((e) => e.itemId === 'gym'), false);
    assert.ok(grouped.notToday.some((e) => e.itemId === 'gym'));
  });
});

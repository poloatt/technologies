import {
  debesMostrarHabitoEnFecha,
  hasCadenciaDebt,
  isScheduledCadenciaDay,
  contarCompletadosEnPeriodo,
  getCadenciaWeekRange,
} from '@shared/habits';

const mondayConfig = {
  tipo: 'SEMANAL',
  frecuencia: 1,
  activo: true,
  diasSemana: [1],
};

const monWedConfig = {
  tipo: 'SEMANAL',
  frecuencia: 2,
  activo: true,
  diasSemana: [1, 3],
};

describe('cadenciaUtils carry-over', () => {
  const monday = new Date(2026, 5, 22, 12, 0, 0, 0);
  const tuesday = new Date(2026, 5, 23, 12, 0, 0, 0);
  const sunday = new Date(2026, 5, 21, 12, 0, 0, 0);

  it('isScheduledCadenciaDay returns true only on configured weekdays', () => {
    expect(isScheduledCadenciaDay(monday, mondayConfig)).toBe(true);
    expect(isScheduledCadenciaDay(tuesday, mondayConfig)).toBe(false);
  });

  it('hasCadenciaDebt is true on Tuesday when Monday was missed', () => {
    expect(hasCadenciaDebt(tuesday, mondayConfig, [])).toBe(true);
  });

  it('hasCadenciaDebt is false on scheduled day before any prior slot passed', () => {
    expect(hasCadenciaDebt(monday, mondayConfig, [])).toBe(false);
  });

  it('hasCadenciaDebt is true on Sunday at week end when Monday was missed (lun-dom week)', () => {
    expect(hasCadenciaDebt(sunday, mondayConfig, [])).toBe(true);
  });

  it('hasCadenciaDebt is false once weekly quota is met via catch-up day', () => {
    const historial = [tuesday];
    expect(hasCadenciaDebt(tuesday, mondayConfig, historial)).toBe(false);
    expect(
      contarCompletadosEnPeriodo(tuesday, 'SEMANAL', 'CADA_SEMANA', historial),
    ).toBe(1);
  });

  it('debesMostrarHabitoEnFecha shows carry-over on non-scheduled day with debt', () => {
    expect(debesMostrarHabitoEnFecha(tuesday, mondayConfig, [])).toBe(true);
    expect(debesMostrarHabitoEnFecha(sunday, mondayConfig, [])).toBe(true);
  });

  it('debesMostrarHabitoEnFecha hides after catch-up completion in period', () => {
    expect(debesMostrarHabitoEnFecha(tuesday, mondayConfig, [tuesday])).toBe(false);
  });

  it('supports f>1 with debt until quota met', () => {
    expect(hasCadenciaDebt(tuesday, monWedConfig, [])).toBe(true);
    expect(debesMostrarHabitoEnFecha(tuesday, monWedConfig, [monday])).toBe(true);
    expect(debesMostrarHabitoEnFecha(tuesday, monWedConfig, [monday, tuesday])).toBe(false);
  });

  it('getCadenciaWeekRange uses Monday as week start', () => {
    const { start, end } = getCadenciaWeekRange(tuesday);
    expect(start.getDay()).toBe(1);
    expect(end.getDay()).toBe(0);
    expect(start.getDate()).toBe(22);
    expect(end.getDate()).toBe(28);
  });
});

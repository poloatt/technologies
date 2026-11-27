import {
  MP_MOVEMENT_KINDS,
  construirPorDiaDolares,
  construirPorDiaInversiones,
} from '../mercadoPagoUtils.js';

const ARS = 'ars-id';

describe('construirPorDiaDolares', () => {
  it('computa FX_BUY como ingreso en USD y FX_SELL como egreso en USD sin usar monto en pesos', () => {
    const rows = [
      {
        _id: { kind: MP_MOVEMENT_KINDS.FX_BUY, tipo: 'EGRESO', moneda: ARS, fecha: '2026-04-10', compraventa: true },
        total: 120000,
        usd: 100,
        face: 100,
      },
      {
        _id: { kind: MP_MOVEMENT_KINDS.FX_SELL, tipo: 'INGRESO', moneda: ARS, fecha: '2026-04-10', compraventa: true },
        total: 30000,
        usd: 25,
        face: 25,
      },
      {
        _id: { kind: MP_MOVEMENT_KINDS.USD_PAYMENT, tipo: 'EGRESO', moneda: 'usd-id', fecha: '2026-04-12', compraventa: false },
        total: 12.5,
        usd: 0,
        face: 12.5,
      },
    ];

    expect(construirPorDiaDolares(rows)).toEqual([
      { fecha: '2026-04-10', ingresos: 100, egresos: 25 },
      { fecha: '2026-04-12', ingresos: 0, egresos: 12.5 },
    ]);
  });

  it('suma ingresos recibidos y rendimientos en USD y ordena por fecha', () => {
    const rows = [
      {
        _id: { kind: MP_MOVEMENT_KINDS.USD_YIELD, tipo: 'INGRESO', moneda: 'usd-id', fecha: '2026-05-02', compraventa: false },
        total: 1.25,
        usd: 0,
        face: 1.25,
      },
      {
        _id: { kind: MP_MOVEMENT_KINDS.USD_IN, tipo: 'INGRESO', moneda: 'usd-id', fecha: '2026-05-01', compraventa: false },
        total: 50,
        usd: 0,
        face: 50,
      },
    ];

    expect(construirPorDiaDolares(rows)).toEqual([
      { fecha: '2026-05-01', ingresos: 50, egresos: 0 },
      { fecha: '2026-05-02', ingresos: 1.25, egresos: 0 },
    ]);
  });
});

describe('construirPorDiaInversiones', () => {
  it('toma reserva e inversion como positivos y rescates o pagos desde reserva como negativos', () => {
    const rows = [
      {
        _id: { kind: MP_MOVEMENT_KINDS.RESERVE_LOCK, tipo: 'EGRESO', moneda: ARS, fecha: '2026-06-01', yieldSide: null },
        total: 1000,
      },
      {
        _id: { kind: MP_MOVEMENT_KINDS.RESERVE_PAYMENT, tipo: 'EGRESO', moneda: ARS, fecha: '2026-06-01', yieldSide: null },
        total: 250,
      },
      {
        _id: { kind: MP_MOVEMENT_KINDS.RESERVE_RELEASE, tipo: 'INGRESO', moneda: ARS, fecha: '2026-06-02', yieldSide: null },
        total: 300,
      },
      {
        _id: { kind: MP_MOVEMENT_KINDS.INVESTMENT_IN, tipo: 'EGRESO', moneda: ARS, fecha: '2026-06-03', yieldSide: null },
        total: 500,
      },
      {
        _id: { kind: MP_MOVEMENT_KINDS.INVESTMENT_OUT, tipo: 'INGRESO', moneda: ARS, fecha: '2026-06-03', yieldSide: null },
        total: 100,
      },
    ];

    expect(construirPorDiaInversiones(rows)).toEqual({
      [ARS]: [
        { fecha: '2026-06-01', ingresos: 1000, egresos: 250 },
        { fecha: '2026-06-02', ingresos: 0, egresos: 300 },
        { fecha: '2026-06-03', ingresos: 500, egresos: 100 },
      ],
    });
  });

  it('trata rendimientos positivos como ingreso y perdidas como egreso', () => {
    const rows = [
      {
        _id: { kind: MP_MOVEMENT_KINDS.YIELD, tipo: 'INGRESO', moneda: ARS, fecha: '2026-06-10', yieldSide: 'reserva' },
        total: 42,
      },
      {
        _id: { kind: MP_MOVEMENT_KINDS.INVESTMENT_YIELD, tipo: 'EGRESO', moneda: ARS, fecha: '2026-06-11', yieldSide: 'inversion' },
        total: 8,
      },
    ];

    expect(construirPorDiaInversiones(rows)).toEqual({
      [ARS]: [
        { fecha: '2026-06-10', ingresos: 42, egresos: 0 },
        { fecha: '2026-06-11', ingresos: 0, egresos: 8 },
      ],
    });
  });
});

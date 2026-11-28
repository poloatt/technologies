import { BankSyncService } from '../bankSyncService.js';

const NOW = new Date('2026-11-28T12:00:00Z');

function servicio({ ledger = [], reingesta = null } = {}) {
  const service = new BankSyncService();
  let enLedger = new Set(ledger);
  service.idsMpEnLedger = async () => enLedger;
  service.procesarMovimientosReporte = async (filas) => {
    if (reingesta) enLedger = new Set([...enLedger, ...reingesta]);
    service.reingestadas = filas.map((f) => String(f.sourceId || f.id));
    return { nuevas: filas.length, actualizadas: 0, omitidas: 0 };
  };
  return service;
}

const conexion = (extra = {}) => ({
  mercadopago: { coberturaRetiros: [], ...extra }
});

const reporteConfiable = {
  trusted: true,
  report: { id: 55 },
  ventanasValidadas: [
    { beginDate: '2026-10-01T03:00:00.000Z', endDate: '2026-11-27T10:00:00.000Z', reportId: '55', fuente: 'settlement' }
  ]
};

const movimientos = [
  { sourceId: '1001', transactionType: 'PAYOUTS', netAmount: -5000, date: '2026-10-05T10:00:00Z' },
  { sourceId: '1002', transactionType: 'PAYOUTS', netAmount: -7000, date: '2026-10-06T10:00:00Z' },
  { sourceId: '9', transactionType: 'SETTLEMENT', netAmount: 10, date: '2026-10-05T10:00:00Z' }
];

describe('conciliarYRegistrarRetiros', () => {
  const base = { cuenta: { _id: 'c1' }, mpUserId: '1', movimientosMerged: movimientos, movimientos };

  it('registra cobertura cuando todos los retiros están en el ledger', async () => {
    const res = await servicio({ ledger: ['1001', '1002'] }).conciliarYRegistrarRetiros({
      ...base,
      bankConnection: conexion(),
      settlementReport: reporteConfiable
    });
    expect(res.validado).toBe(true);
    expect(res.cobertura).toHaveLength(1);
    expect(res.diagnostico).toMatchObject({ esperados: 2, conciliados: 2, faltantes: 0, validado: true });
  });

  it('reingesta lo que falta y valida si queda en el ledger', async () => {
    const service = servicio({ ledger: ['1001'], reingesta: ['1002'] });
    const res = await service.conciliarYRegistrarRetiros({
      ...base,
      bankConnection: conexion(),
      settlementReport: reporteConfiable
    });
    expect(service.reingestadas).toEqual(['1002']);
    expect(res.validado).toBe(true);
  });

  it('si siguen faltando retiros NO registra cobertura y lo informa', async () => {
    const res = await servicio({ ledger: ['1001'] }).conciliarYRegistrarRetiros({
      ...base,
      bankConnection: conexion(),
      settlementReport: reporteConfiable
    });
    expect(res.validado).toBe(false);
    expect(res.cobertura).toEqual([]);
    expect(res.diagnostico.faltantes).toBe(1);
    expect(res.motivo).toMatch(/1002/);
  });

  it('un reporte que no es de confianza nunca valida, aunque el ledger esté completo', async () => {
    const res = await servicio({ ledger: ['1001', '1002'] }).conciliarYRegistrarRetiros({
      ...base,
      bankConnection: conexion(),
      settlementReport: { trusted: false, ventanasValidadas: [] }
    });
    expect(res.validado).toBe(false);
    expect(res.cobertura).toEqual([]);
  });

  it('un reporte pendiente no valida', async () => {
    const res = await servicio().conciliarYRegistrarRetiros({
      ...base,
      bankConnection: conexion(),
      settlementReport: { pending: true }
    });
    expect(res.validado).toBe(false);
    expect(res.motivo).toMatch(/generación/i);
  });

  it('suma a la cobertura existente sin perderla', async () => {
    const previa = [{ beginDate: '2026-01-01T00:00:00.000Z', endDate: '2026-02-01T00:00:00.000Z', reportId: '1' }];
    const res = await servicio({ ledger: ['1001', '1002'] }).conciliarYRegistrarRetiros({
      ...base,
      bankConnection: conexion({ coberturaRetiros: previa }),
      settlementReport: reporteConfiable
    });
    expect(res.cobertura).toHaveLength(2);
  });
});

describe('siguienteTramoSinCoberturaMp', () => {
  const service = new BankSyncService();
  const historial = { cubiertoHasta: '2026-01-01T00:00:00.000Z' };

  it('devuelve el tramo más reciente sin validar', () => {
    const tramo = service.siguienteTramoSinCoberturaMp(conexion(), historial, { now: NOW });
    expect(new Date(tramo.endDate).getTime()).toBe(NOW.getTime());
    expect((Date.parse(tramo.endDate) - Date.parse(tramo.beginDate)) / 864e5).toBeLessThanOrEqual(58.01);
  });

  it('null cuando todo lo importado ya está validado', () => {
    const cob = [{ beginDate: '2025-12-31T00:00:00.000Z', endDate: '2026-11-28T11:00:00.000Z' }];
    expect(
      service.siguienteTramoSinCoberturaMp(conexion({ coberturaRetiros: cob }), historial, { now: NOW })
    ).toBeNull();
  });

  it('saltea un tramo revisado hace poco sin lograr validarlo', () => {
    const primero = service.siguienteTramoSinCoberturaMp(conexion(), historial, { now: NOW });
    const recien = {
      ...historial,
      revisados: [{ beginDate: primero.beginDate, endDate: primero.endDate, revisadoEn: new Date(NOW.getTime() - 3600e3) }]
    };
    const siguiente = service.siguienteTramoSinCoberturaMp(conexion(), recien, { now: NOW });
    expect(siguiente.endDate).not.toBe(primero.endDate);
  });

  it('respeta el límite inferior (inicio de actividad)', () => {
    const tramos = [];
    let h = historial;
    const minDesde = new Date('2026-09-01T00:00:00.000Z');
    const t = service.siguienteTramoSinCoberturaMp(conexion(), h, { now: NOW, minDesde });
    tramos.push(t);
    expect(new Date(t.beginDate).getTime()).toBeGreaterThanOrEqual(minDesde.getTime());
  });
});

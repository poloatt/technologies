import {
  MercadoPagoReportService,
  SettlementReportTimeoutError,
  findRecentCoveringReport,
  getSettlementReuseMaxAgeMs
} from '../mercadoPagoReportService.js';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-11-26T15:00:00Z');

function report(overrides = {}) {
  return {
    id: 1,
    file_name: 'reporte.csv',
    status: 'processed',
    begin_date: '2026-09-27T00:00:00Z',
    end_date: '2026-11-26T12:00:00Z',
    generation_date: '2026-11-26T13:00:00Z',
    ...overrides
  };
}

const beginDate = '2026-09-27T03:00:00Z';
const endDate = '2026-11-26T15:00:00Z';

describe('findRecentCoveringReport', () => {
  it('reutiliza un reporte reciente que cubre el rango pedido', () => {
    const match = findRecentCoveringReport([report()], beginDate, endDate, { maxAgeMs: 6 * HOUR, now: NOW });
    expect(match?.id).toBe(1);
  });

  it('descarta reportes más viejos que la antigüedad máxima', () => {
    const old = report({ generation_date: '2026-11-25T10:00:00Z' });
    expect(findRecentCoveringReport([old], beginDate, endDate, { maxAgeMs: 6 * HOUR, now: NOW })).toBeNull();
  });

  it('descarta reportes que no empiezan antes del rango pedido', () => {
    const tarde = report({ begin_date: '2026-10-15T00:00:00Z' });
    expect(findRecentCoveringReport([tarde], beginDate, endDate, { maxAgeMs: 6 * HOUR, now: NOW })).toBeNull();
  });

  it('descarta reportes que terminan muy lejos del fin pedido', () => {
    const corto = report({ end_date: '2026-11-25T00:00:00Z' });
    expect(findRecentCoveringReport([corto], beginDate, endDate, { maxAgeMs: 6 * HOUR, now: NOW })).toBeNull();
  });

  it('descarta reportes sin archivo listo', () => {
    const sinArchivo = report({ file_name: undefined, filename: undefined, fileName: undefined });
    expect(findRecentCoveringReport([sinArchivo], beginDate, endDate, { maxAgeMs: 6 * HOUR, now: NOW })).toBeNull();
  });

  it('prefiere el reporte generado más recientemente', () => {
    const viejo = report({ id: 'viejo', generation_date: '2026-11-26T08:00:00Z' });
    const nuevo = report({ id: 'nuevo', generation_date: '2026-11-26T14:00:00Z' });
    const match = findRecentCoveringReport([viejo, nuevo], beginDate, endDate, { maxAgeMs: 6 * HOUR, now: NOW });
    expect(match?.id).toBe('nuevo');
  });
});

describe('fetchSettlementMovements: reuso parcial ante timeout', () => {
  function serviceCon(reused) {
    const service = new MercadoPagoReportService({ accessToken: 'x', userId: 1 });
    service.configureReport = async () => ({ include_withdraw: true });
    service.reuseRecentCoveringReport = async () => null;
    service.reuseExistingReports = async () => reused;
    service.createReport = async () => ({ data: { id: 99 } });
    service.completeReport = async () => {
      throw new SettlementReportTimeoutError('timeout', { beginDate, endDate });
    };
    return service;
  }

  it('deja el tramo pendiente con el id del reporte cuando el reuso no es de confianza', async () => {
    const result = await serviceCon({
      rows: [{ transactionType: 'SETTLEMENT' }],
      strictMatch: false,
      trustedCoverage: false
    }).fetchSettlementMovements(beginDate, endDate);
    expect(result.pending).toBe(true);
    expect(result.reportId).toBe('99');
    expect(result.partial).toBe(true);
    expect(result.missingWithdrawals).toBe(true);
  });

  it('un reuso con filas de PAYOUTS pero sin cobertura de confianza sigue pendiente', async () => {
    const result = await serviceCon({
      rows: [{ transactionType: 'SETTLEMENT' }, { transactionType: 'PAYOUTS' }],
      strictMatch: false,
      trustedCoverage: false
    }).fetchSettlementMovements(beginDate, endDate);
    expect(result.pending).toBe(true);
    expect(result.missingWithdrawals).toBe(true);
  });

  it('si los reportes de confianza cubren el rango, devuelve resultado completo y validado', async () => {
    const ventanas = [{ beginDate, endDate, reportId: '5', fuente: 'settlement' }];
    const result = await serviceCon({
      rows: [{ transactionType: 'PAYOUTS' }],
      strictMatch: false,
      trustedCoverage: true,
      ventanas
    }).fetchSettlementMovements(beginDate, endDate);
    expect(result.pending).toBeUndefined();
    expect(result.trusted).toBe(true);
    expect(result.ventanasValidadas).toEqual(ventanas);
  });

  it('un reporte nuevo manual reciente se marca de confianza y valida su ventana', async () => {
    const service = serviceCon(null);
    service.completeReport = async () => ({
      rows: [{ transactionType: 'PAYOUTS' }],
      fileName: 'r.csv',
      total: 1,
      report: {
        id: 99,
        created_from: 'manual',
        begin_date: beginDate,
        end_date: endDate,
        date_created: new Date().toISOString()
      }
    });
    const result = await service.fetchSettlementMovements(beginDate, endDate);
    expect(result.trusted).toBe(true);
    expect(result.ventanasValidadas).toHaveLength(1);
  });

  it('sin include_withdraw activo un reporte nuevo no es de confianza', async () => {
    const service = serviceCon(null);
    service.configureReport = async () => ({ include_withdraw: false });
    service.completeReport = async () => ({
      rows: [],
      fileName: 'r.csv',
      total: 0,
      report: {
        id: 99,
        created_from: 'manual',
        begin_date: beginDate,
        end_date: endDate,
        date_created: new Date().toISOString()
      }
    });
    const result = await service.fetchSettlementMovements(beginDate, endDate);
    expect(result.trusted).toBe(false);
    expect(result.ventanasValidadas).toEqual([]);
  });

  it('completa un pendiente usando su reportId guardado', async () => {
    const service = serviceCon(null);
    let recibido = null;
    service.completeReport = async (b, e, opts) => {
      recibido = opts;
      return { rows: [], fileName: 'r.csv', total: 0, report: null };
    };
    const result = await service.fetchSettlementMovements(beginDate, endDate, {
      pending: { beginDate, endDate, reportId: '104349442', solicitadoEn: new Date().toISOString() }
    });
    expect(recibido.reportId).toBe('104349442');
    expect(result.fromPending).toBe(true);
    expect(result.trusted).toBe(false);
  });
});

describe('getSettlementReuseMaxAgeMs', () => {
  const original = process.env.MP_SETTLEMENT_REUSE_MAX_AGE_MS;

  afterEach(() => {
    if (original === undefined) delete process.env.MP_SETTLEMENT_REUSE_MAX_AGE_MS;
    else process.env.MP_SETTLEMENT_REUSE_MAX_AGE_MS = original;
  });

  it('usa 6 horas por defecto', () => {
    delete process.env.MP_SETTLEMENT_REUSE_MAX_AGE_MS;
    expect(getSettlementReuseMaxAgeMs()).toBe(6 * HOUR);
  });

  it('acepta override por variable de entorno', () => {
    process.env.MP_SETTLEMENT_REUSE_MAX_AGE_MS = String(2 * HOUR);
    expect(getSettlementReuseMaxAgeMs()).toBe(2 * HOUR);
  });

  it('ignora valores inválidos', () => {
    process.env.MP_SETTLEMENT_REUSE_MAX_AGE_MS = 'abc';
    expect(getSettlementReuseMaxAgeMs()).toBe(6 * HOUR);
  });
});

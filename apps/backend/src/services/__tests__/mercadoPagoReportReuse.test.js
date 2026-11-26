import {
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

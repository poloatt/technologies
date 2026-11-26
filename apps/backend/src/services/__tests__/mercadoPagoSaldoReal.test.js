import {
  calcularSaldosMercadoPago,
  rendimientosDelPeriodo,
  resolverDineroEnCuenta,
  SALDO_MP_MAX_AGE_MS
} from '../mercadoPagoUtils.js';

const NOW = Date.parse('2026-11-26T15:00:00Z');
const HOUR = 60 * 60 * 1000;

function cuentaMp({ saldo = 414418.99, actualizadoHaceMs = 2 * HOUR, tipo = 'MERCADO_PAGO' } = {}) {
  return {
    tipo,
    saldo,
    mercadopago: { saldoActualizadoEn: new Date(NOW - actualizadoHaceMs) }
  };
}

describe('resolverDineroEnCuenta', () => {
  it('usa el saldo real de MP en el período actual cuando es reciente', () => {
    const r = resolverDineroEnCuenta({
      cuenta: cuentaMp(),
      ledger: 1192389.37,
      fechaCorte: new Date(NOW + HOUR),
      now: NOW
    });
    expect(r.valor).toBe(414418.99);
    expect(r.fuente).toBe('mercadopago');
    expect(r.ledger).toBe(1192389.37);
    expect(r.actualizadoEn).toBeInstanceOf(Date);
  });

  it('usa el saldo real cuando no hay fecha de corte (período actual)', () => {
    const r = resolverDineroEnCuenta({ cuenta: cuentaMp(), ledger: 1, fechaCorte: null, now: NOW });
    expect(r.fuente).toBe('mercadopago');
  });

  it('usa el ledger en períodos pasados aunque el saldo real sea reciente', () => {
    const r = resolverDineroEnCuenta({
      cuenta: cuentaMp(),
      ledger: 500000,
      fechaCorte: new Date(NOW - 2 * 24 * HOUR),
      now: NOW
    });
    expect(r.valor).toBe(500000);
    expect(r.fuente).toBe('ledger');
    expect(r.actualizadoEn).toBeNull();
  });

  it('usa el ledger cuando el saldo real tiene más de 24 horas', () => {
    const r = resolverDineroEnCuenta({
      cuenta: cuentaMp({ actualizadoHaceMs: SALDO_MP_MAX_AGE_MS + HOUR }),
      ledger: 900000,
      fechaCorte: null,
      now: NOW
    });
    expect(r.valor).toBe(900000);
    expect(r.fuente).toBe('ledger');
  });

  it('usa el ledger si nunca se guardó un saldo real', () => {
    const r = resolverDineroEnCuenta({
      cuenta: { tipo: 'MERCADO_PAGO', saldo: 0, mercadopago: {} },
      ledger: 123,
      fechaCorte: null,
      now: NOW
    });
    expect(r.valor).toBe(123);
    expect(r.fuente).toBe('ledger');
  });

  it('nunca reemplaza el ledger de cuentas que no son MercadoPago', () => {
    const r = resolverDineroEnCuenta({
      cuenta: cuentaMp({ tipo: 'BANCO' }),
      ledger: 42,
      fechaCorte: null,
      now: NOW
    });
    expect(r.valor).toBe(42);
    expect(r.fuente).toBe('ledger');
  });

  it('redondea el saldo real a centavos', () => {
    const r = resolverDineroEnCuenta({
      cuenta: cuentaMp({ saldo: 1234.5678 }),
      ledger: 0,
      fechaCorte: null,
      now: NOW
    });
    expect(r.valor).toBe(1234.57);
  });
});

describe('rendimientosDelPeriodo', () => {
  const PESOS = 'pesos';
  const fila = ({ kind = 'YIELD', tipo = 'INGRESO', side = 'cuenta', enPeriodo, total }) => ({
    _id: { kind, tipo, moneda: PESOS, compraventa: false, flujo: false, side, enPeriodo },
    total,
    usd: 0,
    face: total
  });

  const rows = [
    fila({ enPeriodo: false, total: 1000 }),
    fila({ enPeriodo: true, total: 250 }),
    fila({ kind: 'INVESTMENT_YIELD', side: 'inversion', enPeriodo: true, total: 50 }),
    fila({ kind: 'INVESTMENT_IN', tipo: 'EGRESO', enPeriodo: true, total: 9999 })
  ];

  it('suma solo los rendimientos acreditados dentro del período', () => {
    expect(rendimientosDelPeriodo(rows, { monedaPesosId: PESOS })).toBe(300);
  });

  it('no cambia el acumulado al cierre, que incluye rendimientos anteriores', () => {
    expect(calcularSaldosMercadoPago(rows, { monedaPesosId: PESOS }).rendimientos).toBe(1300);
  });

  it('descuenta los rendimientos negativos del período', () => {
    const conAjuste = [...rows, fila({ tipo: 'EGRESO', enPeriodo: true, total: 20 })];
    expect(rendimientosDelPeriodo(conAjuste, { monedaPesosId: PESOS })).toBe(280);
  });

  it('devuelve 0 sin filas', () => {
    expect(rendimientosDelPeriodo([], {})).toBe(0);
  });
});

import {
  ESTRATEGIA_GENERICA,
  ESTRATEGIA_MERCADO_PAGO,
  calcularSaldosGenericos,
  calcularSaldosGenericosPorMoneda,
  resolverEstrategiaSaldos,
} from '../saldos/estrategiasSaldos.js';

const PESOS = 'pesos';
const USD = 'usd';

function fila(tipo, total, { enPeriodo = true, moneda = PESOS } = {}) {
  return { _id: { tipo, moneda, enPeriodo }, total };
}

describe('resolverEstrategiaSaldos', () => {
  it('usa el cálculo de Mercado Pago para MERCADO_PAGO y para cuentas sin tipo', () => {
    expect(resolverEstrategiaSaldos('MERCADO_PAGO')).toBe(ESTRATEGIA_MERCADO_PAGO);
    expect(resolverEstrategiaSaldos(undefined)).toBe(ESTRATEGIA_MERCADO_PAGO);
  });

  it('usa el cálculo genérico para BANCO, EFECTIVO, CRIPTO y OTRO', () => {
    for (const tipo of ['BANCO', 'EFECTIVO', 'CRIPTO', 'OTRO']) {
      expect(resolverEstrategiaSaldos(tipo)).toBe(ESTRATEGIA_GENERICA);
    }
  });
});

describe('calcularSaldosGenericos', () => {
  it('el saldo acumulado suma ingresos y resta egresos sin importar el período', () => {
    const r = calcularSaldosGenericos([
      fila('INGRESO', 1000, { enPeriodo: false }),
      fila('EGRESO', 300, { enPeriodo: false }),
    ]);
    expect(r.dineroEnCuenta).toBe(700);
  });

  it('el flujo del período solo toma las filas dentro del rango', () => {
    const r = calcularSaldosGenericos([
      fila('INGRESO', 1000, { enPeriodo: false }),
      fila('INGRESO', 500, { enPeriodo: true }),
      fila('EGRESO', 200, { enPeriodo: true }),
    ]);
    expect(r.dineroEnCuenta).toBe(1300);
    expect(r.ingresosPeriodo).toBe(500);
    expect(r.egresosPeriodo).toBe(200);
    expect(r.flujoPeriodo).toBe(300);
  });

  it('con monedaId solo cuenta las filas de esa moneda', () => {
    const r = calcularSaldosGenericos(
      [fila('INGRESO', 1000), fila('INGRESO', 50, { moneda: USD })],
      { monedaId: PESOS },
    );
    expect(r.dineroEnCuenta).toBe(1000);
  });

  it('sin filas devuelve todos los valores en cero', () => {
    expect(calcularSaldosGenericos([])).toEqual({
      dineroEnCuenta: 0,
      ingresosPeriodo: 0,
      egresosPeriodo: 0,
      flujoPeriodo: 0,
    });
  });
});

describe('calcularSaldosGenericosPorMoneda', () => {
  it('informa un saldo por moneda sin mezclarlas', () => {
    const r = calcularSaldosGenericosPorMoneda(
      [
        fila('INGRESO', 1000),
        fila('EGRESO', 300),
        fila('INGRESO', 50, { moneda: USD }),
      ],
      { monedasIds: [PESOS, USD] },
    );
    expect(r.map((m) => m.monedaId)).toEqual([PESOS, USD]);
    expect(r[0].dineroEnCuenta).toBe(700);
    expect(r[1].dineroEnCuenta).toBe(50);
  });

  it('incluye con cero las monedas habilitadas sin movimientos', () => {
    const r = calcularSaldosGenericosPorMoneda([fila('INGRESO', 100)], { monedasIds: [PESOS, USD] });
    expect(r[1]).toEqual({
      monedaId: USD,
      dineroEnCuenta: 0,
      ingresosPeriodo: 0,
      egresosPeriodo: 0,
      flujoPeriodo: 0,
    });
  });

  it('agrega al final una moneda con movimientos que ya no está habilitada', () => {
    const r = calcularSaldosGenericosPorMoneda(
      [fila('INGRESO', 100), fila('INGRESO', 7, { moneda: 'euro' })],
      { monedasIds: [PESOS] },
    );
    expect(r.map((m) => m.monedaId)).toEqual([PESOS, 'euro']);
    expect(r[1].dineroEnCuenta).toBe(7);
  });

  it('respeta el período por moneda', () => {
    const r = calcularSaldosGenericosPorMoneda(
      [
        fila('INGRESO', 100, { enPeriodo: false }),
        fila('INGRESO', 40, { enPeriodo: true }),
        fila('INGRESO', 9, { moneda: USD, enPeriodo: false }),
      ],
      { monedasIds: [PESOS, USD] },
    );
    expect(r[0].dineroEnCuenta).toBe(140);
    expect(r[0].ingresosPeriodo).toBe(40);
    expect(r[1].ingresosPeriodo).toBe(0);
  });
});

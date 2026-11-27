/**
 * Estrategias de saldos por tipo de cuenta.
 *  - mercadopago: libro propio de Mercado Pago (movementKind, USD, reservas e inversiones),
 *    ver `calcularSaldosMercadoPago` en mercadoPagoUtils.js.
 *  - generica: el resto de los tipos (BANCO, EFECTIVO, CRIPTO, OTRO) suma solo
 *    ingresos y egresos de la cuenta.
 */
export const ESTRATEGIA_MERCADO_PAGO = 'mercadopago';
export const ESTRATEGIA_GENERICA = 'generica';

/** Cuentas sin tipo conocido caen en Mercado Pago para conservar el cálculo legacy. */
export function resolverEstrategiaSaldos(tipoCuenta) {
  if (!tipoCuenta || tipoCuenta === 'MERCADO_PAGO') return ESTRATEGIA_MERCADO_PAGO;
  return ESTRATEGIA_GENERICA;
}

/**
 * Saldos de una cuenta genérica a partir de filas agrupadas por `_id: { tipo, moneda, enPeriodo }`
 * con `total` (suma de monto). `enPeriodo` es true si la fila cae dentro del período pedido.
 * Si `monedaId` viene informado, solo cuenta las filas de esa moneda.
 */
export function calcularSaldosGenericos(rows = [], { monedaId = null } = {}) {
  let dineroEnCuenta = 0;
  let ingresosPeriodo = 0;
  let egresosPeriodo = 0;

  for (const row of rows) {
    const { tipo, moneda, enPeriodo } = row._id || {};
    if (monedaId && String(moneda) !== String(monedaId)) continue;
    const monto = Number(row.total) || 0;

    if (tipo === 'INGRESO') dineroEnCuenta += monto;
    else if (tipo === 'EGRESO') dineroEnCuenta -= monto;

    if (enPeriodo === true) {
      if (tipo === 'INGRESO') ingresosPeriodo += monto;
      else if (tipo === 'EGRESO') egresosPeriodo += monto;
    }
  }

  return {
    dineroEnCuenta,
    ingresosPeriodo,
    egresosPeriodo,
    flujoPeriodo: ingresosPeriodo - egresosPeriodo,
  };
}

/**
 * Saldos de una cuenta multimoneda: uno por moneda, sin sumar monedas distintas.
 * Sigue el orden de `monedasIds` (monedas habilitadas, con cero si no tienen movimientos)
 * y agrega al final cualquier moneda con movimientos que ya no esté habilitada.
 */
export function calcularSaldosGenericosPorMoneda(rows = [], { monedasIds = [] } = {}) {
  const ids = monedasIds.map(String);
  for (const row of rows) {
    const moneda = row._id?.moneda;
    if (moneda == null) continue;
    const id = String(moneda);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.map((monedaId) => ({
    monedaId,
    ...calcularSaldosGenericos(rows, { monedaId }),
  }));
}

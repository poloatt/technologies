import { APP_GRAY } from '@shared/config/uiConstants';
import { isCuentaMultimoneda } from './cuentaConstants';

/**
 * Bloques del desglose de saldos según el tipo de cuenta.
 * Cada bloque: `campo` es la clave que devuelve `/api/transacciones/saldos`;
 * `destino` es una clave de DESTINOS en TransaccionesFlujoVisual;
 * `usd` formatea en dólares; `fuenteTitulo` muestra el origen del saldo como tooltip.
 */
const BLOQUES_MERCADO_PAGO = [
  { id: 'cuenta', label: '$ en cuenta', campo: 'dineroEnCuenta', destino: 'transacciones', fuenteTitulo: true },
  { id: 'dolares', label: 'Saldo en U$D', campo: 'dolares', destino: 'dolares', usd: true },
  { id: 'credito', label: 'Tarjeta', campo: 'credito', destino: 'creditos' },
  { id: 'reservado', label: 'Reservado', campo: 'reservado', destino: 'reservado' },
  { id: 'invertido', label: 'Invertido', campo: 'invertido', destino: 'invertido' },
  { id: 'rendimientos', label: 'Rendimientos', campo: 'rendimientosPeriodo', destino: 'rendimientos' },
];

const BLOQUES_GENERICOS = [
  { id: 'cuenta', label: '$ en cuenta', campo: 'dineroEnCuenta', destino: 'transacciones', fuenteTitulo: true },
  { id: 'ingresos', label: 'Ingresos', campo: 'ingresosPeriodo', destino: 'transacciones' },
  { id: 'egresos', label: 'Egresos', campo: 'egresosPeriodo', destino: 'transacciones' },
];

const BLOQUES_POR_TIPO = {
  MERCADO_PAGO: BLOQUES_MERCADO_PAGO,
};

/** Tipos sin bloque propio usan el desglose genérico. */
export function getBloquesSaldos(tipoCuenta) {
  return BLOQUES_POR_TIPO[tipoCuenta] || BLOQUES_GENERICOS;
}

export const COLOR_SALDO_POSITIVO_BASE = APP_GRAY;

/**
 * Cantidad de monedas que incluye una cuenta en el hub: Mercado Pago muestra pesos y USD,
 * las multimoneda tantas como monedas habilitadas, el resto una. Sin cuenta, null.
 */
export function cantidadMonedasCuenta(cuenta) {
  if (!cuenta) return null;
  if (cuenta.tipo === 'MERCADO_PAGO') return 2;
  if (isCuentaMultimoneda(cuenta)) {
    return Math.max(1, Array.isArray(cuenta.monedas) ? cuenta.monedas.length : 1);
  }
  return 1;
}

/**
 * Color de lo positivo en los gráficos del hub: con una sola moneda respeta el color que
 * el usuario eligió para ella; con varias va en el gris estándar de la app.
 */
export function colorSaldoPositivo(cantidadMonedas, colorMoneda, fallbackColor = COLOR_SALDO_POSITIVO_BASE) {
  return cantidadMonedas === 1 && colorMoneda ? colorMoneda : fallbackColor;
}

/**
 * Cuentas multimoneda (p. ej. Efectivo): un saldo por moneda, sin sumar monedas distintas.
 * Devuelve `[{ id, label, valor, simbolo, color }]` con código, símbolo y color del catálogo
 * de monedas (`monedasDocs`); si la moneda no está en el catálogo usa valores neutros.
 */
export function getItemsMultimoneda(saldos, monedasDocs = []) {
  const porMoneda = Array.isArray(saldos?.porMoneda) ? saldos.porMoneda : [];
  return porMoneda.map((item) => {
    const moneda = monedasDocs.find((m) => String(m._id || m.id) === String(item.monedaId));
    return {
      id: String(item.monedaId),
      label: moneda?.codigo || moneda?.nombre || 'Moneda',
      valor: item.dineroEnCuenta ?? 0,
      simbolo: moneda?.simbolo || '$',
      color: moneda?.color || undefined,
    };
  });
}

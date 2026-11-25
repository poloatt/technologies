export const FLUJO_TYPE_FILTERS = [
  { id: 'payment', label: 'Pago', kinds: ['PAYMENT'] },
  { id: 'p2p', label: 'Transferencia a usuario', kinds: ['P2P_TRANSFER'] },
  { id: 'bank', label: 'Transferencia bancaria', kinds: ['EXTERNAL_TRANSFER'] },
  { id: 'refund', label: 'Devolución', kinds: ['REFUND'] },
  { id: 'other', label: 'Movimiento', kinds: ['UNKNOWN'] },
];

export const DOLAR_TYPE_FILTERS = [
  { id: 'move', label: 'Movimientos', kinds: ['USD_IN', 'USD_OUT'] },
  { id: 'card', label: 'Pagos', kinds: ['USD_PAYMENT'] },
  { id: 'fx', label: 'Compraventa', kinds: ['FX_BUY', 'FX_SELL'] },
];

const DOLAR_OUT_KINDS = new Set(['FX_SELL', 'USD_OUT', 'USD_PAYMENT']);
const DOLAR_IN_KINDS = new Set(['FX_BUY', 'USD_IN']);

/** Signo del movimiento en dólares. Vender, enviar o pagar saca; comprar o recibir entra. */
export function dolarSignedAmount(transaccion) {
  const meta = transaccion?.origen?.metadata || {};
  const kind = meta.movementKind;
  if (!DOLAR_OUT_KINDS.has(kind) && !DOLAR_IN_KINDS.has(kind)) return null;
  const face = Math.abs(Number(meta.usdAmount) || Number(transaccion?.monto) || 0);
  return DOLAR_OUT_KINDS.has(kind) ? -face : face;
}

export const INVERSION_TYPE_FILTERS = [
  { id: 'reserve', label: 'Reservado', kinds: ['RESERVE_LOCK', 'RESERVE_RELEASE'] },
  { id: 'invest', label: 'Inversiones', kinds: ['INVESTMENT_IN', 'INVESTMENT_OUT'] },
  { id: 'yield', label: 'Rendimientos', kinds: ['INVESTMENT_YIELD', 'YIELD'] },
];

/** null = todos. [] = ninguno. Un subconjunto se manda como kinds. */
export function kindsQueryFor(options, enabledIds) {
  if (enabledIds == null) return undefined;
  const selected = options.filter((option) => enabledIds.includes(option.id));
  if (selected.length === 0) return 'none';
  if (selected.length === options.length) return undefined;
  return selected.flatMap((option) => option.kinds).join(',');
}

export function toggleKindId(options, enabledIds, id) {
  const current = enabledIds == null ? options.map((option) => option.id) : enabledIds;
  const next = current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id];
  if (next.length === options.length) return null;
  return next;
}

export function toggleAllKinds(options, enabledIds) {
  const allOn = enabledIds == null || enabledIds.length === options.length;
  return allOn ? [] : null;
}

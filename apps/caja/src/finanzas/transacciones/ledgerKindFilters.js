export const FLUJO_TYPE_FILTERS = [
  { id: 'payment', label: 'Pago', kinds: ['PAYMENT'] },
  { id: 'p2p', label: 'Transferencia a usuario', kinds: ['P2P_TRANSFER'] },
  { id: 'bank', label: 'Transferencia bancaria', kinds: ['EXTERNAL_TRANSFER'] },
  { id: 'refund', label: 'Devolución', kinds: ['REFUND'] },
  { id: 'other', label: 'Movimiento', kinds: ['UNKNOWN'] },
];

export const DOLAR_TYPE_FILTERS = [
  { id: 'sell', label: 'Venta', kinds: ['FX_SELL'] },
  { id: 'buy', label: 'Compra', kinds: ['FX_BUY'] },
];

export const INVERSION_TYPE_FILTERS = [
  { id: 'reserve-in', label: 'Reserva in', kinds: ['RESERVE_LOCK'] },
  { id: 'reserve-out', label: 'Reserva out', kinds: ['RESERVE_RELEASE'] },
  { id: 'invested', label: 'Invertido', kinds: ['INVESTMENT_IN'] },
  { id: 'rescued', label: 'Rescatado', kinds: ['INVESTMENT_OUT'] },
  { id: 'yield', label: 'Rendimiento', kinds: ['INVESTMENT_YIELD', 'YIELD'] },
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

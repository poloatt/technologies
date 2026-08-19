/** Rango del mes calendario actual (YYYY-MM-DD). */
export function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    fechaInicio: start.toISOString().split('T')[0],
    fechaFin: end.toISOString().split('T')[0],
    estado: 'PAGADO',
  };
}

export function formatMonto(monto, simbolo, showValues) {
  if (!showValues) return '****';
  const sign = monto < 0 ? '−' : '';
  const abs = Math.abs(monto).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${sign}${simbolo} ${abs}`;
}

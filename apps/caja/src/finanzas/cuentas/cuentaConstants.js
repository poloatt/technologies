/** Cuentas visibles en el hub antes de pedir expandir. */
export const CUENTAS_HUB_PREVIEW_COUNT = 3;

/** Altura y espaciado compacto del hub Cuentas (solo márgenes/padding, no tipografía). */
export const CUENTA_HUB_ROW = {
  minHeight: 32,
  py: 0.2,
  px: 0.75,
  gap: 0.5,
  mb: 0.375,
};

export function saldoReportadoMercadoPago(cuenta) {
  if (cuenta?.tipo !== 'MERCADO_PAGO') return null;
  const valor = cuenta?.mercadopago?.disponibleRetiro ?? cuenta?.saldo;
  if (valor == null || Number.isNaN(Number(valor))) return null;
  return Number(valor);
}

export function isCuentaMultimoneda(cuenta) {
  return Boolean(cuenta?.multimoneda || (cuenta?.esDefault && cuenta?.tipo === 'EFECTIVO'));
}

export function getMonedaFromCuenta(cuenta) {
  const primera = Array.isArray(cuenta?.monedas) && cuenta.monedas.length > 0
    ? cuenta.monedas[0]
    : cuenta?.moneda;
  if (!primera) return { simbolo: '$', color: '#75AADB', codigo: '' };
  if (typeof primera === 'object') {
    return {
      id: primera.id || primera._id,
      codigo: primera.codigo || '',
      nombre: primera.nombre || '',
      simbolo: primera.simbolo || '$',
      color: primera.color || '#75AADB',
    };
  }
  return { simbolo: '$', color: '#75AADB', codigo: '' };
}

/**
 * Devuelve las monedas habilitadas para una cuenta multimoneda (p. ej. Efectivo),
 * normalizadas con símbolo y color. Si `cuenta.monedas` viene del backend se usa
 * directamente; si no, cae al catálogo de monedas activas recibido como fallback.
 */
export function getMonedasFromCuenta(cuenta, monedasCatalog = []) {
  const source = Array.isArray(cuenta?.monedas) && cuenta.monedas.length > 0
    ? cuenta.monedas
    : monedasCatalog.filter((m) => m && m.activa !== false);

  return source
    .filter((m) => m && m.activa !== false)
    .map((m) => ({
      id: String(m.id || m._id),
      _id: String(m.id || m._id),
      codigo: m.codigo || '',
      nombre: m.nombre || m.codigo || 'Moneda',
      simbolo: m.simbolo || '$',
      color: m.color || '#75AADB',
      orden: m.orden ?? 0,
    }));
}

export function normalizeCuenta(cuenta) {
  const id = cuenta.id || cuenta._id;
  return {
    id,
    _id: id,
    nombre: cuenta.nombre || 'Sin nombre',
    tipo: cuenta.tipo || 'OTRO',
    moneda: cuenta.moneda,
    monedas: Array.isArray(cuenta.monedas) ? cuenta.monedas : [],
    esDefault: Boolean(cuenta.esDefault),
    multimoneda: isCuentaMultimoneda(cuenta),
  };
}

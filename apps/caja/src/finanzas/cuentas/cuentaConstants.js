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

export function getMonedaFromCuenta(cuenta) {
  if (!cuenta?.moneda) return { simbolo: '$', color: '#2196F3' };
  if (typeof cuenta.moneda === 'object') {
    return {
      simbolo: cuenta.moneda.simbolo || '$',
      color: cuenta.moneda.color || '#2196F3',
    };
  }
  return { simbolo: '$', color: '#2196F3' };
}

export function normalizeCuenta(cuenta) {
  const id = cuenta.id || cuenta._id;
  return {
    id,
    _id: id,
    nombre: cuenta.nombre || 'Sin nombre',
    tipo: cuenta.tipo || 'OTRO',
    moneda: cuenta.moneda,
  };
}

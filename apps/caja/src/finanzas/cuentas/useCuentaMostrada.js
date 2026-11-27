import { useAPI } from '@shared/hooks/useAPI';

const FALLBACK_NOMBRE = 'Mercado Pago';
const HUB_MERCADO_PAGO_NOMBRE = 'MERCADOPAGO';

/**
 * Cuenta a la que pertenecen los saldos del hub. Hoy el desarrollo solo
 * incluye Mercado Pago: se usa su cuenta, o la indicada por `cuentaId`.
 */
export function useCuentaMostrada(cuentaId) {
  const { data } = useAPI('/api/cuentas', { enableCache: true, cacheDuration: 60000 });
  const cuentas = data?.docs ?? (Array.isArray(data) ? data : []);
  const cuenta = (cuentaId && cuentas.find((c) => (c.id || c._id) === cuentaId))
    || cuentas.find((c) => c.tipo === 'MERCADO_PAGO');
  const nombre = cuenta?.nombre || FALLBACK_NOMBRE;
  const isMercadoPago = !cuenta || cuenta.tipo === 'MERCADO_PAGO';
  return {
    cuenta: cuenta || null,
    nombre,
    hubNombre: isMercadoPago ? HUB_MERCADO_PAGO_NOMBRE : nombre,
  };
}

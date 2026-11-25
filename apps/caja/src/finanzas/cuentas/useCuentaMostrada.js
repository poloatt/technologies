import { useAPI } from '@shared/hooks/useAPI';

const FALLBACK_NOMBRE = 'Mercado Pago';

/**
 * Cuenta a la que pertenecen los saldos del hub. Hoy el desarrollo solo
 * incluye Mercado Pago: se usa su cuenta, o la indicada por `cuentaId`.
 */
export function useCuentaMostrada(cuentaId) {
  const { data } = useAPI('/api/cuentas', { enableCache: true, cacheDuration: 60000 });
  const cuentas = data?.docs ?? (Array.isArray(data) ? data : []);
  const cuenta = (cuentaId && cuentas.find((c) => (c.id || c._id) === cuentaId))
    || cuentas.find((c) => c.tipo === 'MERCADO_PAGO');
  return {
    cuenta: cuenta || null,
    nombre: cuenta?.nombre || FALLBACK_NOMBRE,
  };
}

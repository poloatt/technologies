import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  resolveFinanzasBranch,
  getCuentasPath,
  getTransaccionesPath,
} from './finanzasDeepLink';

/** Rama Caja activa (finanzas | propiedades | inventario) según pathname. */
export function useFinanzasBranch() {
  const { pathname } = useLocation();

  return useMemo(() => {
    const branchId = resolveFinanzasBranch(pathname);
    return {
      branchId,
      cuentasPath: getCuentasPath(branchId),
      transaccionesPath: getTransaccionesPath(branchId),
    };
  }, [pathname]);
}

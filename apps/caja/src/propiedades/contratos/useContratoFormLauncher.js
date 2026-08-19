import { useCallback, useState } from 'react';
import clienteAxios from '@shared/config/axios';
import { buildContratoInitialDataForInquilino } from './buildContratoInitialDataForInquilino';

/**
 * Abre ContratoForm con datos precargados para un inquilino.
 * Carga relatedData bajo demanda la primera vez.
 */
export function useContratoFormLauncher({ onSubmitted } = {}) {
  const [open, setOpen] = useState(false);
  const [initialData, setInitialData] = useState({});
  const [relatedData, setRelatedData] = useState({
    propiedades: [],
    inquilinos: [],
    habitaciones: [],
    cuentas: [],
    monedas: [],
  });

  const loadRelatedData = useCallback(async () => {
    const [propRes, cuentasRes, monedasRes, habRes, inqRes] = await Promise.all([
      clienteAxios.get('/api/propiedades?limit=500'),
      clienteAxios.get('/api/cuentas'),
      clienteAxios.get('/api/monedas'),
      clienteAxios.get('/api/habitaciones?limit=500'),
      clienteAxios.get('/api/inquilinos?limit=100'),
    ]);
    const data = {
      propiedades: propRes.data.docs || [],
      cuentas: cuentasRes.data.docs || [],
      monedas: monedasRes.data.docs || [],
      habitaciones: habRes.data.docs || [],
      inquilinos: inqRes.data.docs || [],
    };
    setRelatedData(data);
    return data;
  }, []);

  const openForInquilino = useCallback(
    async (inquilino) => {
      const data =
        relatedData.propiedades.length > 0 ? relatedData : await loadRelatedData();
      setInitialData(
        buildContratoInitialDataForInquilino(inquilino, data.propiedades, data.cuentas),
      );
      setOpen(true);
    },
    [relatedData, loadRelatedData],
  );

  const openBlank = useCallback(async () => {
    await loadRelatedData();
    setInitialData({ esMantenimiento: false, tipoContrato: 'ALQUILER' });
    setOpen(true);
  }, [loadRelatedData]);

  const close = useCallback(() => setOpen(false), []);

  const handleSubmitted = useCallback(() => {
    setOpen(false);
    onSubmitted?.();
  }, [onSubmitted]);

  return {
    open,
    initialData,
    relatedData,
    openForInquilino,
    openBlank,
    close,
    handleSubmitted,
    loadRelatedData,
    setRelatedData,
  };
}

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import MonedaTile from './MonedaTile';
import { MonedaTileSkeleton } from './MonedasCarousel';
import MonedasSortableList from './MonedasSortableList';
import { COLORES_MONEDA, getDefaultColorForMoneda } from './monedaConstants';
import { sortMonedasByOrden } from './monedaSortUtils';
import { normalizeMoneda } from './index';
import { CommonForm } from '@shared/components/common';
import clienteAxios from '@shared/config/axios';
import { useSnackbar } from 'notistack';
import { EmptyState } from '@shared/components/common';
import { useAPI, useResponsive } from '@shared/hooks';

/**
 * Setup de monedas: se muestra solo dentro del popup (sin página propia).
 */
export function MonedasSetup() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMoneda, setEditingMoneda] = useState(null);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [selectedMonedaId, setSelectedMonedaId] = useState(null);
  const { isDesktop } = useResponsive();

  // Usar nuestro hook personalizado para cargar monedas - Optimizaciones
  const { 
    data: monedasData, 
    loading: isLoading, 
    error: monedasError,
    refetch: refetchMonedas
  } = useAPI('/api/monedas', {
    enableCache: true, // Activar caché para reducir solicitudes
    cacheDuration: 30000, // 30 segundos de caché
    dependencies: [], // Quitar dependencia a window.location.href
    forceRevalidate: false, // No forzar revalidación en cada render
    params: { sort: 'orden', limit: 200 },
  });

  const monedas = useMemo(() => {
    const docs = Array.isArray(monedasData?.docs)
      ? monedasData.docs
      : (Array.isArray(monedasData) ? monedasData : []);
    return sortMonedasByOrden(docs);
  }, [monedasData]);

  // Manejar errores de la API
  useEffect(() => {
    if (monedasError) {
      console.error('Error al cargar monedas:', monedasError);
      enqueueSnackbar('Error al cargar monedas: ' + monedasError.message, { variant: 'error' });
    }
  }, [monedasError, enqueueSnackbar]);

  // Recargar al volver a la pestaña, pero con TTL para no refetch en exceso
  // (se eliminó el polling cada 60s que disparaba requests innecesarias).
  const lastRefetchRef = useRef(Date.now());
  useEffect(() => {
    const REFRESH_TTL_MS = 60000;
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRefetchRef.current < REFRESH_TTL_MS) return;
      lastRefetchRef.current = Date.now();
      refetchMonedas();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetchMonedas]);

  // Escuchar el evento del botón "+" del Header
  useEffect(() => {
    const handleHeaderAdd = (e) => {
      if (e.detail?.type === 'moneda' || e.detail?.type === 'monedas') {
        setEditingMoneda(null);
        setIsFormOpen(true);
      }
    };

    window.addEventListener('headerAddButtonClicked', handleHeaderAdd);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAdd);
  }, []);

  const handleFormSubmit = useCallback(async (formData) => {
    try {
      // Mostrar mensaje de carga
      const loadingMsg = enqueueSnackbar('Guardando moneda...', { 
        variant: 'info',
        persist: true 
      });
      
      let response;
      let monedaId = null;
      
      if (editingMoneda) {
        // Usar siempre el ID normalizado
        monedaId = editingMoneda.id || editingMoneda._id;
        
        if (!monedaId) {
          closeSnackbar(loadingMsg);
          enqueueSnackbar('Error: ID de moneda no válido', { variant: 'error' });
          return;
        }
        
        // Normalizar datos antes de enviar
        const datosActualizados = {
          codigo: formData.codigo?.trim() || '',
          nombre: formData.nombre?.trim() || '',
          simbolo: formData.simbolo?.trim() || '',
          color: formData.color || getDefaultColorForMoneda(formData.codigo),
          activa: typeof formData.activa === 'boolean' ? formData.activa : true
        };
        
        response = await clienteAxios.put(`/api/monedas/${monedaId}`, datosActualizados);
        closeSnackbar(loadingMsg);
        enqueueSnackbar('Moneda actualizada exitosamente', { variant: 'success' });
      } else {
        // Normalizar datos para nueva moneda
        const nuevaMoneda = {
          codigo: formData.codigo?.trim() || '',
          nombre: formData.nombre?.trim() || '',
          simbolo: formData.simbolo?.trim() || '',
          color: formData.color || getDefaultColorForMoneda(formData.codigo),
          activa: true
        };
        
        response = await clienteAxios.post('/api/monedas', nuevaMoneda);
        closeSnackbar(loadingMsg);
        enqueueSnackbar('Moneda creada exitosamente', { variant: 'success' });
      }
      
      setIsFormOpen(false);
      setEditingMoneda(null);
      await refetchMonedas();
      window.dispatchEvent(new Event('monedasRefreshed'));
      window.dispatchEvent(new Event('cuentasRefreshed'));
    } catch (error) {
      console.error('Error al guardar moneda:', error);
      enqueueSnackbar('Error al guardar moneda: ' + (error.response?.data?.message || error.message), { variant: 'error' });
    }
  }, [editingMoneda, enqueueSnackbar, closeSnackbar, refetchMonedas]);

  const handleEdit = useCallback((moneda) => {
    if (!moneda || (!moneda.id && !moneda._id)) {
      enqueueSnackbar('Error: No se puede editar la moneda', { variant: 'error' });
      return;
    }
    
    // Normalizar el objeto para edición
    const monedaEditada = {
      id: moneda.id || moneda._id,
      _id: moneda.id || moneda._id,
      codigo: moneda.codigo || '',
      nombre: moneda.nombre || '',
      simbolo: moneda.simbolo || '',
      color: moneda.color || getDefaultColorForMoneda(moneda.codigo),
      activa: typeof moneda.activa === 'boolean' ? moneda.activa : true
    };
    
    setEditingMoneda(monedaEditada);
    setIsFormOpen(true);
  }, [enqueueSnackbar]);

  const handleDelete = useCallback(async (id) => {
    if (!id) {
      enqueueSnackbar('Error: ID de moneda no válido', { variant: 'error' });
      return;
    }
    
    try {
      // Mostrar mensaje de carga
      const loadingMsg = enqueueSnackbar('Eliminando moneda...', { 
        variant: 'info',
        persist: true 
      });
      
      await clienteAxios.delete(`/api/monedas/${id}`);
      
      // Cerrar mensaje de carga
      closeSnackbar(loadingMsg);
      enqueueSnackbar('Moneda eliminada exitosamente', { variant: 'success' });
      await refetchMonedas();
      window.dispatchEvent(new Event('monedasRefreshed'));
      window.dispatchEvent(new Event('cuentasRefreshed'));
    } catch (error) {
      enqueueSnackbar('Error al eliminar la moneda: ' + (error.response?.data?.message || error.message), { variant: 'error' });
    }
  }, [enqueueSnackbar, closeSnackbar, refetchMonedas]);

  const handleToggleActive = useCallback(async (id) => {
    if (!id) {
      enqueueSnackbar('Error: ID de moneda no válido', { variant: 'error' });
      return;
    }
    
    try {
      // Mostrar mensaje de carga
      const loadingMsg = enqueueSnackbar('Actualizando estado...', { 
        variant: 'info',
        persist: true 
      });
      
      // Buscar la moneda existente
      const moneda = monedas.find(m => m.id === id || m._id === id);
      
      if (!moneda) {
        closeSnackbar(loadingMsg);
        enqueueSnackbar('Error: No se pudo encontrar la moneda', { variant: 'error' });
        return;
      }
      
      // Realizar la operación
      await clienteAxios.patch(`/api/monedas/${id}/toggle-active`);
      
      // Cerrar mensaje de carga
      closeSnackbar(loadingMsg);
      
      enqueueSnackbar(
        `Moneda ${moneda.codigo} ${!moneda.activa ? 'activada' : 'desactivada'} exitosamente`, 
        { variant: 'success' }
      );
      
      // Recargar datos
      await refetchMonedas();
      window.dispatchEvent(new Event('monedasRefreshed'));
      window.dispatchEvent(new Event('cuentasRefreshed'));
    } catch (error) {
      enqueueSnackbar('Error al cambiar el estado de la moneda: ' + (error.response?.data?.message || error.message), { variant: 'error' });
    }
  }, [monedas, enqueueSnackbar, closeSnackbar, refetchMonedas]);

  const handleReorderMonedas = useCallback(async (order) => {
    try {
      await clienteAxios.put('/api/monedas/reorder', { order });
      enqueueSnackbar('Orden de monedas actualizado', { variant: 'success' });
      await refetchMonedas();
      window.dispatchEvent(new Event('monedasRefreshed'));
      window.dispatchEvent(new Event('cuentasRefreshed'));
    } catch (error) {
      enqueueSnackbar(
        'Error al guardar el orden: ' + (error.response?.data?.message || error.message),
        { variant: 'error' },
      );
      throw error;
    }
  }, [enqueueSnackbar, refetchMonedas]);

  const renderMonedaTile = useCallback((moneda) => {
    const monedaId = moneda.id || moneda._id;
    return (
      <MonedaTile
        moneda={normalizeMoneda(moneda)}
        variant="full"
        fullWidth={isDesktop}
        selected={selectedMonedaId === monedaId}
        onSelect={setSelectedMonedaId}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
      />
    );
  }, [isDesktop, selectedMonedaId, handleEdit, handleDelete, handleToggleActive]);

  const formFields = [
    {
      name: 'codigo',
      label: 'Código',
      type: 'text',
      required: true,
      helperText: 'Ejemplo: USD, EUR, ARS'
    },
    {
      name: 'nombre',
      label: 'Nombre',
      type: 'text',
      required: true,
      helperText: 'Ejemplo: Dólar Estadounidense, Euro, Peso Argentino'
    },
    {
      name: 'simbolo',
      label: 'Símbolo',
      type: 'text',
      required: true,
      helperText: 'Ejemplo: $, €, ₱'
    },
    {
      name: 'color',
      label: 'Color para balances positivos',
      type: 'select',
      required: true,
      options: Object.entries(COLORES_MONEDA).map(([key, { value, label }]) => ({
        value: value,
        label: label
      })),
      helperText: 'Este color se usará para mostrar los balances positivos en esta moneda'
    }
  ];

  const openCreate = () => {
    setEditingMoneda(null);
    setIsFormOpen(true);
  };

  const listBody = isLoading ? (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.625, width: '100%' }}>
      <MonedaTileSkeleton count={4} width="100%" />
    </Box>
  ) : monedas.length === 0 ? (
    <EmptyState
      onAdd={openCreate}
      message="Todavía no hay monedas"
      submessage="Agregá ARS, USD u otra moneda antes de crear cuentas."
    />
  ) : (
    <>
      {monedas.length > 1 ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Arrastrá el asa para reordenar. El orden se usa en balances y listados.
        </Typography>
      ) : null}
      <MonedasSortableList
        monedas={monedas}
        onReorder={handleReorderMonedas}
        layout="column"
        renderTile={renderMonedaTile}
      />
    </>
  );

  return (
    <Box sx={{ px: 1.5, py: 1.25 }}>
      {listBody}

      <CommonForm
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingMoneda(null);
        }}
        onSubmit={handleFormSubmit}
        title={editingMoneda ? 'Editar Moneda' : 'Nueva Moneda'}
        fields={formFields}
        initialData={editingMoneda || { color: COLORES_MONEDA.CELESTE_ARGENTINA.value }}
        isEditing={!!editingMoneda}
      />
    </Box>
  );
}

export default MonedasSetup;
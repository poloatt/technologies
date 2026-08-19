import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button, Box, Tooltip, IconButton } from '@mui/material';
import {
  FinanzasSectionNav,
  MonedaTile,
  MonedasCarousel,
  MonedasSortableList,
  MonedaTileSkeleton,
  COLORES_MONEDA,
  normalizeMoneda,
  sortMonedasByOrden,
  monedaDetailPath,
} from '../finanzas';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';
import { CommonDetails, CommonForm } from '@shared/components/common';
import { AddOutlined as AddIcon, RefreshOutlined as RefreshIcon } from '@mui/icons-material';
import clienteAxios from '@shared/config/axios';
import { useSnackbar } from 'notistack';
import { EmptyState } from '@shared/components/common';
import { useAPI, useResponsive } from '@shared/hooks';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

export function Monedas() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMoneda, setEditingMoneda] = useState(null);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedMonedaId = searchParams.get('id');
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
      if (
        (e.detail?.path && e.detail.path === location.pathname) ||
        e.detail?.type === 'moneda' ||
        e.detail?.type === 'monedas'
      ) {
        setEditingMoneda(null);
        setIsFormOpen(true);
      }
    };
    
    window.addEventListener('headerAddButtonClicked', handleHeaderAdd);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAdd);
  }, [location.pathname]);

  // Abrir formulario tras redirección si openAdd está en el estado
  useEffect(() => {
    if (location.state?.openAdd) {
      setEditingMoneda(null);
      setIsFormOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

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
          color: formData.color || COLORES_MONEDA.CELESTE_ARGENTINA.value,
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
          color: formData.color || COLORES_MONEDA.CELESTE_ARGENTINA.value,
          activa: true
        };
        
        response = await clienteAxios.post('/api/monedas', nuevaMoneda);
        closeSnackbar(loadingMsg);
        enqueueSnackbar('Moneda creada exitosamente', { variant: 'success' });
      }
      
      setIsFormOpen(false);
      setEditingMoneda(null);
      await refetchMonedas();
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
      color: moneda.color || COLORES_MONEDA.CELESTE_ARGENTINA.value,
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
    } catch (error) {
      enqueueSnackbar('Error al cambiar el estado de la moneda: ' + (error.response?.data?.message || error.message), { variant: 'error' });
    }
  }, [monedas, enqueueSnackbar, closeSnackbar, refetchMonedas]);

  const handleReorderMonedas = useCallback(async (order) => {
    try {
      await clienteAxios.put('/api/monedas/reorder', { order });
      enqueueSnackbar('Orden de monedas actualizado', { variant: 'success' });
      await refetchMonedas();
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
        onSelect={(id) => navigate(monedaDetailPath(id), { replace: true })}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
      />
    );
  }, [isDesktop, selectedMonedaId, navigate, handleEdit, handleDelete, handleToggleActive]);

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

  return (
    <Box sx={cajaPageLayoutSx}>
      <FinanzasSectionNav variant="strip" />
      <CommonDetails
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Recargar datos">
              <IconButton 
                size="small"
                onClick={() => {
                  const loadingMsg = enqueueSnackbar('Recargando datos...', { 
                    variant: 'info',
                    persist: true 
                  });
                  refetchMonedas().then(() => {
                    closeSnackbar(loadingMsg);
                    enqueueSnackbar('Datos actualizados', { variant: 'success' });
                  });
                }}
                sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              size="small"
              onClick={() => {
                setEditingMoneda(null);
                setIsFormOpen(true);
              }}
              sx={{
                borderRadius: 1,
                textTransform: 'none'
              }}
            >
              Nueva Moneda
            </Button>
          </Box>
        }
      >
        {isLoading ? (
          isDesktop ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.625, width: '100%' }}>
              <MonedaTileSkeleton count={4} width="100%" />
            </Box>
          ) : (
            <MonedasCarousel>
              <MonedaTileSkeleton count={4} />
            </MonedasCarousel>
          )
        ) : monedas.length === 0 ? (
          <EmptyState 
            onAdd={() => setIsFormOpen(true)}
            message="No hay monedas configuradas"
            submessage="Haz clic en el botón para agregar una nueva moneda"
          />
        ) : (
          <MonedasSortableList
            monedas={monedas}
            onReorder={handleReorderMonedas}
            layout={isDesktop ? 'column' : 'carousel'}
            renderTile={renderMonedaTile}
          />
        )}
      </CommonDetails>

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

export default Monedas;
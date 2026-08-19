import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Chip, Typography } from '@shared/utils/materialImports';
import {
  FabNuevaTransaccion,
  TransaccionTable,
  TransaccionForm,
  BranchFinanzasSectionNav,
  cuentaDetailPath,
  useFinanzasBranch,
} from '../finanzas';
import clienteAxios from '@shared/config/axios';
import { useSnackbar } from 'notistack';
import { EmptyState } from '@shared/components/common';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { useAPI } from '@shared/hooks/useAPI';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';

export function Transacciones() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const { enqueueSnackbar } = useSnackbar();
  const [editingTransaccion, setEditingTransaccion] = useState(null);
  const { showValues } = useValuesVisibility();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cuentaFilterId = searchParams.get('cuenta');
  const { branchId } = useFinanzasBranch();

  // Usar nuestro hook personalizado para cargar datos
  const { 
    data: monedasData, 
    loading: monedasLoading, 
    error: monedasError 
  } = useAPI('/api/monedas');

  const { 
    data: cuentasData, 
    loading: cuentasLoading, 
    error: cuentasError 
  } = useAPI('/api/cuentas');

  const { 
    data: transaccionesData, 
    loading: transaccionesLoading, 
    error: transaccionesError,
    refetch: refetchTransacciones 
  } = useAPI('/api/transacciones', { 
    params: { limit: 1000, sort: '-fecha' } 
  });

  // Extraer arrays de datos de las respuestas paginadas
  const monedas = monedasData?.docs || [];
  const cuentas = cuentasData?.docs || [];
  const transacciones = transaccionesData?.docs || [];

  const transaccionesFiltradas = useMemo(() => {
    if (!cuentaFilterId) return transacciones;
    return transacciones.filter((t) => {
      const cuentaId = t.cuenta?._id || t.cuenta?.id || t.cuenta;
      return String(cuentaId) === String(cuentaFilterId);
    });
  }, [transacciones, cuentaFilterId]);

  const cuentaFiltrada = useMemo(() => {
    if (!cuentaFilterId) return null;
    return cuentas.find((c) => (c._id || c.id) === cuentaFilterId) || null;
  }, [cuentas, cuentaFilterId]);

  // Estado de carga general
  const isLoading = monedasLoading || cuentasLoading || transaccionesLoading;

  // Para errores
  useEffect(() => {
    if (monedasError) {
      enqueueSnackbar('Error al cargar monedas: ' + monedasError.message, { variant: 'error' });
    }
    if (cuentasError) {
      enqueueSnackbar('Error al cargar cuentas: ' + cuentasError.message, { variant: 'error' });
    }
    if (transaccionesError) {
      enqueueSnackbar('Error al cargar transacciones: ' + transaccionesError.message, { variant: 'error' });
    }
  }, [monedasError, cuentasError, transaccionesError, enqueueSnackbar]);

  const handleCreateMoneda = useCallback(async (data) => {
    try {
      const response = await clienteAxios.post('/api/monedas', data);
      const newMoneda = response.data;
      enqueueSnackbar('Moneda creada exitosamente', { variant: 'success' });
      return newMoneda;
    } catch (error) {
      console.error('Error al crear moneda:', error);
      enqueueSnackbar('Error al crear moneda', { variant: 'error' });
      throw error;
    }
  }, [enqueueSnackbar]);

  const handleCreateCuenta = useCallback(async (data) => {
    try {
      console.log('Creando cuenta con datos:', data);
      const response = await clienteAxios.post('/api/cuentas', { 
        nombre: data.nombre,
        moneda: data.monedaId,
        tipo: data.tipo
      });
      
      const newCuenta = response.data;
      console.log('Cuenta creada:', newCuenta);
      
      // Refrescar los datos después de crear la cuenta
      refetchTransacciones();
      
      enqueueSnackbar('Cuenta creada exitosamente', { variant: 'success' });
      return newCuenta;
    } catch (error) {
      console.error('Error al crear cuenta:', error);
      console.error('Detalles del error:', error.response?.data);
      enqueueSnackbar(
        'Error al crear la cuenta: ' + 
        (error.response?.data?.error || error.message), 
        { variant: 'error' }
      );
      throw error;
    }
  }, [enqueueSnackbar, refetchTransacciones]);

  const handleEdit = useCallback(async (transaccion) => {
    try {
      console.log('Editando transacción:', transaccion);
      
      // Asegurarse de que la cuenta esté en el formato correcto
      const transaccionFormateada = {
        ...transaccion,
        cuenta: transaccion.cuenta?._id || transaccion.cuenta?.id || transaccion.cuenta,
        moneda: transaccion.moneda?._id || transaccion.moneda?.id || transaccion.moneda
      };
      
      console.log('Transacción formateada para edición:', transaccionFormateada);
      setEditingTransaccion(transaccionFormateada);
      setFormKey(prev => prev + 1);
      setIsFormOpen(true);
    } catch (error) {
      console.error('Error al preparar edición:', error);
      enqueueSnackbar('Error al cargar datos para edición', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const handleFormSubmit = useCallback(async (formData) => {
    try {
      console.log('Datos del formulario recibidos:', formData);
      
      // Verificar autenticación
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión nuevamente.');
      }

      // Validar que la cuenta exista
      const cuentaSeleccionada = cuentas.find(c => 
        c._id === formData.cuenta || 
        c.id === formData.cuenta ||
        c._id === formData.cuenta?._id ||
        c.id === formData.cuenta?._id
      );

      if (!cuentaSeleccionada) {
        console.log('Cuentas disponibles:', cuentas);
        console.log('ID de cuenta buscado:', formData.cuenta);
        throw new Error('La cuenta seleccionada no existe');
      }

      const datosAEnviar = {
        descripcion: formData.descripcion,
        monto: parseFloat(formData.monto),
        fecha: formData.fecha || new Date().toISOString(),
        categoria: formData.categoria,
        estado: formData.estado || 'PENDIENTE',
        cuenta: cuentaSeleccionada._id || cuentaSeleccionada.id,
        tipo: formData.tipo || 'INGRESO',
        moneda: formData.moneda
      };

      console.log('Datos procesados a enviar:', datosAEnviar);
      
      let response;
      if (editingTransaccion) {
        console.log('Actualizando transacción:', editingTransaccion._id);
        response = await clienteAxios.put(`/api/transacciones/${editingTransaccion._id}`, datosAEnviar);
        console.log('Respuesta del servidor:', response.data);
        enqueueSnackbar('Transacción actualizada exitosamente', { variant: 'success' });
      } else {
        console.log('Creando nueva transacción');
        response = await clienteAxios.post('/api/transacciones', datosAEnviar);
        enqueueSnackbar('Transacción creada exitosamente', { variant: 'success' });
      }
      
      setIsFormOpen(false);
      setEditingTransaccion(null);
      setFormKey(prev => prev + 1);
      refetchTransacciones();
    } catch (error) {
      console.error('Error completo:', error);
      console.error('Detalles del error:', error.response?.data);
      
      // Manejar error de autenticación
      if (error.response?.status === 401) {
        enqueueSnackbar('Sesión expirada. Por favor, inicia sesión nuevamente.', { 
          variant: 'error',
          autoHideDuration: 5000
        });
        window.location.href = '/#/login';
        return;
      }
      
      const mensajeError = error.response?.data?.message || error.message || 'Error al guardar la transacción';
      enqueueSnackbar(mensajeError, { variant: 'error' });
    }
  }, [enqueueSnackbar, refetchTransacciones, editingTransaccion, cuentas]);

  const handleDelete = useCallback(async (id) => {
    try {
      await clienteAxios.delete(`/api/transacciones/${id}`);
      enqueueSnackbar('Transacción eliminada exitosamente', { variant: 'success' });
      refetchTransacciones();
    } catch (error) {
      console.error('Error al eliminar transacción:', error);
      enqueueSnackbar('Error al eliminar la transacción', { variant: 'error' });
    }
  }, [enqueueSnackbar, refetchTransacciones]);

  const handleOpenForm = useCallback(() => {
    setEditingTransaccion(null);
    setFormKey(prev => prev + 1);
    setIsFormOpen(true);
  }, []);

  // Abrir formulario automáticamente si viene de navegación con openAdd
  useEffect(() => {
    if (location.state?.openAdd) {
      handleOpenForm();
      // Limpiar el estado para evitar abrirlo de nuevo al navegar
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  // Listener local para abrir el formulario si ya estamos en la ruta
  useEffect(() => {
    const openLocal = () => handleOpenForm();
    window.addEventListener('openAddFormLocal', openLocal);
    return () => window.removeEventListener('openAddFormLocal', openLocal);
  }, [handleOpenForm]);

  // Escuchar evento del Header para abrir formulario
  useEffect(() => {
    const handleHeaderAddButton = (event) => {
      // Modular: abrir si el path del evento coincide con la ruta actual, o si el type es 'transaccion' o 'transacciones'
      if (
        (event.detail?.path && event.detail.path === location.pathname) ||
        event.detail?.type === 'transaccion' ||
        event.detail?.type === 'transacciones'
      ) {
        handleOpenForm();
      }
    };

    window.addEventListener('headerAddButtonClicked', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAddButton);
  }, [handleOpenForm, location.pathname]);

  // Escuchar eventos de sincronización bancaria
  useEffect(() => {
    const handleTransaccionesRefreshed = () => {
      console.log('Refrescando transacciones después de sincronización bancaria');
      refetchTransacciones();
    };

    window.addEventListener('transaccionesRefreshed', handleTransaccionesRefreshed);
    return () => window.removeEventListener('transaccionesRefreshed', handleTransaccionesRefreshed);
  }, [refetchTransacciones]);

  return (
    <Box sx={{ ...cajaPageLayoutSx, position: 'relative', minHeight: '80vh', bgcolor: 'background.default' }}>
      <BranchFinanzasSectionNav branchId={branchId} variant="strip" />
      {cuentaFilterId && cuentaFiltrada && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 0.5 }}>
          <Chip
            label={`Cuenta: ${cuentaFiltrada.nombre}`}
            size="small"
            onDelete={() => navigate(`${location.pathname.split('?')[0]}`, { replace: true })}
            variant="outlined"
          />
          <Typography
            component="button"
            variant="caption"
            onClick={() => navigate(cuentaDetailPath(cuentaFilterId, branchId))}
            sx={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'primary.main',
              textDecoration: 'underline',
            }}
          >
            Ver detalle
          </Typography>
        </Box>
      )}
      <FabNuevaTransaccion onClick={handleOpenForm} />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <EmptyState
            title="Cargando transacciones..."
            description="Por favor espera mientras cargamos tus datos."
            icon="loading"
          />
        </Box>
      ) : transaccionesFiltradas.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <EmptyState
            title={cuentaFilterId ? 'Sin movimientos en esta cuenta' : 'No hay transacciones'}
            description={
              cuentaFilterId
                ? 'Probá sincronizar Mercado Pago o importar el CSV desde Cuentas.'
                : 'Comienza creando tu primera transacción.'
            }
            buttonText={cuentaFilterId ? 'Ir a Cuentas' : 'Nueva Transacción'}
            onButtonClick={
              cuentaFilterId
                ? () => navigate(cuentaDetailPath(cuentaFilterId, branchId))
                : handleOpenForm
            }
            icon="empty"
          />
        </Box>
      ) : (
        <Box sx={{ mt: 2 }}>
          <TransaccionTable
            transacciones={transaccionesFiltradas}
            onEdit={handleEdit}
            onDelete={handleDelete}
            showVisibilityToggle={true}
            showValues={showValues}
          />
        </Box>
      )}

      {isFormOpen && (
        <TransaccionForm
          open={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleFormSubmit}
          initialData={editingTransaccion || {}}
          isEditing={!!editingTransaccion}
        />
      )}
    </Box>
  );
}

export default Transacciones;


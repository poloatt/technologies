import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Box,
  Typography,
  Chip,
  IconButton,
  Grid,
  Card,
  CardContent,
  CardActions
} from '@mui/material';
import { FinanzasSectionNav, TransaccionRecurrenteForm } from '../finanzas';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';
import { CommonDetails } from '@shared/components/common';
import { 
  AutorenewOutlined as RecurrentIcon,
  AddOutlined as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutlineOutlined as DeleteIcon,
  PauseOutlined as PauseIcon,
  PlayArrowOutlined as PlayIcon
} from '@mui/icons-material';
import clienteAxios from '@shared/config/axios';
import { useSnackbar } from 'notistack';
import { EmptyState } from '@shared/components/common';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { api } from '@shared/services/api';

const RecurrenteCard = ({ 
  transaccion, 
  onEdit, 
  onDelete, 
  onToggleEstado,
  showValues,
  relatedData
}) => {
  const getFrecuenciaLabel = (frecuencia) => {
    const labels = {
      'MENSUAL': 'Mensual',
      'TRIMESTRAL': 'Trimestral',
      'SEMESTRAL': 'Semestral',
      'ANUAL': 'Anual'
    };
    return labels[frecuencia] || frecuencia;
  };

  const getMonedaSymbol = (cuentaId) => {
    const cuenta = relatedData.cuentas?.find(c => c._id === cuentaId);
    return cuenta?.moneda?.simbolo || '$';
  };

  return (
    <Card 
      elevation={0}
      sx={{ 
        border: '1px solid',
        borderColor: 'divider',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-2px)',
          boxShadow: 1
        }
      }}
    >
      <CardContent>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          mb: 2
        }}>
          <Typography variant="h6" sx={{ fontWeight: 500 }}>
            {transaccion.descripcion}
          </Typography>
          <Chip 
            label={getFrecuenciaLabel(transaccion.frecuencia)}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>

        <Typography variant="h5" sx={{ 
          color: transaccion.tipo === 'INGRESO' ? 'success.main' : 'error.main',
          mb: 2
        }}>
          {showValues ? 
            `${getMonedaSymbol(transaccion.cuenta)} ${transaccion.monto}` : 
            '****'
          }
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            label={transaccion.categoria}
            size="small"
            variant="outlined"
          />
          <Chip 
            label={`Día ${transaccion.diaDelMes}`}
            size="small"
            variant="outlined"
          />
          {transaccion.propiedad && (
            <Chip 
              label={relatedData.propiedades?.find(p => p._id === transaccion.propiedad)?.titulo}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end' }}>
        <IconButton 
          size="small" 
          onClick={() => onToggleEstado(transaccion)}
          color={transaccion.estado === 'ACTIVO' ? 'warning' : 'success'}
        >
          {transaccion.estado === 'ACTIVO' ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
        <IconButton 
          size="small" 
          onClick={() => onEdit(transaccion)}
          color="primary"
        >
          <EditIcon />
        </IconButton>
        <IconButton 
          size="small" 
          onClick={() => onDelete(transaccion._id)}
          color="error"
        >
          <DeleteIcon />
        </IconButton>
      </CardActions>
    </Card>
  );
};

export function Recurrente() {
  const [transacciones, setTransacciones] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [propiedades, setPropiedades] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaccion, setEditingTransaccion] = useState(null);
  const { enqueueSnackbar } = useSnackbar();
  const { showValues } = useValuesVisibility();

  const fetchTransacciones = useCallback(async () => {
    try {
      console.log('Solicitando transacciones recurrentes...');
      const response = await api.getTransaccionesRecurrentes();
      console.log('Transacciones recurrentes recibidas:', response.data);
      setTransacciones(response.data.docs || []);
    } catch (error) {
      console.error('Error al cargar transacciones recurrentes:', error);
      enqueueSnackbar('Error al cargar transacciones recurrentes', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const fetchCuentas = useCallback(async () => {
    try {
      console.log('Cargando cuentas...');
      const response = await api.getCuentas();
      console.log('Cuentas recibidas:', response.data);
      
      if (!response.data || !Array.isArray(response.data.docs)) {
        console.error('Formato de respuesta inválido para cuentas:', response.data);
        enqueueSnackbar('Error en el formato de datos de cuentas', { variant: 'error' });
        return [];
      }

      const cuentasData = response.data.docs.map(cuenta => ({
        ...cuenta,
        _id: cuenta._id || cuenta.id,
        nombre: cuenta.nombre || 'Sin nombre'
      }));

      console.log('Cuentas procesadas:', cuentasData);
      setCuentas(cuentasData);
      return cuentasData;
    } catch (error) {
      console.error('Error al cargar cuentas:', error);
      enqueueSnackbar('Error al cargar cuentas', { variant: 'error' });
      return [];
    }
  }, [enqueueSnackbar]);

  const fetchPropiedades = useCallback(async () => {
    try {
      console.log('Cargando propiedades...');
      const response = await api.getPropiedades();
      console.log('Propiedades recibidas:', response.data);
      
      if (!response.data || !Array.isArray(response.data.docs)) {
        console.error('Formato de respuesta inválido para propiedades:', response.data);
        enqueueSnackbar('Error en el formato de datos de propiedades', { variant: 'error' });
        return [];
      }

      const propiedadesData = response.data.docs.map(propiedad => ({
        ...propiedad,
        _id: propiedad._id || propiedad.id,
        titulo: propiedad.titulo || 'Sin título'
      }));

      console.log('Propiedades procesadas:', propiedadesData);
      setPropiedades(propiedadesData);
      return propiedadesData;
    } catch (error) {
      console.error('Error al cargar propiedades:', error);
      enqueueSnackbar('Error al cargar propiedades', { variant: 'error' });
      return [];
    }
  }, [enqueueSnackbar]);

  const fetchInitialData = useCallback(async () => {
    try {
      console.log('Iniciando carga de datos...');
      await Promise.all([
        fetchCuentas(),
        fetchPropiedades()
      ]);
      await fetchTransacciones();
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
    }
  }, [fetchTransacciones, fetchCuentas, fetchPropiedades]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    const handleHeaderAdd = (e) => {
      if (
        (e.detail?.path && e.detail.path === window.location.pathname) ||
        e.detail?.type === 'recurrente'
      ) {
        setEditingTransaccion(null);
        setIsFormOpen(true);
      }
    };
    window.addEventListener('headerAddButtonClicked', handleHeaderAdd);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAdd);
  }, []);

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
        c.id === formData.cuenta
      );

      if (!cuentaSeleccionada) {
        console.log('Cuentas disponibles:', cuentas);
        console.log('ID de cuenta buscado:', formData.cuenta);
        throw new Error('La cuenta seleccionada no existe');
      }

      const datosAEnviar = {
        ...formData,
        cuenta: cuentaSeleccionada._id || cuentaSeleccionada.id,
        monto: parseFloat(formData.monto),
        diaDelMes: parseInt(formData.diaDelMes),
        fechaInicio: new Date(formData.fechaInicio).toISOString(),
        fechaFin: formData.fechaFin ? new Date(formData.fechaFin).toISOString() : undefined,
        origen: {
          tipo: 'MANUAL',
          referencia: null
        }
      };

      console.log('Datos procesados a enviar:', datosAEnviar);
      
      if (editingTransaccion) {
        await api.updateTransaccionRecurrente(editingTransaccion._id, datosAEnviar);
        enqueueSnackbar('Transacción recurrente actualizada exitosamente', { variant: 'success' });
      } else {
        await api.createTransaccionRecurrente(datosAEnviar);
        enqueueSnackbar('Transacción recurrente creada exitosamente', { variant: 'success' });
      }
      
      setIsFormOpen(false);
      setEditingTransaccion(null);
      await fetchTransacciones();
    } catch (error) {
      console.error('Error completo:', error);
      
      // Manejar error de autenticación
      if (error.response?.status === 401) {
        enqueueSnackbar('Sesión expirada. Por favor, inicia sesión nuevamente.', { 
          variant: 'error',
          autoHideDuration: 5000
        });
        window.location.href = '/#/login';
        return;
      }
      
      const mensajeError = error.response?.data?.message || error.message || 'Error al guardar la transacción recurrente';
      enqueueSnackbar(mensajeError, { variant: 'error' });
    }
  }, [enqueueSnackbar, fetchTransacciones, editingTransaccion, cuentas]);

  const handleDelete = useCallback(async (id) => {
    try {
      await api.deleteTransaccionRecurrente(id);
      enqueueSnackbar('Transacción recurrente eliminada exitosamente', { variant: 'success' });
      fetchTransacciones();
    } catch (error) {
      console.error('Error al eliminar transacción recurrente:', error);
      enqueueSnackbar('Error al eliminar la transacción recurrente', { variant: 'error' });
    }
  }, [enqueueSnackbar, fetchTransacciones]);

  const handleToggleEstado = useCallback(async (transaccion) => {
    try {
      const nuevoEstado = transaccion.estado === 'ACTIVO' ? 'PAUSADO' : 'ACTIVO';
      await api.updateTransaccionRecurrente(transaccion._id, { estado: nuevoEstado });
      enqueueSnackbar(
        `Transacción recurrente ${nuevoEstado === 'ACTIVO' ? 'activada' : 'pausada'} exitosamente`, 
        { variant: 'success' }
      );
      fetchTransacciones();
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      enqueueSnackbar('Error al cambiar el estado', { variant: 'error' });
    }
  }, [enqueueSnackbar, fetchTransacciones]);

  const handleGenerarTransacciones = useCallback(async () => {
    try {
      const response = await api.generarTransaccionesRecurrentes();
      enqueueSnackbar(response.data.message, { variant: 'success' });
      fetchTransacciones();
    } catch (error) {
      console.error('Error al generar transacciones:', error);
      enqueueSnackbar('Error al generar transacciones', { variant: 'error' });
    }
  }, [enqueueSnackbar, fetchTransacciones]);

  return (
    <Box sx={cajaPageLayoutSx}>
      <FinanzasSectionNav variant="strip" />
      <CommonDetails
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size="small"
              onClick={() => {
                setEditingTransaccion(null);
                setIsFormOpen(true);
              }}
              sx={{ borderRadius: 1 }}
            >
              Nueva Transacción Recurrente
            </Button>
            <Button
              variant="outlined"
              startIcon={<RecurrentIcon />}
              size="small"
              onClick={handleGenerarTransacciones}
              sx={{ borderRadius: 1 }}
            >
              Generar Transacciones
            </Button>
          </Box>
        }
      >
        {transacciones.length === 0 ? (
          <EmptyState 
            onAdd={() => setIsFormOpen(true)}
            message="No hay transacciones recurrentes configuradas"
            submessage="Haz clic en el botón para agregar una nueva transacción recurrente"
          />
        ) : (
          <Grid container spacing={2}>
            {transacciones.map((transaccion) => (
              <Grid item xs={12} sm={6} md={4} key={transaccion._id || transaccion.id}>
                <RecurrenteCard
                  transaccion={transaccion}
                  onEdit={() => {
                    setEditingTransaccion(transaccion);
                    setIsFormOpen(true);
                  }}
                  onDelete={handleDelete}
                  onToggleEstado={handleToggleEstado}
                  showValues={showValues}
                  relatedData={{ cuentas, propiedades }}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </CommonDetails>

      {isFormOpen && (
        <TransaccionRecurrenteForm
          open={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingTransaccion(null);
          }}
          onSubmit={handleFormSubmit}
          initialData={editingTransaccion}
          relatedData={{ cuentas, propiedades }}
          isEditing={!!editingTransaccion}
        />
      )}
    </Box>
  );
}

export default Recurrente; 
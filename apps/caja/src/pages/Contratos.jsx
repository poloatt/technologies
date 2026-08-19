import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  DescriptionOutlined as DescriptionIcon,
  AutoAwesome as WizardIcon,
  Edit as EditIcon
} from '@mui/icons-material';

import { ContratoForm, ContratoDetail } from '../propiedades/contratos';
// import { ContratoWizard } from '../propiedades/contratos'; // Eliminado porque ya no existe
import { useSnackbar } from 'notistack';
import clienteAxios from '@shared/config/axios';
import { EmptyState } from '@shared/components/common';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFormManager } from '@shared/context/FormContext';
import ContratoCard from '../propiedades/contratos/ContratoCard';
import useResponsive from '@shared/hooks/useResponsive';
import { PropiedadesSectionNav } from '../propiedades';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';

export function Contratos() {
  const [contratos, setContratos] = useState([]);
  const [relatedData, setRelatedData] = useState({
    propiedades: [],
    inquilinos: [],
    habitaciones: [],
    cuentas: [],
    monedas: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [useWizard, setUseWizard] = useState(true); // Por defecto usar wizard
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const location = useLocation();
  // --- NUEVO: Contexto de formularios ---
  const { openForm, closeForm, getFormState } = useFormManager();
  const { open: openFormDialog, initialData: initialFormData } = getFormState('contrato');
  const { open: openWizard, initialData: initialWizardData } = getFormState('contratoWizard');
  const { open: openFormChoice, initialData: initialFormChoiceData } = getFormState('contratoFormChoice');

  const [isSaving, setIsSaving] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState(null);
  const [openDetail, setOpenDetail] = useState(false);

  // Abrir formulario tras redirección si openAdd está en el estado
  useEffect(() => {
    if (location.state?.openAdd) {
      openForm('contrato');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, openForm, navigate]);

  // Escuchar evento del Header para abrir formulario
  useEffect(() => {
    const handleHeaderAddButton = (event) => {
      if (
        (event.detail?.path && event.detail.path === location.pathname) ||
        event.detail?.type === 'contrato'
      ) {
        openForm('contrato');
      }
    };
    window.addEventListener('headerAddButtonClicked', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAddButton);
  }, [openForm, location.pathname]);

  // --- DEFINICIÓN DE fetchData y loadData ---
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [
        contratosRes,
        propiedadesRes,
        inquilinosRes,
        habitacionesRes,
        cuentasRes,
        monedasRes
      ] = await Promise.all([
        clienteAxios.get('/api/contratos/estado-actual'),
        clienteAxios.get('/api/propiedades?limit=500'),
        clienteAxios.get('/api/inquilinos?limit=500'),
        clienteAxios.get('/api/habitaciones?limit=500'),
        clienteAxios.get('/api/cuentas?limit=500'),
        clienteAxios.get('/api/monedas?limit=500')
      ]);
      const contratos = contratosRes.data.docs || [];
      const propiedades = propiedadesRes.data.docs || [];
      const inquilinos = inquilinosRes.data.docs || [];
      const habitaciones = habitacionesRes.data.docs || [];
      const cuentas = cuentasRes.data.docs || [];
      const monedas = monedasRes.data.docs || [];
      setContratos(contratos);
      setRelatedData({
        propiedades,
        inquilinos,
        habitaciones,
        cuentas,
        monedas
      });
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError('Error al cargar los datos. Por favor, intente nuevamente.');
      enqueueSnackbar('Error al cargar los datos', { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [enqueueSnackbar]);

  const loadData = fetchData;

  // Evitar doble carga en StrictMode (React 18)
  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      loadData();
    }
  }, [loadData]);

  // Efecto para manejar la navegación desde inquilinos
  useEffect(() => {
    if (location.state?.createContract && location.state?.inquilinoData) {
      const inquilinoData = location.state.inquilinoData;
      
      // Esperar a que se carguen los datos relacionados
      const checkDataAndOpenForm = () => {
        if (relatedData.propiedades.length > 0 && relatedData.cuentas.length > 0) {
          // Configurar el contrato con el inquilino pre-seleccionado
          const initialData = {
            inquilino: [inquilinoData],
            esMantenimiento: false,
            tipoContrato: 'ALQUILER'
          };
          
          openForm('contratoFormChoice', initialData);
          
          // Limpiar el state de navegación para evitar que se abra nuevamente
          navigate(location.pathname, { replace: true });
        } else {
          // Si los datos no están listos, esperar un poco más
          setTimeout(checkDataAndOpenForm, 100);
        }
      };
      
      checkDataAndOpenForm();
    }
  }, [location.state, relatedData, navigate, location.pathname, openForm]);

  // Efecto para manejar la navegación para editar un contrato específico
  useEffect(() => {
    if (location.state?.editContract && location.state?.contratoId) {
      const contratoId = location.state.contratoId;
      
      // Esperar a que se carguen los datos relacionados
      const checkDataAndOpenForm = () => {
        if (contratos.length > 0 && relatedData.propiedades.length > 0) {
          // Buscar el contrato específico
          const contrato = contratos.find(c => c._id === contratoId);
          if (contrato) {
            openForm('contrato', contrato);
          }
          
          // Limpiar el state de navegación para evitar que se abra nuevamente
          navigate(location.pathname, { replace: true });
        } else {
          // Si los datos no están listos, esperar un poco más
          setTimeout(checkDataAndOpenForm, 100);
        }
      };
      
      checkDataAndOpenForm();
    }
  }, [location.state, contratos, relatedData, navigate, location.pathname, openForm]);

  const handleEdit = useCallback((contrato) => {
    openForm('contrato', contrato);
  }, [openForm]);

  const handleDelete = useCallback(async (id) => {
    try {
      await clienteAxios.delete(`/api/contratos/${id}`);
      enqueueSnackbar('Contrato eliminado exitosamente', { variant: 'success' });
      await loadData();
    } catch (error) {
      console.error('Error al eliminar contrato:', error);
      enqueueSnackbar('Error al eliminar el contrato', { variant: 'error' });
    }
  }, [enqueueSnackbar, loadData]);

  const handleFormSubmit = async (formData) => {
    try {
      setIsSaving(true);
      console.log('=== HANDLE FORM SUBMIT ===');
      console.log('formData completo:', JSON.stringify(formData, null, 2));
      console.log('precioTotal en formData:', formData.precioTotal);
      console.log('tipoContrato en formData:', formData.tipoContrato);
      console.log('esMantenimiento en formData:', formData.esMantenimiento);
      
      // Asegurarse de que la cuenta esté presente si no es un contrato de mantenimiento
      if (!formData.esMantenimiento && !formData.cuenta && initialFormData?.cuenta) {
        formData.cuenta = typeof initialFormData.cuenta === 'object' ? 
          (initialFormData.cuenta._id || initialFormData.cuenta.id) : 
          initialFormData.cuenta;
      }
      
      let response;
      if (initialFormData && (initialFormData._id || initialFormData.id)) {
        const contratoId = initialFormData._id || initialFormData.id;
        console.log('Enviando PUT a:', `/api/contratos/${contratoId}`);
        console.log('Datos finales a enviar:', JSON.stringify(formData, null, 2));
        response = await clienteAxios.put(`/api/contratos/${contratoId}`, formData);
        enqueueSnackbar('Contrato actualizado exitosamente', { variant: 'success' });
      } else {
        console.log('Enviando POST a:', '/api/contratos');
        console.log('Datos finales a enviar:', JSON.stringify(formData, null, 2));
        response = await clienteAxios.post('/api/contratos', formData);
        enqueueSnackbar('Contrato creado exitosamente', { variant: 'success' });
      }

      await loadData();
      closeForm('contrato');
    } catch (error) {
      console.error('Error al guardar contrato:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Error al guardar el contrato';
      enqueueSnackbar(errorMessage, { variant: 'error' });
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleWizardSubmit = async (formData) => {
    try {
      setIsSaving(true);
      console.log('Datos del wizard a enviar:', formData);
      
      let response;
      if (initialWizardData && (initialWizardData._id || initialWizardData.id)) {
        const contratoId = initialWizardData._id || initialWizardData.id;
        response = await clienteAxios.put(`/api/contratos/${contratoId}`, formData);
        enqueueSnackbar('Contrato actualizado exitosamente', { variant: 'success' });
      } else {
        response = await clienteAxios.post('/api/contratos', formData);
        enqueueSnackbar('Contrato creado exitosamente', { variant: 'success' });
      }

      await loadData();
      closeForm('contratoWizard');
    } catch (error) {
      console.error('Error al guardar contrato desde wizard:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Error al guardar el contrato';
      enqueueSnackbar(errorMessage, { variant: 'error' });
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Función para actualizar estados de contratos
  const handleActualizarEstados = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await clienteAxios.post('/api/contratos/actualizar-estados');
      
      enqueueSnackbar(
        `Estados actualizados: ${response.data.resultado.actualizados} de ${response.data.resultado.procesados} contratos`,
        { variant: 'success' }
      );
      
      // Recargar los datos después de la actualización
      await loadData();
    } catch (error) {
      console.error('Error al actualizar estados:', error);
      enqueueSnackbar('Error al actualizar estados de contratos', { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [enqueueSnackbar, loadData]);

  // Función para abrir el selector de formulario
  const handleOpenFormChoice = () => {
    openForm('contratoFormChoice');
  };

  // Función para cerrar el selector de formulario
  const handleCloseFormChoice = () => {
    closeForm('contratoFormChoice');
  };

  // Función para seleccionar el tipo de formulario
  const handleSelectFormType = (useWizardMode) => {
    setUseWizard(useWizardMode);
    closeForm('contratoFormChoice');
    if (useWizardMode) {
      openForm('contratoWizard', initialFormChoiceData);
    } else {
      openForm('contrato', initialFormChoiceData);
    }
  };

  console.log('Contratos cargados:', contratos);

  // Configuración para mostrar contratos en PropiedadContent
  const contratoConfig = {
    getTitle: (contrato) => contrato.tipo || 'Contrato',
    getSubtitle: (contrato) => `${contrato.fechaInicio || ''} - ${contrato.fechaFin || ''}`,
    getDetails: (contrato) => [
      { label: 'Estado', value: contrato.estado },
      { label: 'Monto Total', value: contrato.montoTotal },
      { label: 'Propiedad', value: contrato.propiedad?.direccion || contrato.propiedad?.id || '' },
    ],
    getIcon: () => DescriptionIcon,
  };

  const { isDesktop } = useResponsive();

  return (
    <Box sx={{ px: 0, width: '100%' }}>
      {/* Eliminar <Toolbar /> */}
      
      <Box sx={{ ...cajaPageLayoutSx, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <PropiedadesSectionNav variant="strip" />

        {/* Mostrar todos los contratos juntos */}
        <Box
          sx={{
            display: isDesktop ? 'flex' : 'block',
            gap: isDesktop ? 3 : 0,
            alignItems: 'flex-start',
            width: '100%'
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {contratos.length === 0 ? (
              <EmptyState
                icon={DescriptionIcon}
                title="No hay contratos"
                description="No hay contratos para mostrar"
              />
            ) : (
              <Box>
                {contratos.map((contrato) => (
                  <ContratoCard
                    key={contrato._id || contrato.id}
                    contrato={contrato}
                    onClick={() => {
                      setSelectedContrato(contrato);
                      setOpenDetail(true);
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
          {isDesktop && selectedContrato && openDetail && (
            <Box sx={{ flex: 1.2, minWidth: 0, ml: 2 }}>
              <ContratoDetail
                open={true}
                onClose={() => setOpenDetail(false)}
                contrato={selectedContrato}
              />
            </Box>
          )}
        </Box>

        {/* Formulario tradicional */}
        {openFormDialog && (
          <ContratoForm
            open={openFormDialog}
            initialData={initialFormData || {}}
            relatedData={relatedData}
            onSubmit={handleFormSubmit}
            onClose={() => closeForm('contrato')}
            isSaving={isSaving}
          />
        )}

        {/* Wizard de contratos */}
        {openWizard && (
          <ContratoForm
            open={openWizard}
            initialData={initialWizardData || {}}
            relatedData={relatedData}
            onSubmit={handleWizardSubmit}
            onClose={() => closeForm('contratoWizard')}
            isSaving={isSaving}
          />
        )}

        {/* Diálogo para seleccionar tipo de formulario */}
        <Dialog
          open={openFormChoice}
          onClose={() => closeForm('contratoFormChoice')}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 0 }
          }}
        >
          <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider' }}>
            Seleccionar método de creación
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<WizardIcon />}
                onClick={() => handleSelectFormType(true)}
                sx={{ 
                  justifyContent: 'flex-start', 
                  p: 2, 
                  borderRadius: 0,
                  borderWidth: 2
                }}
              >
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Wizard Asistido
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Flujo paso a paso guiado para crear contratos de forma sencilla
                  </Typography>
                </Box>
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => handleSelectFormType(false)}
                sx={{ 
                  justifyContent: 'flex-start', 
                  p: 2, 
                  borderRadius: 0,
                  borderWidth: 2
                }}
              >
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Formulario Completo
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Formulario tradicional con todas las opciones disponibles
                  </Typography>
                </Box>
              </Button>
            </Box>
          </DialogContent>
          <DialogActions sx={{ borderTop: 1, borderColor: 'divider' }}>
            <Button onClick={() => closeForm('contratoFormChoice')} sx={{ borderRadius: 0 }}>
              Cancelar
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de detalle de contrato (solo mobile) */}
        {!isDesktop && selectedContrato && (
          <ContratoDetail
            open={openDetail}
            onClose={() => setOpenDetail(false)}
            contrato={selectedContrato}
          />
        )}
      </Box>
    </Box>
  );
}

export default Contratos; 
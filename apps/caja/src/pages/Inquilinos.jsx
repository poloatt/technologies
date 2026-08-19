import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { useSnackbar } from 'notistack';
import { InquilinoList, InquilinoForm, InquilinoDetail } from '../propiedades/inquilinos';
import { CommonDetails } from '@shared/components/common';
import clienteAxios from '@shared/config/axios';
import { useLocation, useNavigate } from 'react-router-dom';
import ContratoForm from '../propiedades/contratos/ContratoForm';
import { buildContratoInitialDataForInquilino } from '../propiedades/contratos/buildContratoInitialDataForInquilino';
import { useFormManager } from '@shared/context/FormContext';
import useResponsive from '@shared/hooks/useResponsive';
import { PropiedadesSectionNav } from '../propiedades';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';

export function Inquilinos() {
  const [inquilinos, setInquilinos] = useState([]);
  const [propiedades, setPropiedades] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('activos'); // 'activos', 'inactivos', 'todos'
  const { enqueueSnackbar } = useSnackbar();
  const location = useLocation();
  const navigate = useNavigate();
  const [openContratoForm, setOpenContratoForm] = useState(false);
  const [contratoInitialData, setContratoInitialData] = useState({});
  const [cuentas, setCuentas] = useState([]);
  const [monedas, setMonedas] = useState([]);
  const [habitaciones, setHabitaciones] = useState([]);
  // --- NUEVO: Contexto de formularios ---
  const { openForm, closeForm, getFormState } = useFormManager();
  const { open, initialData } = getFormState('inquilino');
  const [selectedInquilino, setSelectedInquilino] = useState(null);

  const handleBack = () => {
    navigate('/');
  };

  // Abrir formulario tras redirección si openAdd está en el estado
  useEffect(() => {
    if (location.state?.openAdd) {
      openForm('inquilino');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, openForm, navigate]);

  // Escuchar evento del Header para abrir formulario
  useEffect(() => {
    const handleHeaderAddButton = (event) => {
      if (
        (event.detail?.path && event.detail.path === location.pathname) ||
        event.detail?.type === 'inquilino'
      ) {
        openForm('inquilino');
      }
    };
    window.addEventListener('headerAddButtonClicked', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAddButton);
  }, [openForm, location.pathname]);

  // Cargar inquilinos
  const fetchInquilinos = async (propiedadId = null) => {
    setIsLoading(true);
    try {
      const url = propiedadId 
        ? `/api/inquilinos?propiedad=${propiedadId}&limit=100`
        : '/api/inquilinos?limit=100';
      const response = await clienteAxios.get(url);
      console.log('Inquilinos obtenidos:', response.data.docs);
      setInquilinos(response.data.docs);
    } catch (error) {
      console.error('Error al cargar inquilinos:', error);
      enqueueSnackbar('Error al cargar inquilinos', { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar propiedades
  const fetchPropiedades = async () => {
    try {
      const response = await clienteAxios.get('/api/propiedades?limit=500');
      setPropiedades(response.data.docs);
    } catch (error) {
      console.error('Error al cargar propiedades:', error);
      enqueueSnackbar('Error al cargar propiedades', { variant: 'error' });
    }
  };

  // Cargar cuentas
  const fetchCuentas = async () => {
    try {
      const response = await clienteAxios.get('/api/cuentas');
      setCuentas(response.data.docs);
    } catch (error) {
      console.error('Error al cargar cuentas:', error);
      enqueueSnackbar('Error al cargar cuentas', { variant: 'error' });
    }
  };

  // Cargar monedas
  const fetchMonedas = async () => {
    try {
      const response = await clienteAxios.get('/api/monedas');
      setMonedas(response.data.docs);
    } catch (error) {
      console.error('Error al cargar monedas:', error);
      enqueueSnackbar('Error al cargar monedas', { variant: 'error' });
    }
  };

  const fetchHabitaciones = async () => {
    try {
      const response = await clienteAxios.get('/api/habitaciones?limit=500');
      setHabitaciones(response.data.docs || []);
    } catch (error) {
      console.error('Error al cargar habitaciones:', error);
    }
  };

  useEffect(() => {
    fetchInquilinos();
    fetchPropiedades();
    fetchCuentas();
    fetchMonedas();
    fetchHabitaciones();
  }, []);

  const handleSubmit = async (formData) => {
    try {
      if (initialData) {
        await clienteAxios.put(`/api/inquilinos/${initialData._id}`, formData);
        enqueueSnackbar('Inquilino actualizado correctamente', { variant: 'success' });
      } else {
        await clienteAxios.post('/api/inquilinos', formData);
        enqueueSnackbar('Inquilino creado correctamente', { variant: 'success' });
      }
      fetchInquilinos();
      closeForm('inquilino');
    } catch (error) {
      console.error('Error al guardar inquilino:', error);
      throw error;
    }
  };

  const handleEdit = (inquilino) => {
    openForm('inquilino', inquilino);
  };

  const handleDelete = async (inquilino) => {
    if (!window.confirm('¿Estás seguro de eliminar este inquilino?')) return;
    
    try {
      await clienteAxios.delete(`/api/inquilinos/${inquilino._id}`);
      enqueueSnackbar('Inquilino eliminado correctamente', { variant: 'success' });
      fetchInquilinos();
    } catch (error) {
      console.error('Error al eliminar inquilino:', error);
      enqueueSnackbar('Error al eliminar el inquilino', { variant: 'error' });
    }
  };

  const handleCloseForm = () => {
    closeForm('inquilino');
  };

  const handleCreateContract = (inquilino) => {
    setContratoInitialData(
      buildContratoInitialDataForInquilino(inquilino, propiedades, cuentas),
    );
    setOpenContratoForm(true);
  };

  useEffect(() => {
    const inquilinoId = location.state?.openContratoForInquilinoId;
    if (!inquilinoId || inquilinos.length === 0 || propiedades.length === 0) return;
    const found = inquilinos.find(
      (i) => String(i._id || i.id) === String(inquilinoId),
    );
    if (!found) return;
    handleCreateContract(found);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state?.openContratoForInquilinoId, inquilinos, propiedades, navigate, location.pathname]);

  const { theme, isDesktop } = useResponsive();

  return (
    <Box sx={{ px: 0, width: '100%' }}>
      {/* Eliminar <Toolbar /> */}

      <Box sx={{ ...cajaPageLayoutSx, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <PropiedadesSectionNav variant="strip" />

        {/* Filtros de grupos */}

        <Box
          sx={{
            py: 2,
            display: isDesktop ? 'flex' : 'block',
            gap: isDesktop ? 3 : 0,
            alignItems: 'flex-start',
            width: '100%'
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <CommonDetails>
              <InquilinoList
                inquilinos={inquilinos}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onCreateContract={handleCreateContract}
                onCardClick={isDesktop ? setSelectedInquilino : undefined}
              />
            </CommonDetails>
          </Box>
          {isDesktop && selectedInquilino && (
            <Box sx={{ flex: 1.2, minWidth: 0, ml: 2 }}>
              <InquilinoDetail
                open={true}
                onClose={() => setSelectedInquilino(null)}
                inquilino={selectedInquilino}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onCreateContract={handleCreateContract}
              />
            </Box>
          )}
        </Box>

        <InquilinoForm
          open={open}
          onClose={handleCloseForm}
          onSubmit={handleSubmit}
          initialData={initialData}
          propiedades={propiedades}
        />

        {/* Formulario de contrato autopopulado */}
        {openContratoForm && (
          <ContratoForm
            open={openContratoForm}
            initialData={contratoInitialData}
            relatedData={{ propiedades, inquilinos, habitaciones, cuentas, monedas }}
            onClose={() => setOpenContratoForm(false)}
            onSubmit={() => { setOpenContratoForm(false); fetchInquilinos(); }}
          />
        )}
      </Box>
    </Box>
  );
}

export default Inquilinos;

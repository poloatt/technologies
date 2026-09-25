import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button } from '@mui/material';
import { CommonDetails, EmptyState } from '@shared/components/common';
import { DataCorporalTable } from '../components/bodycomposition/DataCorporalTable';
import { DataCorporalForm } from '../components/bodycomposition/DataCorporalForm';
import clienteAxios from '@shared/config/axios';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';

export function DataCorporal() {
  const [data, setData] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingData, setEditingData] = useState(null);
  const { enqueueSnackbar } = useSnackbar();

  const fetchData = useCallback(async () => {
    try {
      const response = await clienteAxios.get('/api/datacorporal', { params: { limit: 100 } });
      setData(response.data.docs || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      enqueueSnackbar('Error al cargar los datos', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (dataToEdit = null) => {
    setEditingData(dataToEdit);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingData(null);
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingData?._id) {
        await clienteAxios.put(`/api/datacorporal/${editingData._id}`, formData);
        enqueueSnackbar('Registro actualizado exitosamente', { variant: 'success' });
      } else {
        await clienteAxios.post('/api/datacorporal', formData);
        enqueueSnackbar('Registro creado exitosamente', { variant: 'success' });
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error('Error al guardar:', error);
      if (error.response?.status === 409) {
        enqueueSnackbar('Ya existe un registro para esta fecha', { variant: 'error' });
      } else {
        enqueueSnackbar('Error al guardar el registro', { variant: 'error' });
      }
    }
  };

  const handleDelete = async (id) => {
    try {
      await clienteAxios.delete(`/api/datacorporal/${id}`);
      enqueueSnackbar('Registro eliminado exitosamente', { variant: 'success' });
      fetchData();
    } catch (error) {
      console.error('Error al eliminar:', error);
      enqueueSnackbar('Error al eliminar el registro', { variant: 'error' });
    }
  };

  useEffect(() => {
    const handleHeaderAddButton = (event) => {
      if (event.detail?.type === 'data-corporal') {
        handleOpenDialog();
      }
    };
    window.addEventListener('headerAddButtonClicked', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAddButton);
  }, []);

  return (
    <Box sx={{ px: 0, width: '100%' }}>
      <CommonDetails
        title="Data corporal"
        showTitle
        action={(
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
            onClick={() => handleOpenDialog()}
            sx={{ borderRadius: 0 }}
          >
            Nuevo registro
          </Button>
        )}
      >
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <DataCorporalTable
            data={data}
            onEdit={handleOpenDialog}
            onDelete={handleDelete}
          />
        )}
      </CommonDetails>

      <DataCorporalForm
        open={openDialog}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        initialData={editingData}
      />
    </Box>
  );
}

export default DataCorporal;

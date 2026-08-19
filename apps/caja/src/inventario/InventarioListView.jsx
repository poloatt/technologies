import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import clienteAxios, { isAxiosCanceled } from '@shared/config/axios';
import { EmptyState } from '@shared/components/common';
import { CommonForm } from '@shared/components/common';
import { getPropiedadLabel, getHabitacionLabel, normalizeDocId } from '../propiedades/hub/propiedadesHubUtils';
import { INVENTARIO_UBICACION } from './hub/inventarioHubConstants';

const ESTADO_OPTIONS = [
  { value: 'NUEVO', label: 'Nuevo' },
  { value: 'BUEN_ESTADO', label: 'Buen Estado' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'MALO', label: 'Malo' },
  { value: 'REPARACION', label: 'En Reparación' },
];

export default function InventarioListView({ ubicacion, title }) {
  const [items, setItems] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { enqueueSnackbar } = useSnackbar();
  const [habitaciones, setHabitaciones] = useState([]);
  const [propiedades, setPropiedades] = useState([]);
  const [habitacionesDisponibles, setHabitacionesDisponibles] = useState([]);
  const [formData, setFormData] = useState({});
  const [editingItem, setEditingItem] = useState(null);

  const requiresPropiedad = ubicacion === INVENTARIO_UBICACION.PROPIEDAD;

  const fetchInventario = useCallback(async ({ silent = false } = {}) => {
    try {
      const response = await clienteAxios.get('/api/inventarios', {
        params: { ubicacion },
      });
      setItems(response.data.docs || []);
    } catch (error) {
      if (isAxiosCanceled(error)) return;
      console.error('Error al cargar inventario:', error);
      if (!silent) enqueueSnackbar('Error al cargar inventario', { variant: 'error' });
    }
  }, [ubicacion, enqueueSnackbar]);

  const fetchHabitaciones = async (propiedadId = null, { silent = false } = {}) => {
    try {
      let url = '/api/habitaciones';
      if (propiedadId) {
        url = `/api/habitaciones/propiedad/${propiedadId}`;
      }
      const response = await clienteAxios.get(url);
      const habitacionesData = propiedadId ? response.data.docs : (response.data.docs || []);

      if (propiedadId) {
        setHabitacionesDisponibles(habitacionesData);
      } else {
        setHabitaciones(habitacionesData);
        setHabitacionesDisponibles(habitacionesData);
      }
    } catch (error) {
      if (isAxiosCanceled(error)) return;
      console.error('Error al cargar habitaciones:', error);
      if (!silent) enqueueSnackbar('Error al cargar habitaciones', { variant: 'error' });
    }
  };

  const fetchPropiedades = async ({ silent = false } = {}) => {
    try {
      const response = await clienteAxios.get('/api/propiedades');
      setPropiedades(response.data.docs || []);
    } catch (error) {
      if (isAxiosCanceled(error)) return;
      console.error('Error al cargar propiedades:', error);
      if (!silent) enqueueSnackbar('Error al cargar propiedades', { variant: 'error' });
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const tasks = [fetchInventario({ silent: true })];
      if (requiresPropiedad) {
        tasks.push(fetchHabitaciones(null, { silent: true }), fetchPropiedades({ silent: true }));
      }
      await Promise.all(tasks);
      if (!cancelled) setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [fetchInventario, requiresPropiedad]);

  const handleCreateHabitacion = async (newHabitacionData) => {
    const response = await clienteAxios.post('/api/habitaciones', newHabitacionData);
    await fetchHabitaciones();
    return response.data;
  };

  const handleFormSubmit = async (submitData) => {
    try {
      const payload = { ...submitData };
      if (!requiresPropiedad) {
        delete payload.propiedadId;
        delete payload.habitacionId;
      }
      if (editingItem) {
        await clienteAxios.put(`/api/inventarios/${editingItem.id}`, payload);
        enqueueSnackbar('Item actualizado exitosamente', { variant: 'success' });
      } else {
        await clienteAxios.post('/api/inventarios', payload);
        enqueueSnackbar('Item agregado exitosamente', { variant: 'success' });
      }
      setIsFormOpen(false);
      setEditingItem(null);
      fetchInventario();
    } catch (error) {
      console.error('Error:', error);
      enqueueSnackbar(error.response?.data?.error || 'Error al guardar item', { variant: 'error' });
    }
  };

  const handleDelete = useCallback(async (id) => {
    try {
      await clienteAxios.delete(`/api/inventarios/${id}`);
      enqueueSnackbar('Item eliminado exitosamente', { variant: 'success' });
      await fetchInventario();
    } catch (error) {
      console.error('Error al eliminar item:', error);
      enqueueSnackbar('Error al eliminar el item', { variant: 'error' });
    }
  }, [enqueueSnackbar, fetchInventario]);

  useEffect(() => {
    const handleHeaderAddButton = (event) => {
      if (event.detail?.type === 'inventario') {
        setEditingItem(null);
        setIsFormOpen(true);
      }
    };

    window.addEventListener('headerAddButtonClicked', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAddButton);
  }, []);

  const formFields = [
    ...(requiresPropiedad
      ? [
          {
            name: 'propiedadId',
            label: 'Propiedad',
            type: 'relational',
            required: true,
            options: propiedades.map((p) => ({
              value: normalizeDocId(p),
              label: getPropiedadLabel(p),
            })),
            onChange: async (value) => {
              if (value) {
                await fetchHabitaciones(value);
              } else {
                setHabitacionesDisponibles(habitaciones);
              }
              setFormData((prev) => ({ ...prev, propiedadId: value, habitacionId: null }));
            },
          },
          {
            name: 'habitacionId',
            label: 'Habitación',
            type: 'relational',
            required: false,
            options: habitacionesDisponibles.map((h) => ({
              value: normalizeDocId(h),
              label: getHabitacionLabel(h),
            })),
            disabled: !formData.propiedadId,
            onCreateNew: handleCreateHabitacion,
            createFields: [
              { name: 'numero', label: 'Número', required: true },
              {
                name: 'tipo',
                label: 'Tipo',
                type: 'select',
                required: true,
                options: [
                  { value: 'INDIVIDUAL', label: 'Individual' },
                  { value: 'DOBLE', label: 'Doble' },
                  { value: 'SUITE', label: 'Suite' },
                  { value: 'ESTUDIO', label: 'Estudio' },
                ],
              },
              { name: 'capacidad', label: 'Capacidad', type: 'number', required: true },
            ],
            createTitle: 'Nueva Habitación',
          },
        ]
      : []),
    { name: 'nombre', label: 'Nombre del Elemento', required: true },
    { name: 'descripcion', label: 'Descripción', multiline: true, rows: 3 },
    {
      name: 'estado',
      label: 'Estado',
      type: 'select',
      required: true,
      options: ESTADO_OPTIONS,
    },
    { name: 'cantidad', label: 'Cantidad', type: 'number', required: true },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          size="small"
          onClick={() => {
            setEditingItem(null);
            setIsFormOpen(true);
          }}
        >
          Nuevo ítem
        </Button>
      </Box>

      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Cargando…
        </Typography>
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin ítems"
          description={
            requiresPropiedad
              ? 'Agrega mobiliario u objetos vinculados a una propiedad.'
              : 'Ítems generales sin propiedad ni habitación asignada.'
          }
        />
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                {requiresPropiedad && <TableCell>Ubicación</TableCell>}
                <TableCell align="right">Cant.</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const id = item.id || item._id;
                const ubicacionLabel = requiresPropiedad
                  ? [
                      item.habitacion ? getHabitacionLabel(item.habitacion) : null,
                      item.propiedad ? getPropiedadLabel(item.propiedad) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'
                  : null;

                return (
                  <TableRow key={id} hover>
                    <TableCell>{item.nombre}</TableCell>
                    {requiresPropiedad && <TableCell>{ubicacionLabel}</TableCell>}
                    <TableCell align="right">{item.cantidad}</TableCell>
                    <TableCell>{item.estado}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => { setEditingItem(item); setIsFormOpen(true); }}>
                        Editar
                      </Button>
                      <Button size="small" color="error" onClick={() => handleDelete(id)}>
                        Eliminar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CommonForm
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleFormSubmit}
        title={editingItem ? 'Editar ítem' : 'Nuevo ítem'}
        fields={formFields}
        initialData={editingItem || {}}
        isEditing={!!editingItem}
      />
    </Box>
  );
}

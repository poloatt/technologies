import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CommonActions, CommonDetails, CommonForm, EmptyState } from '@shared/components/common';
import clienteAxios from '@shared/config/axios';
import { useSnackbar } from 'notistack';
import {
  DIET_CHANNELS,
  DIET_SLOTS,
  SHOP_CHANNELS,
} from '@shared/pulso';

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function parseIngredientes(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [nombre, canal] = line.split(',').map((part) => part.trim());
      const known = DIET_CHANNELS.some((channel) => channel.id === canal);
      return { nombre, canal: known ? canal : 'super' };
    })
    .filter((item) => item.nombre);
}

function formatIngredientes(list) {
  return (list || []).map((item) => `${item.nombre}, ${item.canal}`).join('\n');
}

function habitValue(section, habitId) {
  if (!habitId) return '';
  return `${section}:${habitId}`;
}

function splitHabitValue(value) {
  if (!value) return { section: '', habitId: '' };
  const [section, habitId] = String(value).split(':');
  return { section, habitId };
}

export function Dieta() {
  const { enqueueSnackbar } = useSnackbar();
  const [plan, setPlan] = useState(null);
  const [recetas, setRecetas] = useState([]);
  const [menu, setMenu] = useState({ slots: {} });
  const [fecha, setFecha] = useState(todayInput());
  const [habits, setHabits] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const habitOptions = useMemo(() => {
    const options = [];
    Object.entries(habits || {}).forEach(([section, list]) => {
      (list || []).filter((habit) => habit?.activo !== false).forEach((habit) => {
        const habitId = habit.id || habit._id;
        if (!habitId) return;
        options.push({
          value: habitValue(section, habitId),
          label: habit.label || habitId,
        });
      });
    });
    return options;
  }, [habits]);

  const loadRecetas = useCallback(async () => {
    const response = await clienteAxios.get('/api/dietas/recetas');
    setRecetas(response.data || []);
  }, []);

  const loadPlan = useCallback(async () => {
    const response = await clienteAxios.get('/api/dietas/plan');
    setPlan(response.data);
  }, []);

  const loadMenu = useCallback(async (day) => {
    const response = await clienteAxios.get('/api/dietas/menu', { params: { fecha: day } });
    setMenu(response.data || { slots: {} });
  }, []);

  useEffect(() => {
    Promise.all([
      loadPlan(),
      loadRecetas(),
      clienteAxios.get('/api/users/habits').then((response) => {
        setHabits(response.data?.habits || {});
      }),
    ]).catch(() => {
      enqueueSnackbar('Error al cargar la dieta', { variant: 'error' });
    });
  }, [enqueueSnackbar, loadPlan, loadRecetas]);

  useEffect(() => {
    loadMenu(fecha).catch(() => {
      enqueueSnackbar('Error al cargar el menú', { variant: 'error' });
    });
  }, [enqueueSnackbar, fecha, loadMenu]);

  useEffect(() => {
    const onAdd = (event) => {
      if (event.detail?.type === 'dieta') {
        setEditing(null);
        setFormOpen(true);
      }
    };
    window.addEventListener('headerAddButtonClicked', onAdd);
    return () => window.removeEventListener('headerAddButtonClicked', onAdd);
  }, []);

  const savePlan = async () => {
    try {
      const response = await clienteAxios.put('/api/dietas/plan', plan);
      setPlan(response.data);
      enqueueSnackbar('Plan guardado', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Error al guardar el plan', { variant: 'error' });
    }
  };

  const saveMenu = async (nextMenu) => {
    try {
      const response = await clienteAxios.put('/api/dietas/menu', {
        fecha,
        slots: nextMenu.slots,
      });
      setMenu(response.data);
    } catch (error) {
      enqueueSnackbar('Error al guardar el menú', { variant: 'error' });
    }
  };

  const updateVinculo = (group, index, value) => {
    const link = splitHabitValue(value);
    setPlan((current) => {
      const list = [...(current.vinculos?.[group] || [])];
      list[index] = { ...list[index], ...link };
      return { ...current, vinculos: { ...current.vinculos, [group]: list } };
    });
  };

  const handleRecetaSubmit = async (formData) => {
    const payload = {
      nombre: formData.nombre,
      slot: formData.slot,
      calorias: Number(formData.calorias) || 0,
      proteinas: Number(formData.proteinas) || 0,
      carbohidratos: Number(formData.carbohidratos) || 0,
      grasas: Number(formData.grasas) || 0,
      preparacion: formData.preparacion || '',
      ingredientes: parseIngredientes(formData.ingredientes),
    };
    try {
      if (editing?.id || editing?._id) {
        await clienteAxios.put(`/api/dietas/recetas/${editing.id || editing._id}`, payload);
      } else {
        await clienteAxios.post('/api/dietas/recetas', payload);
      }
      setFormOpen(false);
      setEditing(null);
      await loadRecetas();
      enqueueSnackbar('Receta guardada', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Error al guardar la receta', { variant: 'error' });
    }
  };

  const deleteReceta = async (receta) => {
    try {
      await clienteAxios.delete(`/api/dietas/recetas/${receta.id || receta._id}`);
      await loadRecetas();
    } catch (error) {
      enqueueSnackbar('Error al eliminar la receta', { variant: 'error' });
    }
  };

  const formFields = [
    { name: 'nombre', label: 'Nombre', required: true },
    {
      name: 'slot',
      label: 'Comida',
      type: 'select',
      required: true,
      options: DIET_SLOTS.map((slot) => ({ value: slot.id, label: slot.label })),
    },
    { name: 'calorias', label: 'Calorías', type: 'number' },
    { name: 'proteinas', label: 'Proteínas (g)', type: 'number' },
    { name: 'carbohidratos', label: 'Carbohidratos (g)', type: 'number' },
    { name: 'grasas', label: 'Grasas (g)', type: 'number' },
    {
      name: 'ingredientes',
      label: 'Ingredientes (una línea: nombre, super|verduleria|rotiseria|cocina)',
      multiline: true,
      rows: 4,
    },
    { name: 'preparacion', label: 'Preparación', multiline: true, rows: 3 },
  ];

  return (
    <Box sx={{ px: 0, width: '100%' }}>
      <CommonDetails title="Plan" showTitle action={(
        <Button size="small" variant="contained" sx={{ borderRadius: 0 }} onClick={savePlan} disabled={!plan}>
          Guardar plan
        </Button>
      )}
      >
        {!plan ? <EmptyState /> : (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {['calorias', 'proteinas', 'carbohidratos', 'grasas'].map((field) => (
                <TextField
                  key={field}
                  size="small"
                  type="number"
                  label={field}
                  value={plan[field] ?? 0}
                  onChange={(event) => setPlan({ ...plan, [field]: Number(event.target.value) })}
                />
              ))}
            </Stack>
            <Typography variant="body2" color="text.secondary">Cocina y cena</Typography>
            {(plan.vinculos?.cocina || []).map((link, index) => (
              <TextField
                key={link.slot}
                select
                size="small"
                label={DIET_SLOTS.find((slot) => slot.id === link.slot)?.label || link.slot}
                value={habitValue(link.section, link.habitId)}
                onChange={(event) => updateVinculo('cocina', index, event.target.value)}
              >
                {habitOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
            ))}
            <Typography variant="body2" color="text.secondary">Compras</Typography>
            {(plan.vinculos?.compras || []).map((link, index) => (
              <TextField
                key={link.canal}
                select
                size="small"
                label={SHOP_CHANNELS.find((channel) => channel.id === link.canal)?.label || link.canal}
                value={habitValue(link.section, link.habitId)}
                onChange={(event) => updateVinculo('compras', index, event.target.value)}
              >
                <MenuItem value="">Sin vínculo</MenuItem>
                {habitOptions.map((option) => (
                  <MenuItem key={`${link.canal}-${option.value}`} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
            ))}
          </Stack>
        )}
      </CommonDetails>

      <CommonDetails title="Recetas" showTitle action={(
        <Button size="small" variant="contained" sx={{ borderRadius: 0 }} onClick={() => { setEditing(null); setFormOpen(true); }}>
          Nueva receta
        </Button>
      )}
      >
        {recetas.length === 0 ? <EmptyState /> : (
          <Stack spacing={1}>
            {recetas.map((receta) => (
              <Box key={receta.id || receta._id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2">
                  {receta.nombre} · {DIET_SLOTS.find((slot) => slot.id === receta.slot)?.label}
                </Typography>
                <CommonActions
                  onEdit={() => {
                    setEditing({
                      ...receta,
                      ingredientes: formatIngredientes(receta.ingredientes),
                    });
                    setFormOpen(true);
                  }}
                  onDelete={() => deleteReceta(receta)}
                  itemName="la receta"
                  size="small"
                />
              </Box>
            ))}
          </Stack>
        )}
      </CommonDetails>

      <CommonDetails title="Menú del día" showTitle>
        <Stack spacing={1}>
          <TextField
            size="small"
            type="date"
            label="Fecha"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          {DIET_SLOTS.map((slot) => {
            const entry = menu.slots?.[slot.id] || {};
            const options = recetas.filter((receta) => receta.slot === slot.id);
            return (
              <Box key={slot.id}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={slot.label}
                  value={entry.recetaId || ''}
                  onChange={(event) => {
                    const next = {
                      ...menu,
                      slots: {
                        ...menu.slots,
                        [slot.id]: { ...entry, recetaId: event.target.value },
                      },
                    };
                    setMenu(next);
                    saveMenu(next);
                  }}
                >
                  <MenuItem value="">Sin receta</MenuItem>
                  {options.map((receta) => (
                    <MenuItem key={receta.id || receta._id} value={receta.id || receta._id}>
                      {receta.nombre}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={(
                    <Checkbox
                      size="small"
                      checked={Boolean(entry.comido)}
                      onChange={(event) => {
                        const next = {
                          ...menu,
                          slots: {
                            ...menu.slots,
                            [slot.id]: { ...entry, comido: event.target.checked },
                          },
                        };
                        setMenu(next);
                        saveMenu(next);
                      }}
                    />
                  )}
                  label="Comido"
                />
              </Box>
            );
          })}
        </Stack>
      </CommonDetails>

      <CommonForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={handleRecetaSubmit}
        title={editing ? 'Editar receta' : 'Nueva receta'}
        fields={formFields}
        initialData={editing || { slot: 'CENA' }}
        isEditing={!!editing}
      />
    </Box>
  );
}

export default Dieta;

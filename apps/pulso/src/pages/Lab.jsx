import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CommonDate, CommonDetails, EmptyState } from '@shared/components/common';
import clienteAxios from '@shared/config/axios';
import { useSnackbar } from 'notistack';
import { BODY_ZONES, SALUD_ESTADOS, SALUD_TIPOS } from '@shared/pulso';
import BodyMap from '../components/lab/BodyMap';

const TIPO_LABEL = {
  TURNO: 'Turno',
  ESTUDIO: 'Estudio',
  REVISION: 'Revisión',
  COPAGO: 'Copago',
};

function emptyItem(controlId) {
  return {
    controlId: controlId || '',
    tipo: 'TURNO',
    titulo: '',
    fecha: new Date(),
    estado: 'PENDIENTE',
    notas: '',
  };
}

export function Lab() {
  const { enqueueSnackbar } = useSnackbar();
  const [controles, setControles] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [draft, setDraft] = useState(emptyItem());
  const [controlOpen, setControlOpen] = useState(false);
  const [controlDraft, setControlDraft] = useState({ zona: 'ojos', label: '', intervaloDias: 365 });

  const load = useCallback(async () => {
    const [controlesRes, itemsRes] = await Promise.all([
      clienteAxios.get('/api/salud/controles'),
      clienteAxios.get('/api/salud/items'),
    ]);
    setControles(controlesRes.data.controles || []);
    setItems(itemsRes.data || []);
  }, []);

  useEffect(() => {
    load().catch(() => enqueueSnackbar('Error al cargar Lab', { variant: 'error' }));
  }, [enqueueSnackbar, load]);

  useEffect(() => {
    const onAdd = (event) => {
      if (event.detail?.type !== 'salud-item') return;
      const first = controles.find((control) => !selectedZone || control.zona === selectedZone);
      setDraft(emptyItem(first?.controlId));
      setItemOpen(true);
    };
    window.addEventListener('headerAddButtonClicked', onAdd);
    return () => window.removeEventListener('headerAddButtonClicked', onAdd);
  }, [controles, selectedZone]);

  const visible = useMemo(() => controles.filter((control) => {
    if (selectedZone) return control.zona === selectedZone;
    return control.vencido;
  }), [controles, selectedZone]);

  const saveItem = async () => {
    try {
      if (draft.id || draft._id) {
        await clienteAxios.put(`/api/salud/items/${draft.id || draft._id}`, draft);
      } else {
        await clienteAxios.post('/api/salud/items', draft);
      }
      setItemOpen(false);
      await load();
      enqueueSnackbar('Ítem guardado', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Error al guardar el ítem', { variant: 'error' });
    }
  };

  const saveControl = async () => {
    try {
      await clienteAxios.post('/api/salud/controles', controlDraft);
      setControlOpen(false);
      setControlDraft({ zona: 'ojos', label: '', intervaloDias: 365 });
      await load();
    } catch (error) {
      enqueueSnackbar('Error al crear el control', { variant: 'error' });
    }
  };

  const updateIntervalo = async (control, intervaloDias) => {
    try {
      await clienteAxios.put(`/api/salud/controles/${control.controlId}`, {
        ...control,
        intervaloDias: Number(intervaloDias),
      });
      await load();
    } catch (error) {
      enqueueSnackbar('Error al actualizar el plazo', { variant: 'error' });
    }
  };

  return (
    <Box sx={{ px: 0, width: '100%' }}>
      <CommonDetails title="Lab" showTitle action={(
        <Button size="small" sx={{ borderRadius: 0 }} onClick={() => setControlOpen(true)}>
          Nuevo control
        </Button>
      )}
      >
        <BodyMap
          controles={controles}
          selectedZone={selectedZone}
          onSelectZone={setSelectedZone}
        />
        {visible.length === 0 ? <EmptyState /> : (
          <Stack spacing={2}>
            {visible.map((control) => {
              const related = items.filter((item) => item.controlId === control.controlId);
              return (
                <Box key={control.controlId} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                  <Typography variant="subtitle2">{control.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {control.lastFecha
                      ? `Última vez ${new Date(control.lastFecha).toLocaleDateString('es-AR')}`
                      : 'Sin estudio ni revisión'}
                    {control.pendiente ? ' · Turno pendiente' : ''}
                  </Typography>
                  <TextField
                    size="small"
                    type="number"
                    label="Plazo (días)"
                    defaultValue={control.intervaloDias}
                    key={`${control.controlId}-${control.intervaloDias}`}
                    onBlur={(event) => updateIntervalo(control, event.target.value)}
                    sx={{ mt: 1, maxWidth: 160 }}
                  />
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    {related.map((item) => (
                      <Typography key={item.id || item._id} variant="body2">
                        {TIPO_LABEL[item.tipo] || item.tipo}: {item.titulo} · {item.estado}
                      </Typography>
                    ))}
                  </Stack>
                  <Button
                    size="small"
                    sx={{ mt: 1, borderRadius: 0 }}
                    onClick={() => {
                      setDraft(emptyItem(control.controlId));
                      setItemOpen(true);
                    }}
                  >
                    Registrar
                  </Button>
                </Box>
              );
            })}
          </Stack>
        )}
      </CommonDetails>

      {itemOpen && (
        <Box sx={{ p: 2 }}>
          <Stack spacing={1}>
            <TextField
              select
              size="small"
              label="Control"
              value={draft.controlId}
              onChange={(event) => setDraft({ ...draft, controlId: event.target.value })}
            >
              {controles.map((control) => (
                <MenuItem key={control.controlId} value={control.controlId}>{control.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Tipo"
              value={draft.tipo}
              onChange={(event) => setDraft({ ...draft, tipo: event.target.value })}
            >
              {SALUD_TIPOS.map((tipo) => (
                <MenuItem key={tipo} value={tipo}>{TIPO_LABEL[tipo]}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Título"
              value={draft.titulo}
              onChange={(event) => setDraft({ ...draft, titulo: event.target.value })}
            />
            <CommonDate
              label="Fecha"
              value={draft.fecha}
              onChange={(fecha) => setDraft({ ...draft, fecha })}
            />
            <TextField
              select
              size="small"
              label="Estado"
              value={draft.estado}
              onChange={(event) => setDraft({ ...draft, estado: event.target.value })}
            >
              {SALUD_ESTADOS.map((estado) => (
                <MenuItem key={estado} value={estado}>{estado}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Notas"
              multiline
              value={draft.notas}
              onChange={(event) => setDraft({ ...draft, notas: event.target.value })}
            />
            <Button variant="contained" sx={{ borderRadius: 0 }} onClick={saveItem}>Guardar</Button>
            <Button sx={{ borderRadius: 0 }} onClick={() => setItemOpen(false)}>Cerrar</Button>
          </Stack>
        </Box>
      )}

      {controlOpen && (
        <Box sx={{ p: 2 }}>
          <Stack spacing={1}>
            <TextField
              size="small"
              label="Nombre"
              value={controlDraft.label}
              onChange={(event) => setControlDraft({ ...controlDraft, label: event.target.value })}
            />
            <TextField
              select
              size="small"
              label="Zona"
              value={controlDraft.zona}
              onChange={(event) => setControlDraft({ ...controlDraft, zona: event.target.value })}
            >
              {BODY_ZONES.map((zone) => (
                <MenuItem key={zone.id} value={zone.id}>{zone.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              type="number"
              label="Plazo (días)"
              value={controlDraft.intervaloDias}
              onChange={(event) => setControlDraft({ ...controlDraft, intervaloDias: Number(event.target.value) })}
            />
            <Button variant="contained" sx={{ borderRadius: 0 }} onClick={saveControl}>Crear control</Button>
            <Button sx={{ borderRadius: 0 }} onClick={() => setControlOpen(false)}>Cerrar</Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

export default Lab;

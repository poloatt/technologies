import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { CommonDate } from '@shared/components/common';
import useResponsive from '@shared/hooks/useResponsive';
import clienteAxios from '@shared/config/axios';
import { useSnackbar } from 'notistack';
import { SALUD_ESTADOS, SALUD_TIPOS } from '@shared/pulso';
import BodyMap from '../components/data/BodyMap';

const TIPO_LABEL = {
  TURNO: 'Turno',
  ESTUDIO: 'Estudio',
  REVISION: 'Revisión',
  COPAGO: 'Copago',
};

const dialogPaperSx = { borderRadius: 0 };

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

export function Data() {
  const { enqueueSnackbar } = useSnackbar();
  const { isDesktop } = useResponsive();
  const [controles, setControles] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [draft, setDraft] = useState(emptyItem());

  const load = useCallback(async () => {
    const [controlesRes, itemsRes] = await Promise.all([
      clienteAxios.get('/api/salud/controles'),
      clienteAxios.get('/api/salud/items'),
    ]);
    setControles(controlesRes.data.controles || []);
    setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
  }, []);

  useEffect(() => {
    load().catch(() => enqueueSnackbar('Error al cargar Data', { variant: 'error' }));
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

  return (
    <Box
      sx={isDesktop
        ? { px: 0, width: '100%', flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }
        : { px: 0, width: '100%' }}
    >
      <BodyMap
        controles={controles}
        items={items}
        selectedZone={selectedZone}
        onSelectZone={setSelectedZone}
      />

      <Dialog open={itemOpen} onClose={() => setItemOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle>Registrar</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
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
              minRows={2}
              value={draft.notas}
              onChange={(event) => setDraft({ ...draft, notas: event.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button sx={{ borderRadius: 0 }} onClick={() => setItemOpen(false)}>Cerrar</Button>
          <Button variant="contained" sx={{ borderRadius: 0 }} onClick={saveItem}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Data;

import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { CloseOutlined } from '@mui/icons-material';
import { FONT_SIZE, FONT_WEIGHT, hubEyebrowSx } from '@shared/tipografia';

function FlatAutocompletePaper(props) {
  return (
    <Paper
      {...props}
      elevation={0}
      sx={{
        borderRadius: 0,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.default',
        backgroundImage: 'none',
        boxShadow: 'none',
      }}
    />
  );
}

export default function ContactoMergeDialog({
  open,
  onClose,
  targetContacto,
  contactos = [],
  onConfirmMerge,
}) {
  const [selectedSources, setSelectedSources] = useState([]);
  const [applyRetroactive, setApplyRetroactive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const targetId = targetContacto?.id || targetContacto?._id;
  const options = useMemo(
    () => contactos.filter((c) => (c.id || c._id) !== targetId),
    [contactos, targetId]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedSources([]);
    setApplyRetroactive(true);
    setError('');
  }, [open, targetId]);

  const handleConfirm = async () => {
    if (!selectedSources.length) {
      setError('Seleccioná al menos un contacto duplicado para fusionar');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConfirmMerge(
        targetId,
        selectedSources.map((s) => s.id || s._id),
        applyRetroactive
      );
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Error al fusionar contactos');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        elevation: 0,
        sx: {
          borderRadius: 0,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
          backgroundImage: 'none',
          boxShadow: 'none',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1.25,
          px: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ ...hubEyebrowSx, color: 'text.secondary' }}>
            Fusionar contactos
          </Typography>
          <Typography
            noWrap
            sx={{ fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: 'text.primary' }}
          >
            Destino: {targetContacto?.nombre}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={onClose}
          disabled={saving}
          sx={{ borderRadius: 0, color: 'text.secondary' }}
        >
          <CloseOutlined sx={{ fontSize: 16 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: FONT_SIZE.xs }}>
          Los aliases, identificadores de Mercado Pago y movimientos de los contactos seleccionados
          pasarán a «{targetContacto?.nombre}» y los duplicados se eliminarán.
        </Typography>

        {error && (
          <Typography variant="caption" color="error" sx={{ fontSize: FONT_SIZE.xs }}>
            {error}
          </Typography>
        )}

        <Autocomplete
          multiple
          size="small"
          options={options}
          value={selectedSources}
          onChange={(_, value) => setSelectedSources(value)}
          PaperComponent={FlatAutocompletePaper}
          getOptionLabel={(opt) =>
            `${opt.nombre}${opt.transaccionesCount ? ` (${opt.transaccionesCount})` : ''}`
          }
          isOptionEqualToValue={(a, b) => (a.id || a._id) === (b.id || b._id)}
          renderTags={(value, getTagProps) =>
            value.map((opt, index) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip
                  key={key}
                  {...tagProps}
                  size="small"
                  variant="outlined"
                  label={opt.nombre}
                  sx={{
                    borderRadius: 0,
                    height: 22,
                    fontSize: FONT_SIZE.xs,
                    borderColor: 'divider',
                  }}
                />
              );
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Contactos duplicados a absorber"
              placeholder="Buscar contacto..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 0,
                  fontSize: FONT_SIZE.sm,
                },
              }}
            />
          )}
        />

        {Boolean(
          targetContacto?.categoriaDefault ||
          targetContacto?.categoriaIngreso ||
          targetContacto?.categoriaEgreso
        ) && (
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={applyRetroactive}
                  onChange={(e) => setApplyRetroactive(e.target.checked)}
                  sx={{ p: 0.4 }}
                />
              }
              label={
                <Typography variant="caption" sx={{ fontSize: FONT_SIZE.xs, color: 'text.secondary' }}>
                  Aplicar la categoría de «{targetContacto?.nombre}» a los movimientos absorbidos
                </Typography>
              }
              sx={{ m: 0 }}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          onClick={onClose}
          disabled={saving}
          color="inherit"
          size="small"
          sx={{ borderRadius: 0, fontSize: FONT_SIZE.xs, color: 'text.secondary' }}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={saving || !selectedSources.length}
          size="small"
          sx={{
            borderRadius: 0,
            fontSize: FONT_SIZE.xs,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          }}
        >
          {saving ? 'Fusionando...' : 'Fusionar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

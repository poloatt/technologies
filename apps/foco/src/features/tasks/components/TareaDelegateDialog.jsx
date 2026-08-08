import React, { useCallback, useEffect, useState } from 'react';
import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { searchUsersForDelegate } from '../api/tasksApi';

/**
 * Dialog para agregar un co-owner (Delegar).
 */
export default function TareaDelegateDialog({
  open,
  onClose,
  onSelect,
  excludeIds = [],
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setOptions([]);
      setSelected(null);
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const docs = await searchUsersForDelegate(q);
        if (cancelled) return;
        const excluded = new Set(excludeIds.map(String));
        setOptions(
          (docs || []).filter((u) => !excluded.has(String(u._id || u.id))),
        );
      } catch (err) {
        if (!cancelled) {
          setOptions([]);
          setError(err?.response?.data?.error || 'No se pudo buscar usuarios');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, excludeIds]);

  const handleConfirm = useCallback(async () => {
    if (!selected) return;
    await onSelect?.(selected);
    onClose?.();
  }, [selected, onSelect, onClose]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Delegar / agregar owner</DialogTitle>
      <DialogContent>
        <Autocomplete
          sx={{ mt: 1 }}
          options={options}
          loading={loading}
          value={selected}
          onChange={(_, value) => setSelected(value)}
          inputValue={query}
          onInputChange={(_, value) => {
            setQuery(value);
            setError('');
          }}
          getOptionLabel={(opt) => {
            if (!opt) return '';
            const name = opt.nombre || '';
            const email = opt.email || '';
            return name && email ? `${name} (${email})` : (name || email);
          }}
          isOptionEqualToValue={(a, b) => String(a?._id || a?.id) === String(b?._id || b?.id)}
          noOptionsText={query.trim().length < 2 ? 'Escribí al menos 2 caracteres' : 'Sin resultados'}
          renderInput={(params) => (
            <TextField
              {...params}
              autoFocus
              label="Buscar usuario"
              placeholder="Nombre o email"
              error={Boolean(error)}
              helperText={error || 'Se agrega como co-owner; vos seguís siendo owner'}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!selected} onClick={handleConfirm}>
          Agregar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

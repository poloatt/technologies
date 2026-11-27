import React, { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import clienteAxios from '@shared/config/axios';
import { CATEGORIAS, getCategoriaMeta } from './categoriasConstants';
import { FONT_SIZE } from '@shared/tipografia';

export default function TransaccionCategoriaInline({ transaccion }) {
  const { enqueueSnackbar } = useSnackbar();
  const [savingTx, setSavingTx] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [localCategory, setLocalCategory] = useState(null);
  const [rulePromptCategory, setRulePromptCategory] = useState(null);
  const [applyRetroactive, setApplyRetroactive] = useState(true);

  const txId = transaccion?._id || transaccion?.id;
  const currentCategory = localCategory ?? transaccion?.categoria ?? 'Otro';
  const contacto = transaccion?.contacto && typeof transaccion.contacto === 'object'
    ? transaccion.contacto
    : null;
  const contactoId = contacto?.id || contacto?._id || null;

  const handleCategoryChange = async (event) => {
    event.stopPropagation();
    const nextCategory = event.target.value;
    if (!txId || !nextCategory || nextCategory === currentCategory) return;

    setSavingTx(true);
    setLocalCategory(nextCategory);
    try {
      await clienteAxios.put(`/api/transacciones/${txId}`, { categoria: nextCategory });
      window.dispatchEvent(new Event('transaccionesRefreshed'));

      // Si tiene contacto vinculado y la categoría elegida difiere de la del contacto, ofrecer guardarla como regla
      const currentContactCat =
        (transaccion.tipo === 'INGRESO'
          ? contacto?.categoriaIngreso
          : contacto?.categoriaEgreso) || contacto?.categoriaDefault;
      if (contactoId && currentContactCat !== nextCategory) {
        setRulePromptCategory(nextCategory);
        setApplyRetroactive(true);
      } else {
        setRulePromptCategory(null);
        enqueueSnackbar('Categoría actualizada', { variant: 'success' });
      }
    } catch (err) {
      setLocalCategory(null);
      enqueueSnackbar(
        err?.response?.data?.message || 'Error al actualizar la categoría',
        { variant: 'error' }
      );
    } finally {
      setSavingTx(false);
    }
  };

  const handleSaveRuleForContact = async (e) => {
    e.stopPropagation();
    if (!contactoId || !rulePromptCategory) return;
    setSavingRule(true);
    try {
      const res = await clienteAxios.put(`/api/contactos/${contactoId}`, {
        categoriaDefault: rulePromptCategory,
        aplicarRetroactivo: applyRetroactive,
      });
      const updatedTx = res.data?.transaccionesActualizadas || 0;
      enqueueSnackbar(
        updatedTx > 0
          ? `Regla guardada para ${contacto.nombre} · ${updatedTx} ${updatedTx === 1 ? 'movimiento actualizado' : 'movimientos actualizados'}`
          : `Regla guardada para futuros movimientos de ${contacto.nombre}`,
        { variant: 'success' }
      );
      setRulePromptCategory(null);
      window.dispatchEvent(new Event('contactosRefreshed'));
      window.dispatchEvent(new Event('transaccionesRefreshed'));
    } catch (err) {
      enqueueSnackbar(
        err?.response?.data?.message || 'Error al guardar regla en el contacto',
        { variant: 'error' }
      );
    } finally {
      setSavingRule(false);
    }
  };

  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          Categoría
        </Typography>
        <Select
          size="small"
          disabled={savingTx}
          value={currentCategory}
          onChange={handleCategoryChange}
          renderValue={(selected) => {
            const meta = getCategoriaMeta(selected);
            const CatIcon = meta?.Icon;
            return (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                {CatIcon && (
                  <CatIcon sx={{ fontSize: 14, color: meta?.color || 'text.secondary' }} />
                )}
                <Typography component="span" sx={{ fontSize: FONT_SIZE.xs, fontWeight: 500 }}>
                  {selected}
                </Typography>
              </Box>
            );
          }}
          MenuProps={{
            PaperProps: {
              elevation: 0,
              sx: {
                borderRadius: 0,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
                backgroundImage: 'none',
                boxShadow: 'none',
              },
            },
          }}
          sx={{
            height: 26,
            minWidth: 150,
            borderRadius: 0,
            fontSize: FONT_SIZE.xs,
            '& .MuiOutlinedInput-notchedOutline': {
              borderRadius: 0,
            },
            '& .MuiSelect-select': {
              py: 0.25,
              px: 0.85,
              display: 'flex',
              alignItems: 'center',
            },
          }}
        >
          {CATEGORIAS.map((cat) => {
            const CatIcon = cat.Icon;
            return (
              <MenuItem key={cat.valor} value={cat.valor} sx={{ fontSize: FONT_SIZE.xs, gap: 0.75 }}>
                <CatIcon sx={{ fontSize: 16, color: cat.color }} />
                <span>{cat.valor}</span>
              </MenuItem>
            );
          })}
        </Select>
      </Box>

      {rulePromptCategory && contacto && (
        <Box
          sx={{
            p: 0.85,
            border: '1px dashed',
            borderColor: 'primary.main',
            borderRadius: 0,
            bgcolor: 'action.hover',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 500, lineHeight: 1.3 }}>
            ¿Asignar «{rulePromptCategory}» siempre a {contacto.nombre}?
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={applyRetroactive}
                onChange={(e) => setApplyRetroactive(e.target.checked)}
                sx={{ p: 0.3 }}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                Aplicar también a movimientos existentes de este contacto
              </Typography>
            }
            sx={{ m: 0 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
            <Button
              size="small"
              color="inherit"
              disabled={savingRule}
              onClick={(e) => {
                e.stopPropagation();
                setRulePromptCategory(null);
              }}
              sx={{
                minWidth: 0,
                py: 0.2,
                px: 0.75,
                fontSize: FONT_SIZE.xs,
                textTransform: 'none',
                borderRadius: 0,
              }}
            >
              Solo este
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={savingRule}
              onClick={handleSaveRuleForContact}
              sx={{
                minWidth: 0,
                py: 0.2,
                px: 0.9,
                fontSize: FONT_SIZE.xs,
                textTransform: 'none',
                borderRadius: 0,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              }}
            >
              {savingRule ? 'Guardando...' : 'Guardar para contacto'}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

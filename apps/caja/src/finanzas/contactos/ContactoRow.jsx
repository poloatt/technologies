import React, { Suspense, memo, useCallback, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Collapse,
  FormControlLabel,
  Menu,
  MenuItem,
  Skeleton,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  CheckOutlined,
  CloseOutlined,
  ExpandMoreRounded,
} from '@mui/icons-material';
import { CATEGORIAS, getCategoriaMeta } from '../transacciones/categoriasConstants';
import { getTipoContactoMeta } from './contactoConstants';
import { collapsePanelProps } from '@shared/styles/collapseSectionStyles';
import {
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  hubNumericSx,
} from '@shared/tipografia';

let inlineEditorPromise = null;
const loadContactoInlineEditor = () => {
  if (!inlineEditorPromise) {
    inlineEditorPromise = import('./ContactoInlineEditor');
  }
  return inlineEditorPromise;
};

export function preloadContactoInlineEditor() {
  return loadContactoInlineEditor();
}

const ContactoInlineEditor = React.lazy(loadContactoInlineEditor);

function InlineEditorFallback() {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 1.25,
        borderTop: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Skeleton variant="rectangular" height={32} sx={{ borderRadius: 0, bgcolor: 'action.hover' }} />
      <Skeleton variant="rectangular" height={28} sx={{ borderRadius: 0, bgcolor: 'action.hover' }} />
      <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 0, bgcolor: 'action.hover' }} />
    </Box>
  );
}

const ContactoRow = memo(function ContactoRow({
  contacto,
  expanded = false,
  onToggleExpand,
  onQuickCategorySave,
  onSaveEdit,
  onMerge,
  onDelete,
  canMerge = false,
  showCategoryBadge = true,
}) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [pendingCategory, setPendingCategory] = useState(null);
  const [applyRetroactive, setApplyRetroactive] = useState(true);
  const [savingQuick, setSavingQuick] = useState(false);

  const contactoId = contacto.id || contacto._id;
  const tipoMeta = getTipoContactoMeta(contacto.tipo);
  const TipoIcon = tipoMeta.Icon;
  const currentCat = contacto.categoriaDefault || '';
  const displayedCat = pendingCategory !== null ? pendingCategory : currentCat;
  const catMeta = getCategoriaMeta(displayedCat);
  const CatIcon = catMeta?.Icon || null;
  const txCount = contacto.transaccionesCount || 0;
  const hasSeparateOverrides = Boolean(contacto.categoriaIngreso || contacto.categoriaEgreso);
  const isUncategorized = !currentCat && !hasSeparateOverrides;

  const handleOpenCategoryMenu = (e) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  };

  const handleCloseCategoryMenu = (e) => {
    e?.stopPropagation?.();
    setMenuAnchor(null);
  };

  const handlePickCategory = async (nextValue) => {
    setMenuAnchor(null);
    if (nextValue === currentCat) {
      setPendingCategory(null);
      return;
    }
    if (txCount > 0 && nextValue) {
      setPendingCategory(nextValue);
      setApplyRetroactive(true);
      return;
    }
    setSavingQuick(true);
    try {
      await onQuickCategorySave(contacto, nextValue || null, false);
    } finally {
      setSavingQuick(false);
    }
  };

  const handleConfirmPending = async (e) => {
    e.stopPropagation();
    if (pendingCategory === null) return;
    setSavingQuick(true);
    try {
      await onQuickCategorySave(contacto, pendingCategory || null, applyRetroactive);
      setPendingCategory(null);
    } finally {
      setSavingQuick(false);
    }
  };

  const handleSaveInline = useCallback(
    async (payload) => {
      await onSaveEdit(contacto, payload);
      onToggleExpand?.(null);
    },
    [contacto, onSaveEdit, onToggleExpand]
  );

  const handleCancelInline = useCallback(() => {
    onToggleExpand?.(null);
  }, [onToggleExpand]);

  const handleToggle = () => {
    if (!expanded) preloadContactoInlineEditor();
    onToggleExpand?.(expanded ? null : contactoId);
  };

  return (
    <Box
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      {/* Fila colapsada / header de la fila */}
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onMouseEnter={preloadContactoInlineEditor}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.5,
          py: 0.875,
          cursor: 'pointer',
          bgcolor: expanded ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: expanded ? 'action.selected' : 'action.hover' },
          '&:focus-visible': {
            outline: '1px solid',
            outlineColor: 'text.secondary',
            outlineOffset: -1,
          },
          transition: 'background-color 0.14s ease',
        }}
      >
        {/* Izquierda: ícono + nombre + sublínea */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
          <TipoIcon
            sx={{
              fontSize: 16,
              color: isUncategorized ? 'warning.main' : 'text.secondary',
              flexShrink: 0,
            }}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.65, minWidth: 0 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{
                  fontSize: FONT_SIZE.md,
                  fontWeight: FONT_WEIGHT.medium,
                  color: 'text.primary',
                  lineHeight: 1.25,
                }}
              >
                {contacto.nombre}
              </Typography>
              {contacto.origen === 'MERCADOPAGO' && (
                <Box
                  component="span"
                  sx={{
                    px: 0.5,
                    py: 0.1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 0,
                    fontSize: FONT_SIZE['2xs'],
                    fontWeight: FONT_WEIGHT.medium,
                    letterSpacing: LETTER_SPACING.wider,
                    color: 'text.secondary',
                    lineHeight: 1.2,
                    flexShrink: 0,
                  }}
                >
                  MP
                </Box>
              )}
            </Box>

            <Typography
              variant="caption"
              noWrap
              sx={{
                display: 'block',
                fontSize: FONT_SIZE.xs,
                color: 'text.secondary',
                lineHeight: 1.2,
                mt: 0.15,
              }}
            >
              <Box component="span" sx={hubNumericSx}>
                {txCount === 0
                  ? 'Sin mov.'
                  : txCount === 1
                    ? '1 mov.'
                    : `${txCount} mov.`}
              </Box>
              {' · '}
              {tipoMeta.label}
              {hasSeparateOverrides
                ? ` · ${[
                    contacto.categoriaIngreso ? `Ing: ${contacto.categoriaIngreso}` : null,
                    contacto.categoriaEgreso ? `Egr: ${contacto.categoriaEgreso}` : null,
                  ]
                    .filter(Boolean)
                    .join(' / ')}`
                : ''}
            </Typography>
          </Box>
        </Box>

        {/* Derecha: selector plano de categoría + chevron */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            flexShrink: 0,
          }}
        >
          {(showCategoryBadge || isUncategorized || pendingCategory !== null) && !expanded && (
            <ButtonBase
              type="button"
              disabled={savingQuick}
              onClick={handleOpenCategoryMenu}
              aria-label={`Cambiar categoría de ${contacto.nombre}`}
              sx={{
                height: 24,
                px: 0.75,
                borderRadius: 0,
                border: '1px solid',
                borderColor: catMeta
                  ? alpha(catMeta.color, 0.45)
                  : isUncategorized
                    ? (theme) => alpha(theme.palette.warning.main, 0.45)
                    : 'divider',
                bgcolor: catMeta ? alpha(catMeta.color, 0.08) : 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                maxWidth: 148,
                '&:hover': {
                  bgcolor: catMeta ? alpha(catMeta.color, 0.15) : 'action.hover',
                },
                transition: 'background-color 0.12s ease, border-color 0.12s ease',
              }}
            >
              {CatIcon && (
                <CatIcon sx={{ fontSize: 13, color: catMeta.color, flexShrink: 0 }} />
              )}
              <Typography
                component="span"
                noWrap
                sx={{
                  fontSize: FONT_SIZE.xs,
                  fontWeight: FONT_WEIGHT.medium,
                  color: catMeta ? 'text.primary' : 'warning.main',
                  lineHeight: 1,
                }}
              >
                {displayedCat || 'Asignar'}
              </Typography>
            </ButtonBase>
          )}

          <ExpandMoreRounded
            sx={{
              fontSize: 16,
              color: expanded ? 'text.primary' : 'text.disabled',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 160ms ease, color 160ms ease',
            }}
          />
        </Box>
      </Box>

      {/* Menú plano montado solo cuando se abre (evita montar cientos de MUI Menu ocultos) */}
      {Boolean(menuAnchor) && (
        <Menu
          anchorEl={menuAnchor}
          open
          onClose={handleCloseCategoryMenu}
          onClick={(e) => e.stopPropagation()}
          PaperProps={{
            elevation: 0,
            sx: {
              borderRadius: 0,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.default',
              backgroundImage: 'none',
              boxShadow: 'none',
              minWidth: 185,
            },
          }}
        >
          <MenuItem
            dense
            selected={!currentCat}
            onClick={() => handlePickCategory('')}
            sx={{ fontSize: FONT_SIZE.xs, minHeight: 30, color: 'text.secondary' }}
          >
            Sin categoría
          </MenuItem>
          {CATEGORIAS.map((cat) => {
            const IconComp = cat.Icon;
            return (
              <MenuItem
                key={cat.valor}
                dense
                selected={currentCat === cat.valor}
                onClick={() => handlePickCategory(cat.valor)}
                sx={{ fontSize: FONT_SIZE.xs, minHeight: 30, gap: 0.75 }}
              >
                <IconComp sx={{ fontSize: 15, color: cat.color }} />
                <span>{cat.valor}</span>
              </MenuItem>
            );
          })}
        </Menu>
      )}

      {/* Confirmación inline de aplicación retroactiva tras cambio rápido */}
      {pendingCategory !== null && !expanded && (
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            px: 1.5,
            py: 0.75,
            borderTop: '1px dashed',
            borderColor: 'divider',
            bgcolor: (theme) =>
              alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.025 : 0.018),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 0.75,
          }}
        >
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
              <Typography sx={{ fontSize: FONT_SIZE.xs, color: 'text.secondary' }}>
                Aplicar a los{' '}
                <Box component="span" sx={{ ...hubNumericSx, color: 'text.primary', fontWeight: FONT_WEIGHT.semibold }}>
                  {txCount}
                </Box>{' '}
                {txCount === 1 ? 'movimiento existente' : 'movimientos existentes'}
              </Typography>
            }
            sx={{ m: 0 }}
          />
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Button
              size="small"
              color="inherit"
              disabled={savingQuick}
              onClick={(e) => {
                e.stopPropagation();
                setPendingCategory(null);
              }}
              startIcon={<CloseOutlined sx={{ fontSize: 13 }} />}
              sx={{
                borderRadius: 0,
                minWidth: 0,
                px: 0.75,
                py: 0.2,
                fontSize: FONT_SIZE.xs,
                color: 'text.secondary',
              }}
            >
              Cancelar
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={savingQuick}
              onClick={handleConfirmPending}
              startIcon={<CheckOutlined sx={{ fontSize: 13 }} />}
              sx={{
                borderRadius: 0,
                minWidth: 0,
                px: 1,
                py: 0.2,
                fontSize: FONT_SIZE.xs,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              }}
            >
              Guardar
            </Button>
          </Box>
        </Box>
      )}

      {/* Edición inline lazy-loaded al hacer clic en la fila */}
      <Collapse in={expanded} {...collapsePanelProps}>
        <Suspense fallback={<InlineEditorFallback />}>
          <ContactoInlineEditor
            initialData={contacto}
            onSave={handleSaveInline}
            onCancel={handleCancelInline}
            onMerge={onMerge}
            onDelete={onDelete}
            canMerge={canMerge}
          />
        </Suspense>
      </Collapse>
    </Box>
  );
});

export default ContactoRow;

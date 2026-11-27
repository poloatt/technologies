import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Collapse,
  FormControlLabel,
  IconButton,
  InputBase,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  AddOutlined,
  CloseOutlined,
  ExpandMoreRounded,
  MergeTypeOutlined,
} from '@mui/icons-material';
import { CATEGORIAS, getCategoriaMeta, getCategoriasPorTipo } from '../transacciones/categoriasConstants';
import { TIPOS_CONTACTO } from './contactoConstants';
import { collapseInlineToggleSx, collapsePanelProps } from '@shared/styles/collapseSectionStyles';
import {
  FONT_SIZE,
  FONT_WEIGHT,
  hubEyebrowSx,
  hubNumericSx,
} from '@shared/tipografia';

const EMPTY_FORM = {
  nombre: '',
  tipo: 'OTRO',
  categoriaDefault: '',
  categoriaIngreso: '',
  categoriaEgreso: '',
  aliases: [],
  mpIds: [],
  emails: [],
  cuentasBancarias: [],
  telefono: '',
  email: '',
  notas: '',
};

const flatFieldBoxSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 0,
  bgcolor: 'background.default',
  px: 1,
  py: 0.5,
  '&:focus-within': {
    borderColor: (theme) => alpha(theme.palette.text.primary, 0.35),
  },
  transition: 'border-color 0.14s ease',
};

const flatMenuProps = {
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
};

function buildInitialState(initialData) {
  if (!initialData) return EMPTY_FORM;
  return {
    nombre: initialData.nombre || '',
    tipo: initialData.tipo || 'OTRO',
    categoriaDefault: initialData.categoriaDefault || '',
    categoriaIngreso: initialData.categoriaIngreso || '',
    categoriaEgreso: initialData.categoriaEgreso || '',
    aliases: [...(initialData.identificadores?.aliases || [])],
    mpIds: [...(initialData.identificadores?.mpIds || [])],
    emails: [...(initialData.identificadores?.emails || [])],
    cuentasBancarias: [...(initialData.identificadores?.cuentasBancarias || [])],
    telefono: initialData.datosContacto?.telefono || '',
    email: initialData.datosContacto?.email || '',
    notas: initialData.datosContacto?.notas || '',
  };
}

/**
 * Editor/creador inline de Contacto con estética Hub de Finanzas (borderRadius 0).
 * Se renderiza dentro de ContactoRow (edición) o al tope de ContactosSetup (alta).
 */
export default function ContactoInlineEditor({
  initialData = null,
  onSave,
  onCancel,
  onMerge,
  onDelete,
  canMerge = false,
  autoFocus = false,
}) {
  const isEditing = Boolean(initialData?.id || initialData?._id);
  const txCount = initialData?.transaccionesCount || 0;

  const [form, setForm] = useState(() => buildInitialState(initialData));
  const [newAlias, setNewAlias] = useState('');
  const [showDirectionOverrides, setShowDirectionOverrides] = useState(
    Boolean(initialData?.categoriaIngreso || initialData?.categoriaEgreso)
  );
  const [showMetaSection, setShowMetaSection] = useState(false);
  const [applyRetroactive, setApplyRetroactive] = useState(true);
  const [overwriteManuals, setOverwriteManuals] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(buildInitialState(initialData));
    setShowDirectionOverrides(
      Boolean(initialData?.categoriaIngreso || initialData?.categoriaEgreso)
    );
    setConfirmDelete(false);
    setError('');
  }, [initialData]);

  const hasAnyCategory = Boolean(
    form.categoriaDefault || form.categoriaIngreso || form.categoriaEgreso
  );
  const categoryChanged = isEditing && (
    (form.categoriaDefault || null) !== (initialData?.categoriaDefault || null) ||
    (form.categoriaIngreso || null) !== (initialData?.categoriaIngreso || null) ||
    (form.categoriaEgreso || null) !== (initialData?.categoriaEgreso || null)
  );

  const selectedCatMeta = getCategoriaMeta(form.categoriaDefault);
  const categoriasIngreso = getCategoriasPorTipo('INGRESO');
  const categoriasEgreso = getCategoriasPorTipo('EGRESO');

  const handleAddAlias = () => {
    const trimmed = newAlias.trim().toLowerCase();
    if (!trimmed) return;
    if (!form.aliases.includes(trimmed)) {
      setForm((prev) => ({ ...prev, aliases: [...prev.aliases, trimmed] }));
    }
    setNewAlias('');
  };

  const handleRemoveAlias = (alias) => {
    setForm((prev) => ({ ...prev, aliases: prev.aliases.filter((a) => a !== alias) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        categoriaDefault: form.categoriaDefault || null,
        categoriaIngreso: form.categoriaIngreso || null,
        categoriaEgreso: form.categoriaEgreso || null,
        identificadores: {
          aliases: form.aliases,
          mpIds: form.mpIds,
          emails: form.emails,
          cuentasBancarias: form.cuentasBancarias,
        },
        datosContacto: {
          telefono: form.telefono.trim(),
          email: form.email.trim(),
          notas: form.notas.trim(),
        },
        aplicarRetroactivo: isEditing && txCount > 0 && hasAnyCategory && applyRetroactive,
        sobrescribirManuales: overwriteManuals,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async (e) => {
    e.stopPropagation();
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(initialData);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      sx={{
        px: 1.5,
        pt: 1.125,
        pb: 1.25,
        borderTop: isEditing ? '1px solid' : 'none',
        borderColor: 'divider',
        bgcolor: (theme) =>
          alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.025 : 0.018),
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      {error && (
        <Typography variant="caption" color="error" sx={{ fontSize: FONT_SIZE.xs }}>
          {error}
        </Typography>
      )}

      {/* Nombre */}
      <Box>
        <Typography component="label" sx={{ ...hubEyebrowSx, mb: 0.5 }}>
          Nombre
        </Typography>
        <Box sx={flatFieldBoxSx}>
          <InputBase
            fullWidth
            autoFocus={autoFocus}
            value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            placeholder="Ej. Carrefour, Juan Pérez, AFIP..."
            sx={{ fontSize: FONT_SIZE.md, color: 'text.primary' }}
          />
        </Box>
      </Box>

      {/* Tipo segmentado cuadrado */}
      <Box>
        <Typography sx={{ ...hubEyebrowSx, mb: 0.5 }}>
          Tipo
        </Typography>
        <Box
          role="group"
          aria-label="Tipo de contacto"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {TIPOS_CONTACTO.map((t, idx) => {
            const TipoIcon = t.Icon;
            const selected = form.tipo === t.value;
            return (
              <ButtonBase
                key={t.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setForm((p) => ({ ...p, tipo: t.value }))}
                sx={{
                  py: 0.55,
                  px: 0.5,
                  borderRadius: 0,
                  borderLeft: idx > 0 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  bgcolor: selected ? 'action.selected' : 'background.default',
                  color: selected ? 'text.primary' : 'text.secondary',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  fontSize: FONT_SIZE.xs,
                  fontWeight: selected ? FONT_WEIGHT.semibold : FONT_WEIGHT.regular,
                  '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
                  transition: 'background-color 0.14s ease, color 0.14s ease',
                }}
              >
                <TipoIcon sx={{ fontSize: 14 }} />
                <span>{t.label}</span>
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      {/* Categoría automática: grilla compacta plana */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={hubEyebrowSx}>Categoría</Typography>
            <Typography
              component="span"
              sx={{
                fontSize: FONT_SIZE.xs,
                fontWeight: FONT_WEIGHT.medium,
                color: selectedCatMeta ? selectedCatMeta.color : 'text.disabled',
              }}
            >
              {form.categoriaDefault || 'Sin categoría'}
            </Typography>
          </Box>
          {form.categoriaDefault && (
            <ButtonBase
              type="button"
              onClick={() => setForm((p) => ({ ...p, categoriaDefault: '' }))}
              sx={{
                fontSize: FONT_SIZE['2xs'],
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'text.secondary',
                '&:hover': { color: 'text.primary' },
              }}
            >
              Quitar
            </ButtonBase>
          )}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(6, 1fr)', sm: 'repeat(12, 1fr)' },
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          {CATEGORIAS.map((cat) => {
            const CatIcon = cat.Icon;
            const selected = form.categoriaDefault === cat.valor;
            return (
              <Tooltip key={cat.valor} title={cat.valor} arrow={false}>
                <ButtonBase
                  type="button"
                  aria-label={cat.valor}
                  aria-pressed={selected}
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      categoriaDefault: p.categoriaDefault === cat.valor ? '' : cat.valor,
                    }))
                  }
                  sx={{
                    height: 32,
                    borderRadius: 0,
                    bgcolor: selected ? alpha(cat.color, 0.16) : 'transparent',
                    color: selected ? cat.color : 'text.secondary',
                    borderBottom: selected ? `2px solid ${cat.color}` : '2px solid transparent',
                    '&:hover': {
                      bgcolor: selected ? alpha(cat.color, 0.22) : 'action.hover',
                      color: cat.color,
                    },
                    transition: 'background-color 0.12s ease, color 0.12s ease',
                  }}
                >
                  <CatIcon sx={{ fontSize: 16 }} />
                </ButtonBase>
              </Tooltip>
            );
          })}
        </Box>

        {/* Overrides opcionales por sentido */}
        <ButtonBase
          type="button"
          onClick={() => setShowDirectionOverrides((v) => !v)}
          sx={{
            ...collapseInlineToggleSx,
            mt: 0.75,
            py: 0.25,
            fontSize: FONT_SIZE.xs,
            borderRadius: 0,
          }}
        >
          <ExpandMoreRounded
            sx={{
              fontSize: 15,
              transform: showDirectionOverrides ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 160ms ease',
            }}
          />
          <Typography component="span" sx={{ fontSize: FONT_SIZE.xs }}>
            Diferenciar Ingreso / Egreso
          </Typography>
        </ButtonBase>

        <Collapse in={showDirectionOverrides} {...collapsePanelProps}>
          <Box
            sx={{
              mt: 0.75,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1,
            }}
          >
            <Box>
              <Typography sx={{ ...hubEyebrowSx, mb: 0.35 }}>Si es Ingreso</Typography>
              <Select
                size="small"
                fullWidth
                displayEmpty
                value={form.categoriaIngreso}
                onChange={(e) => setForm((p) => ({ ...p, categoriaIngreso: e.target.value }))}
                MenuProps={flatMenuProps}
                sx={{
                  borderRadius: 0,
                  bgcolor: 'background.default',
                  fontSize: FONT_SIZE.xs,
                  height: 30,
                  '& .MuiOutlinedInput-notchedOutline': { borderRadius: 0, borderColor: 'divider' },
                }}
              >
                <MenuItem value="">
                  <Typography variant="caption" color="text.secondary">
                    Usar categoría general
                  </Typography>
                </MenuItem>
                {categoriasIngreso.map((cat) => (
                  <MenuItem key={cat.valor} value={cat.valor} sx={{ fontSize: FONT_SIZE.xs }}>
                    {cat.valor}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Box>
              <Typography sx={{ ...hubEyebrowSx, mb: 0.35 }}>Si es Egreso</Typography>
              <Select
                size="small"
                fullWidth
                displayEmpty
                value={form.categoriaEgreso}
                onChange={(e) => setForm((p) => ({ ...p, categoriaEgreso: e.target.value }))}
                MenuProps={flatMenuProps}
                sx={{
                  borderRadius: 0,
                  bgcolor: 'background.default',
                  fontSize: FONT_SIZE.xs,
                  height: 30,
                  '& .MuiOutlinedInput-notchedOutline': { borderRadius: 0, borderColor: 'divider' },
                }}
              >
                <MenuItem value="">
                  <Typography variant="caption" color="text.secondary">
                    Usar categoría general
                  </Typography>
                </MenuItem>
                {categoriasEgreso.map((cat) => (
                  <MenuItem key={cat.valor} value={cat.valor} sx={{ fontSize: FONT_SIZE.xs }}>
                    {cat.valor}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          </Box>
        </Collapse>
      </Box>

      {/* Aplicación retroactiva */}
      {isEditing && txCount > 0 && hasAnyCategory && (
        <Box
          sx={{
            px: 1,
            py: 0.75,
            border: '1px solid',
            borderColor: categoryChanged ? 'text.secondary' : 'divider',
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={applyRetroactive}
                onChange={(e) => setApplyRetroactive(e.target.checked)}
                sx={{ p: 0.35 }}
              />
            }
            label={
              <Typography sx={{ fontSize: FONT_SIZE.xs, color: 'text.primary' }}>
                Aplicar a los{' '}
                <Box component="span" sx={{ ...hubNumericSx, fontWeight: FONT_WEIGHT.semibold }}>
                  {txCount}
                </Box>{' '}
                {txCount === 1 ? 'movimiento existente' : 'movimientos existentes'}
              </Typography>
            }
            sx={{ m: 0 }}
          />
          {applyRetroactive && (
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={overwriteManuals}
                  onChange={(e) => setOverwriteManuals(e.target.checked)}
                  sx={{ p: 0.35 }}
                />
              }
              label={
                <Typography sx={{ fontSize: FONT_SIZE.xs, color: 'text.secondary' }}>
                  Incluir movimientos recategorizados manualmente
                </Typography>
              }
              sx={{ m: 0, pl: 2 }}
            />
          )}
        </Box>
      )}

      {/* Aliases MP y notas (colapsable) */}
      <Box>
        <ButtonBase
          type="button"
          onClick={() => setShowMetaSection((v) => !v)}
          sx={{
            ...collapseInlineToggleSx,
            py: 0.25,
            borderRadius: 0,
          }}
        >
          <ExpandMoreRounded
            sx={{
              fontSize: 15,
              transform: showMetaSection ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 160ms ease',
            }}
          />
          <Typography component="span" sx={hubEyebrowSx}>
            Aliases MP y datos
          </Typography>
          {(form.aliases.length > 0 || form.mpIds.length > 0 || form.cuentasBancarias.length > 0) && (
            <Typography
              component="span"
              sx={{ ...hubNumericSx, fontSize: FONT_SIZE['2xs'], color: 'text.disabled' }}
            >
              ({form.aliases.length + form.mpIds.length + form.cuentasBancarias.length})
            </Typography>
          )}
        </ButtonBase>

        <Collapse in={showMetaSection} {...collapsePanelProps}>
          <Box sx={{ mt: 0.85, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ ...flatFieldBoxSx, flex: 1 }}>
                  <InputBase
                    fullWidth
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAlias();
                      }
                    }}
                    placeholder="Agregar alias o nombre que emite MP..."
                    sx={{ fontSize: FONT_SIZE.xs, color: 'text.primary' }}
                  />
                </Box>
                <IconButton
                  type="button"
                  size="small"
                  onClick={handleAddAlias}
                  aria-label="Agregar alias"
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: 0,
                    border: '1px solid',
                    borderColor: 'divider',
                    color: 'text.primary',
                  }}
                >
                  <AddOutlined sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>

              {(form.aliases.length > 0 || form.mpIds.length > 0 || form.cuentasBancarias.length > 0) && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                  {form.aliases.map((alias) => (
                    <Box
                      key={alias}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.4,
                        px: 0.75,
                        py: 0.2,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                        fontSize: FONT_SIZE.xs,
                        color: 'text.secondary',
                      }}
                    >
                      <span>{alias}</span>
                      <IconButton
                        type="button"
                        size="small"
                        onClick={() => handleRemoveAlias(alias)}
                        sx={{ p: 0.1, color: 'text.disabled', '&:hover': { color: 'text.primary' } }}
                      >
                        <CloseOutlined sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Box>
                  ))}
                  {form.mpIds.map((mpId) => (
                    <Box
                      key={`mp-${mpId}`}
                      sx={{
                        px: 0.75,
                        py: 0.2,
                        border: '1px solid',
                        borderColor: 'divider',
                        fontSize: FONT_SIZE.xs,
                        color: 'text.disabled',
                        ...hubNumericSx,
                      }}
                    >
                      MP #{mpId}
                    </Box>
                  ))}
                  {form.cuentasBancarias.map((cbu) => (
                    <Box
                      key={`bank-${cbu}`}
                      sx={{
                        px: 0.75,
                        py: 0.2,
                        border: '1px solid',
                        borderColor: 'divider',
                        fontSize: FONT_SIZE.xs,
                        color: 'text.disabled',
                        ...hubNumericSx,
                      }}
                    >
                      CBU/CVU {cbu}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 0.75,
              }}
            >
              <Box sx={flatFieldBoxSx}>
                <InputBase
                  fullWidth
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="Email"
                  sx={{ fontSize: FONT_SIZE.xs, color: 'text.primary' }}
                />
              </Box>
              <Box sx={flatFieldBoxSx}>
                <InputBase
                  fullWidth
                  value={form.telefono}
                  onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                  placeholder="Teléfono"
                  sx={{ fontSize: FONT_SIZE.xs, color: 'text.primary' }}
                />
              </Box>
            </Box>

            <Box sx={flatFieldBoxSx}>
              <InputBase
                fullWidth
                multiline
                minRows={2}
                value={form.notas}
                onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                placeholder="Notas (ej. alquiler depto, préstamo, proveedor...)"
                sx={{ fontSize: FONT_SIZE.xs, color: 'text.primary' }}
              />
            </Box>
          </Box>
        </Collapse>
      </Box>

      {/* Pie de acciones */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
          pt: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isEditing && canMerge && onMerge && !confirmDelete && (
            <Button
              type="button"
              size="small"
              color="inherit"
              disabled={saving || deleting}
              onClick={(e) => {
                e.stopPropagation();
                onMerge(initialData);
              }}
              startIcon={<MergeTypeOutlined sx={{ fontSize: 15 }} />}
              sx={{
                borderRadius: 0,
                px: 0.75,
                py: 0.25,
                fontSize: FONT_SIZE.xs,
                color: 'text.secondary',
                '&:hover': { color: 'text.primary' },
              }}
            >
              Fusionar
            </Button>
          )}
          {isEditing && onDelete && (
            confirmDelete ? (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ fontSize: FONT_SIZE.xs, color: 'error.main' }}>
                  ¿Eliminar?
                </Typography>
                <Button
                  type="button"
                  size="small"
                  variant="contained"
                  color="error"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  sx={{
                    borderRadius: 0,
                    minWidth: 0,
                    px: 0.85,
                    py: 0.2,
                    fontSize: FONT_SIZE.xs,
                  }}
                >
                  {deleting ? '...' : 'Confirmar'}
                </Button>
                <Button
                  type="button"
                  size="small"
                  color="inherit"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                  sx={{
                    borderRadius: 0,
                    minWidth: 0,
                    px: 0.6,
                    py: 0.2,
                    fontSize: FONT_SIZE.xs,
                    color: 'text.secondary',
                  }}
                >
                  No
                </Button>
              </Box>
            ) : (
              <Button
                type="button"
                size="small"
                color="inherit"
                disabled={saving || deleting}
                onClick={() => setConfirmDelete(true)}
                sx={{
                  borderRadius: 0,
                  px: 0.75,
                  py: 0.25,
                  fontSize: FONT_SIZE.xs,
                  color: 'text.secondary',
                  '&:hover': { color: 'error.main' },
                }}
              >
                Eliminar
              </Button>
            )
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Button
            type="button"
            size="small"
            color="inherit"
            disabled={saving || deleting}
            onClick={(e) => {
              e.stopPropagation();
              onCancel?.();
            }}
            sx={{
              borderRadius: 0,
              px: 1,
              py: 0.35,
              fontSize: FONT_SIZE.xs,
              color: 'text.secondary',
            }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            size="small"
            variant="contained"
            disabled={saving || deleting}
            sx={{
              borderRadius: 0,
              px: 1.5,
              py: 0.35,
              fontSize: FONT_SIZE.xs,
              fontWeight: FONT_WEIGHT.semibold,
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            {saving ? 'Guardando...' : isEditing ? 'Guardar' : 'Crear'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

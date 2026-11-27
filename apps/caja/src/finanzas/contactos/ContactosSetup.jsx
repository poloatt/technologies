import React, {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Box,
  Button,
  Collapse,
  IconButton,
  InputBase,
  LinearProgress,
  Skeleton,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  AddOutlined,
  AutorenewOutlined,
  CloseOutlined,
  LabelOffOutlined,
  SearchOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import clienteAxios from '@shared/config/axios';
import { useAPI } from '@shared/hooks/useAPI';
import {
  HUB_SECTION,
  getHubSubsectionSx,
} from '@shared/styles/hubSectionStyles';
import { filterToggleRowSx } from '@shared/styles/filterToggleStyles';
import { collapsePanelProps } from '@shared/styles/collapseSectionStyles';
import {
  FONT_SIZE,
  captionSx,
  hubEyebrowSx,
} from '@shared/tipografia';
import FilterToggleButton from '../FilterToggleButton';
import { CATEGORIAS, getCategoriaMeta } from '../transacciones/categoriasConstants';
import ContactoGroupSection from './ContactoGroupSection';
import ContactoRow, { preloadContactoInlineEditor } from './ContactoRow';

const ContactoInlineEditor = React.lazy(() => import('./ContactoInlineEditor'));
const ContactoMergeDialog = React.lazy(() => import('./ContactoMergeDialog'));

function notifyContactosChanged({ transaccionesModificadas = false } = {}) {
  window.dispatchEvent(new Event('contactosRefreshed'));
  if (transaccionesModificadas) {
    window.dispatchEvent(new Event('transaccionesRefreshed'));
  }
}

function getEffectiveCategory(contacto) {
  return contacto.categoriaDefault || contacto.categoriaEgreso || contacto.categoriaIngreso || '';
}

function EditorSkeleton() {
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

/**
 * Gestión de Contactos (contrapartes de transferencias, pagos y cobros).
 * Solo existe dentro del popup de setup (sin página propia).
 */
export function ContactosSetup() {
  const { enqueueSnackbar } = useSnackbar();

  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'uncategorized' | 'categorized'
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [creatingNew, setCreatingNew] = useState(false);
  const [expandedContactoId, setExpandedContactoId] = useState(null);
  const [mergeTarget, setMergeTarget] = useState(null);
  const [isBackfilling, setIsBackfilling] = useState(false);

  const {
    data: contactosData,
    loading,
    refetch: refetchContactos,
  } = useAPI('/api/contactos', {
    enableCache: true,
    cacheDuration: 30000,
    params: { limit: 500, sort: 'nombre' },
  });

  const contactos = useMemo(() => contactosData?.docs || [], [contactosData]);

  const summary = useMemo(() => {
    if (contactosData?.summary) return contactosData.summary;
    const sinCat = contactos.filter((c) => !getEffectiveCategory(c)).length;
    return { totalCount: contactos.length, sinCategoriaCount: sinCat };
  }, [contactosData, contactos]);

  const categorizadosCount = Math.max(
    0,
    (summary.totalCount || 0) - (summary.sinCategoriaCount || 0)
  );

  const filteredContactos = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return contactos.filter((c) => {
      const hasCat = Boolean(getEffectiveCategory(c));
      if (filterMode === 'uncategorized' && hasCat) return false;
      if (filterMode === 'categorized' && !hasCat) return false;
      if (!q) return true;
      const inNombre = (c.nombre || '').toLowerCase().includes(q);
      const inEmail = (c.datosContacto?.email || '').toLowerCase().includes(q);
      const inAliases = (c.identificadores?.aliases || []).some((a) =>
        a.toLowerCase().includes(q)
      );
      const inMpIds = (c.identificadores?.mpIds || []).some((id) =>
        String(id).toLowerCase().includes(q)
      );
      const inCat = getEffectiveCategory(c).toLowerCase().includes(q);
      return inNombre || inEmail || inAliases || inMpIds || inCat;
    });
  }, [contactos, filterMode, deferredSearch]);

  const groupedSections = useMemo(() => {
    const uncategorized = [];
    const byCategory = new Map();

    for (const c of filteredContactos) {
      const cat = getEffectiveCategory(c);
      if (!cat) {
        uncategorized.push(c);
      } else {
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat).push(c);
      }
    }

    // Sin categoría: priorizar contrapartes más frecuentes primero
    uncategorized.sort((a, b) => {
      const diff = (b.transaccionesCount || 0) - (a.transaccionesCount || 0);
      if (diff !== 0) return diff;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });

    const sections = [];

    if ((filterMode === 'all' || filterMode === 'uncategorized') && uncategorized.length > 0) {
      sections.push({
        key: '__uncategorized__',
        title: 'Sin categoría',
        icon: WarningAmberOutlined,
        accentColor: 'warning.main',
        items: uncategorized,
      });
    }

    if (filterMode === 'all' || filterMode === 'categorized') {
      const seen = new Set();

      for (const cat of CATEGORIAS) {
        const list = byCategory.get(cat.valor);
        if (list && list.length > 0) {
          seen.add(cat.valor);
          list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
          sections.push({
            key: cat.valor,
            title: cat.valor,
            icon: cat.Icon,
            accentColor: cat.color,
            items: list,
          });
        }
      }

      // Categorías fuera del orden canónico (por si existiera alguna)
      for (const [catName, list] of byCategory.entries()) {
        if (seen.has(catName) || list.length === 0) continue;
        const meta = getCategoriaMeta(catName);
        list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
        sections.push({
          key: catName,
          title: catName,
          icon: meta?.Icon || LabelOffOutlined,
          accentColor: meta?.color || 'text.secondary',
          items: list,
        });
      }
    }

    return sections;
  }, [filteredContactos, filterMode]);

  const handleBackfillMp = useCallback(async () => {
    setIsBackfilling(true);
    try {
      const res = await clienteAxios.post('/api/contactos/backfill-mp');
      const { contactosCreados = 0, vinculadas = 0, categorizadas = 0 } = res.data || {};
      if (contactosCreados === 0 && vinculadas === 0) {
        enqueueSnackbar('Todos los movimientos de Mercado Pago ya tienen su contacto vinculado', {
          variant: 'info',
        });
      } else {
        const partes = [];
        if (contactosCreados > 0) partes.push(`${contactosCreados} nuevos`);
        if (vinculadas > 0) partes.push(`${vinculadas} movimientos vinculados`);
        if (categorizadas > 0) partes.push(`${categorizadas} categorizados`);
        enqueueSnackbar(`Detectados desde MP: ${partes.join(' · ')}`, { variant: 'success' });
      }
      await refetchContactos();
      notifyContactosChanged({ transaccionesModificadas: vinculadas > 0 || categorizadas > 0 });
    } catch (err) {
      enqueueSnackbar(
        err?.response?.data?.message || 'Error al detectar contactos desde Mercado Pago',
        { variant: 'error' }
      );
    } finally {
      setIsBackfilling(false);
    }
  }, [enqueueSnackbar, refetchContactos]);

  useEffect(() => {
    const handleHeaderAdd = (e) => {
      if (e.detail?.type === 'contactos' || e.detail?.type === 'contacto') {
        preloadContactoInlineEditor();
        setExpandedContactoId(null);
        setCreatingNew((prev) => !prev);
      }
    };
    const handleBackfillEvent = () => {
      if (!isBackfilling) {
        handleBackfillMp();
      }
    };
    const handleRefresh = () => {
      refetchContactos();
    };
    window.addEventListener('headerAddButtonClicked', handleHeaderAdd);
    window.addEventListener('contactosBackfillRequested', handleBackfillEvent);
    window.addEventListener('contactosRefreshed', handleRefresh);
    window.addEventListener('transaccionesRefreshed', handleRefresh);
    return () => {
      window.removeEventListener('headerAddButtonClicked', handleHeaderAdd);
      window.removeEventListener('contactosBackfillRequested', handleBackfillEvent);
      window.removeEventListener('contactosRefreshed', handleRefresh);
      window.removeEventListener('transaccionesRefreshed', handleRefresh);
    };
  }, [refetchContactos, handleBackfillMp, isBackfilling]);

  const handleCreateContacto = useCallback(
    async (payload) => {
      await clienteAxios.post('/api/contactos', payload);
      enqueueSnackbar('Contacto creado', { variant: 'success' });
      setCreatingNew(false);
      await refetchContactos();
      notifyContactosChanged();
    },
    [enqueueSnackbar, refetchContactos]
  );

  const handleUpdateContacto = useCallback(
    async (contacto, payload) => {
      const id = contacto.id || contacto._id;
      const res = await clienteAxios.put(`/api/contactos/${id}`, payload);
      const updatedTx = res.data?.transaccionesActualizadas || 0;
      enqueueSnackbar(
        updatedTx > 0
          ? `Contacto guardado · ${updatedTx} ${updatedTx === 1 ? 'movimiento recategorizado' : 'movimientos recategorizados'}`
          : 'Contacto actualizado',
        { variant: 'success' }
      );
      await refetchContactos();
      notifyContactosChanged({ transaccionesModificadas: updatedTx > 0 });
    },
    [enqueueSnackbar, refetchContactos]
  );

  const handleQuickCategorySave = useCallback(
    async (contacto, categoriaDefault, aplicarRetroactivo) => {
      const id = contacto.id || contacto._id;
      try {
        const res = await clienteAxios.put(`/api/contactos/${id}`, {
          categoriaDefault,
          aplicarRetroactivo,
        });
        const updatedTx = res.data?.transaccionesActualizadas || 0;
        enqueueSnackbar(
          updatedTx > 0
            ? `Categoría guardada · ${updatedTx} ${updatedTx === 1 ? 'movimiento actualizado' : 'movimientos actualizados'}`
            : 'Categoría guardada para futuros movimientos',
          { variant: 'success' }
        );
        await refetchContactos();
        notifyContactosChanged({ transaccionesModificadas: updatedTx > 0 });
      } catch (err) {
        enqueueSnackbar(
          err?.response?.data?.message || 'Error al guardar la categoría',
          { variant: 'error' }
        );
      }
    },
    [enqueueSnackbar, refetchContactos]
  );

  const handleConfirmMerge = useCallback(
    async (targetId, sourceIds, aplicarRetroactivo) => {
      const res = await clienteAxios.post(`/api/contactos/${targetId}/merge`, {
        sourceIds,
        aplicarRetroactivo,
      });
      const { fusionados = 0, transaccionesReasignadas = 0, transaccionesActualizadas = 0 } =
        res.data || {};
      enqueueSnackbar(
        `Fusionados ${fusionados} ${fusionados === 1 ? 'contacto' : 'contactos'} (${transaccionesReasignadas} mov. reasignados)`,
        { variant: 'success' }
      );
      setExpandedContactoId(null);
      await refetchContactos();
      notifyContactosChanged({
        transaccionesModificadas: transaccionesReasignadas > 0 || transaccionesActualizadas > 0,
      });
    },
    [enqueueSnackbar, refetchContactos]
  );

  const handleDeleteContacto = useCallback(
    async (contacto) => {
      const id = contacto.id || contacto._id;
      try {
        await clienteAxios.delete(`/api/contactos/${id}`);
        enqueueSnackbar('Contacto eliminado', { variant: 'success' });
        setExpandedContactoId((prev) => (prev === id ? null : prev));
        await refetchContactos();
        notifyContactosChanged({
          transaccionesModificadas: (contacto.transaccionesCount || 0) > 0,
        });
      } catch (err) {
        enqueueSnackbar(err?.response?.data?.message || 'Error al eliminar contacto', {
          variant: 'error',
        });
        throw err;
      }
    },
    [enqueueSnackbar, refetchContactos]
  );

  const handleToggleExpand = useCallback((id) => {
    setCreatingNew(false);
    setExpandedContactoId((prev) => (prev === id ? null : id));
  }, []);

  const handleOpenMerge = useCallback((contacto) => {
    setMergeTarget(contacto);
  }, []);

  const handleCloseMerge = useCallback(() => {
    setMergeTarget(null);
  }, []);

  const handleCancelCreate = useCallback(() => {
    setCreatingNew(false);
  }, []);

  const canMerge = contactos.length > 1;

  return (
    <Box sx={{ px: HUB_SECTION.bodyPx, py: HUB_SECTION.bodyPy }}>
      {/* Barra superior de métricas-filtro (estilo Finanzas Hub) */}
      <Box
        sx={{
          ...filterToggleRowSx,
          pb: 1.25,
          mb: 1.25,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <FilterToggleButton
          label="Todos"
          amount={String(summary.totalCount)}
          amountColor="text.primary"
          selected={filterMode === 'all'}
          onClick={() => setFilterMode('all')}
        />
        <FilterToggleButton
          label="Sin categoría"
          amount={String(summary.sinCategoriaCount)}
          amountColor={summary.sinCategoriaCount > 0 ? 'warning.main' : 'text.secondary'}
          selected={filterMode === 'uncategorized'}
          onClick={() => setFilterMode('uncategorized')}
        />
        <FilterToggleButton
          label="Categorizados"
          amount={String(categorizadosCount)}
          amountColor="text.primary"
          selected={filterMode === 'categorized'}
          onClick={() => setFilterMode('categorized')}
        />
      </Box>

      {/* Indicador discreto de sincronización cuando se dispara backfill desde el header */}
      {isBackfilling && (
        <Box sx={{ mb: 1.25 }}>
          <LinearProgress sx={{ height: 2, borderRadius: 0 }} />
          <Typography
            sx={{
              ...hubEyebrowSx,
              fontSize: FONT_SIZE['2xs'],
              mt: 0.4,
              color: 'primary.main',
            }}
          >
            Detectando contactos desde Mercado Pago...
          </Typography>
        </Box>
      )}

      {/* Buscador plano sin chrome */}
      <Box
        sx={{
          ...getHubSubsectionSx({ mb: 1.25 }),
          display: 'flex',
          alignItems: 'center',
          height: 32,
          px: 1,
          gap: 0.75,
        }}
      >
        <SearchOutlined sx={{ fontSize: 15, color: 'text.secondary', flexShrink: 0 }} />
        <InputBase
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, alias, categoría o email..."
          inputProps={{ 'aria-label': 'Buscar contactos' }}
          sx={{
            fontSize: FONT_SIZE.sm,
            color: 'text.primary',
            '& input::placeholder': {
              color: 'text.secondary',
              opacity: 0.75,
            },
          }}
        />
        {search && (
          <IconButton
            size="small"
            onClick={() => setSearch('')}
            aria-label="Limpiar búsqueda"
            sx={{ p: 0.25, borderRadius: 0, color: 'text.secondary' }}
          >
            <CloseOutlined sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Box>

      {/* Alta inline lazy-loaded cuando el usuario pulsa "+" en el header */}
      <Collapse in={creatingNew} {...collapsePanelProps}>
        <Box sx={{ ...getHubSubsectionSx({ mb: 1.25 }), overflow: 'hidden' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1.5,
              py: 0.625,
              bgcolor: (theme) =>
                alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.03 : 0.025),
            }}
          >
            <Typography sx={{ ...hubEyebrowSx, color: 'text.primary' }}>
              Nuevo contacto
            </Typography>
            <IconButton
              size="small"
              onClick={handleCancelCreate}
              aria-label="Cerrar creación"
              sx={{ p: 0.25, borderRadius: 0, color: 'text.secondary' }}
            >
              <CloseOutlined sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
          <Suspense fallback={<EditorSkeleton />}>
            <ContactoInlineEditor
              autoFocus
              onSave={handleCreateContacto}
              onCancel={handleCancelCreate}
            />
          </Suspense>
        </Box>
      </Collapse>

      {/* Contenido principal: Skeleton / Empty / Grupos */}
      {loading && contactos.length === 0 ? (
        <Box sx={{ ...getHubSubsectionSx(), overflow: 'hidden' }}>
          {[0, 1, 2, 3].map((idx) => (
            <Box
              key={idx}
              sx={{
                borderBottom: idx < 3 ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              <Skeleton
                variant="rectangular"
                height={44}
                sx={{ borderRadius: 0, bgcolor: 'action.hover' }}
              />
            </Box>
          ))}
        </Box>
      ) : groupedSections.length === 0 ? (
        <Box
          sx={{
            ...getHubSubsectionSx(),
            py: 3.5,
            px: 2,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ ...hubEyebrowSx, color: 'text.primary', mb: 0.75 }}>
            {contactos.length === 0
              ? 'Sin contactos registrados'
              : filterMode === 'uncategorized'
                ? 'Todo categorizado'
                : 'Sin coincidencias'}
          </Typography>
          <Typography
            sx={{
              ...captionSx,
              display: 'block',
              color: 'text.secondary',
              mb: contactos.length === 0 ? 1.75 : 0,
            }}
          >
            {contactos.length === 0
              ? 'Detectalos desde tus movimientos de Mercado Pago o creá uno manualmente.'
              : filterMode === 'uncategorized'
                ? 'Todos tus contactos ya tienen categoría automática asignada.'
                : 'Probá limpiando el filtro o la búsqueda.'}
          </Typography>
          {contactos.length === 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="contained"
                disabled={isBackfilling}
                onClick={handleBackfillMp}
                startIcon={<AutorenewOutlined sx={{ fontSize: 15 }} />}
                sx={{
                  borderRadius: 0,
                  fontSize: FONT_SIZE.xs,
                  boxShadow: 'none',
                  '&:hover': { boxShadow: 'none' },
                }}
              >
                Detectar desde Mercado Pago
              </Button>
              <Button
                size="small"
                variant="outlined"
                onMouseEnter={preloadContactoInlineEditor}
                onClick={() => {
                  preloadContactoInlineEditor();
                  setCreatingNew(true);
                }}
                startIcon={<AddOutlined sx={{ fontSize: 15 }} />}
                sx={{
                  borderRadius: 0,
                  fontSize: FONT_SIZE.xs,
                  borderColor: 'divider',
                  color: 'text.primary',
                  '&:hover': { borderColor: 'text.secondary' },
                }}
              >
                Crear contacto
              </Button>
            </Box>
          )}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {groupedSections.map((section) => (
            <ContactoGroupSection
              key={section.key}
              title={section.title}
              count={section.items.length}
              icon={section.icon}
              accentColor={section.accentColor}
              defaultExpanded
            >
              {section.items.map((contacto) => {
                const cid = contacto.id || contacto._id;
                return (
                  <ContactoRow
                    key={cid}
                    contacto={contacto}
                    expanded={expandedContactoId === cid}
                    onToggleExpand={handleToggleExpand}
                    onQuickCategorySave={handleQuickCategorySave}
                    onSaveEdit={handleUpdateContacto}
                    onMerge={handleOpenMerge}
                    onDelete={handleDeleteContacto}
                    canMerge={canMerge}
                    showCategoryBadge
                  />
                );
              })}
            </ContactoGroupSection>
          ))}
        </Box>
      )}

      {/* Diálogo de fusión lazy-loaded solo al activarse */}
      {Boolean(mergeTarget) && (
        <Suspense fallback={null}>
          <ContactoMergeDialog
            open
            onClose={handleCloseMerge}
            targetContacto={mergeTarget}
            contactos={contactos}
            onConfirmMerge={handleConfirmMerge}
          />
        </Suspense>
      )}
    </Box>
  );
}

export default ContactosSetup;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Alert } from '@mui/material';
import { snackbar } from '@shared/components/common';
import { useLocation } from 'react-router-dom';
import clienteAxios from '@shared/config/axios';
import {
  PropiedadForm,
  PropiedadDetail,
  PropiedadesSectionNav,
} from '../propiedades';
import { InquilinoForm } from '../propiedades/inquilinos';
import ContratoForm from '../propiedades/contratos/ContratoForm';
import { useContratoFormLauncher } from '../propiedades/contratos/useContratoFormLauncher';
import { usePageWithHistory } from '@shared/hooks/useGlobalActionHistory';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';

export function Propiedades() {
  const [propiedades, setPropiedades] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState(null);
  const [editingPropiedad, setEditingPropiedad] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPropiedad, setDetailPropiedad] = useState(null);
  const [focusHabitacionId, setFocusHabitacionId] = useState(null);
  const [deepLinkConsumed, setDeepLinkConsumed] = useState(false);
  const [openInquilinoForm, setOpenInquilinoForm] = useState(false);

  const contratoLauncher = useContratoFormLauncher({
    onSubmitted: () => fetchPropiedadesRef.current?.(),
  });
  const { openBlank: openBlankContratoForm } = contratoLauncher;

  const location = useLocation();
  const fetchPropiedadesRef = useRef();
  const debounceTimerRef = useRef(null);

  const initialSelectedId =
    !deepLinkConsumed && location.state?.selectedId
      ? String(location.state.selectedId)
      : null;
  const initialSelectedHabitacionId =
    !deepLinkConsumed && location.state?.selectedHabitacionId
      ? String(location.state.selectedHabitacionId)
      : null;

  const { createWithHistory, updateWithHistory, deleteWithHistory } = usePageWithHistory(
    async () => {
      await fetchPropiedades();
    },
    (err) => {
      snackbar.error('Error al revertir la acción');
      console.error('Error al revertir acción:', err);
    },
  );

  const fetchPropiedades = useCallback(async () => {
    try {
      const response = await clienteAxios.get('/api/propiedades?withRelated=true');
      const propiedadesData = response.data.docs || [];
      const propiedadesEnriquecidas = propiedadesData.map((propiedad) => ({
        ...propiedad,
        inquilinos: propiedad.inquilinos || [],
        habitaciones: propiedad.habitaciones || [],
        contratos: propiedad.contratos || [],
        inventario: propiedad.inventario || [],
      }));
      setPropiedades(propiedadesEnriquecidas);
      setError(null);
    } catch (err) {
      console.error('Error al cargar propiedades:', err);
      setError(err.message || 'Error al cargar propiedades');
      snackbar.error('Error al cargar propiedades');
    }
  }, []);

  const debouncedFetchPropiedades = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchPropiedades();
    }, 150);
  }, [fetchPropiedades]);

  fetchPropiedadesRef.current = debouncedFetchPropiedades;

  useEffect(() => {
    fetchPropiedades();
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchPropiedades]);

  useEffect(() => {
    if (location.state?.openAdd) {
      setEditingPropiedad(null);
      setIsFormOpen(true);
      window.history.replaceState({}, document.title);
    } else if (location.state?.selectedId || location.state?.selectedHabitacionId) {
      setDeepLinkConsumed(false);
    }
  }, [location.state]);

  useEffect(() => {
    const openLocal = () => {
      setEditingPropiedad(null);
      setIsFormOpen(true);
    };
    window.addEventListener('openAddFormLocal', openLocal);
    return () => window.removeEventListener('openAddFormLocal', openLocal);
  }, []);

  useEffect(() => {
    const handleHeaderAddButton = (event) => {
      const onHub = window.location.pathname === '/propiedades';
      const type = event.detail?.type;
      const isSamePath = event.detail?.path && event.detail.path === window.location.pathname;

      if (!onHub && !isSamePath && type !== 'propiedad' && type !== 'propiedades') {
        return;
      }

      if (type === 'inquilinos' || type === 'inquilino') {
        if (onHub || isSamePath) setOpenInquilinoForm(true);
        return;
      }
      if (type === 'contratos' || type === 'contrato') {
        if (onHub) openBlankContratoForm();
        return;
      }
      if (type === 'propiedad' || type === 'propiedades' || isSamePath) {
        setEditingPropiedad(null);
        setIsFormOpen(true);
      }
    };
    window.addEventListener('headerAddButtonClicked', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAddButton);
  }, [openBlankContratoForm]);

  useEffect(() => {
    const handleEntityUpdate = (event) => {
      if (event.detail.type === 'propiedad' || event.detail.type === 'propiedades') {
        fetchPropiedadesRef.current?.();
      }
    };
    window.addEventListener('entityUpdated', handleEntityUpdate);
    return () => window.removeEventListener('entityUpdated', handleEntityUpdate);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailPropiedad(null);
    setFocusHabitacionId(null);
    setDeepLinkConsumed(true);
    window.history.replaceState({}, document.title);
  }, []);

  useEffect(() => {
    if (!initialSelectedId || !propiedades.length) return;
    const found = propiedades.find((p) => String(p._id || p.id) === initialSelectedId);
    if (!found) return;
    setDetailPropiedad(found);
    setFocusHabitacionId(initialSelectedHabitacionId);
    setDetailOpen(true);
  }, [initialSelectedId, initialSelectedHabitacionId, propiedades]);

  const handleEdit = useCallback((propiedad) => {
    setEditingPropiedad({
      ...propiedad,
      _id: propiedad._id || propiedad.id,
      alias: propiedad.alias || propiedad.titulo || '',
      cuenta: propiedad.cuenta?._id || propiedad.cuenta?.id || propiedad.cuenta,
    });
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (id) => {
      try {
        await deleteWithHistory(id);
        snackbar.success('Propiedad eliminada exitosamente');
        if (String(detailPropiedad?._id || detailPropiedad?.id) === String(id)) {
          closeDetail();
        }
        await fetchPropiedades();
      } catch (err) {
        console.error('Error al eliminar propiedad:', err);
        snackbar.error('Error al eliminar la propiedad');
      }
    },
    [deleteWithHistory, fetchPropiedades, detailPropiedad, closeDetail],
  );

  if (error) {
    return (
      <Box sx={{ px: 0, py: 1 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 0, width: '100%' }}>
      <Box sx={{ ...cajaPageLayoutSx, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <PropiedadesSectionNav variant="hub" />

        {detailPropiedad && (
          <PropiedadDetail
            propiedad={detailPropiedad}
            open={detailOpen}
            onClose={closeDetail}
            onEdit={handleEdit}
            onDelete={handleDelete}
            propiedades={propiedades}
            initialExpandedSection={focusHabitacionId ? 'habitaciones' : undefined}
            initialHabitacionId={focusHabitacionId}
          />
        )}

        <PropiedadForm
          open={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingPropiedad(null);
          }}
          onSubmit={() => {
            setIsFormOpen(false);
            setEditingPropiedad(null);
          }}
          initialData={editingPropiedad}
          isEditing={!!editingPropiedad}
          createWithHistory={createWithHistory}
          updateWithHistory={updateWithHistory}
        />

        <InquilinoForm
          open={openInquilinoForm}
          onClose={() => setOpenInquilinoForm(false)}
          onSubmit={async (formData) => {
            await clienteAxios.post('/api/inquilinos', formData);
            snackbar.success('Inquilino creado correctamente');
            setOpenInquilinoForm(false);
            await fetchPropiedades();
          }}
          propiedades={propiedades}
        />

        {contratoLauncher.open && (
          <ContratoForm
            open={contratoLauncher.open}
            initialData={contratoLauncher.initialData}
            relatedData={contratoLauncher.relatedData}
            onClose={contratoLauncher.close}
            onSubmit={contratoLauncher.handleSubmitted}
          />
        )}
      </Box>
    </Box>
  );
}

export default Propiedades;

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box } from '@mui/material';
import { useResponsive } from '@shared/hooks';
import clienteAxios from '@shared/config/axios';
import { snackbar } from '@shared/components/common';
import PropiedadDialogShell from './PropiedadDialogShell';
import PropiedadPanelHeader from './PropiedadPanelHeader';
import PropiedadCoreFields from './PropiedadCoreFields';
import PropiedadDetailExtendedSections from './PropiedadDetailExtendedSections';
import PropiedadDetailFooter from './PropiedadDetailFooter';
import { getDocumentId } from './propiedadFormUtils';

const PropiedadDetail = ({
  propiedad,
  open,
  onClose,
  onEdit,
  onDelete,
  propiedades = [],
  initialHabitacionId = null,
}) => {
  const { isMobile } = useResponsive();
  const propiedadId = getDocumentId(propiedad);

  const [propiedadCompleta, setPropiedadCompleta] = useState(propiedad);

  const fetchPropiedadCompleta = useCallback(async () => {
    if (!propiedadId) return;

    try {
      const response = await clienteAxios.get(`/api/propiedades/${propiedadId}`, {
        params: {
          populate: 'inquilinos,contratos,habitaciones,inventarios,cuenta,moneda,documentos',
          _t: Date.now(),
        },
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
      setPropiedadCompleta(response.data);
    } catch (error) {
      console.error('Error al obtener propiedad completa:', error);
      snackbar.error('Error al cargar detalles de la propiedad');
    }
  }, [propiedadId]);

  useEffect(() => {
    if (open && propiedadId) {
      setPropiedadCompleta(propiedad);
      fetchPropiedadCompleta();
    }
  }, [open, propiedadId, propiedad, fetchPropiedadCompleta]);

  const panelData = useMemo(
    () => ({
      ...propiedadCompleta,
      alias: propiedadCompleta?.alias || propiedadCompleta?.titulo || '',
    }),
    [propiedadCompleta],
  );

  const handleEditPropiedad = () => {
    onClose?.();
    window.setTimeout(() => {
      onEdit?.(propiedadCompleta);
    }, 200);
  };

  const handleDeletePropiedad = () => {
    if (window.confirm('¿Seguro que deseas eliminar esta propiedad?')) {
      onDelete?.(propiedadCompleta);
      onClose?.();
    }
  };

  return (
    <PropiedadDialogShell
      open={open}
      onClose={onClose}
      isMobile={isMobile}
      footer={
        <PropiedadDetailFooter
          onEdit={handleEditPropiedad}
          onDelete={handleDeletePropiedad}
          onClose={onClose}
        />
      }
    >
      <PropiedadPanelHeader mode="view" data={panelData} onClose={onClose} />

      <Box sx={{ px: 2, pb: 2 }}>
        <PropiedadCoreFields mode="view" data={panelData} />

        <PropiedadDetailExtendedSections
          propiedad={propiedadCompleta}
          propiedades={propiedades}
          onChanged={fetchPropiedadCompleta}
          initialHabitacionId={initialHabitacionId}
        />
      </Box>
    </PropiedadDialogShell>
  );
};

export default PropiedadDetail;

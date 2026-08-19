import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { snackbar } from '@shared/components/common';
import { useRelationalData } from '@shared/hooks/useRelationalData';
import { useAuth } from '@shared/context/AuthContext';
import { useResponsive } from '@shared/hooks';
import clienteAxios from '@shared/config/axios';
import { TareaFormFooter } from '@shared/components/forms/tareaFormUi';
import PropiedadDialogShell from './PropiedadDialogShell';
import PropiedadPanelHeader from './PropiedadPanelHeader';
import PropiedadCoreFields from './PropiedadCoreFields';
import { getDocumentId, buildPropiedadFormState, resolveCuentaId } from './propiedadFormUtils';

const PropiedadForm = ({
  open,
  onClose,
  onSubmit,
  initialData = null,
  isEditing = false,
  createWithHistory,
  updateWithHistory,
}) => {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const propiedadId = getDocumentId(initialData);

  const [formData, setFormData] = useState(() => buildPropiedadFormState(initialData));
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const relatedFields = useMemo(() => {
    const userFilter = user?.id || user?._id;
    const cuentaEndpoint = userFilter
      ? `/cuentas?limit=100&filter=${encodeURIComponent(JSON.stringify({ usuario: userFilter }))}`
      : '/cuentas?limit=100';

    return [
      {
        type: 'relational',
        name: 'cuenta',
        endpoint: cuentaEndpoint,
        labelField: 'nombre',
        populate: ['moneda'],
      },
    ];
  }, [user?.id, user?._id]);

  const { relatedData, isLoading: isLoadingRelated } = useRelationalData({
    open,
    relatedFields,
  });

  const cuentaOptions = useMemo(
    () =>
      (relatedData?.cuenta || []).map((cuenta) => ({
        value: getDocumentId(cuenta),
        label: `${cuenta?.nombre || 'Sin nombre'} · ${cuenta?.tipo || ''}`.trim(),
      })),
    [relatedData?.cuenta],
  );

  useEffect(() => {
    if (!open) return;
    setFormData(buildPropiedadFormState(initialData));
    setErrors({});
  }, [open, propiedadId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !cuentaOptions.length) return;

    const cuentaId = resolveCuentaId(initialData, user);
    if (!cuentaId) return;

    const exists = cuentaOptions.some((option) => option.value === cuentaId);
    if (exists) {
      setFormData((prev) => (prev.cuenta === cuentaId ? prev : { ...prev, cuenta: cuentaId }));
    }
  }, [open, cuentaOptions, initialData, user, propiedadId]);

  const handleChange = useCallback((name, value) => {
    let finalValue = value;

    if (name === 'metrosCuadrados') {
      if (value === '') {
        finalValue = '';
      } else {
        finalValue = value.replace(/[^0-9.]/g, '');
        const parts = finalValue.split('.');
        if (parts.length > 2) {
          finalValue = `${parts[0]}.${parts.slice(1).join('')}`;
        }
      }
    }

    setFormData((prev) => ({ ...prev, [name]: finalValue }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: null } : prev));
  }, []);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.alias?.trim()) newErrors.alias = 'El alias es requerido';
    if (!formData.descripcion?.trim()) newErrors.descripcion = 'La descripción es requerida';
    if (!formData.direccion?.trim()) newErrors.direccion = 'La dirección es requerida';
    if (!formData.ciudad?.trim()) newErrors.ciudad = 'La ciudad es requerida';

    if (formData.metrosCuadrados && formData.metrosCuadrados.trim() !== '') {
      const value = parseFloat(formData.metrosCuadrados);
      if (Number.isNaN(value) || value < 0) {
        newErrors.metrosCuadrados = 'Los metros cuadrados deben ser un número válido (≥ 0)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const dataToSubmit = {
      alias: formData.alias.trim(),
      descripcion: formData.descripcion.trim(),
      direccion: formData.direccion.trim(),
      ciudad: formData.ciudad.trim(),
      tipo: formData.tipo,
      metrosCuadrados: formData.metrosCuadrados ? Number(formData.metrosCuadrados) : 0,
      cuenta: formData.cuenta || null,
      usuario: getDocumentId(user),
    };

    if (propiedadId) {
      dataToSubmit._id = propiedadId;
    }

    try {
      setIsSaving(true);
      let response;

      if (propiedadId) {
        if (updateWithHistory) {
          response = await updateWithHistory(propiedadId, dataToSubmit, initialData);
        } else {
          response = await clienteAxios.put(`/api/propiedades/${propiedadId}`, dataToSubmit);
        }
      } else if (createWithHistory) {
        response = await createWithHistory(dataToSubmit);
      } else {
        response = await clienteAxios.post('/api/propiedades', dataToSubmit);
      }

      snackbar.success(isEditing ? 'Propiedad actualizada exitosamente' : 'Propiedad creada exitosamente');

      window.dispatchEvent(
        new CustomEvent('entityUpdated', {
          detail: { type: 'propiedades', action: isEditing ? 'edit' : 'create' },
        }),
      );

      onClose();
      if (typeof onSubmit === 'function') {
        onSubmit(response?.data ?? response);
      }
    } catch (error) {
      console.error('Error al guardar la propiedad:', error);
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Error al guardar la propiedad';

      setErrors((prev) => ({ ...prev, submit: errorMessage }));
      snackbar.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PropiedadDialogShell
      open={open}
      onClose={onClose}
      isMobile={isMobile}
      disableBackdropClose={isSaving}
    >
      <PropiedadPanelHeader
        mode="edit"
        data={formData}
        errors={errors}
        onTipoChange={(value) => handleChange('tipo', value)}
        onAliasChange={(event) => handleChange('alias', event.target.value)}
        onClose={onClose}
        disableClose={isSaving}
      />

      <Box sx={{ px: 2 }}>
        <PropiedadCoreFields
          mode="edit"
          data={formData}
          errors={errors}
          onChange={handleChange}
          cuentaOptions={cuentaOptions}
          isLoadingCuentas={isLoadingRelated}
        />

        {errors.submit ? (
          <Typography variant="caption" color="error" sx={{ display: 'block', pb: 1 }}>
            {errors.submit}
          </Typography>
        ) : null}
      </Box>

      <TareaFormFooter
        onSave={handleSubmit}
        saveLabel={isSaving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Guardar'}
        saving={isSaving}
        disabled={isSaving}
      />
    </PropiedadDialogShell>
  );
};

export default PropiedadForm;

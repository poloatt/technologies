import React, { useState, Suspense } from 'react';
import {
  TextField,
  Box,
  Stack,
  IconButton,
  Chip,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Close as CloseIcon, AttachMoney as MoneyIcon, Home as HomeIcon } from '@mui/icons-material';
import { useResponsive } from '@shared/hooks';
import { useRelationalData } from '@shared/hooks';
import { getEstadoColor } from '@shared/components/common/StatusSystem';
import {
  TareaFormHeader,
  TareaFormFooter,
  TareaFormRow,
  TareaFormPillSelect,
  TareaFormSectionLabel,
  tareaFormTitleFieldSx,
  tareaFormChipSx,
  tareaFormStandardFieldSx,
  tareaFormFieldInputSx,
  tareaFormRowContentIndent,
  tareaFormActionIconSx,
  tareaFormErrorTextSx,
  tareaFormPillRowSx,
  tareaFormRowContentGutterSx,
  TAREA_FORM_OBJETIVO_ESTADO_OPTIONS,
  TareaFormHeaderTitleRow,
} from '@shared/components/forms/tareaFormUi';
import TareaFormDescriptionField from '@shared/components/forms/TareaFormDescriptionField';
import { TareaFormIcons } from '@shared/components/forms/tareaFormIcons';
import TareaActions from '../tasks/components/TareaActions';
import {
  TareaFormSettingsRow,
  TareaFormDeadlinePill,
  TareaFormDialogShell,
  TareaFormAttachmentsSection,
  useTareaFormAttachments,
} from '@shared/components/forms/tareaFormUi';

const TareaForm = React.lazy(() => import('../tasks/form/TareaForm'));

const ObjetivoForm = ({ open, onClose, onSubmit, initialData = null, isEditing, createWithHistory, updateWithHistory }) => {
  const { isMobile } = useResponsive();

  const [formData, setFormData] = useState({
    nombre: initialData?.nombre || '',
    descripcion: initialData?.descripcion || '',
    estado: initialData?.estado || 'PENDIENTE',
    fechaInicio: initialData?.fechaInicio ? new Date(initialData.fechaInicio) : new Date(),
    fechaFin: initialData?.fechaFin ? new Date(initialData.fechaFin) : null,
    prioridad: initialData?.prioridad || 'MEDIA',
    presupuesto: initialData?.presupuesto || 0,
    moneda: initialData?.moneda || null,
    archivos: initialData?.archivos || [],
    propiedad: initialData?.propiedad || null,
    tareas: initialData?.tareas || [],
  });

  const [errors, setErrors] = useState({});
  const [isTareaFormOpen, setIsTareaFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { handleFileChange, removeFile } = useTareaFormAttachments(setFormData);

  const relatedFields = [
    {
      type: 'relational',
      name: 'moneda',
      endpoint: '/monedas',
      labelField: 'nombre',
      populate: [],
    },
    {
      type: 'relational',
      name: 'propiedad',
      endpoint: '/propiedades',
      labelField: 'titulo',
      populate: [],
    },
  ];

  const { relatedData } = useRelationalData({
    open,
    relatedFields,
  });

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    const finalValue = field === 'presupuesto'
      ? (value === '' ? 0 : Number(String(value).replace(/[^0-9]/g, '')))
      : value;

    setFormData((prev) => ({
      ...prev,
      [field]: finalValue,
    }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleDateChange = (field) => (date) => {
    setFormData((prev) => ({
      ...prev,
      [field]: date,
    }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleTareaSubmit = (tareaData) => {
    setFormData((prev) => ({
      ...prev,
      tareas: [...prev.tareas, tareaData],
    }));
    setIsTareaFormOpen(false);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.nombre) newErrors.nombre = 'El nombre es requerido';
    if (!formData.estado) newErrors.estado = 'El estado es requerido';
    if (!formData.fechaInicio) newErrors.fechaInicio = 'La fecha de inicio es requerida';
    if (formData.fechaFin && formData.fechaInicio > formData.fechaFin) {
      newErrors.fechaFin = 'La fecha de fin debe ser posterior a la fecha de inicio';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (isEditing && updateWithHistory) {
        await updateWithHistory(initialData._id || initialData.id, formData, initialData);
      } else if (!isEditing && createWithHistory) {
        await createWithHistory(formData);
      } else if (onSubmit) {
        await onSubmit(formData);
      }
      if (onClose) onClose();
    } catch {
      // Error handling delegated to caller
    } finally {
      setSaving(false);
    }
  };

  const monedaOptions = (relatedData?.moneda || []).map((moneda) => ({
    value: moneda._id || moneda.id,
    label: `${moneda.simbolo} - ${moneda.nombre}`,
  }));

  const propiedadOptions = (relatedData?.propiedad || []).map((propiedad) => ({
    value: propiedad._id || propiedad.id,
    label: propiedad.titulo,
  }));

  return (
    <TareaFormDialogShell open={open} onClose={onClose} isMobile={isMobile}>
        <TareaFormHeader onClose={onClose}>
          <Box sx={{ mb: 0.5 }}>
            <TareaActions
              variant="form"
              tarea={{ tipo: 'TAREA', prioridad: formData.prioridad === 'ALTA' ? 'ALTA' : 'BAJA' }}
              onTogglePriority={() => {
                setFormData((prev) => ({
                  ...prev,
                  prioridad: prev.prioridad === 'ALTA' ? 'BAJA' : 'ALTA',
                }));
              }}
              onAttach={handleFileChange}
            />
          </Box>
          <TareaFormHeaderTitleRow>
            <TextField
              variant="standard"
              fullWidth
              placeholder="Nombre del objetivo"
              value={formData.nombre}
              onChange={handleChange('nombre')}
              error={!!errors.nombre}
              helperText={errors.nombre}
              required
              autoFocus
              sx={{ flex: 1, minWidth: 0, ...tareaFormTitleFieldSx }}
            />
          </TareaFormHeaderTitleRow>
        </TareaFormHeader>

        <Box sx={{ px: 2 }}>
          <TareaFormDescriptionField
            value={formData.descripcion}
            onChange={handleChange('descripcion')}
            placeholder="Agregar descripción..."
          />

          <TareaFormSettingsRow
            estado={formData.estado}
            onEstadoChange={handleChange('estado')}
            showPrioridad={false}
            showRecurrence={false}
            errors={errors}
            estadoOptions={TAREA_FORM_OBJETIVO_ESTADO_OPTIONS}
            entityType="OBJETIVO"
          />

          <TareaFormRow icon={TareaFormIcons.schedule} showDivider={false} align="center">
            <Stack
              direction="row"
              flexWrap="wrap"
              alignItems="center"
              gap={0.75}
              useFlexGap
              sx={{ ...tareaFormPillRowSx, ...tareaFormRowContentGutterSx }}
            >
              <TareaFormDeadlinePill
                value={formData.fechaInicio}
                onChange={handleDateChange('fechaInicio')}
                placeholder="Fecha de inicio"
              />
              <TareaFormDeadlinePill
                value={formData.fechaFin}
                onChange={handleDateChange('fechaFin')}
                placeholder="Fecha de fin"
              />
            </Stack>
            {(errors.fechaInicio || errors.fechaFin) && (
              <Typography component="span" sx={{ ...tareaFormErrorTextSx, mt: 0.5, display: 'block' }}>
                {errors.fechaInicio || errors.fechaFin}
              </Typography>
            )}
          </TareaFormRow>

          <TareaFormRow icon={MoneyIcon} showDivider={false} align="center">
            <TextField
              variant="standard"
              fullWidth
              placeholder="Presupuesto"
              value={formData.presupuesto || ''}
              onChange={handleChange('presupuesto')}
              error={!!errors.presupuesto}
              type="number"
              InputProps={{ disableUnderline: true }}
              sx={{
                ...tareaFormStandardFieldSx,
                maxWidth: 120,
                '& .MuiInputBase-input': {
                  ...tareaFormFieldInputSx,
                  color: formData.presupuesto ? 'text.primary' : 'text.secondary',
                },
              }}
            />
            <TareaFormPillSelect
              value={formData.moneda || ''}
              onChange={handleChange('moneda')}
              options={monedaOptions}
              emptyLabel="Moneda"
              error={errors.moneda}
            />
          </TareaFormRow>

          <TareaFormRow icon={HomeIcon} showDivider={false} align="center">
            <TareaFormPillSelect
              value={formData.propiedad || ''}
              onChange={handleChange('propiedad')}
              options={propiedadOptions}
              emptyLabel="Sin propiedad asociada"
              error={errors.propiedad}
            />
          </TareaFormRow>

          <Box sx={{ py: 1.5 }}>
            <TareaFormSectionLabel>Tareas</TareaFormSectionLabel>
            <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
              <IconButton
                size="small"
                onClick={() => setIsTareaFormOpen(true)}
                aria-label="Nueva tarea"
                sx={{ color: 'text.secondary', p: 0.5 }}
              >
                <AddIcon sx={tareaFormActionIconSx} />
              </IconButton>
            </Stack>
            {formData.tareas.length > 0 && (
              <Stack spacing={0.5} sx={{ pl: tareaFormRowContentIndent }}>
                {formData.tareas.map((tarea, index) => (
                  <Box
                    key={tarea._id || tarea.id || `tarea-${index}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      py: 0.25,
                      minHeight: 40,
                    }}
                  >
                    <Typography
                      sx={{
                        flex: 1,
                        fontSize: '0.875rem',
                        color: tarea.completada ? 'text.secondary' : 'text.primary',
                        textDecoration: tarea.completada ? 'line-through' : 'none',
                      }}
                    >
                      {tarea.titulo}
                    </Typography>
                    <Chip
                      label={tarea.estado}
                      size="small"
                      sx={{
                        ...tareaFormChipSx,
                        backgroundColor: `${getEstadoColor(tarea.estado, 'TAREA')}20`,
                        color: getEstadoColor(tarea.estado, 'TAREA'),
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          tareas: prev.tareas.filter((_, i) => i !== index),
                        }));
                      }}
                      sx={{ p: 0.5, color: 'error.main' }}
                      aria-label="Eliminar tarea"
                    >
                      <CloseIcon sx={tareaFormActionIconSx} />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          <TareaFormAttachmentsSection
            archivos={formData.archivos}
            onRemove={removeFile}
          />
        </Box>

        <TareaFormFooter
          onSave={handleSubmit}
          saving={saving}
          saveLabel={isEditing ? 'Actualizar' : 'Guardar'}
        />

      <Suspense fallback={null}>
        <TareaForm
          open={isTareaFormOpen}
          onClose={() => setIsTareaFormOpen(false)}
          onSubmit={handleTareaSubmit}
          objetivoId={initialData?._id}
        />
      </Suspense>
    </TareaFormDialogShell>
  );
};

export default ObjetivoForm;

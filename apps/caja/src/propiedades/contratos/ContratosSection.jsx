import React, { useEffect } from 'react';
import { Box, Typography, Autocomplete, Chip, InputAdornment } from '@mui/material';
import { Home, SingleBed, Person, AttachMoney } from '@mui/icons-material';
import { StyledTextField, FormSection, StyledToggleButton } from '@shared/components/common/CommonFormStyles';
import { getCuentaYMoneda } from '@shared/utils/contratoUtils';
import { SeccionUbicacion } from '../SeccionesPropiedad';
import {
  getDocumentId,
  getPropiedadDisplayLabel,
  getHabitacionTipoLabel,
  habitacionMatchesPropiedad,
} from '../habitacionConstants';

// --- TIPO_ALQUILER ---
export const TIPO_ALQUILER = [
  { valor: false, icon: <Home />, label: 'Propiedad', color: '#4caf50' },
  { valor: true, icon: <SingleBed />, label: 'Habitación', color: '#2196f3' }
];

// --- ContratoPropiedadSection ---
export const ContratoPropiedadSection = ({
  formData,
  selectedPropiedad,
  onPropiedadChange,
  onTipoAlquilerChange,
  relatedData,
  errors
}) => (
  <FormSection>
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      <Autocomplete
        sx={{ flex: 1 }}
        value={selectedPropiedad}
        onChange={(_, newValue) => onPropiedadChange(newValue)}
        options={relatedData.propiedades || []}
        getOptionLabel={(option) => getPropiedadDisplayLabel(option)}
        isOptionEqualToValue={(option, value) => getDocumentId(option) === getDocumentId(value)}
        renderInput={(params) => (
          <StyledTextField
            {...params}
            label="Propiedad"
            error={!!errors.propiedad}
            helperText={errors.propiedad}
            InputLabelProps={{
              ...params.InputLabelProps,
              shrink: true
            }}
          />
        )}
      />
      {!formData.esMantenimiento && (
        <Box sx={{ display: 'flex', gap: 0.5, alignSelf: 'center', height: '56px', alignItems: 'center' }}>
          {TIPO_ALQUILER.map((tipo) => (
            <StyledToggleButton
              key={String(tipo.valor)}
              value={tipo.valor}
              selected={formData.esPorHabitacion === tipo.valor}
              onClick={() => onTipoAlquilerChange(tipo.valor)}
              customcolor={tipo.color}
            >
              {tipo.icon}
              <Typography 
                variant="body2" 
                className={formData.esPorHabitacion === tipo.valor ? 'selected' : ''}
                sx={{ 
                  textTransform: 'capitalize',
                  fontSize: '0.875rem',
                  display: formData.esPorHabitacion === tipo.valor ? 'block' : 'none',
                  '.MuiButtonBase-root:hover &': {
                    display: 'block'
                  }
                }}
              >
                {tipo.label.toLowerCase()}
              </Typography>
            </StyledToggleButton>
          ))}
        </Box>
      )}
    </Box>
  </FormSection>
);

// --- ContratoHabitacionSection ---
export const ContratoHabitacionSection = ({
  selectedHabitacion,
  onHabitacionChange,
  relatedData,
  formData,
  errors
}) => {
  if (!formData.esPorHabitacion || formData.esMantenimiento) return null;
  return (
    <FormSection>
      <Autocomplete
        value={selectedHabitacion}
        onChange={(_, newValue) => onHabitacionChange(newValue)}
        options={relatedData.habitaciones?.filter((h) => habitacionMatchesPropiedad(h, formData.propiedad)) || []}
        getOptionLabel={(option) => getHabitacionTipoLabel(option.tipo, option.nombrePersonalizado)}
        isOptionEqualToValue={(option, value) => getDocumentId(option) === getDocumentId(value)}
        disabled={!formData.propiedad}
        renderInput={(params) => (
          <StyledTextField
            {...params}
            label="Habitación"
            error={!!errors.habitacion}
            helperText={errors.habitacion}
            InputLabelProps={{
              ...params.InputLabelProps,
              shrink: true
            }}
          />
        )}
      />
    </FormSection>
  );
};

// --- ContratoInquilinosSection ---
export const ContratoInquilinosSection = ({
  selectedInquilinos,
  onInquilinosChange,
  relatedData,
  errors
}) => (
  <FormSection>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Autocomplete
        multiple
        value={selectedInquilinos}
        onChange={(_, newValue) => onInquilinosChange(newValue)}
        options={relatedData.inquilinos || []}
        getOptionLabel={(option) => 
          option && typeof option === 'object' ? 
            `${option.nombre || ''} ${option.apellido || ''}`.trim() : ''
        }
        isOptionEqualToValue={(option, value) => getDocumentId(option) === getDocumentId(value)}
        renderInput={(params) => (
          <StyledTextField
            {...params}
            label="Seleccionar Inquilinos"
            error={!!errors.inquilino}
            helperText={errors.inquilino}
            InputLabelProps={{
              ...params.InputLabelProps,
              shrink: true
            }}
          />
        )}
        renderTags={() => null}
      />
      {selectedInquilinos.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, p: 1, bgcolor: 'background.default' }}>
          {selectedInquilinos.map((inquilino) => inquilino && (
            <Chip
              key={inquilino._id}
              label={`${inquilino.nombre || ''} ${inquilino.apellido || ''}`}
              onDelete={() => {
                const newInquilinos = selectedInquilinos.filter(i => i._id !== inquilino._id);
                onInquilinosChange(newInquilinos);
              }}
              sx={{ 
                borderRadius: 0,
                bgcolor: 'background.paper',
                '& .MuiChip-deleteIcon': {
                  color: 'text.secondary',
                  '&:hover': { color: 'error.main' }
                }
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  </FormSection>
);

// --- ContratoMontosSection ---
export const ContratoMontosSection = ({
  formData,
  selectedCuenta,
  onCuentaChange,
  onMontoChange,
  relatedData,
  errors
}) => {
  useEffect(() => {
    if (formData.cuenta && !selectedCuenta && relatedData.cuentas?.length > 0) {
      const cuenta = relatedData.cuentas.find(c => c._id === formData.cuenta || c.id === formData.cuenta);
      if (cuenta) {
        onCuentaChange(cuenta);
      }
    }
  }, [selectedCuenta, formData.cuenta, relatedData.cuentas, onCuentaChange]);

  const getMonedaSimbolo = () => {
    const contratoTemp = {
      cuenta: selectedCuenta,
      moneda: selectedCuenta?.moneda
    };
    const { simboloMoneda } = getCuentaYMoneda(contratoTemp, relatedData);
    return simboloMoneda;
  };
  const simboloMoneda = getMonedaSimbolo();

  return (
    <FormSection>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <StyledTextField
            sx={{ flex: 1 }}
            label="Precio Total del Contrato"
            value={formData.precioTotal}
            onChange={(e) => onMontoChange('precioTotal', e.target.value)}
            error={!!errors.precioTotal}
            helperText={errors.precioTotal}
            type="number"
            InputLabelProps={{ shrink: true }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    {simboloMoneda}
                  </Typography>
                </InputAdornment>
              )
            }}
          />
          <StyledTextField
            sx={{ flex: 1 }}
            label="Depósito"
            value={formData.deposito}
            onChange={(e) => onMontoChange('deposito', e.target.value)}
            error={!!errors.deposito}
            helperText={errors.deposito}
            type="number"
            InputLabelProps={{ shrink: true }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    {simboloMoneda}
                  </Typography>
                </InputAdornment>
              )
            }}
          />
        </Box>
        <Autocomplete
          value={selectedCuenta}
          onChange={(_, newValue) => onCuentaChange(newValue)}
          options={relatedData.cuentas || []}
          getOptionLabel={(option) => {
            if (!option) return '';
            const simbolo = option.moneda?.simbolo || '$';
            return `${option.nombre || ''} - ${simbolo} (${option.tipo || ''})`;
          }}
          isOptionEqualToValue={(option, value) => {
            if (!option || !value) return false;
            return option._id === value._id || option.id === value.id;
          }}
          renderInput={(params) => (
            <StyledTextField
              {...params}
              label="Cuenta"
              error={!!errors.cuenta}
              helperText={errors.cuenta || (formData.cuenta && !selectedCuenta ? 'Seleccione una cuenta' : '')}
              InputLabelProps={{
                ...params.InputLabelProps,
                shrink: true
              }}
            />
          )}
          renderOption={(props, option) => {
            if (!option) return null;
            const { key, ...otherProps } = props;
            const simbolo = option.moneda?.simbolo || '$';
            return (
              <Box component="li" key={option._id || option.id} {...otherProps}>
                <Box>
                  <Typography>{option.nombre}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {simbolo} - {option.tipo}
                  </Typography>
                </Box>
              </Box>
            );
          }}
        />
      </Box>
    </FormSection>
  );
};

// --- ContratoUbicacionSection ---
export const ContratoUbicacionSection = ({ propiedad }) => {
  if (!propiedad) return null;
  return <SeccionUbicacion propiedad={propiedad} />;
};

// --- Componente principal agrupador (opcional) ---
const ContratosSection = {
  ContratoUbicacionSection,
  ContratoPropiedadSection, // Información principal primero
  ContratoHabitacionSection,
  ContratoInquilinosSection,
  ContratoMontosSection,
  TIPO_ALQUILER
};

export default ContratosSection; 
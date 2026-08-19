import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  LinearProgress,
  Fade,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  Autocomplete,
  CircularProgress,
  Dialog as MuiDialog
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SyncIcon from '@mui/icons-material/Sync';
import { useSnackbar } from 'notistack';
import { useRelationalData } from '@shared/hooks/useRelationalData';
import clienteAxios from '@shared/config/axios';
import { FORM_HEIGHTS } from '@shared/config/uiConstants';
import MercadoPagoConnectButton from './MercadoPagoConnectButton';
import GoogleIcon from '@mui/icons-material/Google';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import GoogleWalletConnectButton from './GoogleWalletConnectButton';
import UalaConnectButton from './UalaConnectButton';
import WiseConnectButton from './WiseConnectButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 0,
    backgroundColor: theme.palette.background.default,
    backgroundImage: 'none',
    [theme.breakpoints.down('sm')]: {
      margin: 0,
      maxHeight: '100%',
      height: '100%',
      width: '100%',
      maxWidth: '100%'
    },
    [theme.breakpoints.up('sm')]: {
      minWidth: '600px',
      maxWidth: '800px'
    }
  }
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
            height: FORM_HEIGHTS.input,
    backgroundColor: theme.palette.background.default,
    '& fieldset': {
      borderColor: theme.palette.divider
    }
  },
  '& .MuiInputLabel-root': {
    transform: 'translate(14px, -9px) scale(0.75)',
    '&.Mui-focused, &.MuiFormLabel-filled': {
      transform: 'translate(14px, -9px) scale(0.75)'
    }
  },
  '& .MuiInputLabel-shrink': {
    transform: 'translate(14px, -9px) scale(0.75)'
  }
}));

const TIPOS_CONEXION = [
  { valor: 'PLAID', label: 'Plaid', descripcion: 'Conecta con más de 11,000 instituciones financieras' },
  { valor: 'OPEN_BANKING', label: 'Open Banking', descripcion: 'Estándar europeo de APIs bancarias' },
  { valor: 'API_DIRECTA', label: 'API Directa', descripcion: 'Conexión directa con el banco' },
  { valor: 'MERCADOPAGO', label: 'MercadoPago', descripcion: 'Sincronización automática con MercadoPago' },
  { valor: 'MANUAL', label: 'Manual', descripcion: 'Importación manual de transacciones' }
];

const BANCOS_POPULARES = [
  'Banco Santander',
  'BBVA',
  'Banco de Chile',
  'Banco Estado',
  'Banco BCI',
  'Banco Security',
  'Banco Falabella',
  'Banco Ripley',
  'Banco Consorcio',
  'Banco Itaú',
  'Scotiabank',
  'Banco de Crédito e Inversiones',
  'Banco Edwards',
  'Banco Internacional',
  'Banco Paris',
  'Banco Santander-Chile',
  'Banco de A. Edwards',
  'Banco Bice',
  'Banco Corpbanca',
  'Banco del Desarrollo',
  'ICBC'
];

// Componente para selección de tipo de cuenta
const AccountTypeSelector = ({ onSelect }) => (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', letterSpacing: 1 }}>
              ¿Qué tipo de cuenta deseas agregar?
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box
        onClick={() => onSelect('BANCO')}
                sx={{
                  cursor: 'pointer',
                  width: '100%',
                  minHeight: 56,
                  bgcolor: 'transparent',
                  borderRadius: 0,
                  boxShadow: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  px: 2,
                  py: 1.5,
                  border: '2px solid transparent',
                  transition: 'border 0.2s, background 0.2s',
                  '&:hover': {
                    border: '2px solid',
                    borderColor: 'primary.main',
                    bgcolor: 'grey.900',
                  },
                }}
              >
                <AccountBalanceIcon sx={{ color: 'white', fontSize: 28, mr: 2 }} />
                <Typography sx={{ color: 'white', fontWeight: 600, fontSize: 16 }}>
                  Cuenta bancaria
                </Typography>
              </Box>
              <Box
        onClick={() => onSelect('BILLETERA')}
                sx={{
                  cursor: 'pointer',
                  width: '100%',
                  minHeight: 56,
                  bgcolor: 'transparent',
                  borderRadius: 0,
                  boxShadow: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  px: 2,
                  py: 1.5,
                  border: '2px solid transparent',
                  transition: 'border 0.2s, background 0.2s',
                  '&:hover': {
                    border: '2px solid',
                    borderColor: 'primary.main',
                    bgcolor: 'grey.900',
                  },
                }}
              >
                <AccountBalanceWalletIcon sx={{ color: 'white', fontSize: 28, mr: 2 }} />
                <Typography sx={{ color: 'white', fontWeight: 600, fontSize: 16 }}>
                  Billetera digital
                </Typography>
              </Box>
            </Box>
          </Box>
);

// Componente para formulario de cuenta bancaria
const BankAccountForm = ({ formData, handleChange, handleSubmit, isSaving, onClose, errors }) => (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', letterSpacing: 1 }}>
              Información de la cuenta bancaria
            </Typography>
            <StyledTextField
              fullWidth
              label="Nombre de la cuenta"
              value={formData.nombre}
              onChange={e => handleChange('nombre', e.target.value)}
              error={!!errors.nombre}
              helperText={errors.nombre}
              sx={{ mb: 2 }}
            />
            <StyledTextField
              fullWidth
              label="Número de cuenta"
              value={formData.numero}
              onChange={e => handleChange('numero', e.target.value)}
              error={!!errors.numero}
              helperText={errors.numero}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={formData.tipo}
                onChange={e => handleChange('tipo', e.target.value)}
                error={!!errors.tipo}
                sx={{ borderRadius: 0, height: FORM_HEIGHTS.input }}
              >
                <MenuItem value="BANCO">Cuenta bancaria</MenuItem>
                <MenuItem value="EFECTIVO">Efectivo</MenuItem>
                <MenuItem value="OTRO">Otro</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
              <Button variant="text" color="inherit" onClick={onClose} sx={{ borderRadius: 0 }}>
                Cancelar
              </Button>
              <Button
                variant="text"
                color="inherit"
                onClick={handleSubmit}
                startIcon={isSaving ? <CircularProgress size={18} /> : <AccountBalanceIcon />}
                sx={{ borderRadius: 0, color: 'white' }}
              >
        {isSaving ? 'Guardando...' : 'Crear'}
              </Button>
            </Box>
          </>
);

// Componente para billeteras digitales
const DigitalWalletsForm = ({ onClose, onBack }) => (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', letterSpacing: 1 }}>
              Selecciona tu billetera para conectar
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
              <MercadoPagoConnectButton
                onSuccess={onClose}
        onError={(err) => console.error('Error MercadoPago:', err)}
        fullWidth
      />
      <GoogleWalletConnectButton 
        onSuccess={onClose} 
        onError={() => {}} 
        fullWidth 
      />
      <UalaConnectButton 
        onSuccess={onClose} 
        onError={() => {}} 
        fullWidth 
      />
      <WiseConnectButton 
        onSuccess={onClose} 
        onError={() => {}} 
                fullWidth
              />
            </Box>
    <Button variant="text" sx={{ mt: 2 }} onClick={onBack}>
              ← Volver
            </Button>
          </Box>
);

const BankConnectionForm = ({ 
  open, 
  onClose, 
  onSubmit,
  initialData = {},
  isEditing = false 
}) => {
  const [formData, setFormData] = useState({
    nombre: initialData.nombre || '',
    numero: initialData.numero || '',
    tipo: initialData.tipo || 'BANCO'
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [tipoCuenta, setTipoCuenta] = useState(null);
  const { enqueueSnackbar } = useSnackbar();

  // Efecto para reiniciar el formulario cuando se abre
  useEffect(() => {
    if (open) {
      setFormData({
        nombre: initialData.nombre || '',
        numero: initialData.numero || '',
        tipo: initialData.tipo || 'BANCO'
      });
      setErrors({});
      // setTipoCuenta(null); // <-- Quitado para no resetear el paso
    }
  }, [open, initialData]);

  const handleChange = useCallback((name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.nombre?.trim()) newErrors.nombre = 'El nombre es requerido';
    if (!formData.numero?.trim()) newErrors.numero = 'El número de cuenta es requerido';
    if (!formData.tipo) newErrors.tipo = 'Seleccione el tipo de cuenta';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      await onSubmit(formData);
      enqueueSnackbar('Cuenta creada exitosamente', { variant: 'success' });
      onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
      enqueueSnackbar(
        error.response?.data?.message || error.message || 'Error al guardar', 
        { variant: 'error' }
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = useCallback(() => {
    if (!isSaving) {
      onClose();
    }
  }, [isSaving, onClose]);

  const handleBack = useCallback(() => {
    setTipoCuenta(null);
  }, []);

  return (
    <StyledDialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <Box sx={{ p: 3, minWidth: 350, position: 'relative', pt: 6 }}>
        {/* Botón Atrás solo si no estamos en el paso inicial */}
        {tipoCuenta && (
          <IconButton
            onClick={handleBack}
            sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              color: 'text.secondary',
              borderRadius: 0,
              bgcolor: 'transparent',
              '&:hover': { bgcolor: 'grey.900' },
              zIndex: 2
            }}
            size="small"
            aria-label="Atrás"
          >
            <ArrowBackIcon />
          </IconButton>
        )}
        
        {/* Botón Cerrar (X) siempre visible */}
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: 'text.secondary',
            borderRadius: 0,
            bgcolor: 'transparent',
            '&:hover': { bgcolor: 'grey.900' },
            zIndex: 2
          }}
          size="small"
          aria-label="Cerrar"
        >
          <CloseIcon />
        </IconButton>
        
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {isEditing ? 'Editar Cuenta' : 'Nueva Cuenta'}
        </Typography>

        {/* Paso 1: Selección visual de tipo de cuenta */}
        {!tipoCuenta && (
          <AccountTypeSelector onSelect={setTipoCuenta} />
        )}

        {/* Paso 2: Si elige cuenta bancaria, mostrar los campos tradicionales */}
        {tipoCuenta === 'BANCO' && (
          <BankAccountForm
            formData={formData}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            isSaving={isSaving}
            onClose={handleClose}
            errors={errors}
          />
        )}

        {/* Paso 2: Si elige billetera digital, mostrar los botones de integración */}
        {tipoCuenta === 'BILLETERA' && (
          <DigitalWalletsForm onClose={handleClose} onBack={handleBack} />
        )}
      </Box>
    </StyledDialog>
  );
};

export default BankConnectionForm; 
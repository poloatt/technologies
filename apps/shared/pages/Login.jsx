  import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Button, 
  TextField, 
  Box, 
  Typography, 
  Paper,
  IconButton,
  Tooltip,
  Avatar
} from '@mui/material';
import { 
  Google as GoogleIcon,
  Visibility as ShowValuesIcon,
  VisibilityOff as HideValuesIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import { FONT_SIZE } from '../tipografia';

export function Login() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lastGoogleUser, setLastGoogleUser] = useState(null);

  // Nombre amigable para el último usuario de Google (solo primer nombre o parte antes de @)
  const friendlyLastGoogleName = lastGoogleUser
    ? (lastGoogleUser.nombre?.trim().split(' ')[0] || lastGoogleUser.email?.split('@')[0] || '')
    : '';

  // Estilos comunes para los campos de texto
  const textFieldStyles = {
    '& .MuiOutlinedInput-root': {
      bgcolor: '#232323',
      '& fieldset': {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      '&:hover fieldset': {
        borderColor: 'rgba(255, 255, 255, 0.3)',
      },
      '& input': {
        bgcolor: '#232323',
        color: 'rgba(255, 255, 255, 0.9)',
        ':-webkit-autofill': {
          WebkitBoxShadow: '0 0 0 100px #232323 inset',
          WebkitTextFillColor: 'rgba(255,255,255,0.9)',
        },
        ':-webkit-autofill:focus': {
          WebkitBoxShadow: '0 0 0 100px #232323 inset',
          WebkitTextFillColor: 'rgba(255,255,255,0.9)',
        },
        ':-webkit-autofill:hover': {
          WebkitBoxShadow: '0 0 0 100px #232323 inset',
          WebkitTextFillColor: 'rgba(255,255,255,0.9)',
        },
      },
    },
    '& .MuiInputLabel-root': {
      color: 'rgba(255, 255, 255, 0.7)',
    },
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevenir múltiples envíos
    if (loading) {
      return;
    }
    
    try {
      setLoading(true);
      // Solo loggear en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log('🚀 Iniciando login...');
      }
      const result = await login({ email, password });
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Login completado, redirigiendo a /');
      }
      navigate('/');
    } catch (error) {
      // Solo mostrar error si no es una cancelación por duplicación
      if (!error.cancelado) {
        const errorMessage = error.response?.data?.error || 'Error al iniciar sesión';
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Cargar información del último usuario de Google al montar el componente
  useEffect(() => {
    try {
      const stored = localStorage.getItem('lastGoogleUser');
      if (stored) {
        const userData = JSON.parse(stored);
        // Verificar que la información no sea muy antigua (máximo 90 días)
        const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 días en milisegundos
        if (Date.now() - userData.timestamp < maxAge) {
          setLastGoogleUser(userData);
        } else {
          // Limpiar información antigua
          localStorage.removeItem('lastGoogleUser');
        }
      }
    } catch (error) {
      // Silenciar errores al leer localStorage
      if (process.env.NODE_ENV === 'development') {
        console.log('Error al leer último usuario de Google:', error);
      }
    }
  }, []);

  const handleGoogleLogin = async (options = {}) => {
    // Prevenir múltiples clics
    if (loading) {
      return;
    }
    
    try {
      setLoading(true);
      toast.loading('Redirigiendo a Google...', { id: 'google-login' });
      await loginWithGoogle(options);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error al iniciar sesión con Google:', error);
      }
      toast.dismiss('google-login');
      toast.error(error.message || 'Error al iniciar sesión con Google. Por favor, intenta más tarde.');
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', px: { xs: 1, sm: 2, md: 3 }, mt: 4, maxWidth: 400, mx: 'auto' }}>
      <Paper 
        sx={{ 
          p: 3,
          bgcolor: '#1a1a1a',
          border: '1px solid',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          width: '100%',
          borderRadius: 0
        }}
      >
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email"
            name="email"
            autoComplete="email"
            autoFocus
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ 
              mb: 2,
              ...textFieldStyles
            }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="current-password"
            size="small"
            InputLabelProps={{ shrink: true }}
            InputProps={{
              endAdornment: (
                <Tooltip title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  <IconButton
                    size="small"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.5)',
                      '&:hover': { 
                        color: 'rgba(255, 255, 255, 0.9)'
                      }
                    }}
                  >
                    {showPassword ? <HideValuesIcon sx={{ fontSize: 18 }} /> : <ShowValuesIcon sx={{ fontSize: 18 }} />}
                  </IconButton>
                </Tooltip>
              ),
            }}
            sx={textFieldStyles}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />



          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{ 
              mt: 3, 
              mb: 2,
              textTransform: 'none',
              py: 1,
              bgcolor: '#000',
              color: '#fff',
              border: '1px solid',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                bgcolor: '#333',
                borderColor: 'rgba(255, 255, 255, 0.2)'
              },
              '&:disabled': {
                borderColor: 'rgba(255, 255, 255, 0.05)'
              }
            }}
          >
            {loading ? 'Iniciando...' : 'Iniciar Sesión'}
          </Button>

          <Button
            fullWidth
            variant="outlined"
            startIcon={
              lastGoogleUser ? (
                <Avatar 
                  sx={{ 
                    width: 24, 
                    height: 24, 
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    fontSize: FONT_SIZE.sm,
                    fontWeight: 'bold',
                    color: 'rgba(255, 255, 255, 0.9)'
                  }}
                >
                  {(friendlyLastGoogleName || lastGoogleUser.email || 'G')
                    .charAt(0)
                    .toUpperCase()}
                </Avatar>
              ) : (
                <GoogleIcon sx={{ fontSize: 18 }} />
              )
            }
            onClick={() => handleGoogleLogin({
              forceSelectAccount: false,
              loginHint: lastGoogleUser?.email
            })}
            disabled={loading}
            sx={{ 
              textTransform: 'none',
              py: lastGoogleUser ? 1.5 : 1,
              color: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              justifyContent: 'flex-start',
              '& .MuiButton-startIcon': {
                marginRight: lastGoogleUser ? 1.5 : 1
              },
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.3)',
                bgcolor: 'transparent'
              },
              '&:disabled': {
                color: 'rgba(255, 255, 255, 0.5)',
                borderColor: 'rgba(255, 255, 255, 0.05)'
              }
            }}
            >
            {loading ? (
              'Conectando...'
            ) : lastGoogleUser ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, textAlign: 'left' }}>
                <Typography variant="body2" sx={{ fontSize: FONT_SIZE.base, lineHeight: 1.2, fontWeight: 500 }}>
                  Continuar como {friendlyLastGoogleName}
                </Typography>
                {lastGoogleUser.email && (
                  <Typography variant="caption" sx={{ fontSize: FONT_SIZE.xs, opacity: 0.6, lineHeight: 1, mt: 0.25 }}>
                    {lastGoogleUser.email}
                  </Typography>
                )}
              </Box>
            ) : (
              'Continuar con Google'
            )}
          </Button>

          {lastGoogleUser && (
            <Box sx={{ mt: 1, textAlign: 'center' }}>
              <Button
                variant="text"
                size="small"
                disabled={loading}
                onClick={() => handleGoogleLogin({ forceSelectAccount: true })}
                sx={{
                  textTransform: 'none',
                  fontSize: FONT_SIZE.sm,
                  color: 'rgba(255, 255, 255, 0.6)',
                  '&:hover': {
                    color: 'rgba(255, 255, 255, 0.9)',
                    backgroundColor: 'transparent',
                  },
                }}
              >
                Iniciar sesión con otra cuenta de Google
              </Button>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default Login; 

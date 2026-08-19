import { styled } from '@mui/material/styles';
import { Card, Box, Dialog, TextField, Chip, Typography } from '@mui/material';
import { FORM_HEIGHTS } from '@shared/config/uiConstants';

// Componente estilizado para las tarjetas con estilo angular
export const StyledCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'isAssets'
})(({ theme, isAssets }) => ({
  borderRadius: 0,
  backgroundColor: theme.palette.collapse.background,
  backgroundImage: 'none',
  boxShadow: 'none',
  border: 'none',
  transition: 'all 0.2s ease',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  overflow: 'visible',
  '&:hover': {
    transform: 'none',
    boxShadow: 'none'
  }
}));

// Chip de estado estilizado (mantenido para compatibilidad, pero ahora usa el mismo tamaño)
export const StyledStatusChip = styled(Box)(({ theme, customcolor }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 6px',
  fontSize: '0.75rem',
  color: customcolor || theme.palette.text.secondary,
  height: 24,
  marginLeft: theme.spacing(1),
  '& .MuiSvgIcon-root': {
    fontSize: '0.9rem'
  }
}));

// Dialog estilizado para formularios
export const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 0,
    backgroundColor: '#181818',
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

// TextField estilizado
export const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
    backgroundColor: '#181818',
    '& fieldset': {
      borderColor: theme.palette.divider
    },
    '&:hover fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.2)'
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main
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

// Chip de categoría estilizado
export const CategoryChip = styled(Chip)(({ theme, customcolor }) => ({
  borderRadius: 0,
  height: FORM_HEIGHTS.input,
  minWidth: 40,
  padding: 0,
  transition: 'all 0.2s ease',
  backgroundColor: 'transparent',
  border: 'none',
  color: theme.palette.text.secondary,
  '& .MuiChip-icon': {
    margin: 0,
    fontSize: '1.25rem',
    transition: 'all 0.2s ease'
  },
  '& .MuiChip-label': {
    display: 'none',
    transition: 'all 0.2s ease',
    padding: theme.spacing(0, 1),
    color: theme.palette.text.secondary
  },
  '&:hover': {
    backgroundColor: 'transparent',
    '& .MuiChip-label': {
      display: 'block'
    },
    '& .MuiChip-icon': {
      color: customcolor
    }
  },
  '&.selected': {
    backgroundColor: 'transparent',
    '& .MuiChip-icon': {
      color: customcolor
    },
    '& .MuiChip-label': {
      display: 'block'
    }
  }
}));

// Título de sección estilizado
export const StyledSectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(1),
  borderBottom: `1px solid ${theme.palette.divider}`,
  paddingBottom: theme.spacing(0.5)
}));

// Chip de estado estilizado
export const StatusChip = ({ children, customcolor, ...props }) => {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        padding: '2px 6px',
        fontSize: '0.75rem',
        color: customcolor || 'text.secondary',
        height: 24,
        marginLeft: 1,
        borderRadius: 0,
        backgroundColor: 'transparent',
        border: 'none',
        fontWeight: 500,
        '& .MuiSvgIcon-root': {
          fontSize: '0.9rem'
        }
      }}
      {...props}
    >
      {children}
    </Box>
  );
}; 
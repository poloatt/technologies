import { styled, alpha } from '../../utils/materialImports';
import { Dialog, TextField, Box, Chip, ToggleButton, TableContainer, IconButton } from '../../utils/materialImports';
import { FORM_HEIGHTS } from '../../config/uiConstants';
import { FONT_SIZE } from '../../tipografia';

export const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 0,
    backgroundColor: theme.palette.background.default,
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

export const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
    backgroundColor: alpha(theme.palette.background.paper, 0.9),
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

export const FormSection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2)
}));

export const StyledToggleButton = styled(ToggleButton)(({ theme, customcolor }) => ({
  flex: 1,
  height: FORM_HEIGHTS.input,
  borderRadius: 0,
  border: 'none',
  backgroundColor: 'transparent',
  color: theme.palette.text.secondary,
  transition: 'all 0.2s ease',
  textTransform: 'none',
  padding: theme.spacing(1),
  minWidth: 40,
  '&:hover': {
    backgroundColor: 'transparent',
    '& .MuiSvgIcon-root': {
      color: customcolor
    },
    '& .MuiTypography-root': {
      color: customcolor,
      marginLeft: theme.spacing(1)
    }
  },
  '&.Mui-selected': {
    backgroundColor: 'transparent',
    '& .MuiSvgIcon-root': {
      color: customcolor
    },
    '& .MuiTypography-root': {
      color: customcolor,
      marginLeft: theme.spacing(1),
      display: 'block !important'
    }
  },
  '& .MuiSvgIcon-root': {
    fontSize: '1.2rem',
    transition: 'color 0.2s ease'
  },
  '& .MuiTypography-root': {
    fontSize: FONT_SIZE.base,
    transition: 'all 0.2s ease',
    marginLeft: 0
  }
}));

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

// Estilos compartidos para ContratoCuotasSection
export const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: 0,
  backgroundColor: 'transparent',
  '& .MuiTable-root': {
    backgroundColor: 'transparent'
  },
  '& .MuiTableCell-root': {
    borderColor: theme.palette.divider,
    padding: theme.spacing(1, 1.5),
    fontSize: FONT_SIZE.base
  },
  '& .MuiTableHead-root .MuiTableCell-root': {
    backgroundColor: theme.palette.background.paper,
    fontWeight: 600,
    fontSize: FONT_SIZE.md,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  }
}));

export const StyledCuotasTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
    backgroundColor: theme.palette.background.paper,
    '& fieldset': {
      borderColor: theme.palette.divider
    },
    '&:hover fieldset': {
      borderColor: theme.palette.primary.main
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main
    }
  },
  '& .MuiInputBase-input': {
    fontSize: FONT_SIZE.base,
    padding: theme.spacing(0.5, 1)
  }
}));

export const StyledCuotasChip = styled(Chip)(({ theme, customcolor }) => ({
  borderRadius: 0,
  height: 24,
  fontSize: FONT_SIZE.sm,
  backgroundColor: customcolor ? alpha(customcolor, 0.1) : 'transparent',
  color: customcolor || theme.palette.text.secondary,
  border: customcolor ? `1px solid ${customcolor}` : `1px solid ${theme.palette.divider}`
}));

export const StyledCuotasIconButton = styled(IconButton)(({ theme }) => ({
  borderRadius: 0,
  color: 'primary.main',
  '&:hover': { 
    backgroundColor: 'action.hover' 
  }
}));

export const StyledCuotasCheckbox = styled(Box)(({ theme }) => ({
  '& .MuiCheckbox-root': {
    borderRadius: 0,
    color: theme.palette.text.secondary,
    '&.Mui-checked': {
      color: 'success.main'
    }
  }
})); 
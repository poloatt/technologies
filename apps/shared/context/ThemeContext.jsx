import { createTheme } from '@mui/material/styles';
import { SUBTLE_STROKE_COLOR } from '../styles/subtleStrokeStyles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ffffff',
    },
    secondary: {
      main: '#cccccc',
    },
    background: {
      default: '#181818',
      paper: '#181818',
      toolbar: 'rgba(24, 24, 24, 0.8)'
    },
    collapse: {
      background: 'transparent'
    },
    collapseHeader: {
      background: '#181818'
    },
    text: {
      primary: '#e6e6e6',
      secondary: '#a6a7ab',
    },
    divider: '#232323',
    section: {
      background: '#181818'
    },
  },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'sans-serif',
    ].join(','),
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
    },
    subtitle1: {
      fontSize: '0.813rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '0.813rem',
    },
    body2: {
      fontSize: '0.75rem',
    },
  },
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#181818',
          height: 48,
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: '40px !important',
          padding: '0 !important',
          boxShadow: 'none', // Asegura sin sombra
          '& .MuiIconButton-root': {
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary'
            }
          }
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#181818',
          borderRight: '1px solid rgba(140, 140, 140, 0.15)',
          '& .MuiListItemButton-root': {
            minHeight: 40,
            paddingTop: 4,
            paddingBottom: 4,
            paddingRight: 12,
            margin: '2px 4px',
            borderRadius: 1,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
            '&.Mui-selected': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 32,
          color: '#a6a7ab',
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontSize: '0.813rem',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: 8,
          color: 'text.secondary',
          '&:hover': {
            color: 'text.primary',
            backgroundColor: 'transparent'
          }
        },
        sizeSmall: {
          padding: 4,
          '& .MuiSvgIcon-root': {
            fontSize: '1.25rem'
          }
        }
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          padding: '6px 12px',
          '&:hover': {
            backgroundColor: 'transparent'
          }
        },
        text: {
          padding: '6px 8px',
          minWidth: 'auto'
        },
        sizeSmall: {
          padding: '4px 8px',
          '& .MuiSvgIcon-root': {
            fontSize: '1.25rem'
          }
        }
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.813rem',
          minHeight: 32,
          padding: '4px 12px',
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          '@media (min-width:600px)': {
            paddingLeft: '0px',
            paddingRight: '0px',
          }
        }
      }
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: SUBTLE_STROKE_COLOR
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#181818'
        }
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '12px 16px',
          '& .MuiTypography-root': {
            fontSize: '1rem',
            fontWeight: 600
          }
        }
      }
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '16px',
          '&:first-of-type': {
            paddingTop: '16px'
          }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          borderRadius: 4,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(140, 140, 140, 0.2)'
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(140, 140, 140, 0.4)'
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.3)'
          }
        },
        input: {
          padding: '8px 12px',
          height: '20px',
          lineHeight: '20px',
          fontSize: '0.813rem'
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.813rem',
          transform: 'translate(14px, 12px) scale(1)',
          '&.Mui-focused, &.MuiFormLabel-filled': {
            transform: 'translate(14px, -9px) scale(0.75)'
          }
        },
        outlined: {
          '&.MuiInputLabel-shrink': {
            transform: 'translate(14px, -9px) scale(0.75)'
          }
        }
      }
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: '0.813rem',
          backgroundColor: 'transparent',
          '& .MuiInputAdornment-root': {
            marginTop: '0 !important',
            height: '36px'
          }
        }
      }
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          height: '20px',
          lineHeight: '20px',
          '&.MuiInputBase-input': {
            paddingRight: '32px'
          }
        },
        icon: {
          right: 8
        }
      }
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            marginTop: 0
          }
        }
      }
    },
    MuiInputAdornment: {
      styleOverrides: {
        root: {
          marginTop: '0 !important',
          height: '36px',
          maxHeight: '36px',
          '& .MuiSvgIcon-root': {
            fontSize: '1.25rem',
            color: 'rgba(255, 255, 255, 0.5)'
          }
        },
        positionStart: {
          marginLeft: 4,
          marginRight: 0
        }
      }
    },
    MuiCollapse: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          overflow: 'hidden',
          '& .MuiCollapse-wrapper': {
            borderRadius: 0
          },
          '& .MuiCollapse-wrapperInner': {
            borderRadius: 0
          }
        },
        entered: {
          borderRadius: 0
        },
        hidden: {
          borderRadius: 0
        }
      }
    }
  },
});

export default theme;

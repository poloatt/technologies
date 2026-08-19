import React, { useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Paper,
  Chip,
  IconButton,
  Collapse,
  Tooltip
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { Link } from 'react-router-dom';
import { InquilinoDetail } from '.';
import { getInquilinosByPropiedad, getInquilinosByContrato } from '@shared/utils/inquilinosUtils';
import ContratoDetail from '../propiedades/contratos/ContratoDetail';
import {
  LocationOnOutlined as AddressIcon,
  LocationCityOutlined as CityIcon,
  SquareFootOutlined as AreaIcon,
  MonetizationOnOutlined as MoneyIcon,
  AccountBalanceWalletOutlined as DepositIcon,
  AccountBalance as BankIcon,
  AttachMoney as CurrencyIcon,
  People as PeopleIcon,
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  Home as HomeIcon,
  HomeOutlined,
  Apartment as ApartmentIcon,
  Description as ContractIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  StoreOutlined,
  Inventory2Outlined as InventoryIcon,
  Visibility as ViewIcon,
  InfoOutlined as InfoIcon,
  Description as DescriptionIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { getEstadoContrato, calcularDuracionTotal, getApellidoInquilinoContrato, calcularRangoMesesContrato } from '@shared/utils/contratoUtils';
import { icons } from '@shared/navigation/menuIcons';
import { getStatusIconComponent, getStatusIconComponentRaw, getEstadoColor, getEstadoText } from '@shared/components/common/StatusSystem';
import { IconoContratoDocumentos } from '../propiedades/SeccionesPropiedad';
import { calcularProgresoOcupacion, calcularYearToDate, calcularYearToGo } from '@shared/utils/propiedadUtils';
import EstadoFinanzasContrato from '../propiedades/contratos/EstadoFinanzasContrato';
import { CuotasProvider } from './contratos';
import { calcularEstadoCuotasContrato } from '@shared/utils/contratoUtils';
import { SeccionUbicacion, SeccionHabitaciones, SeccionDocumentos } from '../propiedades/SeccionesPropiedad';
import HabitacionesCarouselSection from './HabitacionesCarouselSection';


// Constantes de estilo jerárquicas para alineación y separadores
const SECTION_PADDING_X = 1;
const SECTION_PADDING_Y = 0.5;
const SECTION_GAP = 0.5;
const SECTION_MIN_HEIGHT = '40px';
const ROW_MIN_HEIGHT = '32px';
const SEPARATOR_COLOR = 'divider';
const SEPARATOR_WIDTH = '1px';

// Función para formatear números de forma compacta (k, M, B)
const formatCompactNumber = (value) => {
  if (!value || isNaN(value)) return '0';
  
  const num = parseFloat(value);
  if (num === 0) return '0';
  
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1000000000) {
    return `${sign}${(absNum / 1000000000).toFixed(1)}B`;
  } else if (absNum >= 1000000) {
    return `${sign}${(absNum / 1000000).toFixed(1)}M`;
  } else if (absNum >= 1000) {
    return `${sign}${(absNum / 1000).toFixed(1)}k`;
  } else {
    return `${sign}${absNum.toFixed(0)}`;
  }
};

// Componente Paper estilizado minimalista con fondo del tema
const GeometricPaper = styled(Paper)(({ theme }) => ({
  borderRadius: 0,
  padding: theme.spacing(0.05, 1.5), // padding horizontal unificado
  border: 'none',
  backgroundColor: theme.palette.collapse.background,
  boxShadow: '0 1px 0 0 rgba(0,0,0,0.18)',
  borderBottom: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.2s ease',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: '14px',
  '&:hover': {
    backgroundColor: theme.palette.collapse.background,
  }
}));

// Componente Paper específico para elementos más compactos
const CompactPaper = styled(Paper)(({ theme }) => ({
  borderRadius: 0,
  padding: theme.spacing(0.03, 0.5),
  border: 'none',
  backgroundColor: theme.palette.collapse.background,
  boxShadow: '0 1px 0 0 rgba(0,0,0,0.18)',
  borderBottom: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.2s ease',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: '12px',
  '&:hover': {
    backgroundColor: theme.palette.collapse.background,
  }
}));

// Chip estilizado geométrico
const GeometricChip = styled(Chip)(({ theme, customcolor }) => ({
  borderRadius: 0,
  backgroundColor: customcolor || theme.palette.action.selected,
  color: theme.palette.text.primary,
  fontWeight: 500,
  fontSize: '0.75rem',
  height: 24,
  '& .MuiChip-icon': {
    fontSize: '0.9rem',
    marginLeft: theme.spacing(0.5)
  }
}));

// Componente base para filas/secciones
const EntitySectionRow = ({
  icon: Icon = InfoIcon,
  primary,
  secondary,
  children,
  sx = {},
  showLargeCurrency = false,
  ...props
}) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 1,
      minHeight: '32px',
      px: 1,
      py: 0.2,
      ...sx
    }}
    {...props}
  >
    {Icon && !showLargeCurrency && <Icon sx={{ fontSize: '1.2rem', color: 'text.secondary', flexShrink: 0 }} />}
    <Box sx={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center',
      minWidth: 0 
    }}>
      <Typography
        variant={showLargeCurrency ? "h5" : "body2"}
        sx={{
          fontWeight: showLargeCurrency ? 600 : 500,
          color: 'text.primary',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontSize: showLargeCurrency ? '1.2rem' : undefined,
          lineHeight: showLargeCurrency ? 1 : undefined,
          textAlign: showLargeCurrency ? 'center' : 'left',
          m: 0
        }}
      >
        {primary}
      </Typography>
      {secondary && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.65rem',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: showLargeCurrency ? 'center' : 'left',
            m: 0
          }}
        >
          {secondary}
        </Typography>
      )}
    </Box>
    {children}
  </Box>
);

// Componente EstadoChip usando el nuevo StatusSystem
const EstadoChip = ({ estado, tipo = 'PROPIEDAD', sx = {} }) => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      px: 1,
      py: 0.5,
      fontSize: '0.75rem',
      color: getEstadoColor(estado, tipo),
      bgcolor: 'transparent',
      borderRadius: 0,
      fontWeight: 600,
      height: 24,
      minWidth: 'fit-content',
      ...sx
    }}
  >
    {getStatusIconComponent(estado, tipo)}
    <span>{getEstadoText(estado, tipo)}</span>
  </Box>
);

// Componente estandarizado para encabezado de entidad con título y estado y acciones a la derecha
const EntityHeader = ({ title, estado, tipoEntidad = 'PROPIEDAD', icon: Icon, iconColor, actions }) => (
  <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
    {/* Columna izquierda: ícono, título, chip de estado */}
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1 }}>
      {Icon && (
        <Icon sx={{ fontSize: '1.2rem', color: iconColor, flexShrink: 0, mt: 0.2 }} />
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', color: 'text.primary', lineHeight: 1.2 }}>
          {title}
        </Typography>
        {estado && <EstadoChip estado={estado} tipo={tipoEntidad} />}
      </Box>
    </Box>
    {/* Columna derecha: acciones */}
    {actions && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {actions}
      </Box>
    )}
  </Box>
);

// Encabezado unificado para todas las secciones primarias
const PrimarySectionHeader = ({ icon: Icon, title }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: SECTION_GAP, mb: SECTION_GAP, pl: SECTION_PADDING_X, minHeight: ROW_MIN_HEIGHT }}>
    {Icon && <Icon sx={{ fontSize: '1.1rem', color: 'primary.main', flexShrink: 0 }} />}
    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.95rem', letterSpacing: 0.1 }}>
      {title}
    </Typography>
  </Box>
);

// Configuraciones pre-definidas para secciones estándar
const SECTION_CONFIGS = {
  // Sección financiera estándar (primaria)
  financiero: (simboloMoneda, nombreCuenta, datosAdicionales = []) => {
    // Extraer datos adicionales (YTD y YTG) y formatear de forma compacta
    const ytd = datosAdicionales[0]?.value || '';
    const ytg = datosAdicionales[1]?.value || '';
    
    // Formatear valores de forma compacta
    const formatValue = (value) => {
      if (!value || typeof value === 'string') return value;
      return formatCompactNumber(value);
    };
    
    return {
      type: 'custom', // Usar tipo custom para renderizado personalizado
      render: () => (
        <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
          {/* Box YTG */}
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 0.3,
            minHeight: '40px'
          }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                fontSize: '0.9rem',
                lineHeight: 1,
                m: 0,
                color: 'text.primary'
              }}
            >
              {formatValue(ytg)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 400,
                fontSize: '0.65rem',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1,
                m: 0,
                textAlign: 'center'
              }}
            >
              YTG
            </Typography>
          </Box>
          
          {/* Box YTD */}
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 0.3,
            minHeight: '40px'
          }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                fontSize: '0.9rem',
                lineHeight: 1,
                m: 0,
                color: 'text.primary'
              }}
            >
              {formatValue(ytd)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 400,
                fontSize: '0.65rem',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1,
                m: 0,
                textAlign: 'center'
              }}
            >
              YTD
            </Typography>
          </Box>
          
          {/* Box Cuenta */}
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 0.3,
            minHeight: '40px'
          }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                fontSize: '1.2rem',
                lineHeight: 1,
                m: 0,
                color: 'text.primary'
              }}
            >
              {simboloMoneda || '$'}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 400,
                fontSize: '0.65rem',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1,
                m: 0,
                textAlign: 'center'
              }}
            >
              {nombreCuenta || 'No especificada'}
            </Typography>
          </Box>
        </Box>
      )
    };
  },

  // Sección de inquilinos estándar (primaria)
  inquilinos: (inquilinos) => ({
    type: 'primary',
    left: [
      {
        icon: PeopleIcon,
        value: inquilinos.length
          ? inquilinos.map(i => `${i.nombre} ${i.apellido}`).join(', ')
          : 'Ninguno',
        subtitle: 'Inquilinos',
        color: 'text.secondary'
      }
    ]
  }),

  documentos: (documentos) => ({
    type: 'primary',
    left: [
      {
        icon: DescriptionIcon,
        value: 'Documentos',
        color: 'text.secondary',
        documentos
      }
    ],
    documentos
  }),

  // Sección de tiempo estándar (secundaria)
  tiempo: (diasRestantes, duracionTotal) => ({
    type: 'secondary',
    data: [
      {
        icon: CalendarIcon,
        label: 'Restantes',
        value: diasRestantes ? `${diasRestantes} días` : 'Finalizado',
        color: 'warning.main'
      },
      {
        icon: ScheduleIcon,
        label: 'Duración',
        value: duracionTotal || 'No especificada',
        color: 'info.main'
      }
    ]
  }),

  // Sección de inventario estándar (secundaria)
  inventario: (items = []) => ({
    type: 'secondary',
    data: items.map(item => ({
      icon: item.icon || DepositIcon,
      label: item.label || 'Item',
      value: item.value || 'No especificado',
      color: item.color || 'text.secondary'
    }))
  }),

  // Sección de resumen de inventario (primaria)
  resumenInventario: (inventario = []) => {
    const totalItems = inventario.length;
    // Determinar el texto a mostrar
    const textoInventario = totalItems === 0 
      ? 'Sin inventario' 
      : totalItems === 1 
        ? '1 elemento' 
        : `${totalItems} elementos`;
    return {
      type: 'primary',
      left: [
        {
          icon: InventoryIcon,
          label: 'Inventario',
          value: textoInventario,
          color: 'text.secondary',
          position: 'left'
        }
      ]
      // No right column
    };
  },

  // Sección de ambientes (carrusel horizontal)
  habitaciones: (habitaciones = [], inventarios = []) => ({
    type: 'habitaciones',
    habitaciones,
    inventarios,
  }),
};

// Componente para renderizar sección con layout izquierda/derecha
const SectionRenderer = ({ section, isCollapsed = false, onContratoDetail = null, inquilinos = [], onInquilinoDetail = null, onInventarioClick = null }) => {
  const theme = useTheme();
  if (section.hidden) return null;

  // Detectar si es sección especial (ubicación, finanzas, inquilinos/contratos) que usan value como array o string
  const isSpecial = section.left && section.left.length === 1 && (Array.isArray(section.left[0]?.value) || typeof section.left[0]?.value === 'string');

  // Si es sección financiera, mostrar monto mensual arriba y depósito abajo, con estilos distintos
  const isFinanciera = isSpecial && section.left[0]?.label === 'Moneda' && section.right?.[0]?.label === 'Montos';
  const isFinancieraLarge = isFinanciera && section.left[0]?.showLargeCurrency;
  
  // Si es sección de tiempo con números grandes
  const isTiempoLarge = section.left[0]?.showLargeNumber && section.right?.[0]?.showLargeNumber;
  
  // Si es sección de inquilinos estándar (PeopleIcon)
  const isInquilinos = section.left && section.left.length === 1 && section.left[0]?.icon === PeopleIcon;
  if (isInquilinos) {
    // Obtener la entidad (propiedad o contrato) desde section.entity si está disponible
    let inquilinosArr = [];
    if (section.entity) {
      if (section.entity.contratos || section.entity.inquilinos) {
        inquilinosArr = getInquilinosByPropiedad(section.entity);
      } else if (section.entity.inquilino) {
        inquilinosArr = getInquilinosByContrato(section.entity);
      }
    } else if (Array.isArray(inquilinos) && inquilinos.length > 0) {
      inquilinosArr = inquilinos;
    } else if (typeof section.left[0].value === 'string' && section.left[0].value !== 'Ninguno') {
      inquilinosArr = section.left[0].value.split(',').map(n => ({ nombre: n.trim(), apellido: '' }));
    }
    // Si no hay inquilinos, mostrar mensaje
    if (!inquilinosArr.length) {
      return (
        <Box sx={{ minHeight: '40px', bgcolor: theme.palette.collapse.background, p: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5 }}>
            <PeopleIcon sx={{ fontSize: '1.2rem', color: 'text.secondary', flexShrink: 0 }} />
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
              Sin inquilinos
            </Typography>
          </Box>
        </Box>
      );
    }
    // Mostrar los inquilinos en una sola línea friendly
    const maxToShow = 3;
    const nombres = inquilinosArr.map(i => `${i.nombre} ${i.apellido}`.trim()).filter(Boolean);
    const friendly = nombres.slice(0, maxToShow).join(', ') + (nombres.length > maxToShow ? ` +${nombres.length - maxToShow} más` : '');
    return (
      <Box sx={{ minHeight: '40px', bgcolor: theme.palette.collapse.background, p: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5 }}>
          <PeopleIcon sx={{ fontSize: '1.2rem', color: 'text.secondary', flexShrink: 0 }} />
          <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>
            {friendly}
          </Typography>
        </Box>
      </Box>
    );
  } else if (isFinancieraLarge) {
    // Usar el estilo estándar como las otras secciones
    const hasLeft = (section.left || []).length > 0;
    const hasRight = (section.right || []).length > 0;
    
    return (
      <Box sx={{ minHeight: SECTION_MIN_HEIGHT, px: SECTION_PADDING_X, py: 0.2, display: 'flex', flexDirection: 'column', gap: SECTION_GAP, bgcolor: theme.palette.collapse.background }}>
        <PrimarySectionHeader icon={section.left[0]?.icon} title={section.left[0]?.label || ''} />
        <Box sx={{ display: 'flex', width: '100%' }}>
          {/* Columna izquierda */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {(section.left || []).map((item, index) => (
              <EntitySectionRow key={index} icon={item.icon} primary={item.value} secondary={item.subtitle} sx={{ minHeight: ROW_MIN_HEIGHT }} />
            ))}
          </Box>
          {/* Separador vertical solo si hay ambas columnas */}
          {hasLeft && hasRight && (
            <Box sx={{ width: SEPARATOR_WIDTH, backgroundColor: SEPARATOR_COLOR, mx: 1 }} />
          )}
          {/* Columna derecha */}
          {hasRight && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {(section.right || []).map((item, index) => (
                <EntitySectionRow key={index} icon={item.icon} primary={item.value} secondary={item.subtitle} sx={{ minHeight: ROW_MIN_HEIGHT }} />
              ))}
          </Box>
          )}
          </Box>
        </Box>
    );
  } else if (isTiempoLarge) {
    // Nueva versión con números grandes para la sección de tiempo
    const valorIzquierda = section.left[0]?.value || '0';
    const subtituloIzquierda = section.left[0]?.subtitle || '';
    const valorDerecha = section.right?.[0]?.value || '0';
    const subtituloDerecha = section.right?.[0]?.subtitle || '';
    
    return (
      <Box sx={{ minHeight: '40px', bgcolor: theme.palette.collapse.background }}>
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
          {/* Número grande y etiqueta izquierda */}
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 0.3
          }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                fontSize: '1.4rem',
                lineHeight: 1,
                m: 0,
                color: 'text.primary'
              }}
            >
              {valorIzquierda}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 400,
                fontSize: '0.65rem',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1,
                m: 0,
                textAlign: 'center'
              }}
            >
              {subtituloIzquierda}
            </Typography>
          </Box>
          {/* Número grande y etiqueta derecha */}
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 0.3
          }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                fontSize: '1.4rem',
                lineHeight: 1,
                m: 0,
                color: 'text.primary'
              }}
            >
              {valorDerecha}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 400,
                fontSize: '0.65rem',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1,
                m: 0,
                textAlign: 'center'
              }}
            >
              {subtituloDerecha}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  } else if (isFinanciera) {
    const iconLeft = section.left[0]?.icon;
    const colorLeft = section.left[0]?.color;
    const valuesLeft = Array.isArray(section.left[0]?.value) ? section.left[0]?.value : [section.left[0]?.value];
    const iconRight = section.right?.[0]?.icon;
    const colorRight = section.right?.[0]?.color;
    const valuesRight = Array.isArray(section.right?.[0]?.value) ? section.right?.[0]?.value : [section.right?.[0]?.value];
    // YTD y YTG
    const ytd = valuesRight[0] || '';
    const ytg = valuesRight[1] || '';
    return (
      <Box sx={{ minHeight: '40px', bgcolor: theme.palette.collapse.background }}>
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
          {/* Ícono izquierda */}
          {iconLeft && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', pr: 1.5, minWidth: 28 }}>
              {React.createElement(iconLeft, { sx: { fontSize: '1.05rem', color: 'rgba(255,255,255,0.7)' } })}
            </Box>
          )}
          {/* Valores izquierda */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.4, justifyContent: 'center' }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.7rem',
                  lineHeight: 1,
                  m: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
              {section.left[0]?.value}
              </Typography>
            {section.left[0]?.subtitle && (
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 400,
                  fontSize: '0.65rem',
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1,
                  m: 0,
                  mt: 0.2
                }}
              >
                {section.left[0]?.subtitle}
              </Typography>
            )}
          </Box>
          {/* Ícono derecha */}
          {iconRight && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', pl: 1.5, minWidth: 28 }}>
              {React.createElement(iconRight, { sx: { fontSize: '1.05rem', color: 'rgba(255,255,255,0.7)' } })}
            </Box>
          )}
          {/* YTD y YTG en dos líneas */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.4, justifyContent: 'center', alignItems: 'flex-start' }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.7rem',
                  lineHeight: 1,
                  m: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
              {section.right[0]?.value}
              </Typography>
            {section.right[0]?.subtitle && (
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 400,
                  fontSize: '0.65rem',
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1,
                  m: 0,
                  mt: 0.2
                }}
              >
                {section.right[0]?.subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  // Si es locación, separar dirección y ciudad en dos líneas con estilos distintos
  const isLocacion = isSpecial && section.left[0]?.label === 'Ubicación';

  if (isLocacion) {
    const iconLeft = section.left[0]?.icon;
    const colorLeft = section.left[0]?.color;
    const ubicacionValue = section.left[0]?.value || '';
    // Separar dirección y ciudad
    let direccion = '', ciudad = '';
    if (typeof ubicacionValue === 'string') {
      [direccion, ciudad] = ubicacionValue.split(',').map(s => s.trim());
    } else if (Array.isArray(ubicacionValue)) {
      [direccion, ciudad] = ubicacionValue;
    }
    const metrosCuadrados = section.right?.[0]?.value || '';
    return (
      <Box sx={{ minHeight: '28px', px: SECTION_PADDING_X, bgcolor: theme.palette.collapse.background }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          {/* Izquierda: ícono + dirección/ciudad */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, px: 1, py: 0.2 }}>
            {iconLeft && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                {React.createElement(iconLeft, { sx: { fontSize: '1.05rem', color: 'rgba(255,255,255,0.7)' } })}
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {direccion && (
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    fontSize: '0.7rem',
                    lineHeight: 1,
                    m: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: { xs: 120, sm: 200, md: 260 }
                  }}
                >
                  {direccion}
                </Typography>
              )}
              {ciudad && (
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 400,
                    fontSize: '0.68rem',
                    color: 'text.secondary',
                    lineHeight: 1,
                    m: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: { xs: 120, sm: 200, md: 260 }
                  }}
                >
                  {ciudad}
                </Typography>
              )}
            </Box>
          </Box>
          {/* Derecha: metros cuadrados */}
          {metrosCuadrados && (
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                fontSize: '0.7rem',
                color: 'text.secondary',
                textAlign: 'right',
                minWidth: 60
              }}
            >
              {metrosCuadrados}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  // Lógica especial para sección de documentos
  const isDocumentos = section.left && section.left.length === 1 && section.left[0]?.icon === DescriptionIcon;
  if (isDocumentos) {
    const documentos = section.documentos || section.left[0].documentos || [];
    const [inquilinoDetailOpen, setInquilinoDetailOpen] = React.useState(false);
    const [selectedInquilino, setSelectedInquilino] = React.useState(null);
    const [contratoDetailOpen, setContratoDetailOpen] = React.useState(false);
    const [selectedContrato, setSelectedContrato] = React.useState(null);
    const [showAllContratos, setShowAllContratos] = React.useState(false);
    
    const handleOpenInquilino = (inquilino) => {
      setSelectedInquilino(inquilino);
      setInquilinoDetailOpen(true);
    };
    const handleCloseInquilino = () => {
      setInquilinoDetailOpen(false);
      setSelectedInquilino(null);
    };
    const handleOpenContrato = (contrato) => {
      setSelectedContrato(contrato);
      setContratoDetailOpen(true);
    };
    const handleCloseContrato = () => {
      setContratoDetailOpen(false);
      setSelectedContrato(null);
    };
    
    // Separar contratos de otros documentos
    const contratos = documentos.filter(doc => doc.categoria === 'CONTRATO' || doc.tipo === 'CONTRATO');
    const otrosDocumentos = documentos.filter(doc => doc.categoria !== 'CONTRATO' && doc.tipo !== 'CONTRATO');
    
    // Limitar contratos mostrados inicialmente
    const contratosAMostrar = showAllContratos ? contratos : contratos.slice(0, 2);
    const contratosOcultos = contratos.length - contratosAMostrar.length;
    return (
      <Box sx={{ minHeight: SECTION_MIN_HEIGHT, px: SECTION_PADDING_X, py: 0.2, display: 'flex', flexDirection: 'column', gap: SECTION_GAP, bgcolor: theme.palette.collapse.background }}>
        {documentos.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
            No hay documentos
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
            {/* Mostrar otros documentos primero */}
            {otrosDocumentos.map((doc, idx) => {
              let IconoDoc = DescriptionIcon;
              let label = doc.nombre;
              let secondary = '';
              
              return (
                <EntitySectionRow
                  key={doc._id || idx}
                  icon={IconoDoc}
                  primary={label}
                  secondary={secondary}
                  children={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {doc.url && (
                        <IconButton size="small" href={doc.url} target="_blank" rel="noopener noreferrer" sx={{ p: 0.2 }}>
                          <ViewIcon sx={{ fontSize: '1rem', color: 'primary.main' }}/>
                        </IconButton>
                      )}
                    </Box>
                  }
                  sx={{ minHeight: ROW_MIN_HEIGHT, pl: 1 }}
                />
              );
            })}
            
            {/* Mostrar contratos limitados */}
            {contratosAMostrar.map((doc, idx) => {
              // Obtener estado dinámico del contrato
              const estadoContrato = getEstadoContrato(doc);
              const IconoDoc = getStatusIconComponentRaw(estadoContrato, 'CONTRATO');
              const colorIcono = getEstadoColor(estadoContrato, 'CONTRATO');
              
              const apellido = getApellidoInquilinoContrato(doc);
              const rango = doc.fechaInicio && doc.fechaFin ? calcularRangoMesesContrato(doc.fechaInicio, doc.fechaFin) : '';
              const label = apellido;
              const secondary = rango;
              
              // Iconos de acción a la derecha
              const inquilino = doc.inquilino && Array.isArray(doc.inquilino) ? doc.inquilino[0] : doc.inquilino;
              const contrato = doc;
              
              return (
                <EntitySectionRow
                  key={doc._id || idx}
                  icon={(props) => <IconoDoc {...props} sx={{ fontSize: '1.2rem', color: colorIcono, flexShrink: 0 }} />}
                  primary={label}
                  secondary={secondary}
                  children={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {inquilino && (
                        <IconButton size="small" sx={{ p: 0.2 }} onClick={() => handleOpenInquilino(inquilino)}>
                          {React.createElement(icons.person, { sx: { fontSize: '1rem', color: 'primary.main' } })}
                        </IconButton>
                      )}
                      <IconButton size="small" sx={{ p: 0.2 }} onClick={() => handleOpenContrato(contrato)}>
                        {React.createElement(icons.description, { sx: { fontSize: '1rem', color: 'primary.main' } })}
                      </IconButton>
                      {/* Botón de archivos de la propiedad */}
                      {section.entity?.documentos && section.entity.documentos.length > 0 ? (
                        <Tooltip title={`Ver ${section.entity.documentos.length} documento${section.entity.documentos.length > 1 ? 's' : ''} de la propiedad`}>
                          <IconButton size="small" sx={{ p: 0.2, color: 'text.secondary' }} onClick={() => onInventarioClick && onInventarioClick({ tipo: 'documentos', propiedad: section.entity })}>
                            <IconoContratoDocumentos sinDocumentos={false} />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', p: 0.2, color: 'text.disabled' }}>
                          <IconoContratoDocumentos sinDocumentos={true} />
                        </Box>
                      )}
                    </Box>
                  }
                  sx={{ minHeight: ROW_MIN_HEIGHT, pl: 1 }}
                />
              );
            })}
            
            {/* Link para mostrar más contratos */}
            {contratosOcultos > 0 && (
              <Box sx={{ pl: 1, pt: 0.5 }}>
                <Typography 
                  variant="caption" 
                  color="primary.main" 
                  sx={{ 
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '0.65rem',
                    '&:hover': {
                      color: 'primary.light'
                    }
                  }}
                  onClick={() => setShowAllContratos(true)}
                >
                  Ver {contratosOcultos} contrato{contratosOcultos > 1 ? 's' : ''} más
                </Typography>
              </Box>
            )}
            
            {/* Link para ocultar contratos */}
            {showAllContratos && contratos.length > 2 && (
              <Box sx={{ pl: 1, pt: 0.5 }}>
                <Typography 
                  variant="caption" 
                  color="primary.main" 
                  sx={{ 
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '0.65rem',
                    '&:hover': {
                      color: 'primary.light'
                    }
                  }}
                  onClick={() => setShowAllContratos(false)}
                >
                  Mostrar menos
                </Typography>
              </Box>
            )}
          </Box>
        )}
        {/* Popups de detalle */}
        {selectedInquilino && (
          <InquilinoDetail open={inquilinoDetailOpen} onClose={handleCloseInquilino} inquilino={selectedInquilino} />
        )}
        {selectedContrato && (
          <ContratoDetail open={contratoDetailOpen} onClose={handleCloseContrato} contrato={selectedContrato} onEdit={() => {}} onDelete={() => {}} />
        )}
      </Box>
    );
  }

  // Para todas las secciones primarias estándar, usar encabezado y layout unificado
  const isPrimarySection = section.type === 'primary' && !isSpecial && !isDocumentos;
  if (isPrimarySection) {
    const hasLeft = (section.left || []).length > 0;
    const hasRight = (section.right || []).length > 0;
    return (
      <Box sx={{ minHeight: SECTION_MIN_HEIGHT, px: SECTION_PADDING_X, py: 0.2, display: 'flex', flexDirection: 'column', gap: SECTION_GAP, bgcolor: theme.palette.collapse.background }}>
        <PrimarySectionHeader icon={section.left[0]?.icon} title={section.left[0]?.label || ''} />
        <Box sx={{ display: 'flex', width: '100%' }}>
          {/* Columna izquierda */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {(section.left || []).map((item, index) => (
              <EntitySectionRow key={index} icon={item.icon} primary={item.value} secondary={item.subtitle} showLargeCurrency={item.showLargeCurrency} sx={{ minHeight: ROW_MIN_HEIGHT }} />
            ))}
          </Box>
          {/* Separador vertical solo si hay ambas columnas */}
          {hasLeft && hasRight && (
            <Box sx={{ width: SEPARATOR_WIDTH, backgroundColor: SEPARATOR_COLOR, mx: 1 }} />
          )}
          {/* Columna derecha */}
          {hasRight && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {(section.right || []).map((item, index) => (
                <EntitySectionRow key={index} icon={item.icon} primary={item.value} secondary={item.subtitle} showLargeCurrency={item.showLargeCurrency} sx={{ minHeight: ROW_MIN_HEIGHT }} />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <GeometricPaper sx={{ minHeight: SECTION_MIN_HEIGHT, px: SECTION_PADDING_X, py: SECTION_PADDING_Y, display: 'flex', flexDirection: 'column', gap: SECTION_GAP }}>
      <Box sx={{ 
        display: 'flex', 
        height: '100%',
        width: '100%'
      }}>
        {/* Parte izquierda */}
        <Box sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          pr: 1
        }}>
          {(section.left || []).map((item, index) => (
            <EntitySectionRow key={index} icon={item.icon} primary={item.value} secondary={item.subtitle} showLargeCurrency={item.showLargeCurrency} />
          ))}
        </Box>
        {/* Separador vertical solo si hay ambas columnas */}
        {(section.left || []).length > 0 && (section.right || []).length > 0 && (
          <Box sx={{ 
            width: SEPARATOR_WIDTH, 
            backgroundColor: SEPARATOR_COLOR,
            mx: 1
          }} />
        )}
        {/* Parte derecha */}
        {(section.right || []).length > 0 && (
          <Box sx={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            pl: 1
          }}>
            {(section.right || []).map((item, index) => (
              <EntitySectionRow key={index} icon={item.icon} primary={item.value} secondary={item.subtitle} showLargeCurrency={item.showLargeCurrency} />
            ))}
          </Box>
        )}
      </Box>
    </GeometricPaper>
  );
};

// Componente para renderizar sección secundaria
const SecondarySectionRenderer = ({ section, isCollapsed = false }) => {
  if (isCollapsed) return null;

  return (
    <GeometricPaper sx={{ minHeight: SECTION_MIN_HEIGHT, px: SECTION_PADDING_X, py: SECTION_PADDING_Y, display: 'flex', flexDirection: 'column', gap: SECTION_GAP }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: 0,
        height: '100%',
        width: '100%'
      }}>
        {section.data.map((item, itemIndex) => (
          <EntitySectionRow
            key={itemIndex}
            icon={item.icon}
            primary={item.value}
            secondary={item.label}
            showLargeCurrency={item.showLargeCurrency}
          />
        ))}
      </Box>
    </GeometricPaper>
  );
};

// Componente para mostrar secciones estándar organizadas
const StandardSections = ({ sections, gridSize = { xs: 6, sm: 6, md: 6, lg: 6 }, isCollapsed = false, onContratoDetail = null, inquilinos = [], onInquilinoDetail = null, onInventarioClick = null }) => {
  // Secciones estándar
  const seccionesPrimarias = sections.filter(s => s.type === 'primary' && !s.hidden);
  const seccionesSecundarias = sections.filter(s => s.type === 'secondary');
  const seccionesHabitaciones = sections.filter(s => s.type === 'habitaciones');
  // Secciones custom (con campo render) - excluir las que ya están en primarias
  const seccionesCustom = sections.filter(s => typeof s.render === 'function' && s.type !== 'primary');

  return (
    <Box>
      {/* Fila para cada sección primaria */}
      {seccionesPrimarias.map((section, sectionIndex) => (
        <React.Fragment key={`primary-row-${section.type}-${section.left?.[0]?.label || sectionIndex}`}>
          <Box sx={{ p: 0, mb: 0.3 }}>
            {/* Si la sección primaria tiene render, usarlo directamente */}
            {typeof section.render === 'function' ? (
              <Box sx={{ bgcolor: 'transparent', p: 0, m: 0 }}>
                {section.render()}
              </Box>
            ) : (
              <SectionRenderer section={section} isCollapsed={isCollapsed} onContratoDetail={onContratoDetail} inquilinos={inquilinos} onInquilinoDetail={onInquilinoDetail} onInventarioClick={onInventarioClick} />
            )}
          </Box>
          {/* Separador sutil después de secciones primarias */}
          {sectionIndex < seccionesPrimarias.length - 1 && (
            <Box sx={{ 
              height: '1px', 
              bgcolor: 'rgba(255,255,255,0.08)', 
              mx: 1, 
              my: 0.5,
              borderRadius: '0.5px'
            }} />
          )}
        </React.Fragment>
      ))}

      {/* Separador principal entre secciones primarias y habitaciones */}
      {seccionesPrimarias.length > 0 && seccionesHabitaciones.length > 0 && (
        <Box sx={{ 
          height: '1px', 
          bgcolor: 'rgba(255,255,255,0.12)', 
          mx: 1, 
          my: 1,
          borderRadius: '0.5px'
        }} />
      )}

      {/* Fila para cada sección de habitaciones */}
      {seccionesHabitaciones.map((section, sectionIndex) => (
        <React.Fragment key={`habitaciones-row-${sectionIndex}`}>
          <Box sx={{ p: 0, mb: 1 }}>
            <HabitacionesRenderer section={section} isCollapsed={isCollapsed} />
          </Box>
          {/* Separador sutil después de secciones de habitaciones */}
          {sectionIndex < seccionesHabitaciones.length - 1 && (
            <Box sx={{ 
              height: '1px', 
              bgcolor: 'rgba(255,255,255,0.08)', 
              mx: 1, 
              my: 0.5,
              borderRadius: '0.5px'
            }} />
          )}
        </React.Fragment>
      ))}

      {/* Separador principal entre habitaciones y secundarias */}
      {seccionesHabitaciones.length > 0 && seccionesSecundarias.length > 0 && (
        <Box sx={{ 
          height: '1px', 
          bgcolor: 'rgba(255,255,255,0.12)', 
          mx: 1, 
          my: 1,
          borderRadius: '0.5px'
        }} />
      )}

      {/* Fila para cada sección secundaria */}
      {seccionesSecundarias.map((section, sectionIndex) => (
        <React.Fragment key={`secondary-row-${sectionIndex}`}>
          <Box sx={{ p: 0, mb: 1 }}>
            <SecondarySectionRenderer section={section} isCollapsed={isCollapsed} />
          </Box>
          {/* Separador sutil después de secciones secundarias */}
          {sectionIndex < seccionesSecundarias.length - 1 && (
            <Box sx={{ 
              height: '1px', 
              bgcolor: 'rgba(255,255,255,0.08)', 
              mx: 1, 
              my: 0.5,
              borderRadius: '0.5px'
            }} />
          )}
        </React.Fragment>
      ))}

      {/* Separador principal entre secundarias y custom */}
      {seccionesSecundarias.length > 0 && seccionesCustom.length > 0 && (
        <Box sx={{ 
          height: '1px', 
          bgcolor: 'rgba(255,255,255,0.12)', 
          mx: 1, 
          my: 1,
          borderRadius: '0.5px'
        }} />
      )}

      {/* Fila para cada sección custom */}
      {seccionesCustom.map((section, sectionIndex) => (
        <React.Fragment key={`custom-row-${sectionIndex}`}>
          <Box sx={{ p: 0, mb: 1 }}>
            <Box sx={{ bgcolor: 'transparent', p: 0, m: 0 }}>
              {section.render()}
            </Box>
          </Box>
          {/* Separador sutil después de secciones custom */}
          {sectionIndex < seccionesCustom.length - 1 && (
            <Box sx={{ 
              height: '1px', 
              bgcolor: 'rgba(255,255,255,0.08)', 
              mx: 1, 
              my: 0.5,
              borderRadius: '0.5px'
            }} />
          )}
        </React.Fragment>
      ))}
    </Box>
  );
};

// Componente individual para elementos con hover horizontal
const EntityCard = ({ 
  item, 
  config, 
  isCompact = false,
  linkTo = null,
  gridSize = { xs: 6, sm: 6, md: 6, lg: 6 }
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const PaperComponent = isCompact ? CompactPaper : GeometricPaper;
  
  const cardContent = (
    <PaperComponent
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{ cursor: linkTo ? 'pointer' : 'default', minHeight: isCompact ? '40px' : '50px' }}
    >
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: 1,
        height: '100%',
        width: '100%'
      }}>
        {/* Icono a la izquierda */}
        {config.getIcon && (() => {
          const IconComponent = config.getIcon(item);
          if (IconComponent && (typeof IconComponent === 'function' || React.isValidElement(IconComponent))) {
            return (
              <IconComponent 
                sx={{ 
                  fontSize: isCompact ? '1rem' : '1.2rem', 
                  color: config.getIconColor ? config.getIconColor(item) : 'text.primary',
                  flexShrink: 0
                }} 
              />
            );
          } else {
            console.warn(`EntityCard: IconComponent no es válido:`, IconComponent);
            return null;
          }
        })()}
        
        {/* Contenido a la derecha */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 0,
          flex: 1,
          overflow: 'hidden'
        }}>
          {!isHovered ? (
            // Vista normal
            <>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 500,
                  fontSize: isCompact ? '0.6rem' : '0.7rem',
                  lineHeight: 1,
                  m: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {config.getTitle(item)}
              </Typography>
              {config.getSubtitle && (
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                  {config.getSubtitle(item)}
                </Typography>
              )}
            </>
          ) : (
            // Vista hover
            <>
              <Typography variant="body2" sx={{ fontSize: isCompact ? '0.65rem' : '0.7rem', fontWeight: 600, color: 'primary.main' }}>
                {config.getTitle(item)}
              </Typography>
              {config.getHoverInfo && (
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'warning.main' }}>
                  {config.getHoverInfo(item)}
                </Typography>
              )}
            </>
          )}
        </Box>
      </Box>
    </PaperComponent>
  );

  if (linkTo) {
    return (
      <Box component={Link} to={linkTo} sx={{ textDecoration: 'none', color: 'inherit' }}>
        {cardContent}
      </Box>
    );
  }

  return cardContent;
};

// Componente para mostrar elementos en grid con paginación opcional
const EntityGrid = ({ 
  items, 
  config, 
  isCompact = false,
  fixedSlots = null,
  itemsPerPage = null,
  gridSize = { xs: 6, sm: 6, md: 6, lg: 6 },
  emptyMessage = "No hay elementos registrados"
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  
  if (!items || items.length === 0) {
    if (fixedSlots) {
      return (
        <Box sx={{ position: 'relative', minHeight: isCompact ? '104px' : '120px' }}>
          <Grid container spacing={0.3} sx={{ p: 0 }}>
            {Array.from({ length: fixedSlots }).map((_, index) => (
              <Grid item {...gridSize} key={`empty-${index}`}>
                <CompactPaper sx={{ 
                  minHeight: isCompact ? '40px' : '50px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {index === 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                      {emptyMessage}
                    </Typography>
                  )}
                </CompactPaper>
              </Grid>
            ))}
          </Grid>
        </Box>
      );
    }
    
    return (
      <Box sx={{ 
        p: 1.5, 
        textAlign: 'center'
      }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  let displayItems = items;
  let totalPages = 1;

  if (itemsPerPage && fixedSlots) {
    totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = currentPage * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = items.slice(startIndex, endIndex);
    
    // Crear array de elementos fijos, rellenando con null los espacios vacíos
    displayItems = Array.from({ length: fixedSlots }, (_, index) => 
      currentItems[index] || null
    );
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ 
        minHeight: isCompact ? '104px' : '120px',
        paddingRight: totalPages > 1 ? '24px' : '0px'
      }}>
        <Grid container spacing={0.3} sx={{ p: 0 }}>
          {displayItems.map((item, index) => (
            <Grid item {...gridSize} key={item?._id || item?.id || `slot-${index}`}>
              {item ? (
                <EntityCard 
                  item={item} 
                  config={config} 
                  isCompact={isCompact}
                  linkTo={config.getLinkTo ? config.getLinkTo(item) : null}
                />
              ) : (
                <CompactPaper sx={{ 
                  minHeight: isCompact ? '40px' : '50px',
                  backgroundColor: 'transparent',
                  '&:hover': {
                    backgroundColor: 'transparent'
                  }
                }}>
                  {/* Espacio vacío para mantener la estructura */}
                </CompactPaper>
              )}
            </Grid>
          ))}
        </Grid>
      </Box>
      
      {/* Flecha sutil para más elementos */}
      {totalPages > 1 && (
        <Box 
          onClick={handleNextPage}
          sx={{ 
            position: 'absolute',
            right: 0,
            top: '12px',
            width: '20px',
            height: '80px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderLeft: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderColor: 'rgba(255, 255, 255, 0.2)'
            }
          }}
        >
          <Typography 
            sx={{ 
              fontSize: '0.9rem', 
              color: 'text.secondary',
              transform: 'rotate(90deg)',
              userSelect: 'none',
              fontWeight: 400
            }}
          >
            ›
          </Typography>
        </Box>
      )}
      
      {/* Indicador de página */}
      {totalPages > 1 && (
        <Box sx={{ 
          position: 'absolute', 
          bottom: 6, 
          right: 28, 
          display: 'flex', 
          gap: 0.5 
        }}>
          {Array.from({ length: totalPages }).map((_, pageIndex) => (
            <Box
              key={pageIndex}
              sx={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                backgroundColor: pageIndex === currentPage 
                  ? 'text.secondary' 
                  : 'rgba(255, 255, 255, 0.2)',
                transition: 'backgroundColor 0.2s ease'
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

// Componente para mostrar información en grid horizontal
const InfoGrid = ({ data, config, gridSize = { xs: 4, sm: 4, md: 4, lg: 4 } }) => {
  return (
    <Grid container spacing={0.3} sx={{ p: 0 }}>
      {data.map((item, index) => (
        <Grid item {...gridSize} key={index}>
          <GeometricPaper sx={{ minHeight: '50px' }}>
            <EntitySectionRow
              icon={item.icon}
              primary={item.value}
              secondary={item.label}
            />
          </GeometricPaper>
        </Grid>
      ))}
    </Grid>
  );
};

// Carrusel de ambientes (misma UX que Monedas en Finanzas)
const HabitacionesRenderer = ({ section, isCollapsed = false }) => {
  if (isCollapsed) return null;

  const habitaciones = section.habitaciones ?? section.data ?? [];
  const inventarios = section.inventarios ?? [];

  return (
    <Box sx={{ px: 0.125, py: 0.25 }}>
      <HabitacionesCarouselSection
        habitaciones={habitaciones}
        inventarios={inventarios}
        emptyMessage="Sin ambientes"
      />
    </Box>
  );
};

// Componente principal EntityGridView
const PropiedadContent = ({ 
  type = 'list',
  data,
  config,
  title,
  showEmpty = true,
  isCompact = false,
  fixedSlots = null,
  itemsPerPage = null,
  gridSize = { xs: 6, sm: 6, md: 6, lg: 6 },
  emptyMessage = "No hay elementos registrados",
  // Nuevas props para secciones estándar
  sections = null,
  sectionGridSize = { xs: 6, sm: 6, md: 6, lg: 6 },
  isCollapsed = false,
  showCollapseButton = false,
  onToggleCollapse = null,
  // Props para manejo de contratos
  contratos = [],
  onEditContrato = null,
  onDeleteContrato = null,
  inquilinos = [],
  onInventarioClick = null // Nuevo prop para manejar el clic en el botón de inventario
}) => {
  const [collapsed, setCollapsed] = useState(isCollapsed);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState(null);
  const [inquilinoDetailOpen, setInquilinoDetailOpen] = useState(false);
  const [selectedInquilino, setSelectedInquilino] = useState(null);

  const handleToggleCollapse = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    if (onToggleCollapse) {
      onToggleCollapse(newCollapsed);
    }
  };

  const handleContratoDetail = (contratoId) => {
    const contrato = contratos.find(c => c._id === contratoId);
    if (contrato) {
      setSelectedContrato(contrato);
      setDetailOpen(true);
    }
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedContrato(null);
  };

  const handleEditContrato = (contrato) => {
    if (onEditContrato) {
      onEditContrato(contrato);
    }
    handleCloseDetail();
  };

  const handleDeleteContrato = (contratoId) => {
    if (onDeleteContrato) {
      onDeleteContrato(contratoId);
    }
    handleCloseDetail();
  };

  const handleInquilinoDetail = (inquilinoId) => {
    const inq = inquilinos.find(i => i._id === inquilinoId);
    if (inq) {
      setSelectedInquilino(inq);
      setInquilinoDetailOpen(true);
    }
  };

  const handleCloseInquilinoDetail = () => {
    setInquilinoDetailOpen(false);
    setSelectedInquilino(null);
  };

  const renderContent = () => {
    switch (type) {
      case 'list':
        return (
          <EntityGrid 
            items={data} 
            config={config}
            isCompact={isCompact}
            fixedSlots={fixedSlots}
            itemsPerPage={itemsPerPage}
            gridSize={gridSize}
            emptyMessage={emptyMessage}
          />
        );
      case 'info':
        return <InfoGrid data={data} config={config} gridSize={gridSize} />;
      case 'sections':
        return <StandardSections sections={sections} gridSize={sectionGridSize} isCollapsed={collapsed} onContratoDetail={handleContratoDetail} inquilinos={inquilinos} onInquilinoDetail={handleInquilinoDetail} onInventarioClick={onInventarioClick} />;
      case 'habitaciones':
        return <HabitacionesRenderer section={data} isCollapsed={collapsed} />;
      default:
        return (
          <Box sx={{ 
            p: 1.5, 
            textAlign: 'center'
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              Tipo de vista no reconocido: {type}
            </Typography>
          </Box>
        );
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header con título y botón de colapsar */}
      {(title || showCollapseButton) && (
        <Box sx={{ 
          mb: 1, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          {title && (
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          )}
          {showCollapseButton && (
            <IconButton
              onClick={handleToggleCollapse}
              size="small"
              sx={{ 
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }
              }}
            >
              {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
            </IconButton>
          )}
        </Box>
      )}
      
      {/* Contenido */}
      {renderContent()}
      
      {/* Popup de detalle de contrato */}
      {selectedContrato && (
        <ContratoDetail
          open={detailOpen}
          onClose={handleCloseDetail}
          contrato={selectedContrato}
          onEdit={handleEditContrato}
          onDelete={handleDeleteContrato}
          relatedData={{}}
        />
      )}
      {/* Popup de detalle de inquilino */}
      {selectedInquilino && (
        <InquilinoDetail
          open={inquilinoDetailOpen}
          onClose={handleCloseInquilinoDetail}
          inquilino={selectedInquilino}
        />
      )}
    </Box>
  );
};

export default PropiedadContent;
export { 
  PropiedadContent,
  EntityCard, 
  EntityGrid, 
  InfoGrid, 
  StandardSections, 
  SectionRenderer, 
  SecondarySectionRenderer, 
  HabitacionesRenderer,
  GeometricPaper, 
  CompactPaper, 
  GeometricChip, 
  EntityHeader,
  SECTION_CONFIGS,
  formatCompactNumber,
  SECTION_PADDING_X,
  crearSeccionesPropiedad // <-- Agregado aquí
}; 

// --- INICIO: Definición de crearSeccionesPropiedad ---
const crearSeccionesPropiedad = (propiedad, precio, simboloMoneda, nombreCuenta, moneda, habitaciones, contratos, documentos = [], extendida = false) => {
  let secciones = [
    {
      type: 'primary',
      render: () => <SeccionUbicacion propiedad={propiedad} />
    }
  ];
  if (extendida) {
    if (habitaciones && habitaciones.length > 0) {
      secciones.push({
        type: 'primary',
        render: () => <SeccionHabitaciones habitaciones={habitaciones} />
      });
    }
  }
  const documentosCompletos = [
    ...(documentos || []),
    ...(contratos || []).map(contrato => ({
      ...contrato,
      categoria: 'CONTRATO',
      inquilino: contrato.inquilino || (Array.isArray(propiedad?.inquilinos) ? propiedad.inquilinos : []),
      url: contrato.documentoUrl || `/contratos/${contrato._id}`
    }))
  ];
  secciones.push({
    type: 'primary',
    render: () => <SeccionDocumentos documentos={documentosCompletos} propiedad={propiedad} />
  });
  return secciones;
};
// --- FIN: Definición de crearSeccionesPropiedad ---

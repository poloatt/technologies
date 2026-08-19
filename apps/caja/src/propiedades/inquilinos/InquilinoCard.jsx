import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Divider,
  LinearProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Email as EmailIcon,
  Phone as PhoneIcon,
  Badge as BadgeIcon,
  Home as HomeIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  OpenInNew as OpenIcon,
  CalendarToday as CalendarIcon,
  Description as ContractIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckIcon,
  PendingActions as PendingIcon,
  BookmarkAdded as ReservedIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import InquilinoDetail from './InquilinoDetail';
import { ContratoDetail } from '../contratos';
import { getEstadoColor, getEstadoText, getEstadoIcon, getStatusIconComponent } from '@shared/components/common/StatusSystem';
import CommonHeader from '@shared/components/common/CommonHeader';
import EstadoIcon from '@shared/components/common/EstadoIcon';
import { CallButton, SmsButton, EmailButton } from '@shared/components/common/CommonActions';
import TipoPropiedadIcon from '../TipoPropiedadIcon';
import { formatFecha } from '@shared/utils/contratoUtils';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PropiedadDetail from '../PropiedadDetail';
import AgregarContratoButton from '../contratos/AgregarContratoButton';

// Componentes estilizados siguiendo la estética geométrica
const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: 0,
  borderWidth: '1px 0 1px 0',
  borderStyle: 'solid',
  borderColor: theme.palette.divider,
  backgroundColor: '#181818',
  transition: 'all 0.2s ease',
  position: 'relative',
  overflow: 'hidden',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
  }
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  borderRadius: '50%',
  width: 48,
  height: 48,
  backgroundColor: theme.palette.primary.main,
  fontSize: '1rem',
  fontWeight: 600
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  borderRadius: 0,
  padding: theme.spacing(0.5),
  color: theme.palette.text.secondary,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.primary.main
  }
}));



const InfoRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 0),
  '& .MuiSvgIcon-root': {
    fontSize: 16,
    color: theme.palette.text.secondary,
    flexShrink: 0
  }
}));

const ActionBar = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 8,
  right: 8,
  display: 'flex',
  gap: 2,
  backgroundColor: '#181818',
  border: '1px solid',
  borderColor: theme.palette.divider,
  padding: theme.spacing(0.25),
  borderRadius: 0
}));

const InquilinoCard = ({ 
  inquilino, 
  onEdit, 
  onDelete,
  onCreateContract,
  showActions = true
}) => {
  const navigate = useNavigate();
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [contratoDetailOpen, setContratoDetailOpen] = React.useState(false);
  const [propiedadDetailOpen, setPropiedadDetailOpen] = React.useState(false);
  
  const {
    _id,
    nombre,
    apellido,
    email,
    telefono,
    dni,
    estadoActual = 'PENDIENTE',
    contratosClasificados = {}
  } = inquilino;

  const getStatusIcon = (status) => {
    const statusIcons = {
      'ACTIVO': CheckIcon,
      'RESERVADO': ReservedIcon,
      'PENDIENTE': PendingIcon,
      'INACTIVO': PersonIcon
    };
    return statusIcons[status] || PersonIcon;
  };

  const getStatusColor = (status) => {
    return getEstadoColor(status, 'INQUILINO');
  };

  const getInitials = () => {
    return `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase();
  };

  // Función para formatear la duración del contrato
  const formatContratoDuration = (fechaInicio, fechaFin) => {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const diffTime = Math.abs(fin - inicio);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffMonths / 12);
    
    if (diffYears > 0) {
      return `${diffYears} año${diffYears > 1 ? 's' : ''}`;
    } else if (diffMonths > 0) {
      return `${diffMonths} mes${diffMonths > 1 ? 'es' : ''}`;
    } else {
      return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
    }
  };

  // Obtener el contrato activo o más reciente
  const getContratoActual = () => {
    if (contratosClasificados.activos?.length > 0) {
      return contratosClasificados.activos[0];
    }
    if (contratosClasificados.futuros?.length > 0) {
      return contratosClasificados.futuros[0];
    }
    if (contratosClasificados.vencidos?.length > 0) {
      return contratosClasificados.vencidos[0];
    }
    return null;
  };

  // Función para navegar al contrato
  const handleContratoClick = (contrato) => {
    navigate('/contratos', { 
      state: { 
        editContract: true, 
        contratoId: contrato._id 
      } 
    });
  };

  const contratoActual = getContratoActual();

  const handleOpenDetail = () => {
    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
  };

  return (
    <>
      <StyledPaper
        elevation={0}
        sx={theme => ({
          pb: 0.5,
          pt: 1.5,
          px: 2.5,
          minWidth: 420,
          maxWidth: 700,
          width: '100%',
          height: 'auto',
          borderTop: estadoActual === 'ACTIVO'
            ? `3px solid ${getStatusColor(estadoActual)}`
            : `1px solid ${theme.palette.divider}`,
          borderBottom: `1px solid ${theme.palette.divider}`,
          mb: 2
        })}
        onClick={handleOpenDetail}
        style={{ cursor: 'pointer' }}
      >
        {/* Contenido Principal */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1, pr: 0, alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <CommonHeader
              icon={EstadoIcon}
              iconProps={{ estado: estadoActual, tipo: 'INQUILINO', sx: { fontSize: 22, mr: 1 } }}
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{`${nombre} ${apellido}`}</span>
                  <OpenInNewIcon
                    sx={{ fontSize: 18, cursor: 'pointer', color: 'text.secondary', borderRadius: 0, p: 0.2, '&:hover': { color: 'primary.main', background: 'transparent' } }}
                    onClick={e => { e.stopPropagation(); handleOpenDetail(); }}
                  />
                </Box>
              }
              subtitle={
                contratoActual && contratoActual.fechaInicio && contratoActual.fechaFin && contratoActual.propiedad ?
                  `${formatContratoDuration(contratoActual.fechaInicio, contratoActual.fechaFin)} en ${contratoActual.propiedad.alias || contratoActual.propiedad.nombre || 'Propiedad'}`
                  : ''
              }
              titleSize="subtitle1"
              titleWeight={600}
              gap={1}
            />
            {!contratoActual && onCreateContract && (
              <Box sx={{ mt: 0.75 }} onClick={(e) => e.stopPropagation()}>
                <AgregarContratoButton
                  onClick={() => onCreateContract(inquilino)}
                />
              </Box>
            )}
          </Box>
          {/* Iconos de contacto en el margen superior derecho */}
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.2 }}>
            <CallButton phone={telefono} disabled={!telefono} size="small" onClick={e => e.stopPropagation()} sx={{ p: 0.5, fontSize: 16 }} />
            <SmsButton phone={telefono} disabled={!telefono} size="small" onClick={e => e.stopPropagation()} sx={{ p: 0.5, fontSize: 16 }} />
            <EmailButton email={email} disabled={!email} size="small" onClick={e => e.stopPropagation()} sx={{ p: 0.5, fontSize: 16 }} />
          </Box>
        </Box>
      </StyledPaper>

      {/* Popup de detalle */}
      <InquilinoDetail
        open={detailOpen}
        onClose={handleCloseDetail}
        inquilino={inquilino}
        onEdit={onEdit}
        onDelete={onDelete}
        onCreateContract={onCreateContract}
      />
      {/* Modal de detalle de contrato */}
      {contratoActual && (
        <ContratoDetail
          open={contratoDetailOpen}
          onClose={() => setContratoDetailOpen(false)}
          contrato={contratoActual}
          onEdit={() => { setContratoDetailOpen(false); navigate('/contratos', { state: { editContract: true, contratoId: contratoActual._id } }); }}
          onDelete={() => setContratoDetailOpen(false)}
        />
      )}
      {/* Modal de detalle de propiedad */}
      {contratoActual && contratoActual.propiedad && (
        <PropiedadDetail
          open={propiedadDetailOpen}
          onClose={() => setPropiedadDetailOpen(false)}
          propiedad={contratoActual.propiedad}
        />
      )}
    </>
  );
};

export default InquilinoCard; 

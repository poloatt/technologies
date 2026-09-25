import React from 'react';
import { Box, Typography, Paper, IconButton, Dialog, Button, Accordion, AccordionSummary } from '@mui/material';
import { getStatusIconComponent, getEstadoColor, getEstadoText } from './StatusSystem';
import { styled } from '@mui/material/styles';
import useResponsive from '../../hooks/useResponsive';
import CloseIcon from '@mui/icons-material/Close';
import CommonActions from './CommonActions';
import { CollapseIconButton } from './SystemButtons';

export const EstadoChip = ({ estado, tipo = 'PROPIEDAD', sx = {} }) => (
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

// Estilo geométrico para papeles
export const GeometricPaper = styled(Paper)(({ theme }) => ({
  borderRadius: 0,
  padding: theme.spacing(1.5),
  border: 'none',
  backgroundColor: theme.palette.collapseHeader.background,
  boxShadow: '0 1px 0 0 rgba(0,0,0,0.18)',
  borderBottom: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: theme.palette.collapseHeader.background,
  }
}));

// Header geométrico para modales
export const GeometricModalHeader = ({
  icon: Icon,
  title,
  chip,
  onClose,
  children
}) => {
  const { theme } = useResponsive();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0, mt: 0, backgroundColor: theme.palette.collapseHeader.background, p: 2, pb: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {Icon && <Icon sx={{ fontSize: 32, color: 'primary.main' }} />}
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '1.05rem', color: theme.palette.text.primary }}>
            {title}
          </Typography>
          {children}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {chip}
        {onClose && (
          <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>
    </Box>
  );
};

// Dialog geométrico reutilizable
export const GeometricDialog = ({
  open,
  onClose,
  fullScreen = false,
  maxWidth = 'md',
  fullWidth = true,
  actions = null, // acciones para el footer (ej: <CommonActions ... />)
  children,
  ...rest
}) => {
  const { theme } = useResponsive();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      fullScreen={fullScreen}
      PaperProps={{
        sx: {
          borderRadius: 0,
          backgroundColor: theme.palette.background.default,
          minHeight: fullScreen ? '100vh' : 'auto',
          color: theme.palette.text.primary,
        }
      }}
      {...rest}
    >
      {children}
      {/* Footer modular: acciones a la izquierda, cerrar a la derecha */}
      <Box sx={{ p: 2, pt: 1, borderTop: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.default, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>{actions}</Box>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 0 }}>
          Cerrar
        </Button>
      </Box>
    </Dialog>
  );
};

export { styled };
export { CommonActions };

export const StyledAccordion = styled(Accordion)(({ theme }) => ({
  borderRadius: 0,
  backgroundColor: theme.palette.collapse.background,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: 'none',
  margin: 0,
  marginLeft: 0,
  marginRight: 0,
  '&:before': {
    display: 'none'
  },
  '&.Mui-expanded': {
    margin: 0
  },
  '& + &': {
    marginTop: 0 // Eliminar margen entre accordions consecutivos
  }
}));

export const StyledAccordionSummary = styled(AccordionSummary)(({ theme }) => ({
  borderRadius: 0,
  backgroundColor: theme.palette.collapseHeader.background,
  minHeight: 8,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  paddingTop: 2,
  paddingBottom: 2,
  paddingLeft: 8,
  paddingRight: 8,
  '&.Mui-expanded': {
    minHeight: 8
  },
  '& .MuiAccordionSummary-content': {
    margin: '4px 0',
  },
  '& .MuiAccordionSummary-content.Mui-expanded': {
    margin: '4px 0',
  },
}));

// Sección de detalle reutilizable con título, ícono y children
export const EntityDetailSection = ({ icon: Icon, title, children, color = 'primary.main', sx = {} }) => (
  <GeometricPaper sx={{ ...sx }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      {Icon && <Icon sx={{ fontSize: '1.2rem', color }} />}
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
    </Box>
    <Box>{children}</Box>
  </GeometricPaper>
);

// Grid de información reutilizable para detalles
export const EntityDetailGrid = ({ children, spacing = 2 }) => (
  <Box sx={{ width: '100%' }}>
    <Box component="div" sx={{ display: 'flex', flexDirection: 'column', gap: spacing }}>{children}</Box>
  </Box>
);

// Sección colapsable reutilizable para detalles
export const CollapsibleSection = ({
  title,
  icon: Icon,
  children,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onToggle,
  actions = null,
  sx = {},
}) => {
  const [localExpanded, setLocalExpanded] = React.useState(defaultExpanded);
  const expanded = controlledExpanded !== undefined ? controlledExpanded : localExpanded;
  const handleToggle = () => {
    if (onToggle) onToggle();
    else setLocalExpanded(e => !e);
  };
  return (
    <StyledAccordion expanded={expanded} onChange={handleToggle} sx={sx}>
      <StyledAccordionSummary expandIcon={<CollapseIconButton expanded={expanded} />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {Icon && <Icon sx={{ fontSize: '1.1rem', color: 'primary.main' }} />}
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>{title}</Typography>
        </Box>
        {actions && <Box sx={{ ml: 2 }}>{actions}</Box>}
      </StyledAccordionSummary>
      <Box sx={{ p: 1.2 }}>{children}</Box>
    </StyledAccordion>
  );
};

// Renderizador modular de secciones colapsables para detalles
export const EntityDetailSections = ({ sections }) => {
  const [expandedKey, setExpandedKey] = React.useState(
    sections.find(s => s.defaultExpanded)?.key || sections[0]?.key
  );
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.125 }}>
      {sections.map((section, idx) => (
        <CollapsibleSection
          key={section.key || section.title || idx}
          title={section.title}
          icon={section.icon}
          defaultExpanded={false}
          expanded={expandedKey === (section.key || idx)}
          onToggle={() => setExpandedKey(expandedKey === (section.key || idx) ? null : (section.key || idx))}
          actions={section.actions}
        >
          {section.children}
        </CollapsibleSection>
      ))}
    </Box>
  );
};

const EntityDetails = ({ 
  title, 
  children, 
  action,
  elevation = 0,
  showTitle = false,
  fill = false,
}) => {
  return (
    <Paper 
      elevation={elevation}
      sx={{ 
        backgroundColor: 'background.default',
        height: '100%',
        border: 'none',
        ...(fill ? {
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        } : null),
      }}
    >
      {showTitle && (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 2,
          flexShrink: 0,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Typography 
            variant="subtitle2" 
            sx={{ 
              color: 'text.secondary',
              fontWeight: 500
            }}
          >
            {title}
          </Typography>
          {action && (
            <Box>
              {action}
            </Box>
          )}
        </Box>
      )}
      <Box sx={{ 
        p: 1,
        minHeight: fill ? 0 : 100,
        ...(fill ? {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        } : null),
      }}>
        {children || (
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary',
              textAlign: 'center',
              py: 4
            }}
          >
            No hay datos para mostrar
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default EntityDetails;

import React from 'react';
import { Box, Typography } from '@mui/material';
import EstadoIcon from './EstadoIcon';
import { getEstadoColor, getEstadoText } from './StatusSystem';
import { FONT_SIZE } from '../../tipografia';

const CommonHeader = ({
  icon: Icon,
  iconProps = {},
  title,
  subtitle,
  estado,
  tipo = 'PROPIEDAD',
  showEstado = true,
  iconSize = '1.1rem',
  titleSize = 'subtitle1',
  titleWeight = 500,
  gap = 1,
  actions = null,
  ...props
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap, ...props }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap }}>
      {Icon && (typeof Icon === 'function' || React.isValidElement(Icon)) && (
        <Icon {...iconProps} sx={{ fontSize: iconSize, ...iconProps.sx }} />
      )}
      <Box>
        <Typography
          variant={titleSize}
          sx={{
            fontWeight: titleWeight,
            fontSize: titleSize === 'subtitle1' ? FONT_SIZE.base : undefined,
            lineHeight: titleSize === 'subtitle1' ? 1.2 : undefined
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
    {showEstado && estado && (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.5,
          fontSize: FONT_SIZE.sm,
          color: getEstadoColor(estado, tipo),
          bgcolor: 'transparent',
          borderRadius: 0,
          fontWeight: 600,
          height: 24,
          minWidth: 'fit-content'
        }}
      >
        <EstadoIcon estado={estado} tipo={tipo} />
      </Box>
    )}
    {actions}
  </Box>
);

export default CommonHeader; 

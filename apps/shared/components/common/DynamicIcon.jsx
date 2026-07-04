import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { icons, getIconByKey } from '../../navigation/menuIcons';
import { getIconByName } from '../../utils/iconConfig';
import { ICON_SIZES, TRANSITIONS } from '../../config/uiConstants';

/**
 * Componente reutilizable para renderizado dinámico de iconos
 * Elimina duplicación de React.createElement en múltiples componentes
 */

/**
 * Renderiza un icono dinámicamente
 * @param {Object} props - Props del componente
 * @param {string} props.iconKey - Clave del icono en menuIcons.js
 * @param {string} props.size - Tamaño del icono ('small', 'medium', 'large')
 * @param {Object} props.sx - Estilos personalizados
 * @param {string} props.color - Color del icono
 * @param {Function} props.onClick - Función onClick (opcional)
 * @param {React.Component} props.component - Componente wrapper (opcional)
 * @returns {React.Element|null} - Elemento del icono o null
 */
export function DynamicIcon({ 
  iconKey, 
  size = ICON_SIZES.small, 
  sx = {}, 
  color,
  onClick,
  component,
  ...otherProps 
}) {
  // Obtener el componente del icono (menuIcons camelCase o habitIcons PascalCase)
  const IconComponent = typeof iconKey === 'string'
    ? (icons[iconKey] || getIconByName(iconKey) || getIconByKey(iconKey))
    : null;

  if (!IconComponent) {
    console.warn(`DynamicIcon: No se pudo obtener icono para iconKey:`, iconKey);
    return null;
  }

  const iconProps = {
    fontSize: size,
    sx: {
      color,
      ...sx
    },
    ...otherProps
  };

  const iconElement = React.createElement(IconComponent, iconProps);

  // Si hay un componente wrapper, úsalo
  if (component) {
    if (typeof component === 'function' || React.isValidElement(component)) {
      return React.createElement(component, { onClick, ...otherProps }, iconElement);
    } else {
      console.warn(`DynamicIcon: component no es válido:`, component);
      return iconElement;
    }
  }

  // Si hay onClick pero no component, usar Box
  if (onClick) {
    return (
      <Box
        onClick={onClick}
        sx={{
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...sx
        }}
        {...otherProps}
      >
        {iconElement}
      </Box>
    );
  }

  return iconElement;
}

/**
 * Icono clickeable con tooltip (patrón común en Toolbar y Sidebar)
 * @param {Object} props - Props del componente
 * @param {string} props.iconKey - Clave del icono
 * @param {string} props.title - Título para el tooltip
 * @param {Function} props.onClick - Función onClick
 * @param {boolean} props.isActive - Si está activo
 * @param {boolean} props.disabled - Si está deshabilitado
 * @param {string} props.size - Tamaño del IconButton
 * @returns {React.Element} - IconButton con tooltip
 */
export const ClickableIcon = React.forwardRef(({
  iconKey,
  title,
  onClick,
  isActive = false,
  disabled = false,
  size = 'small',
  sx = {},
  ...otherProps
}, ref) => {
  const IconComponent = getIconByKey(iconKey);
  
  if (!IconComponent) {
    console.warn(`ClickableIcon: No se pudo obtener icono para iconKey:`, iconKey);
    return null;
  }

  const buttonSx = {
    bgcolor: isActive ? 'action.selected' : 'transparent',
    color: isActive ? 'primary.main' : 'text.secondary',
    borderRadius: 1,
    transition: TRANSITIONS.colorChange,
    '&:hover': {
      color: 'primary.main',
      bgcolor: 'action.hover',
    },
    // Aplicar padding personalizado si se proporciona
    ...(sx.padding && { padding: sx.padding }),
    ...sx
  };

  return (
    <Tooltip title={title}>
      <span style={{ display: 'inline-flex' }}>
        <IconButton
          ref={ref}
          onClick={onClick}
          size={size}
          disabled={disabled || isActive}
          sx={buttonSx}
          {...otherProps}
        >
          <DynamicIcon iconKey={iconKey} size="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
});

/**
 * Icono con texto (patrón usado en Toolbar para módulo activo)
 * @param {Object} props - Props del componente
 * @param {string} props.iconKey - Clave del icono
 * @param {string} props.text - Texto a mostrar
 * @param {Function} props.onClick - Función onClick
 * @param {Object} props.sx - Estilos personalizados
 * @returns {React.Element} - Box con icono y texto
 */
export const IconWithText = React.forwardRef(({
  iconKey,
  text,
  onClick,
  sx = {},
  textSx = {},
  ...otherProps
}, ref) => {
  return (
    <Box
      ref={ref}
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        cursor: onClick ? 'pointer' : 'default',
        transition: TRANSITIONS.colorChange,
        '&:hover': onClick ? {
          color: 'primary.main',
        } : {},
        ...sx
      }}
      {...otherProps}
    >
      <DynamicIcon iconKey={iconKey} size="small" />
      {text && (
        <span style={{ 
          fontWeight: 500, 
          fontSize: '0.75rem',
          ...textSx 
        }}>
          {text}
        </span>
      )}
    </Box>
  );
});

/**
 * Hook para verificar si un icono existe
 * @param {string} iconKey - Clave del icono
 * @returns {boolean} - True si el icono existe
 */
export function useIconExists(iconKey) {
  return !!(icons[iconKey] || getIconByKey(iconKey));
}

export default DynamicIcon; 
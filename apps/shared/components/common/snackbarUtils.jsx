import React, { createRef } from 'react';
import { SnackbarProvider, useSnackbar } from 'notistack';
import { NEGATIVE_COLOR } from '../../config/uiConstants';
import { FONT_SIZE } from '../../tipografia';

/**
 * Referencia al proveedor SnackbarProvider para usar en utilidades globales
 */
const notistackRef = createRef();

/**
 * Acciones personalizadas por defecto para las notificaciones
 * @returns Componente de acción de cierre para todas las notificaciones
 */
const onSnackbarDismiss = key => () => {
  notistackRef.current.closeSnackbar(key);
};

/**
 * Objeto de utilidades para mostrar notificaciones desde cualquier parte de la aplicación
 * sin necesidad de usar el hook useSnackbar
 */
export const SnackbarUtilsConfigurator = () => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  /**
   * Función para mostrar una notificación con estilo personalizado
   * @param {string} message Mensaje a mostrar
   * @param {object} options Opciones adicionales
   * @returns ID de la notificación
   */
  const showNotification = (message, options = {}) => {
    const variant = options.variant || 'default';
    const className = `snackbar-${variant}`;
    
    // Opciones por defecto con estilo exacto del Footer - Centrado en el contenedor de 32px
    const defaultOptions = {
      className,
      style: {
        position: 'fixed',
        bottom: '32px',
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: '100%',
        height: '24px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: 400,
        fontSize: FONT_SIZE.sm,
        lineHeight: 1,
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        border: variant === 'success' ? '1px solid #4caf50' :
                variant === 'error' ? `1px solid ${NEGATIVE_COLOR}` :
                variant === 'warning' ? '1px solid #ff9800' :
                variant === 'info' ? '1px solid #2196f3' : '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 0,
        clipPath: 'none',
        boxShadow: 'none',
        backdropFilter: 'none',
        pointerEvents: 'auto',
        margin: 0,
        zIndex: 1202,
        transition: 'opacity 0.5s ease, transform 0.5s ease',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        boxSizing: 'border-box'
      },
      preventDuplicate: true,
      autoHideDuration: 4000
    };
    
    // Combinar opciones
    const finalOptions = { ...defaultOptions, ...options };
    
    return enqueueSnackbar(message, finalOptions);
  };
  
  // Asignar funciones a la utilidad global
  window.snackbar = {
    success: (msg, options) => showNotification(msg, { ...options, variant: 'success' }),
    warning: (msg, options) => showNotification(msg, { ...options, variant: 'warning' }),
    info: (msg, options) => showNotification(msg, { ...options, variant: 'info' }),
    error: (msg, options) => showNotification(msg, { ...options, variant: 'error' }),
    show: showNotification,
    close: closeSnackbar
  };
  
  return null;
};

/**
 * Componente SnackbarProvider personalizado con referencia configurada
 * Posicionado como chip en el centro del Footer (4px desde el bottom)
 * @param {object} props Propiedades del componente
 * @returns Componente SnackbarProvider personalizado
 */
export const CustomSnackbarProvider = props => {
  return (
    <SnackbarProvider
      ref={notistackRef}
      maxSnack={3}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      autoHideDuration={4000}
      style={{ 
        marginBottom: '0px',
        pointerEvents: 'none',
        zIndex: 1202
      }}
      dense
      preventDuplicate
      classes={{
        variantSuccess: 'snackbar-success',
        variantError: 'snackbar-error',
        variantWarning: 'snackbar-warning',
        variantInfo: 'snackbar-info',
        variantDefault: 'snackbar-default',
        contentRoot: 'snackbar-content-root'
      }}
      {...props}
    >
      {props.children}
      <SnackbarUtilsConfigurator />
    </SnackbarProvider>
  );
};

// Exportar funciones de utilidad global para usar en archivos que no tienen acceso a hooks
export const snackbar = {
  success: (msg, options = {}) => {
    if (window.snackbar) window.snackbar.success(msg, options);
  },
  warning: (msg, options = {}) => {
    if (window.snackbar) window.snackbar.warning(msg, options);
  },
  info: (msg, options = {}) => {
    if (window.snackbar) window.snackbar.info(msg, options);
  },
  error: (msg, options = {}) => {
    if (window.snackbar) window.snackbar.error(msg, options);
  },
  show: (msg, options = {}) => {
    if (window.snackbar) window.snackbar.show(msg, options);
  },
  close: key => {
    if (window.snackbar) window.snackbar.close(key);
  }
};

// Export default para compatibilidad con imports default
export default CustomSnackbarProvider; 

// Configuración centralizada para MercadoPago
export const MERCADOPAGO_CONFIG = {
  // URLs de redirección por ambiente
  redirectURIs: {
    development: 'http://localhost:5173/mercadopago/callback',
    production: 'https://caja.attadia.com/mercadopago/callback'
  },
  
  // Colores de marca
  colors: {
    primary: '#009ee3',
    secondary: '#ff6b35',
    success: '#00a650',
    error: '#ff4444'
  },
  
  // Configuración de sincronización
  sync: {
    defaultFrequency: 'DIARIA',
    maxRetries: 3,
    retryDelay: 5000, // 5 segundos
    timeout: 30000 // 30 segundos
  },
  
  // Estados de transacciones
  transactionStates: {
    approved: 'COMPLETADA',
    pending: 'PENDIENTE',
    in_process: 'PENDIENTE',
    rejected: 'CANCELADA',
    cancelled: 'CANCELADA',
    refunded: 'CANCELADA'
  },
  
  // Tipos de pago
  paymentTypes: {
    credit_card: 'Tarjeta de crédito',
    debit_card: 'Tarjeta de débito',
    bank_transfer: 'Transferencia bancaria',
    cash: 'Efectivo',
    atm: 'Cajero automático'
  }
};

// Función para obtener la URL de redirección según el ambiente
export const getRedirectURI = () => {
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  console.log('🔵 [MercadoPago] getRedirectURI - hostname:', hostname, 'port:', port);
  
  let redirectURI;
  if (hostname === 'localhost' || hostname.includes('127.0.0.1')) {
    // En desarrollo, usar el puerto actual dinámicamente
    redirectURI = `http://localhost:${port}/mercadopago/callback`;
  } else if (hostname === 'caja.attadia.com' ||
             hostname === 'atta.attadia.com' ||
             hostname === 'foco.attadia.com' ||
             hostname === 'pulso.attadia.com') {
    redirectURI = MERCADOPAGO_CONFIG.redirectURIs.production;
  } else {
    // Fallback: usar puerto actual o 5173 por defecto
    redirectURI = `http://localhost:${port || '5173'}/mercadopago/callback`;
  }
  
  console.log('🔵 [MercadoPago] getRedirectURI - redirectURI:', redirectURI);
  
  return redirectURI;
};

// Habilitar MercadoPago (producción o modo desarrollo forzado)
export const isMercadoPagoEnabled = () => {
  try {
    // Producción siempre habilitado
    if (import.meta.env.PROD) {
      console.log('🔵 [MercadoPago] isMercadoPagoEnabled: PROD=true → enabled');
      return true;
    }

    // Desarrollo: detectar localhost
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1' ||
       window.location.hostname.includes('127.0.0.1'));
    
    if (isLocalhost) {
      console.log('🔵 [MercadoPago] isMercadoPagoEnabled: localhost detected → enabled');
      return true;
    }

    // 1) Bandera de Vite (por si alguien la configura)
    const devFlag = import.meta?.env?.VITE_MP_DEV;
    if (devFlag === '1' || devFlag === 'true') {
      console.log('🔵 [MercadoPago] isMercadoPagoEnabled: VITE_MP_DEV=true → enabled');
      return true;
    }

    // 2) Query param ?mpdev=1 para habilitar al vuelo
    const params = new URLSearchParams(window.location.search);
    if (params.get('mpdev') === '1' || params.get('mpdev') === 'true') {
      try { localStorage.setItem('MP_DEV', '1'); } catch {}
      console.log('🔵 [MercadoPago] isMercadoPagoEnabled: query param=true → enabled');
      return true;
    }

    // 3) LocalStorage persistente
    const ls = (() => { try { return localStorage.getItem('MP_DEV'); } catch { return null; } })();
    if (ls === '1' || ls === 'true') {
      console.log('🔵 [MercadoPago] isMercadoPagoEnabled: localStorage=true → enabled');
      return true;
    }

    console.warn('⚠️ [MercadoPago] isMercadoPagoEnabled: disabled (use ?mpdev=1 to enable)');
    return false;
  } catch (error) {
    console.error('❌ [MercadoPago] isMercadoPagoEnabled: error', error);
    return false;
  }
};

// Función para mapear estado de MercadoPago a estado interno
export const mapTransactionState = (mpState) => {
  return MERCADOPAGO_CONFIG.transactionStates[mpState] || 'PENDIENTE';
};

// Función para formatear descripción de transacción
export const formatTransactionDescription = (payment) => {
  let description = `MercadoPago - ${MERCADOPAGO_CONFIG.paymentTypes[payment.payment_method?.type] || 'Pago'}`;
  
  if (payment.description) {
    description += ` - ${payment.description}`;
  }
  
  if (payment.external_reference) {
    description += ` (Ref: ${payment.external_reference})`;
  }
  
  return description;
}; 
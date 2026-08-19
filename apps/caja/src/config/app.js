// Configuración específica para Caja
export const cajaConfig = {
  name: 'Caja',
  title: 'Caja',
  description: 'Aplicación para gestión de propiedades y finanzas',
  
  // Puerto de desarrollo
  port: 5174,
  
  // Tema y colores
  theme: {
    primary: '#4caf50',
    name: 'green',
    mode: 'light'
  },
  
  // URLs específicas
  urls: {
    development: 'http://localhost:5174',
    production: 'https://caja.attadia.com'
  },
  
  // Rutas principales de la app
  defaultRoute: '/finanzas',
  routes: {
    finanzas: '/finanzas',
    propiedades: '/propiedades',
    transacciones: '/finanzas/transacciones',
    cuentas: '/finanzas/cuentas',
    inquilinos: '/propiedades/inquilinos',
    contratos: '/propiedades/contratos'
  },
  
  // Features habilitadas
  features: {
    finanzas: true,
    propiedades: true,
    transacciones: true,
    cuentas: true,
    monedas: true,
    inversiones: true,
    deudores: true,
    recurrente: true,
    inquilinos: true,
    contratos: true,
    inventario: true,
    autos: true,
    mercadopago: true,
    analytics: true,
    notifications: true
  }
}

export default cajaConfig

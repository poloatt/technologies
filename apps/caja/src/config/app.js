// Configuración específica para Caja
export const cajaConfig = {
  name: 'Caja',
  title: 'Caja',
  description: 'Aplicación para gestión de propiedades y finanzas',

  port: 5174,

  theme: {
    primary: '#4caf50',
    name: 'green',
    mode: 'light'
  },

  urls: {
    development: 'http://localhost:5174',
    production: 'https://caja.attadia.com'
  },

  defaultRoute: '/finanzas',
  routes: {
    finanzas: '/finanzas',
    propiedades: '/propiedades',
    transacciones: '/finanzas/transacciones',
    cuentas: '/finanzas/cuentas',
    inquilinos: '/propiedades/inquilinos',
    contratos: '/propiedades/contratos'
  },

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

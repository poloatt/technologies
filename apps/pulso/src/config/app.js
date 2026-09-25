// Configuración específica para Pulso
export const pulsoConfig = {
  name: 'Pulso',
  title: 'Pulso',
  description: 'Aplicación para monitoreo de salud y bienestar',
  
  // Puerto de desarrollo
  port: 5175,
  
  // Tema y colores
  theme: {
    primary: '#ff9800',
    name: 'orange',
    mode: 'light'
  },
  
  // URLs específicas
  urls: {
    development: 'http://localhost:5175',
    production: 'https://pulso.attadia.com'
  },
  
  // Rutas principales de la app
  defaultRoute: '/datacorporal',
  routes: {
    datacorporal: '/datacorporal',
    dieta: '/dieta',
    lab: '/lab',
    salud: '/salud'
  },
  
  // Features habilitadas
  features: {
    datacorporal: true,
    dieta: true,
    lab: true,
    salud: true,
    analytics: false,
    notifications: true,
    wearables: false // Para futuro: integración con dispositivos
  }
}

export default pulsoConfig

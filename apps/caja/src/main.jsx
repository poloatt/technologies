import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './toolbarConfig.js'
import '@shared/index.css'
import { AuthProvider } from '@shared/context/AuthContext'
import { ActionHistoryProvider } from '@shared/context/ActionHistoryContext'
import { ActionHistoryRoutesProvider } from '@shared/context/ActionHistoryRoutesContext.jsx'
import clienteAxios from '@shared/config/axios'

// Configure React Router future flags to suppress warnings
const routerConfig = {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
}

// Configuración específica para Caja
const AppConfig = {
  name: 'Caja',
  title: 'Caja',
  theme: 'green',
  primaryColor: '#4caf50'
}

// Inyectar configuración global
window.APP_CONFIG = AppConfig

// Definir mapa de rutas para Caja
const cajaRoutesMap = {
  '/finanzas/transacciones': {
    entity: 'transaccion',
    apiService: {
      create: (data) => clienteAxios.post('/api/transacciones', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/transacciones/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/transacciones/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/transacciones/${id}`).then(res => res.data)
    }
  },
  '/propiedades/transacciones': {
    entity: 'transaccion',
    apiService: {
      create: (data) => clienteAxios.post('/api/transacciones', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/transacciones/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/transacciones/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/transacciones/${id}`).then(res => res.data)
    }
  },
  '/propiedades/inventario/transacciones': {
    entity: 'transaccion',
    apiService: {
      create: (data) => clienteAxios.post('/api/transacciones', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/transacciones/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/transacciones/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/transacciones/${id}`).then(res => res.data)
    }
  },
  '/finanzas/cuentas': {
    entity: 'cuenta',
    apiService: {
      create: (data) => clienteAxios.post('/api/cuentas', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/cuentas/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/cuentas/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/cuentas/${id}`).then(res => res.data)
    }
  },
  '/propiedades/cuentas': {
    entity: 'cuenta',
    apiService: {
      create: (data) => clienteAxios.post('/api/cuentas', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/cuentas/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/cuentas/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/cuentas/${id}`).then(res => res.data)
    }
  },
  '/propiedades/inventario/cuentas': {
    entity: 'cuenta',
    apiService: {
      create: (data) => clienteAxios.post('/api/cuentas', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/cuentas/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/cuentas/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/cuentas/${id}`).then(res => res.data)
    }
  },
  '/finanzas/monedas': {
    entity: 'moneda',
    apiService: {
      create: (data) => clienteAxios.post('/api/monedas', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/monedas/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/monedas/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/monedas/${id}`).then(res => res.data)
    }
  },
  '/propiedades': {
    entity: 'propiedad',
    apiService: {
      create: (data) => clienteAxios.post('/api/propiedades', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/propiedades/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/propiedades/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/propiedades/${id}`).then(res => res.data)
    }
  },
  '/propiedades/inquilinos': {
    entity: 'inquilino',
    apiService: {
      create: (data) => clienteAxios.post('/api/inquilinos', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/inquilinos/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/inquilinos/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/inquilinos/${id}`).then(res => res.data)
    }
  },
  '/propiedades/contratos': {
    entity: 'contrato',
    apiService: {
      create: (data) => clienteAxios.post('/api/contratos', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/contratos/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/contratos/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/contratos/${id}`).then(res => res.data)
    }
  },
  '/propiedades/inventario': {
    entity: 'inventario',
    apiService: {
      create: (data) => clienteAxios.post('/api/inventarios', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/inventarios/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/inventarios/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/inventarios/${id}`).then(res => res.data)
    }
  },
}

const Root = (
  <BrowserRouter {...routerConfig}>
    <AuthProvider>
      <ActionHistoryProvider>
        <ActionHistoryRoutesProvider routesMap={cajaRoutesMap}>
          <App />
        </ActionHistoryRoutesProvider>
      </ActionHistoryProvider>
    </AuthProvider>
  </BrowserRouter>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  import.meta.env.DEV ? Root : <React.StrictMode>{Root}</React.StrictMode>,
)

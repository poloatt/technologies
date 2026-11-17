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

// Configuración específica para Pulso
const AppConfig = {
  name: 'Pulso',
  title: 'Pulso',
  theme: 'orange',
  primaryColor: '#ff9800'
}

// Inyectar configuración global
window.APP_CONFIG = AppConfig

// Definir mapa de rutas para Pulso (vacío por ahora, se puede ampliar)
const pulsoRoutesMap = {
  '/data': {
    entity: 'salud_item',
    apiService: {
      create: (data) => clienteAxios.post('/api/salud/items', data).then((res) => res.data),
      update: (id, data) => clienteAxios.put(`/api/salud/items/${id}`, data).then((res) => res.data),
      delete: (id) => clienteAxios.delete(`/api/salud/items/${id}`).then((res) => res.data),
      getById: (id) => clienteAxios.get(`/api/salud/items/${id}`).then((res) => res.data),
    },
  },
  '/data/controles': {
    entity: 'salud_control',
    apiService: {
      create: (data) => clienteAxios.post('/api/salud/controles', data).then((res) => res.data),
      update: (id, data) => clienteAxios.put(`/api/salud/controles/${id}`, data).then((res) => res.data),
      delete: (id) => clienteAxios.delete(`/api/salud/controles/${id}`).then((res) => res.data),
      getById: (id) => clienteAxios.get('/api/salud/controles').then((res) => (
        (res.data?.controles || []).find((control) => control.controlId === id)
      )),
    },
  },
  '/nutricion': {
    entity: 'receta',
    apiService: {
      create: (data) => clienteAxios.post('/api/dietas/recetas', data).then((res) => res.data),
      update: (id, data) => clienteAxios.put(`/api/dietas/recetas/${id}`, data).then((res) => res.data),
      delete: (id) => clienteAxios.delete(`/api/dietas/recetas/${id}`).then((res) => res.data),
      getById: (id) => clienteAxios.get('/api/dietas/recetas').then((res) => (
        (res.data || []).find((meal) => String(meal.id || meal._id) === String(id))
      )),
    },
  },
  '/nutricion/plan': {
    entity: 'dieta_plan',
    apiService: {
      create: (data) => clienteAxios.put('/api/dietas/plan', data).then((res) => res.data),
      update: (_id, data) => clienteAxios.put('/api/dietas/plan', data).then((res) => res.data),
      delete: () => clienteAxios.put('/api/dietas/plan', {
        calorias: 0,
        proteinas: 0,
        carbohidratos: 0,
        grasas: 0,
      }).then((res) => res.data),
      getById: () => clienteAxios.get('/api/dietas/plan').then((res) => res.data),
    },
  },
}

// Reemplazar por montaje condicional de StrictMode
const Root = (
  <BrowserRouter {...routerConfig}>
    <AuthProvider>
      <ActionHistoryProvider>
        <ActionHistoryRoutesProvider routesMap={pulsoRoutesMap}>
          <App />
        </ActionHistoryRoutesProvider>
      </ActionHistoryProvider>
    </AuthProvider>
  </BrowserRouter>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  import.meta.env.DEV ? Root : <React.StrictMode>{Root}</React.StrictMode>,
)

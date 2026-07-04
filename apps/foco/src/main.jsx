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

// Configuración específica para Foco
const AppConfig = {
  name: 'Foco',
  title: 'Foco',
  theme: 'blue',
  primaryColor: '#1976d2'
}

// Inyectar configuración global
window.APP_CONFIG = AppConfig

// Definir mapa de rutas para Foco
const focoRoutesMap = {
  '/objetivos': {
    entity: 'objetivo',
    apiService: {
      create: (data) => clienteAxios.post('/api/objetivos', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/objetivos/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/objetivos/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/objetivos/${id}`).then(res => res.data)
    }
  },
  '/tareas': {
    entity: 'tarea',
    apiService: {
      create: (data) => clienteAxios.post('/api/tareas', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/tareas/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/tareas/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/tareas/${id}`).then(res => res.data)
    }
  },
  '/archivo': {
    entity: 'tarea',
    apiService: {
      create: (data) => clienteAxios.post('/api/tareas', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/tareas/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/tareas/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/tareas/${id}`).then(res => res.data)
    }
  },
  '/rutinas': {
    entity: 'rutina',
    apiService: {
      create: (data) => clienteAxios.post('/api/rutinas', data).then(res => res.data),
      update: (id, data) => clienteAxios.put(`/api/rutinas/${id}`, data).then(res => res.data),
      delete: (id) => clienteAxios.delete(`/api/rutinas/${id}`).then(res => res.data),
      getById: (id) => clienteAxios.get(`/api/rutinas/${id}`).then(res => res.data)
    }
  }
}

const Root = (
  <BrowserRouter {...routerConfig}>
    <AuthProvider>
      <ActionHistoryProvider>
        <ActionHistoryRoutesProvider routesMap={focoRoutesMap}>
          <App />
        </ActionHistoryRoutesProvider>
      </ActionHistoryProvider>
    </AuthProvider>
  </BrowserRouter>
)

ReactDOM.createRoot(document.getElementById('root')).render(Root)

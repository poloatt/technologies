import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createAppManualChunks } from '../shared/vite/manualChunks.js'
import { createDevApiProxy } from '../shared/vite/devProxy.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Forzar modo producción si VITE_API_URL está definido
  const isProd = mode === 'production' || process.env.VITE_API_URL;
  
  // Cargar variables de entorno específicas de la app
  const appEnv = loadEnv(mode, __dirname, '')
  
  return {
    base: '/',
    plugins: [
      react()
    ],
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, '../shared'),
        '@shared/habits': path.resolve(__dirname, '../shared/habits'),
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom']
    },
    server: {
      host: 'localhost',
      port: 5175,
      strictPort: true,
      hmr: {
        clientPort: 5175,
        host: 'localhost',
        overlay: false
      },
      watch: {
        usePolling: false, // Usar file watching nativo (más rápido)
        interval: 1000,
        // Solo observar cambios en la app actual y shared
        ignored: [
          '**/node_modules/**',
          '**/dist/**',
          '**/.git/**',
          '**/apps/foco/**',
          '**/apps/caja/**',
          '**/apps/backend/**',
          '**/.vite/**'
        ]
      },
      proxy: createDevApiProxy(mode),
    },
    cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
    optimizeDeps: {
      include: [
        '@mui/material',
        '@emotion/react',
        '@emotion/styled',
        '@mui/icons-material',
        '@mui/x-date-pickers',
        'date-fns',
        'react-router-dom',
        'notistack',
        'axios',
        'shared'
      ],
      force: false // Solo reoptimizar cuando sea necesario
    },
    build: {
      outDir: 'dist',
      sourcemap: !isProd,
      minify: isProd,
      rollupOptions: {
        output: {
          manualChunks: createAppManualChunks
        }
      }
    },
    preview: {
      port: 5175
    },
    define: {
      'import.meta.env.VITE_ENVIRONMENT': JSON.stringify(mode),
      'import.meta.env.MODE': JSON.stringify(mode),
      'import.meta.env.VITE_APP_NAME': JSON.stringify('Pulso'),
      'import.meta.env.VITE_API_URL': JSON.stringify(appEnv.VITE_API_URL || ''),
      'import.meta.env.VITE_FRONTEND_URL': JSON.stringify(
        process.env.VITE_FRONTEND_URL || 'https://pulso.attadia.com'
      ),
      // Combinar variables de entorno específicas de la app
      ...Object.keys(appEnv).reduce((prev, key) => {
        if (key.startsWith('VITE_')) {
          prev[`process.env.${key}`] = JSON.stringify(appEnv[key])
        }
        return prev
      }, {})
    }
  }
})

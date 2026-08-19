import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Toaster } from 'react-hot-toast';

// Importaciones compartidas
import { PrivateRoute } from '@shared/navigation';
import { Layout } from '@shared/layouts/Layout';
import { Login } from '@shared/pages/Login';
import { Register } from '@shared/pages/Register';
import AuthCallback from '@shared/components/auth/AuthCallback';
import AuthError from '@shared/components/auth/AuthError';
import { AppLoadingScreen, ErrorBoundary } from '@shared/components/common';
import theme from '@shared/context/ThemeContext';
import { ValuesVisibilityProvider } from '@shared/context/ValuesVisibilityContext';
import { NavigationBarProvider } from '@shared/context/NavigationBarContext';
import { SidebarProvider } from '@shared/context/SidebarContext';
import { UISettingsProvider } from '@shared/context/UISettingsContext';
import { useAuth } from '@shared/context/AuthContext';

// Páginas Caja (lazy)
const Finanzas = React.lazy(() => import('./pages/Finanzas'));
const Propiedades = React.lazy(() => import('./pages/Propiedades'));
const Transacciones = React.lazy(() => import('./pages/Transacciones'));
const Cuentas = React.lazy(() => import('./pages/Cuentas'));
const Monedas = React.lazy(() => import('./pages/Monedas'));
const Inquilinos = React.lazy(() => import('./pages/Inquilinos'));
const Contratos = React.lazy(() => import('./pages/Contratos'));
const Inventario = React.lazy(() => import('./pages/Inventario'));
const Deudores = React.lazy(() => import('./pages/Deudores'));
const Recurrente = React.lazy(() => import('./pages/Recurrente'));
const Inversiones = React.lazy(() => import('./pages/Inversiones'));
const Autos = React.lazy(() => import('./pages/Autos'));
const MercadoPagoCallbackPage = React.lazy(() =>
  import('@shared/pages/MercadoPagoCallbackPage').then((m) => ({ default: m.MercadoPagoCallbackPage }))
);
const Perfil = React.lazy(() => import('@shared/pages/Perfil'));
const Configuracion = React.lazy(() => import('@shared/pages/Configuracion'));
const Preferencias = React.lazy(() => import('@shared/pages/Preferencias'));

function App() {
  const { user, loading } = useAuth();

  if (process.env.NODE_ENV === 'development' && !user && !loading) {
    console.log('🏠 ATTA AUTH STATE:', { authenticated: !!user, loading });
  }

  if (loading) {
    return <AppLoadingScreen />;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Toaster position="top-right" />
      <ValuesVisibilityProvider>
        <NavigationBarProvider>
          <SidebarProvider>
            <UISettingsProvider>
              <ErrorBoundary>
              <Suspense fallback={<AppLoadingScreen />}>
              <Routes>
                {/* Rutas públicas */}
                <Route path="/login" element={user ? <Navigate to="/finanzas" replace /> : <Login />} />
                <Route path="/registro" element={<Register />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth/callback/*" element={<AuthCallback />} />
                <Route path="/auth/error" element={<AuthError />} />
                <Route path="/mercadopago/callback" element={<MercadoPagoCallbackPage />} />

                <Route path="/" element={<Navigate to="/finanzas" replace />} />

                <Route element={<PrivateRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/finanzas" element={<Finanzas />} />
                    <Route path="/finanzas/transacciones" element={<Transacciones />} />
                    <Route path="/finanzas/cuentas" element={<Cuentas />} />
                    <Route path="/finanzas/monedas" element={<Monedas />} />
                    <Route path="/finanzas/inversiones" element={<Inversiones />} />
                    <Route path="/finanzas/deudores" element={<Deudores />} />
                    <Route path="/finanzas/recurrente" element={<Recurrente />} />

                    <Route path="/propiedades" element={<Propiedades />} />
                    <Route path="/propiedades/cuentas" element={<Cuentas />} />
                    <Route path="/propiedades/transacciones" element={<Transacciones />} />
                    <Route path="/propiedades/inquilinos" element={<Inquilinos />} />
                    <Route path="/propiedades/contratos" element={<Contratos />} />
                    <Route
                      path="/propiedades/habitaciones"
                      element={<Navigate to="/propiedades" replace />}
                    />
                    <Route path="/propiedades/inventario" element={<Inventario />} />
                    <Route path="/propiedades/inventario/cuentas" element={<Cuentas />} />
                    <Route path="/propiedades/inventario/transacciones" element={<Transacciones />} />
                    <Route path="/propiedades/inventario/en-propiedades" element={<Inventario />} />
                    <Route path="/propiedades/inventario/sin-ubicacion" element={<Inventario />} />
                    <Route path="/propiedades/autos" element={<Autos />} />

                    <Route path="/configuracion" element={<Configuracion />} />
                    <Route path="/configuracion/perfil" element={<Perfil />} />
                    <Route path="/configuracion/preferencias" element={<Preferencias />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/finanzas" replace />} />
              </Routes>
              </Suspense>
              </ErrorBoundary>
            </UISettingsProvider>
          </SidebarProvider>
        </NavigationBarProvider>
      </ValuesVisibilityProvider>
    </ThemeProvider>
  );
}

export default App;

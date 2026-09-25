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

// Páginas Pulso (lazy)
const Data = React.lazy(() => import('./pages/Data'));
const Nutricion = React.lazy(() => import('./pages/Nutricion'));
const Lab = React.lazy(() => import('./pages/Lab'));
const Salud = React.lazy(() => import('./pages/Salud'));
const Perfil = React.lazy(() => import('@shared/pages/Perfil'));
const Configuracion = React.lazy(() => import('@shared/pages/Configuracion'));
const Preferencias = React.lazy(() => import('@shared/pages/Preferencias'));

function App() {
  const { user, loading } = useAuth();

  if (process.env.NODE_ENV === 'development' && !user && !loading) {
    console.log('💓 PULSO AUTH STATE:', { authenticated: !!user, loading });
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
                <Route path="/login" element={user ? <Navigate to="/data" replace /> : <Login />} />
                <Route path="/registro" element={<Register />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth/callback/*" element={<AuthCallback />} />
                <Route path="/auth/error" element={<AuthError />} />

                <Route path="/" element={<Navigate to="/data" replace />} />

                <Route element={<PrivateRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/data" element={<Data />} />
                    <Route path="/nutricion" element={<Nutricion />} />
                    <Route path="/lab" element={<Lab />} />
                    <Route path="/datacorporal" element={<Navigate to="/data" replace />} />
                    <Route path="/dieta" element={<Navigate to="/nutricion" replace />} />
                    <Route path="/salud" element={<Salud />} />

                    <Route path="/configuracion" element={<Configuracion />} />
                    <Route path="/configuracion/perfil" element={<Perfil />} />
                    <Route path="/configuracion/preferencias" element={<Preferencias />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/data" replace />} />
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

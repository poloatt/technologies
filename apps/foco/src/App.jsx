import React, { Suspense, useEffect } from 'react';
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
import { AppLoadingScreen, CustomSnackbarProvider, ErrorBoundary } from '@shared/components/common';
import theme from '@shared/context/ThemeContext';
import { ValuesVisibilityProvider } from '@shared/context/ValuesVisibilityContext';
import { NavigationBarProvider } from '@shared/context/NavigationBarContext';
import { SidebarProvider } from '@shared/context/SidebarContext';
import { UISettingsProvider } from '@shared/context/UISettingsContext';
import { RutinasProvider, useRutinas } from '@shared/context/RutinasContext';
import { HabitsProvider, useHabits } from '@shared/context/HabitsContext';
import { fetchHabitsPreferencesFromApi } from '@shared/hooks/useHabitsPreferences';
import TimezoneInitializer from '@shared/components/TimezoneInitializer';
import { useAuth } from '@shared/context/AuthContext';
import { prefetchTasksForList } from './features/tasks/hooks/useTasksForList';
import { prefetchTasksForCalendar } from './features/tasks/hooks/useTasksForCalendar';
import { prefetchObjetivosLight } from './features/tasks/hooks/useObjetivosLight';

// Páginas Foco (lazy)
const Rutinas = React.lazy(() => import('./pages/Rutinas'));
const Tareas = React.lazy(() => import('./pages/Tareas'));
const Objetivos = React.lazy(() =>
  import('./pages/Objetivos').then((m) => ({ default: m.Objetivos }))
);
const Archivo = React.lazy(() => import('./pages/Archivo'));
const Perfil = React.lazy(() => import('@shared/pages/Perfil'));
const Configuracion = React.lazy(() => import('@shared/pages/Configuracion'));
const Preferencias = React.lazy(() => import('@shared/pages/Preferencias'));

function AppContent() {
  const { user, loading } = useAuth();
  const { fetchRutinas } = useRutinas();
  const { fetchHabits } = useHabits();

  // Precarga inmediata (en paralelo con el chunk de la ruta principal) de los datos críticos
  // del carrusel de hábitos y la lista de tareas para evitar el waterfall al entrar a Foco.
  useEffect(() => {
    if (!user) return undefined;
    import('./pages/Tareas').catch(() => {});
    fetchHabits().catch(() => {});
    fetchRutinas().catch(() => {});
    fetchHabitsPreferencesFromApi().catch(() => {});
    prefetchTasksForList(false);

    const warmSecondary = () => {
      prefetchTasksForCalendar(null, 'week', true);
      prefetchObjetivosLight();
      import('./pages/Objetivos').catch(() => {});
    };
    const ric = typeof window !== 'undefined' && window.requestIdleCallback;
    const id = ric
      ? window.requestIdleCallback(warmSecondary, { timeout: 1500 })
      : setTimeout(warmSecondary, 300);
    return () => {
      if (ric && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };
  }, [user, fetchHabits, fetchRutinas]);

  if (import.meta.env.DEV && !user && !loading) {
    console.log('[Foco] auth state:', { authenticated: !!user, loading });
  }

  if (loading) {
    return <AppLoadingScreen />;
  }

  return (
    <Suspense fallback={<AppLoadingScreen />}>
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/tareas" replace /> : <Login />} />
      <Route path="/registro" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/callback/*" element={<AuthCallback />} />
      <Route path="/auth/error" element={<AuthError />} />

      <Route path="/" element={<Navigate to="/tareas" replace />} />

      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          <Route path="/foco" element={<Navigate to="/tareas" replace />} />
          <Route path="/agenda" element={<Navigate to="/tareas" replace />} />
          <Route path="/rutinas" element={<Rutinas />} />
          <Route path="/objetivos" element={<Objetivos />} />
          <Route path="/proyectos" element={<Navigate to="/objetivos" replace />} />
          <Route path="/tiempo/proyectos" element={<Navigate to="/objetivos" replace />} />
          <Route path="/tiempo/objetivos" element={<Navigate to="/objetivos" replace />} />
          <Route path="/tareas" element={<Tareas />} />
          <Route path="/archivo" element={<Archivo />} />

          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="/configuracion/perfil" element={<Perfil />} />
          <Route path="/configuracion/preferencias" element={<Preferencias />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/tareas" replace />} />
    </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Toaster position="top-right" />
      <CustomSnackbarProvider>
        <ValuesVisibilityProvider>
          <NavigationBarProvider>
            <SidebarProvider>
              <UISettingsProvider>
                <RutinasProvider>
                  <HabitsProvider>
                    <TimezoneInitializer />
                    <ErrorBoundary>
                      <AppContent />
                    </ErrorBoundary>
                  </HabitsProvider>
                </RutinasProvider>
              </UISettingsProvider>
            </SidebarProvider>
          </NavigationBarProvider>
        </ValuesVisibilityProvider>
      </CustomSnackbarProvider>
    </ThemeProvider>
  );
}

export default App;

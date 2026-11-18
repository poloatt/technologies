import { lazy, Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Button, Chip, CircularProgress, Skeleton, Typography } from '@shared/utils/materialImports';
import BranchFinanzasSectionNav from '../finanzas/BranchFinanzasSectionNav';
import { cuentaDetailPath } from '../finanzas/finanzasDeepLink';
import { useFinanzasBranch } from '../finanzas/useFinanzasBranch';
import TransaccionTable from '../finanzas/transacciones/TransaccionTable';
import TransaccionesFlujoVisual from '../finanzas/transacciones/TransaccionesFlujoVisual';
import { useTransaccionesList } from '../finanzas/transacciones/useTransaccionesList';
import {
  DEFAULT_PERIOD_PRESET,
  getPeriodRange,
} from '../finanzas/transacciones/transaccionesPeriodUtils';
import clienteAxios from '@shared/config/axios';
import { useSnackbar } from 'notistack';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';

const loadTransaccionForm = () => import('../finanzas/transacciones/TransaccionForm');
const TransaccionForm = lazy(loadTransaccionForm);

function getScrollParent(node) {
  let current = node?.parentElement;
  while (current && current !== document.body) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === 'auto' || overflowY === 'scroll') return current;
    current = current.parentElement;
  }
  return null;
}

function ListSkeleton() {
  return (
    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} variant="rounded" height={64} />
      ))}
    </Box>
  );
}

function PeriodoVacio({ title, description, buttonText, onButtonClick }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 1,
        py: 4,
        px: 2,
      }}
    >
      <Typography variant="subtitle1">{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
        {description}
      </Typography>
      {buttonText && (
        <Button variant="text" onClick={onButtonClick} sx={{ mt: 0.5 }}>
          {buttonText}
        </Button>
      )}
    </Box>
  );
}

export function Transacciones() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const { enqueueSnackbar } = useSnackbar();
  const [editingTransaccion, setEditingTransaccion] = useState(null);
  const { showValues } = useValuesVisibility();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cuentaFilterId = searchParams.get('cuenta');
  const { branchId } = useFinanzasBranch();
  const [preset, setPreset] = useState(DEFAULT_PERIOD_PRESET);
  const [cuentaFiltrada, setCuentaFiltrada] = useState(null);
  const periodRange = useMemo(() => getPeriodRange(preset), [preset]);
  const sentinelRef = useRef(null);

  const {
    transacciones: transaccionesFiltradas,
    loading: transaccionesLoading,
    loadingMore,
    error: transaccionesError,
    hasMore,
    hasAny,
    loadMore,
    refetch: refetchTransacciones,
  } = useTransaccionesList({
    fechaInicio: periodRange.fechaInicio,
    fechaFin: periodRange.fechaFin,
    cuentaId: cuentaFilterId || undefined,
  });

  useEffect(() => {
    let idleId;
    let timeoutId;
    const warmForm = () => { loadTransaccionForm(); };
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(warmForm, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(warmForm, 800);
    }
    return () => {
      if (idleId != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!cuentaFilterId) {
      setCuentaFiltrada(null);
      return undefined;
    }
    let active = true;
    setCuentaFiltrada(null);
    clienteAxios.get(`/api/cuentas/${cuentaFilterId}`)
      .then((response) => {
        if (active) setCuentaFiltrada(response.data);
      })
      .catch(() => {
        if (active) setCuentaFiltrada(null);
      });
    return () => { active = false; };
  }, [cuentaFilterId]);

  useEffect(() => {
    if (!transaccionesError) return;
    const message = transaccionesError.response?.data?.error
      || transaccionesError.message
      || 'Error al cargar transacciones';
    enqueueSnackbar(`Error al cargar transacciones: ${message}`, { variant: 'error' });
  }, [transaccionesError, enqueueSnackbar]);

  const handleEdit = useCallback(async (transaccion) => {
    try {
      const transaccionFormateada = {
        ...transaccion,
        cuenta: transaccion.cuenta?._id || transaccion.cuenta?.id || transaccion.cuenta,
        moneda: transaccion.moneda?._id || transaccion.moneda?.id || transaccion.moneda
      };
      setEditingTransaccion(transaccionFormateada);
      setFormKey(prev => prev + 1);
      setIsFormOpen(true);
    } catch (error) {
      console.error('Error al preparar edición:', error);
      enqueueSnackbar('Error al cargar datos para edición', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const handleFormSubmit = useCallback(async (formData) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión nuevamente.');
      }

      const cuentaId = formData.cuenta?._id || formData.cuenta?.id || formData.cuenta;
      if (!cuentaId) {
        throw new Error('La cuenta seleccionada no existe');
      }

      const datosAEnviar = {
        descripcion: formData.descripcion,
        monto: parseFloat(formData.monto),
        fecha: formData.fecha || new Date().toISOString(),
        categoria: formData.categoria,
        estado: formData.estado || 'PENDIENTE',
        cuenta: cuentaId,
        tipo: formData.tipo || 'INGRESO',
        moneda: formData.moneda
      };

      if (editingTransaccion) {
        await clienteAxios.put(`/api/transacciones/${editingTransaccion._id}`, datosAEnviar);
        enqueueSnackbar('Transacción actualizada exitosamente', { variant: 'success' });
      } else {
        await clienteAxios.post('/api/transacciones', datosAEnviar);
        enqueueSnackbar('Transacción creada exitosamente', { variant: 'success' });
      }

      setIsFormOpen(false);
      setEditingTransaccion(null);
      setFormKey(prev => prev + 1);
      window.dispatchEvent(new Event('transaccionesRefreshed'));
    } catch (error) {
      console.error('Error completo:', error);
      if (error.response?.status === 401) {
        enqueueSnackbar('Sesión expirada. Por favor, inicia sesión nuevamente.', {
          variant: 'error',
          autoHideDuration: 5000
        });
        window.location.href = '/#/login';
        return;
      }
      const mensajeError = error.response?.data?.message || error.message || 'Error al guardar la transacción';
      enqueueSnackbar(mensajeError, { variant: 'error' });
    }
  }, [enqueueSnackbar, editingTransaccion]);

  const handleDelete = useCallback(async (transaccion) => {
    const id = transaccion?._id || transaccion?.id || transaccion;
    try {
      await clienteAxios.delete(`/api/transacciones/${id}`);
      enqueueSnackbar('Transacción eliminada exitosamente', { variant: 'success' });
      window.dispatchEvent(new Event('transaccionesRefreshed'));
    } catch (error) {
      console.error('Error al eliminar transacción:', error);
      enqueueSnackbar('Error al eliminar la transacción', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const handleOpenForm = useCallback(() => {
    setEditingTransaccion(null);
    setFormKey(prev => prev + 1);
    setIsFormOpen(true);
  }, []);

  useEffect(() => {
    if (location.state?.openAdd) {
      handleOpenForm();
      window.history.replaceState({}, document.title);
    }
  }, [location.state, handleOpenForm]);

  useEffect(() => {
    const openLocal = () => handleOpenForm();
    window.addEventListener('openAddFormLocal', openLocal);
    return () => window.removeEventListener('openAddFormLocal', openLocal);
  }, [handleOpenForm]);

  useEffect(() => {
    const handleHeaderAddButton = (event) => {
      if (
        (event.detail?.path && event.detail.path === location.pathname) ||
        event.detail?.type === 'transaccion' ||
        event.detail?.type === 'transacciones'
      ) {
        handleOpenForm();
      }
    };

    window.addEventListener('headerAddButtonClicked', handleHeaderAddButton);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAddButton);
  }, [handleOpenForm, location.pathname]);

  useEffect(() => {
    const handleTransaccionesRefreshed = () => {
      refetchTransacciones();
    };
    window.addEventListener('transaccionesRefreshed', handleTransaccionesRefreshed);
    return () => window.removeEventListener('transaccionesRefreshed', handleTransaccionesRefreshed);
  }, [refetchTransacciones]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    }, { root: getScrollParent(node), rootMargin: '240px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, transaccionesFiltradas.length]);

  const sinMovimientosDeBase = hasAny === false;
  const hayMovimientosDeBase = hasAny === true;

  let emptyTitle = 'No hay transacciones';
  let emptyDescription = 'Comienza creando tu primera transacción.';
  if (cuentaFilterId && sinMovimientosDeBase) {
    emptyTitle = 'Sin movimientos en esta cuenta';
    emptyDescription = 'Probá sincronizar Mercado Pago o importar el CSV desde Cuentas.';
  } else if (hayMovimientosDeBase) {
    emptyTitle = 'Sin movimientos en este período';
    emptyDescription = 'Probá otro período o cargá un movimiento de estas fechas.';
  }

  return (
    <Box sx={{ ...cajaPageLayoutSx, position: 'relative', minHeight: '80vh', bgcolor: 'background.default' }}>
      <BranchFinanzasSectionNav branchId={branchId} variant="strip" />
      {cuentaFilterId && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 0.5 }}>
          <Chip
            label={cuentaFiltrada?.nombre ? `Cuenta: ${cuentaFiltrada.nombre}` : 'Cuenta'}
            size="small"
            onDelete={() => navigate(location.pathname.split('?')[0], { replace: true })}
            variant="outlined"
          />
          <Typography
            component="button"
            variant="caption"
            onClick={() => navigate(cuentaDetailPath(cuentaFilterId, branchId))}
            sx={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'primary.main',
              textDecoration: 'underline',
            }}
          >
            Ver detalle
          </Typography>
        </Box>
      )}
      <TransaccionesFlujoVisual
        density="page"
        cuentaId={cuentaFilterId}
        preset={preset}
        onPresetChange={setPreset}
      />

      {transaccionesLoading ? (
        <ListSkeleton />
      ) : transaccionesError && transaccionesFiltradas.length === 0 ? (
        <PeriodoVacio
          title="No se pudieron cargar las transacciones"
          description="Reintentá en unos segundos."
          buttonText="Reintentar"
          onButtonClick={refetchTransacciones}
        />
      ) : transaccionesFiltradas.length === 0 ? (
        <PeriodoVacio
          title={emptyTitle}
          description={emptyDescription}
          buttonText={cuentaFilterId ? 'Ir a Cuentas' : 'Nueva Transacción'}
          onButtonClick={
            cuentaFilterId
              ? () => navigate(cuentaDetailPath(cuentaFilterId, branchId))
              : handleOpenForm
          }
        />
      ) : (
        <Box sx={{ mt: 2 }}>
          <TransaccionTable
            transacciones={transaccionesFiltradas}
            onEdit={handleEdit}
            onDelete={handleDelete}
            showVisibilityToggle={true}
            showValues={showValues}
          />
          {(hasMore || loadingMore) && (
            <Box
              ref={sentinelRef}
              sx={{ display: 'flex', justifyContent: 'center', py: 2, minHeight: 40 }}
            >
              {loadingMore && <CircularProgress size={22} />}
            </Box>
          )}
        </Box>
      )}

      {isFormOpen && (
        <Suspense fallback={null}>
          <TransaccionForm
            key={formKey}
            open={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSubmit={handleFormSubmit}
            initialData={editingTransaccion || {}}
            isEditing={!!editingTransaccion}
          />
        </Suspense>
      )}
    </Box>
  );
}

export default Transacciones;

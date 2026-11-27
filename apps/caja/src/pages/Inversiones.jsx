import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Skeleton, Typography } from '@shared/utils/materialImports';
import { FinanzasSectionNav } from '../finanzas';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';
import InversionesResumen from '../finanzas/inversiones/InversionesResumen';
import TransaccionTable from '../finanzas/transacciones/TransaccionTable';
import { useTransaccionesList } from '../finanzas/transacciones/useTransaccionesList';
import {
  DEFAULT_PERIOD_PRESET,
  getPeriodRange,
} from '../finanzas/transacciones/transaccionesPeriodUtils';
import { inversionKindsFromVista, inversionListQuery } from '../finanzas/transacciones/ledgerKindFilters';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';

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

export default function Inversiones() {
  const { showValues } = useValuesVisibility();
  const [searchParams] = useSearchParams();
  const cuentaId = searchParams.get('cuenta') || undefined;
  const vista = searchParams.get('vista');
  const [preset, setPreset] = useState(DEFAULT_PERIOD_PRESET);
  const [enabledKinds, setEnabledKinds] = useState(() => inversionKindsFromVista(vista));
  const periodRange = useMemo(() => getPeriodRange(preset), [preset]);
  const listQuery = useMemo(() => inversionListQuery(enabledKinds), [enabledKinds]);

  useEffect(() => {
    setEnabledKinds(inversionKindsFromVista(vista));
  }, [vista]);
  const sentinelRef = useRef(null);

  const {
    transacciones,
    loading,
    loadingMore,
    error,
    hasMore,
    hasAny,
    loadMore,
    refetch,
  } = useTransaccionesList({
    fechaInicio: periodRange.fechaInicio,
    fechaFin: periodRange.fechaFin,
    cuentaId,
    ledger: 'inversiones',
    estado: 'PAGADO',
    kinds: listQuery.kinds,
    yieldSide: listQuery.yieldSide,
  });

  useEffect(() => {
    const handleHeaderAdd = (e) => {
      if (e.detail?.type === 'inversiones') {
        alert('La función de agregar inversión está en construcción.');
      }
    };
    window.addEventListener('headerAddButtonClicked', handleHeaderAdd);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAdd);
  }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    }, { root: getScrollParent(node), rootMargin: '240px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, transacciones.length]);

  const emptyTitle = hasAny
    ? 'Sin movimientos de inversión en este período'
    : 'Todavía no hay reservas ni inversiones';
  const emptyDescription = hasAny
    ? 'Probá otro período. Los cobros y transferencias siguen en Transacciones.'
    : 'Cuando sincronices Mercado Pago, reservas, aportes, rescates y rendimientos van a aparecer acá.';

  return (
    <Box sx={{ ...cajaPageLayoutSx, position: 'relative', minHeight: '80vh', bgcolor: 'background.default' }}>
      <FinanzasSectionNav variant="strip" />
      <InversionesResumen
        cuentaId={cuentaId}
        preset={preset}
        onPresetChange={setPreset}
        enabledKinds={enabledKinds}
        onKindsChange={setEnabledKinds}
      />

      {loading ? (
        <ListSkeleton />
      ) : error && transacciones.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="subtitle1">No se pudieron cargar las inversiones</Typography>
          <Typography
            component="button"
            variant="body2"
            onClick={refetch}
            sx={{ mt: 1, border: 0, bgcolor: 'transparent', color: 'primary.main', cursor: 'pointer' }}
          >
            Reintentar
          </Typography>
        </Box>
      ) : transacciones.length === 0 ? (
        <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
          <Typography variant="subtitle1">{emptyTitle}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 420, mx: 'auto' }}>
            {emptyDescription}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ mt: 2 }}>
          <TransaccionTable
            transacciones={transacciones}
            variant="ledger"
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
    </Box>
  );
}

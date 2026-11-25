import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Skeleton, Typography } from '@shared/utils/materialImports';
import { FinanzasSectionNav } from '../finanzas';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';
import CreditosResumen from '../finanzas/creditos/CreditosResumen';
import CreditosMesList, { agruparCuotas } from '../finanzas/creditos/CreditosMesList';
import { useTransaccionesList } from '../finanzas/transacciones/useTransaccionesList';
import {
  DEFAULT_PERIOD_PRESET,
  getCreditosPeriodRange,
} from '../finanzas/transacciones/transaccionesPeriodUtils';
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
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} variant="rounded" height={52} />
      ))}
    </Box>
  );
}

export default function Creditos() {
  const { showValues } = useValuesVisibility();
  const [preset, setPreset] = useState(DEFAULT_PERIOD_PRESET);
  const periodRange = useMemo(() => getCreditosPeriodRange(preset), [preset]);
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
    ledger: 'creditos',
    estado: 'PAGADO',
    pageSize: 200,
  });

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    }, { root: getScrollParent(node), rootMargin: '240px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, transacciones.length]);

  const grupos = useMemo(
    () => agruparCuotas(transacciones, periodRange.fechaInicio, periodRange.fechaFin),
    [transacciones, periodRange.fechaInicio, periodRange.fechaFin],
  );

  const emptyTitle = hasAny
    ? 'Sin cuotas en este período'
    : 'Todavía no hay compras con tarjeta';
  const emptyDescription = hasAny
    ? 'Probá otro período. Las cuotas que vencen más adelante aparecen en YTG.'
    : 'Cuando pagues una compra con tarjeta de crédito, el resumen del mes va a aparecer acá.';

  return (
    <Box sx={{ ...cajaPageLayoutSx, position: 'relative', minHeight: '80vh', bgcolor: 'background.default' }}>
      <FinanzasSectionNav variant="strip" />
      <CreditosResumen preset={preset} onPresetChange={setPreset} />

      {loading ? (
        <ListSkeleton />
      ) : error && transacciones.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="subtitle1">No se pudieron cargar los créditos</Typography>
          <Typography
            component="button"
            variant="body2"
            onClick={refetch}
            sx={{ mt: 1, border: 0, bgcolor: 'transparent', color: 'primary.main', cursor: 'pointer' }}
          >
            Reintentar
          </Typography>
        </Box>
      ) : grupos.length === 0 ? (
        <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
          <Typography variant="subtitle1">{emptyTitle}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 420, mx: 'auto' }}>
            {emptyDescription}
          </Typography>
        </Box>
      ) : (
        <Box>
          <CreditosMesList
            transacciones={transacciones}
            fechaInicio={periodRange.fechaInicio}
            fechaFin={periodRange.fechaFin}
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

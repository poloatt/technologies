import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Skeleton, Typography } from '@shared/utils/materialImports';
import { useAPI } from '@shared/hooks/useAPI';
import { FinanzasSectionNav } from '../finanzas';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';
import DolaresResumen from '../finanzas/dolares/DolaresResumen';
import TransaccionTable from '../finanzas/transacciones/TransaccionTable';
import { useTransaccionesList } from '../finanzas/transacciones/useTransaccionesList';
import {
  DEFAULT_PERIOD_PRESET,
  getPeriodRange,
} from '../finanzas/transacciones/transaccionesPeriodUtils';
import { DEFAULT_USD_COLOR } from '../finanzas/monedas/monedaConstants';
import { DOLAR_TYPE_FILTERS, dolarSignedAmount, kindsQueryFor } from '../finanzas/transacciones/ledgerKindFilters';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { FONT_SIZE } from '@shared/tipografia';

function getScrollParent(node) {
  let current = node?.parentElement;
  while (current && current !== document.body) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === 'auto' || overflowY === 'scroll') return current;
    current = current.parentElement;
  }
  return null;
}

function formatUsdTotal(monto, showValues) {
  if (!showValues) return 'U$D ••••';
  const n = Number(monto) || 0;
  const body = Math.abs(n).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (n < 0) return `−U$D ${body}`;
  if (n > 0) return `+U$D ${body}`;
  return `U$D ${body}`;
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

export default function Dolares() {
  const { showValues } = useValuesVisibility();
  const [searchParams] = useSearchParams();
  const cuentaId = searchParams.get('cuenta') || undefined;
  const { data: monedasData } = useAPI('/api/monedas');
  const usdColor = (monedasData?.docs || []).find((moneda) => moneda.codigo === 'USD')?.color || DEFAULT_USD_COLOR;
  const [preset, setPreset] = useState(DEFAULT_PERIOD_PRESET);
  const [enabledKinds, setEnabledKinds] = useState(null);
  const periodRange = useMemo(() => getPeriodRange(preset), [preset]);
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
    ledger: 'dolares',
    estado: 'PAGADO',
    kinds: kindsQueryFor(DOLAR_TYPE_FILTERS, enabledKinds),
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

  const totalListado = transacciones.reduce(
    (acc, transaccion) => acc + (dolarSignedAmount(transaccion) || 0),
    0,
  );
  const totalColor = totalListado < 0 ? 'error.main' : (usdColor || 'text.primary');

  const emptyTitle = hasAny
    ? 'Sin operaciones de dólares en este período'
    : 'Todavía no hay compras ni ventas de dólares';
  const emptyDescription = hasAny
    ? 'Probá otro período. Las reservas y el fondo siguen en Inversiones.'
    : 'Cuando Mercado Pago registre una compra o venta de dólares, va a aparecer acá.';

  return (
    <Box sx={{ ...cajaPageLayoutSx, position: 'relative', minHeight: '80vh', bgcolor: 'background.default' }}>
      <FinanzasSectionNav variant="strip" />
      <DolaresResumen
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
          <Typography variant="subtitle1">No se pudieron cargar los dólares</Typography>
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
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
            <Typography sx={{ fontSize: FONT_SIZE.sm, fontWeight: 650, letterSpacing: '0.04em', color: 'text.secondary' }}>
              {`${transacciones.length} movimientos`}
            </Typography>
            <Typography sx={{ fontWeight: 700, fontSize: FONT_SIZE.base, color: totalColor, fontVariantNumeric: 'tabular-nums' }}>
              {formatUsdTotal(totalListado, showValues)}
            </Typography>
          </Box>
          <TransaccionTable
            transacciones={transacciones}
            variant="ledger"
            showValues={showValues}
            inColor={usdColor}
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

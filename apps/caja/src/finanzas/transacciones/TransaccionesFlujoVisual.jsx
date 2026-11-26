import { useEffect, useId, useState } from 'react';
import { Box, Skeleton, Typography, useTheme } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { hubEyebrowSx, hubLabelSx, hubSupportAmountSx } from '../../hub';
import HubBalanceDivider from '../hub/HubBalanceDivider';
import { HubBalanceBreakdown, HubBalanceRow } from '@shared/components/hub';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAPI } from '@shared/hooks/useAPI';
import { useCuentaMostrada } from '../cuentas/useCuentaMostrada';
import { useSaldosCuenta } from '../cuentas/useSaldosCuenta';
import {
  CREDITOS_PATH,
  DOLARES_PATH,
  INVERSIONES_PATH,
  cuentaDetailPath,
  getCuentasPath,
  resolveFinanzasBranch,
} from '../finanzasDeepLink';
import { useSectionPeriod } from '../hub/finanzasHubPeriod';
import {
  DEFAULT_PERIOD_PRESET,
  FLUJO_PERIOD_MODES,
  fillDailySeries,
  formatMonto,
  formatPeriodSpan,
  formatSaldoFuente,
  formatSaldosCorte,
  formatUsdMonto,
  getPeriodRange,
} from './transaccionesPeriodUtils';
import { useTransaccionesPeriodStats } from './useTransaccionesPeriodStats';
import PeriodControl from './PeriodPicker';
import LedgerKindFilter from './LedgerKindFilter';
import { FLUJO_TYPE_FILTERS, kindsQueryFor } from './ledgerKindFilters';

const EMPTY_MONEDA = {
  monedaId: null,
  codigo: '',
  simbolo: '$',
  color: '#4CAF50',
  ingresos: 0,
  egresos: 0,
  balance: 0,
  porDia: [],
};

export { PeriodControl };

/**
 * Ingresos y egresos del período, que componen el flujo neto de arriba.
 * El filtro de tipos vive acá porque afecta al flujo, no a los saldos.
 */
function FlujoPeriodoLine({ moneda, simbolo, showValues, loading, error, filter }) {
  let content;
  if (loading) {
    content = <Skeleton height={18} width="70%" sx={{ borderRadius: 0.5 }} />;
  } else if (error) {
    content = (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        No se pudo cargar el período
      </Typography>
    );
  } else if (!moneda.ingresos && !moneda.egresos) {
    content = (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Sin movimientos pagos en este período
      </Typography>
    );
  } else {
    const items = [
      { id: 'ingresos', label: 'Ingresos', valor: moneda.ingresos },
      { id: 'egresos', label: 'Egresos', valor: moneda.egresos },
    ];
    content = (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.25 }}>
        {items.map((item) => (
          <Typography
            key={item.id}
            variant="caption"
            noWrap
            sx={{ ...hubSupportAmountSx, mt: 0, color: item.color || 'text.primary' }}
          >
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, mr: 0.5 }}>
              {item.label}
            </Box>
            {formatMonto(item.valor, simbolo, showValues)}
          </Typography>
        ))}
      </Box>
    );
  }

  return (
    <Box component="section" aria-label="Flujo del período" sx={{ mt: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.375 }}>
        <Typography variant="caption" noWrap sx={{ ...hubEyebrowSx, mb: 0 }}>
          Flujo del período
        </Typography>
        {filter}
      </Box>
      {content}
    </Box>
  );
}

function MonedaControl({ monedas, activaId, onChange }) {
  if (monedas.length < 2) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }} role="group" aria-label="Moneda">
      {monedas.map((moneda) => {
        const selected = moneda.monedaId === activaId;
        const accent = moneda.color || '#4CAF50';
        return (
          <Box
            key={moneda.monedaId}
            component="button"
            type="button"
            onClick={() => onChange(moneda.monedaId)}
            aria-pressed={selected}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.625,
              border: '1px solid',
              borderColor: selected ? accent : 'divider',
              bgcolor: selected ? 'action.selected' : 'transparent',
              color: 'text.primary',
              borderRadius: 1.5,
              px: 1,
              py: 0.375,
              cursor: 'pointer',
              font: 'inherit',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: accent, flex: '0 0 auto' }} />
            {moneda.codigo}
          </Box>
        );
      })}
    </Box>
  );
}

export function ProportionTrack({ label, amount, value, max, color, dense }) {
  const ratio = max > 0 && value > 0 ? Math.max(value / max, 0.04) : 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, mb: 0.375 }}>
        <Typography variant="caption" noWrap sx={hubEyebrowSx}>
          {label}
        </Typography>
        <Typography variant="caption" noWrap sx={{ ...hubSupportAmountSx, mt: 0, color }}>
          {amount}
        </Typography>
      </Box>
      <Box
        sx={{
          height: dense ? 6 : 8,
          borderRadius: 99,
          bgcolor: 'action.hover',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: `${ratio * 100}%`,
            height: '100%',
            bgcolor: color,
            borderRadius: 99,
          }}
        />
      </Box>
    </Box>
  );
}

function FlujoSpark({ series, positive, negative }) {
  const rawId = useId().replace(/:/g, '');
  const aboveId = `flujo-above-${rawId}`;
  const belowId = `flujo-below-${rawId}`;
  if (!series.length) return null;

  const width = 100;
  const height = 32;
  const mid = height / 2;
  const maxAbs = Math.max(1, ...series.map((point) => Math.abs(point.neto)));
  const coords = series.map((point, index) => {
    const x = series.length === 1 ? width / 2 : (index / (series.length - 1)) * width;
    const y = mid - (point.neto / maxAbs) * (mid - 1.5);
    return [x, y];
  });
  const line = coords
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
  const area = `${line} L${width} ${mid} L0 ${mid} Z`;

  return (
    <Box sx={{ mt: 1.75 }} aria-hidden>
      <Typography variant="caption" sx={{ ...hubLabelSx, display: 'block', mb: 0.5 }}>
        Día a día
      </Typography>
      <Box sx={{ height: 56 }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          <defs>
            <clipPath id={aboveId}>
              <rect x="0" y="0" width={width} height={mid} />
            </clipPath>
            <clipPath id={belowId}>
              <rect x="0" y={mid} width={width} height={mid} />
            </clipPath>
          </defs>
          <line
            x1="0"
            y1={mid}
            x2={width}
            y2={mid}
            stroke="currentColor"
            strokeOpacity="0.2"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <path d={area} fill={positive} fillOpacity="0.9" clipPath={`url(#${aboveId})`} />
          <path d={area} fill={negative} fillOpacity="0.9" clipPath={`url(#${belowId})`} />
        </svg>
      </Box>
    </Box>
  );
}

/**
 * Tarjeta de la cuenta Mercado Pago: flujo neto del período arriba, saldos al cierre
 * (dinero en cuenta con saldo real de MP si hay lectura reciente) y la línea de ingresos y egresos.
 * `compact` entra en la tarjeta del hub. `page` va arriba del listado y suma el spark diario.
 */
export default function TransaccionesFlujoVisual({
  density = 'page',
  cuentaId,
  preset = DEFAULT_PERIOD_PRESET,
  onPresetChange,
  enabledKinds,
  onKindsChange,
}) {
  const theme = useTheme();
  const { showValues } = useValuesVisibility();
  const { dense, activePreset, changePreset, showPeriodControl } = useSectionPeriod({
    density,
    preset,
    onPresetChange,
  });
  const [monedaElegida, setMonedaElegida] = useState(null);
  const [localKinds, setLocalKinds] = useState(null);
  const controlledKinds = typeof onKindsChange === 'function';
  const kindSelection = controlledKinds ? enabledKinds : localKinds;
  const setKindSelection = controlledKinds ? onKindsChange : setLocalKinds;
  const range = getPeriodRange(activePreset);
  const span = formatPeriodSpan(range.fechaInicio, range.fechaFin);

  // Hoy solo hay conexión con Mercado Pago: la tarjeta lleva el nombre de esa cuenta,
  // así que flujo y saldos se acotan a ella para que rótulo y números coincidan.
  const { cuenta: cuentaMostrada, nombre: cuentaNombre } = useCuentaMostrada(cuentaId);
  const scopeCuentaId = cuentaId || cuentaMostrada?.id || cuentaMostrada?._id || undefined;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const branchId = resolveFinanzasBranch(pathname);
  const cuentaPath = scopeCuentaId ? cuentaDetailPath(scopeCuentaId, branchId) : getCuentasPath(branchId);

  const { stats, loading, error, periodLabel, refetch } = useTransaccionesPeriodStats({
    preset: activePreset,
    cuentaId: scopeCuentaId,
    kinds: kindsQueryFor(FLUJO_TYPE_FILTERS, kindSelection),
  });

  useEffect(() => {
    const onRefresh = () => refetch();
    window.addEventListener('transaccionesRefreshed', onRefresh);
    return () => window.removeEventListener('transaccionesRefreshed', onRefresh);
  }, [refetch]);

  const monedas = stats.porMoneda;
  const activa = monedas.find((moneda) => moneda.monedaId === monedaElegida) || monedas[0] || EMPTY_MONEDA;
  const simbolo = activa.simbolo || '$';
  const accent = activa.color || '#4CAF50';
  const expense = theme.palette.error.main;
  const extras = monedas.length - 1;
  const serie = fillDailySeries(activa.porDia, stats.fechaInicio, stats.fechaFin);

  // El desglose arranca desplegado: los saldos son lo primero que se quiere ver.
  const [saldosOpen, setSaldosOpen] = useState(true);
  const saldosId = `saldos-${useId().replace(/:/g, '')}`;
  const { saldos, loading: saldosLoading, error: saldosError } = useSaldosCuenta({
    enabled: true,
    cuentaId: scopeCuentaId,
    preset: activePreset,
  });
  // Positivo: el color que el usuario eligió para esa moneda. Negativo: rojo. Cero: texto normal.
  const { data: monedasData } = useAPI('/api/monedas', { enableCache: true, cacheDuration: 60000 });
  const monedasDocs = monedasData?.docs ?? (Array.isArray(monedasData) ? monedasData : []);
  const pesosColor = monedasDocs.find((m) => saldos?.monedaId && String(m._id || m.id) === saldos.monedaId)?.color || accent;
  const usdColor = monedasDocs.find((m) => m.codigo === 'USD')?.color || accent;
  const saldoColor = (valor, positivo) => {
    if (valor < 0) return expense;
    return valor > 0 ? positivo : undefined;
  };
  const saldosItems = saldos ? [
    {
      id: 'cuenta',
      label: 'Dinero en cuenta',
      valor: saldos.dineroEnCuenta,
      destino: cuentaPath,
      title: formatSaldoFuente(saldos.dineroEnCuentaFuente, saldos.dineroEnCuentaActualizadoEn, range.fechaFin),
    },
    { id: 'dolares', label: 'Saldo en U$D', valor: saldos.dolares, destino: DOLARES_PATH, usd: true },
    { id: 'credito', label: 'Deuda de tarjeta', valor: saldos.credito, destino: CREDITOS_PATH },
    { id: 'reservado', label: 'Reservado', valor: saldos.reservado, destino: INVERSIONES_PATH },
    { id: 'invertido', label: 'Invertido', valor: saldos.invertido, destino: INVERSIONES_PATH },
    {
      id: 'rendimientos',
      label: 'Rendimientos del período',
      valor: saldos.rendimientosPeriodo,
      destino: INVERSIONES_PATH,
    },
  ].map((item) => ({
    id: item.id,
    label: item.label,
    amount: item.usd ? formatUsdMonto(item.valor, showValues) : formatMonto(item.valor, simbolo, showValues),
    color: saldoColor(item.valor, item.usd ? usdColor : pesosColor),
    title: item.title,
    onClick: () => navigate(item.destino),
  })) : [];

  // Arriba va el flujo neto del período (no es un saldo); los saldos viven en el desglose.
  let heroAmount;
  if (loading) {
    heroAmount = <Skeleton component="span" width={dense ? 96 : 140} sx={{ display: 'inline-block' }} />;
  } else if (error) {
    heroAmount = '—';
  } else {
    heroAmount = formatMonto(activa.balance, simbolo, showValues);
  }
  // Con selector propio en un hub, el rango no aparece en otro lado: va acá.
  // El hub Finanzas (barra compartida) y la página ya lo muestran junto al selector.
  const heroCaption = dense && showPeriodControl ? `Flujo neto · ${span}` : 'Flujo neto del período';

  const body = (
    <>
      <HubBalanceRow
        cuenta={cuentaNombre}
        amount={heroAmount}
        color={!loading && !error && activa.balance < 0 ? expense : undefined}
        dense={dense}
        expanded={saldosOpen}
        onToggle={() => setSaldosOpen((open) => !open)}
        controlsId={saldosId}
        below={(
          <Typography
            variant="caption"
            sx={{ ...hubEyebrowSx, display: 'block', mb: 0, mt: 0, textAlign: 'right' }}
          >
            {heroCaption}
          </Typography>
        )}
      />
      <HubBalanceBreakdown
        id={saldosId}
        open={saldosOpen}
        items={saldosItems}
        loading={saldosLoading}
        error={Boolean(saldosError)}
        caption={formatSaldosCorte(range.fechaFin)}
      />
      <FlujoPeriodoLine
        moneda={activa}
        simbolo={simbolo}
        showValues={showValues}
        loading={loading}
        error={Boolean(error)}
        filter={(
          <LedgerKindFilter
            options={FLUJO_TYPE_FILTERS}
            enabledIds={kindSelection}
            onChange={setKindSelection}
          />
        )}
      />
      {dense && <HubBalanceDivider />}
      {!dense && !loading && !error && (
        <FlujoSpark series={serie} positive={accent} negative={expense} />
      )}
    </>
  );

  return (
    <Box
      component="section"
      aria-label={`Flujo de ${periodLabel}`}
      sx={dense ? undefined : { mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      {(showPeriodControl || !dense || extras > 0) && (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: dense ? 0.375 : 0.5, mb: dense ? 1 : 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'flex-start',
            justifyContent: showPeriodControl ? 'flex-start' : 'flex-end',
            gap: 1,
            minHeight: 28,
            width: '100%',
          }}
        >
          {showPeriodControl && (
            <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
              <PeriodControl
                preset={activePreset}
                onChange={changePreset}
                modes={FLUJO_PERIOD_MODES}
                cuentaId={scopeCuentaId}
              />
            </Box>
          )}
          {dense && extras > 0 && (
            <Typography
              variant="caption"
              sx={{ ...hubEyebrowSx, mb: 0, flex: '0 0 auto', whiteSpace: 'nowrap' }}
            >
              {activa.codigo} +{extras}
            </Typography>
          )}
        </Box>
        {!dense && (
          <Typography variant="caption" sx={{ ...hubEyebrowSx, mb: 0 }}>
            {span}
          </Typography>
        )}
        {!dense && !loading && !error && (
          <MonedaControl monedas={monedas} activaId={activa.monedaId} onChange={setMonedaElegida} />
        )}
      </Box>
      )}
      {body}
    </Box>
  );
}

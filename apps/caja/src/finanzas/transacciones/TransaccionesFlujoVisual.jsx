import { useEffect, useState } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { hubEyebrowSx, hubSupportAmountSx, FONT_SIZE } from '@shared/tipografia';
import FinanzasPagePeriodHeader, { finanzasPageSummarySectionSx } from '../FinanzasPagePeriodHeader';
import { HubAccountBlock } from '@shared/components/hub';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAPI } from '@shared/hooks/useAPI';
import { useCuentaMostrada } from '../cuentas/useCuentaMostrada';
import { useSaldosCuenta } from '../cuentas/useSaldosCuenta';
import { getBloquesSaldos, getItemsMultimoneda } from '../cuentas/tiposCuentaSaldos';
import { DEFAULT_USD_COLOR } from '../monedas/monedaConstants';
import {
  creditosCuentaPath,
  dolaresCuentaPath,
  getTransaccionesPath,
  inversionesVistaPath,
  resolveFinanzasBranch,
  transaccionesCuentaFilterPath,
} from '../finanzasDeepLink';
import { useSectionPeriod } from '../hub/finanzasHubPeriod';
import {
  DEFAULT_PERIOD_PRESET,
  FLUJO_PERIOD_MODES,
  formatMonto,
  formatPeriodSpan,
  formatSaldoFuente,
  formatUsdMonto,
  getPeriodRange,
} from './transaccionesPeriodUtils';
import { useTransaccionesPeriodStats } from './useTransaccionesPeriodStats';
import PeriodControl from './PeriodPicker';

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
              fontSize: FONT_SIZE.sm,
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

/**
 * Tarjeta de la cuenta Mercado Pago: flujo neto del período arriba y saldos al cierre
 * (dinero en cuenta con saldo real de MP si hay lectura reciente).
 * `compact` entra en la tarjeta del hub. `page` va arriba del listado de movimientos.
 */
export default function TransaccionesFlujoVisual({
  density = 'page',
  cuentaId,
  preset = DEFAULT_PERIOD_PRESET,
  onPresetChange,
}) {
  const theme = useTheme();
  const { showValues } = useValuesVisibility();
  const { dense, activePreset, changePreset, showPeriodControl } = useSectionPeriod({
    density,
    preset,
    onPresetChange,
  });
  const [monedaElegida, setMonedaElegida] = useState(null);
  const range = getPeriodRange(activePreset);
  const span = formatPeriodSpan(range.fechaInicio, range.fechaFin);

  // Hoy solo hay conexión con Mercado Pago: la tarjeta lleva el nombre de esa cuenta,
  // así que flujo y saldos se acotan a ella para que rótulo y números coincidan.
  const { cuenta: cuentaMostrada, nombre: cuentaNombre, hubNombre } = useCuentaMostrada(cuentaId);
  const scopeCuentaId = cuentaId || cuentaMostrada?.id || cuentaMostrada?._id || undefined;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const branchId = resolveFinanzasBranch(pathname);
  const transaccionesPath = scopeCuentaId
    ? transaccionesCuentaFilterPath(scopeCuentaId, branchId)
    : getTransaccionesPath(branchId);

  const { stats, loading, error, periodLabel, refetch } = useTransaccionesPeriodStats({
    preset: activePreset,
    cuentaId: scopeCuentaId,
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

  const { saldos, loading: saldosLoading, error: saldosError } = useSaldosCuenta({
    enabled: dense,
    cuentaId: scopeCuentaId,
    preset: activePreset,
  });
  // Positivo: el color que el usuario eligió para esa moneda. Negativo: rojo. Cero: texto normal.
  const { data: monedasData } = useAPI('/api/monedas', { enableCache: true, cacheDuration: 60000 });
  const monedasDocs = monedasData?.docs ?? (Array.isArray(monedasData) ? monedasData : []);
  const pesosColor = monedasDocs.find((m) => saldos?.monedaId && String(m._id || m.id) === saldos.monedaId)?.color || accent;
  const usdColor = monedasDocs.find((m) => m.codigo === 'USD')?.color || DEFAULT_USD_COLOR;
  const saldoColor = (valor, positivo) => {
    if (valor < 0) return expense;
    return valor > 0 ? positivo : undefined;
  };
  // Los bloques dependen del tipo de la cuenta que describen los saldos (ver tiposCuentaSaldos).
  const destinos = {
    transacciones: transaccionesPath,
    dolares: dolaresCuentaPath(scopeCuentaId),
    creditos: creditosCuentaPath(scopeCuentaId),
    reservado: inversionesVistaPath('reserve', scopeCuentaId),
    invertido: inversionesVistaPath('invest', scopeCuentaId),
    rendimientos: inversionesVistaPath('yield', scopeCuentaId),
  };
  let saldosItems = [];
  if (saldos?.multimoneda) {
    // Multimoneda: un saldo por moneda con su propio símbolo y color; nunca se suman entre sí.
    saldosItems = getItemsMultimoneda(saldos, monedasDocs).map((item) => ({
      id: item.id,
      label: item.label,
      amount: formatMonto(item.valor, item.simbolo, showValues),
      color: saldoColor(item.valor, item.color || accent),
      onClick: () => navigate(destinos.transacciones),
    }));
  } else if (saldos) {
    saldosItems = getBloquesSaldos(saldos.tipo).map((bloque) => {
      const valor = saldos[bloque.campo];
      return {
        id: bloque.id,
        label: bloque.label,
        amount: bloque.usd ? formatUsdMonto(valor, showValues) : formatMonto(valor, simbolo, showValues),
        color: saldoColor(valor, bloque.usd ? usdColor : pesosColor),
        title: bloque.fuenteTitulo
          ? formatSaldoFuente(saldos.dineroEnCuentaFuente, saldos.dineroEnCuentaActualizadoEn, range.fechaFin)
          : undefined,
        onClick: () => navigate(destinos[bloque.destino]),
      };
    });
  }

  // Con selector propio en un hub, el rango no aparece en otro lado: va acá.
  // El hub Finanzas (barra compartida) y la página ya lo muestran junto al selector.
  const heroCaption = dense && showPeriodControl ? `Flujo neto · ${span}` : 'Flujo neto del período';

  const body = (
    <HubAccountBlock
      cuenta={dense ? hubNombre : cuentaNombre}
      amount={formatMonto(activa.balance, simbolo, showValues)}
      isNegative={activa.balance < 0}
      caption={heroCaption}
      dense={dense}
      loading={loading}
      error={Boolean(error)}
      breakdownItems={saldosItems}
      breakdownLoading={saldosLoading}
      breakdownError={Boolean(saldosError)}
      showDivider={dense}
    />
  );

  return (
    <Box
      component="section"
      aria-label={`Flujo de ${periodLabel}`}
      sx={dense ? undefined : finanzasPageSummarySectionSx}
    >
      {!dense ? (
        <FinanzasPagePeriodHeader
          title="Movimientos"
          subtitle={cuentaId ? cuentaNombre : null}
          preset={activePreset}
          onChange={changePreset}
          span={span}
          modes={FLUJO_PERIOD_MODES}
          cuentaId={scopeCuentaId}
          extra={!loading && !error ? (
            <MonedaControl monedas={monedas} activaId={activa.monedaId} onChange={setMonedaElegida} />
          ) : null}
        />
      ) : (showPeriodControl || extras > 0) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.375, mb: 1 }}>
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
            {extras > 0 && (
              <Typography
                variant="caption"
                sx={{ ...hubEyebrowSx, mb: 0, flex: '0 0 auto', whiteSpace: 'nowrap' }}
              >
                {activa.codigo} +{extras}
              </Typography>
            )}
          </Box>
        </Box>
      )}
      {body}
    </Box>
  );
}

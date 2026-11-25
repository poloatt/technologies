import { useEffect, useId, useState } from 'react';
import { Box, Collapse, Skeleton, Typography, useTheme } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { hubLabelSx, hubPeriodSx, hubValueSx } from '../../hub';
import HubBalanceDivider from '../hub/HubBalanceDivider';
import { useSectionPeriod } from '../hub/finanzasHubPeriod';
import {
  DEFAULT_PERIOD_PRESET,
  MONTH_PRESET,
  QUARTER_PRESETS,
  YEAR_PRESETS,
  fillDailySeries,
  formatMonthPresetLabel,
  formatMonto,
  formatPeriodSpan,
  getCurrentQuarter,
  getPeriodRange,
  isMonthPreset,
  monthPresetId,
  shiftMonthPreset,
} from './transaccionesPeriodUtils';
import { useTransaccionesPeriodStats } from './useTransaccionesPeriodStats';
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

function flowPhrase(moneda, showValues) {
  if (!moneda.ingresos && !moneda.egresos) return 'Sin movimientos pagos en este período';
  if (moneda.balance > 0) return 'Entró más de lo que salió';
  if (moneda.balance < 0) {
    return `Saliste ${formatMonto(Math.abs(moneda.balance), moneda.simbolo || '$', showValues)} por encima`;
  }
  return 'Entradas y salidas empataron';
}

/** Misma tipografía que labels/títulos de sección hub (hubLabelSx / hubPeriodSx). */
function PeriodSeg({ item, selected, marked, onChange }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={() => onChange?.(item.id)}
      aria-pressed={selected}
      title={item.hint}
      sx={{
        ...hubLabelSx,
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.375,
        m: 0,
        px: 0.25,
        py: 0,
        minHeight: 28,
        height: 28,
        border: 0,
        borderRadius: 0,
        bgcolor: 'transparent',
        cursor: 'pointer',
        font: 'inherit',
        fontWeight: selected ? 700 : 600,
        color: selected ? 'text.primary' : 'text.secondary',
        flex: '0 0 auto',
        whiteSpace: 'nowrap',
        transition: 'color 120ms ease',
        '&:hover': { color: 'text.primary' },
      }}
    >
      {item.label}
      {marked && (
        <Box
          aria-hidden
          sx={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            bgcolor: selected ? 'text.primary' : 'text.disabled',
            flex: '0 0 auto',
          }}
        />
      )}
    </Box>
  );
}

function MonthStepButton({ label, onClick, children }) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={label}
      onClick={onClick}
      sx={{
        ...hubLabelSx,
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        minWidth: 28,
        minHeight: 28,
        m: 0,
        p: 0,
        border: 0,
        borderRadius: 0,
        bgcolor: 'transparent',
        color: 'text.secondary',
        cursor: 'pointer',
        font: 'inherit',
        fontWeight: 600,
        lineHeight: 1,
        '&:hover': { color: 'text.primary' },
      }}
    >
      {children}
    </Box>
  );
}

/** `< mes >` en columnas fijas para que el nombre no mueva las flechas. */
function MonthStepper({ preset, onChange }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.25 }}>
      <Box
        role="group"
        aria-label="Mes"
        sx={{
          display: 'grid',
          gridTemplateColumns: '28px 11rem 28px',
          alignItems: 'center',
          justifyItems: 'center',
        }}
      >
        <MonthStepButton
          label="Mes anterior"
          onClick={() => onChange?.(shiftMonthPreset(preset, -1))}
        >
          {'<'}
        </MonthStepButton>
        <Typography
          component="span"
          aria-live="polite"
          sx={{
            ...hubLabelSx,
            mb: 0,
            width: '100%',
            textAlign: 'center',
            color: 'text.primary',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {formatMonthPresetLabel(preset)}
        </Typography>
        <MonthStepButton
          label="Mes siguiente"
          onClick={() => onChange?.(shiftMonthPreset(preset, 1))}
        >
          {'>'}
        </MonthStepButton>
      </Box>
    </Box>
  );
}

/** YTD · YTG | Q1–Q4 | Mensual en una sola línea, estética de cabecera de sección. */
export function PeriodControl({ preset, onChange }) {
  const currentQuarter = `q${getCurrentQuarter()}`;
  const monthSelected = isMonthPreset(preset);
  const items = [
    ...YEAR_PRESETS,
    { id: 'div-quarters', divider: true },
    ...QUARTER_PRESETS,
    { id: 'div-month', divider: true },
    MONTH_PRESET,
  ];

  const handleChange = (id) => {
    if (id === 'month') {
      onChange?.(monthPresetId(new Date()));
      return;
    }
    onChange?.(id);
  };

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Box
        role="group"
        aria-label="Período"
        sx={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
          justifyContent: 'safe center',
          gap: 0.75,
          minWidth: 0,
          width: '100%',
          height: 28,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {items.map((item) =>
          item.divider ? (
            <Box
              key={item.id}
              aria-hidden
              sx={{
                width: '1px',
                alignSelf: 'stretch',
                my: 0.75,
                bgcolor: 'divider',
                flex: '0 0 auto',
              }}
            />
          ) : (
            <PeriodSeg
              key={item.id}
              item={item}
              selected={item.id === 'month' ? monthSelected : item.id === preset}
              marked={item.id === currentQuarter}
              onChange={handleChange}
            />
          )
        )}
      </Box>
      <Collapse in={monthSelected} unmountOnExit timeout={180}>
        <MonthStepper preset={preset} onChange={onChange} />
      </Collapse>
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
        <Typography variant="caption" noWrap sx={hubLabelSx}>
          {label}
        </Typography>
        <Typography variant="caption" noWrap sx={{ ...hubValueSx, mt: 0, color }}>
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

function FlujoSkeleton({ dense }) {
  return (
    <Box>
      <Skeleton height={dense ? 22 : 36} width={dense ? 96 : 140} sx={{ mb: 1, borderRadius: 0.5 }} />
      <Skeleton height={dense ? 22 : 28} sx={{ mb: 0.75, borderRadius: 1 }} />
      <Skeleton height={dense ? 22 : 28} sx={{ borderRadius: 1 }} />
      {!dense && <Skeleton height={56} sx={{ mt: 1.5, borderRadius: 1 }} />}
    </Box>
  );
}

/**
 * Flujo del período: balance, barra de proporción y, en la página, spark diario.
 * `compact` entra en la tarjeta del hub. `page` va arriba del listado.
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
  const span = formatPeriodSpan(
    getPeriodRange(activePreset).fechaInicio,
    getPeriodRange(activePreset).fechaFin,
  );
  const { stats, loading, error, periodLabel, refetch } = useTransaccionesPeriodStats({
    preset: activePreset,
    cuentaId: dense ? undefined : cuentaId || undefined,
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
  const balanceColor = activa.balance < 0 ? expense : accent;
  const maxBar = Math.max(activa.ingresos, activa.egresos, 0);
  const extras = monedas.length - 1;
  const serie = fillDailySeries(activa.porDia, stats.fechaInicio, stats.fechaFin);

  let body;
  if (loading) {
    body = <FlujoSkeleton dense={dense} />;
  } else if (error) {
    body = (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        No se pudo cargar el período
      </Typography>
    );
  } else {
    body = (
      <>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mb: 0,
          }}
        >
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: dense ? '1rem' : '1.75rem',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: balanceColor,
            }}
          >
            {formatMonto(activa.balance, simbolo, showValues)}
          </Typography>
          {dense && (
            <Typography variant="caption" sx={{ ...hubPeriodSx, mb: 0, flexShrink: 0, textAlign: 'right' }}>
              {span}
            </Typography>
          )}
        </Box>
        {dense && <HubBalanceDivider />}
        {!dense && (
          <Typography
            variant="body2"
            sx={{ mt: 0.375, mb: 1.5, color: 'text.secondary', fontSize: '0.8125rem' }}
          >
            {flowPhrase(activa, showValues)}
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: dense ? 0.75 : 1.25 }}>
          <ProportionTrack
            label="Ingresos"
            amount={`+${formatMonto(activa.ingresos, simbolo, showValues)}`}
            value={activa.ingresos}
            max={maxBar}
            color={accent}
            dense={dense}
          />
          <ProportionTrack
            label="Gastos"
            amount={`−${formatMonto(activa.egresos, simbolo, showValues)}`}
            value={activa.egresos}
            max={maxBar}
            color={expense}
            dense={dense}
          />
        </Box>
        {!dense && <FlujoSpark series={serie} positive={accent} negative={expense} />}
      </>
    );
  }

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
              <PeriodControl preset={activePreset} onChange={changePreset} />
            </Box>
          )}
          {dense && extras > 0 && (
            <Typography
              variant="caption"
              sx={{ ...hubPeriodSx, mb: 0, flex: '0 0 auto', whiteSpace: 'nowrap' }}
            >
              {activa.codigo} +{extras}
            </Typography>
          )}
          {!dense && (
            <LedgerKindFilter
              options={FLUJO_TYPE_FILTERS}
              enabledIds={kindSelection}
              onChange={setKindSelection}
            />
          )}
        </Box>
        {!dense && (
          <Typography variant="caption" sx={{ ...hubPeriodSx, mb: 0 }}>
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

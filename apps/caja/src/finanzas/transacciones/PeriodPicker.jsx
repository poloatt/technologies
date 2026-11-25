import { useMemo } from 'react';
import { Box, MenuItem, Select, alpha, useTheme } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { useAPI } from '@shared/hooks/useAPI';
import { hubLabelSx } from '../../hub';
import {
  formatDateKey,
  formatMonto,
  getPeriodAnchorYear,
  getPeriodBuckets,
  getPeriodMode,
  getPeriodRange,
  monthPresetId,
  parseMonthPreset,
  parseQuarterPreset,
  parseYearPreset,
  presetForMode,
  quarterPresetId,
  sumBucketsNeto,
  yearPresetId,
} from './transaccionesPeriodUtils';

const MODE_OPTIONS = [
  { id: 'year', label: 'Anual', short: 'Anual' },
  { id: 'quarter', label: 'Trimestral', short: 'Trimestral' },
  { id: 'month', label: 'Mensual', short: 'Mensual' },
  { id: 'ytd', label: 'YTD · año a la fecha', short: 'YTD' },
  { id: 'ytg', label: 'YTG · hasta fin de año', short: 'YTG' },
];

const BAR_AREA = 44;
const DEFAULT_ACCENT = '#4CAF50';
/** Alturas relativas del esqueleto mientras carga (12 columnas como máximo). */
const SKELETON_HEIGHTS = [0.5, 0.8, 0.35, 0.65, 0.9, 0.45, 0.7, 0.3, 0.6, 0.85, 0.4, 0.55];
/** Ancho máximo por columna: las barras se reparten el ancho sin estirarse de más. */
const COLUMN_MAX = { year: 64, quarter: 84, month: 42 };

/** Mismo lenguaje que los chips del hub: borde sutil, radio 1.5, sin sombra. */
const controlSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.5,
  transition: 'border-color 120ms ease',
  '&:hover': { borderColor: 'text.disabled' },
};

/** Id canónico del corte elegido (los ids históricos `q2` o `month` se normalizan). */
function selectedBucketId(preset) {
  const month = parseMonthPreset(preset);
  if (month) return monthPresetId(new Date(month.year, month.monthIndex, 1));
  const quarter = parseQuarterPreset(preset);
  if (quarter) return quarterPresetId(quarter.year, quarter.quarter);
  const year = parseYearPreset(preset);
  if (year) return yearPresetId(year.year);
  return null;
}

/** Mismo mes/trimestre, otro año. */
function shiftPresetYear(preset, delta) {
  const month = parseMonthPreset(preset);
  if (month) return monthPresetId(new Date(month.year + delta, month.monthIndex, 1));
  const quarter = parseQuarterPreset(preset);
  if (quarter) return quarterPresetId(quarter.year + delta, quarter.quarter);
  return preset;
}

function StepButton({ label, onClick, disabled, children }) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      sx={{
        ...hubLabelSx,
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        minWidth: 0,
        minHeight: 0,
        m: 0,
        p: 0,
        border: 0,
        borderRadius: 1.5,
        bgcolor: 'transparent',
        color: 'text.secondary',
        cursor: 'pointer',
        font: 'inherit',
        fontWeight: 600,
        lineHeight: 1,
        '&:hover': { color: 'text.primary' },
        '&:focus-visible': { outline: '1px solid', outlineColor: 'text.secondary' },
        '&:disabled': { opacity: 0.3, cursor: 'default', color: 'text.secondary' },
      }}
    >
      {children}
    </Box>
  );
}

function YearStepper({ year, canNext, onPrev, onNext }) {
  return (
    <Box
      role="group"
      aria-label="Año"
      sx={{
        ...controlSx,
        display: 'grid',
        gridTemplateColumns: '26px 2.75rem 26px',
        alignItems: 'center',
        justifyItems: 'center',
        height: 28,
        boxSizing: 'border-box',
      }}
    >
      <StepButton label="Año anterior" onClick={onPrev}>{'<'}</StepButton>
      <Box
        component="span"
        aria-live="polite"
        sx={{ ...hubLabelSx, color: 'text.primary', fontWeight: 700, textAlign: 'center' }}
      >
        {year}
      </Box>
      <StepButton label="Año siguiente" onClick={onNext} disabled={!canNext}>{'>'}</StepButton>
    </Box>
  );
}

/** Netos por columna: una sola consulta que cubre todas las barras. */
function useBucketNetos(buckets) {
  const fechaInicio = buckets[0]?.fechaInicio;
  const fechaFin = buckets[buckets.length - 1]?.fechaFin;
  const params = useMemo(
    () => ({ fechaInicio, fechaFin, estado: 'PAGADO' }),
    [fechaInicio, fechaFin],
  );
  const { data, error } = useAPI('/api/transacciones/stats', {
    params,
    enableCache: true,
    cacheDuration: 60000,
  });

  const matches = !!data
    && data.fechaInicio === fechaInicio
    && data.fechaFin === fechaFin
    && (data.ledger || 'flujo') === 'flujo'
    && !data.kinds
    && !data.cuenta;

  return useMemo(() => {
    if (!matches) return { loading: !error, netos: null, moneda: null };
    // La moneda con más movimiento, la misma que muestra el resumen por defecto.
    const moneda = [...(data.porMoneda ?? [])]
      .sort((a, b) => (b.ingresos + b.egresos) - (a.ingresos + a.egresos))[0] || null;
    return { loading: false, netos: sumBucketsNeto(moneda?.porDia, buckets), moneda };
  }, [matches, data, buckets, error]);
}

function PeriodBars({ mode, year, preset, onChange }) {
  const theme = useTheme();
  const { showValues } = useValuesVisibility();
  const buckets = useMemo(() => getPeriodBuckets(mode, year), [mode, year]);
  const { loading, netos, moneda } = useBucketNetos(buckets);

  const selectedId = selectedBucketId(preset);
  const range = getPeriodRange(preset);
  const todayKey = formatDateKey(new Date());
  const isSelected = (bucket) => (
    selectedId
      ? bucket.id === selectedId
      : bucket.fechaFin >= range.fechaInicio && bucket.fechaInicio <= range.fechaFin
  );

  const values = netos || buckets.map(() => 0);
  const maxPos = Math.max(0, ...values);
  const maxNeg = Math.max(0, ...values.map((value) => -value));
  const total = maxPos + maxNeg;
  const scale = total > 0 ? BAR_AREA / total : 0;
  const zeroY = maxNeg * scale;
  const simbolo = moneda?.simbolo || '$';
  // Mismos colores que el resto de Caja: positivo en el color de la moneda, negativo en rojo.
  const positive = moneda?.color || DEFAULT_ACCENT;
  const negative = theme.palette.error.main;
  const baseline = alpha(theme.palette.text.secondary, 0.3);
  const groupLabel = { year: 'Años', quarter: 'Trimestres', month: 'Meses' }[mode] || 'Meses';
  const columnMax = COLUMN_MAX[mode] || COLUMN_MAX.month;

  return (
    <Box
      role="group"
      aria-label={groupLabel}
      aria-busy={loading}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        gap: 0.25,
        mt: 1,
        mx: 'auto',
        width: '100%',
        maxWidth: columnMax * buckets.length,
      }}
    >
      {buckets.map((bucket, index) => {
        const neto = values[index];
        const selected = isSelected(bucket);
        const future = bucket.fechaInicio > todayKey;
        const current = bucket.fechaInicio <= todayKey && todayKey <= bucket.fechaFin;
        const barHeight = netos && neto !== 0 ? Math.max(Math.abs(neto) * scale, 3) : 0;
        const title = netos
          ? `${bucket.label} · ${formatMonto(neto, simbolo, showValues)}`
          : bucket.label;
        const skeletonHeight = SKELETON_HEIGHTS[index % SKELETON_HEIGHTS.length] * BAR_AREA;
        return (
          <Box
            key={bucket.id}
            component="button"
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={selected}
            aria-current={current ? 'date' : undefined}
            onClick={() => onChange?.(bucket.id)}
            sx={{
              appearance: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: '1 1 0',
              minWidth: 0,
              minHeight: 0,
              m: 0,
              px: 0.25,
              pt: 0.75,
              pb: 0.5,
              border: '1px solid',
              borderColor: selected ? 'divider' : 'transparent',
              borderRadius: 1.5,
              bgcolor: selected ? 'action.selected' : 'transparent',
              cursor: 'pointer',
              font: 'inherit',
              color: selected ? 'text.primary' : 'text.secondary',
              transition: 'background-color 150ms ease, border-color 150ms ease',
              '& .period-bar': {
                opacity: selected ? 1 : future ? 0.3 : 0.55,
                transition: 'opacity 150ms ease, height 240ms ease, bottom 240ms ease',
              },
              '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover', color: 'text.primary' },
              '&:hover .period-bar': { opacity: selected ? 1 : 0.85 },
              '&:focus-visible': { outline: '1px solid', outlineColor: 'text.secondary' },
            }}
          >
            <Box sx={{ position: 'relative', width: '100%', height: BAR_AREA }}>
              <Box
                aria-hidden
                sx={{ position: 'absolute', left: 0, right: 0, bottom: zeroY, height: '1px', bgcolor: baseline }}
              />
              {loading && (
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    left: '24%',
                    right: '24%',
                    bottom: 0,
                    height: skeletonHeight,
                    borderRadius: '2px 2px 0 0',
                    bgcolor: 'action.hover',
                    animation: 'periodPulse 1.3s ease-in-out infinite',
                    '@keyframes periodPulse': { '0%, 100%': { opacity: 0.4 }, '50%': { opacity: 1 } },
                  }}
                />
              )}
              {barHeight > 0 && (
                <Box
                  aria-hidden
                  className="period-bar"
                  sx={{
                    position: 'absolute',
                    left: '24%',
                    right: '24%',
                    height: barHeight,
                    bottom: neto > 0 ? zeroY : zeroY - barHeight,
                    bgcolor: neto > 0 ? positive : negative,
                    borderRadius: neto > 0 ? '2px 2px 0 0' : '0 0 2px 2px',
                  }}
                />
              )}
            </Box>
            <Box
              component="span"
              sx={{
                ...hubLabelSx,
                color: future && !selected ? 'text.disabled' : 'inherit',
                fontSize: '0.625rem',
                fontWeight: selected ? 700 : 500,
                mt: 0.75,
                textTransform: mode === 'month' ? 'lowercase' : 'uppercase',
              }}
            >
              {bucket.label}
            </Box>
            {/* Marca del período en curso: reserva su lugar para que no se muevan las columnas. */}
            <Box
              aria-hidden
              sx={{
                width: 4,
                height: 4,
                mt: 0.5,
                borderRadius: '50%',
                bgcolor: current ? (selected ? 'text.primary' : 'text.secondary') : 'transparent',
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Selector de período: tipo (anual, trimestral, mensual, YTD, YTG) y, debajo,
 * un gráfico de barras con el neto de cada corte del tipo elegido. Tocar una barra elige ese corte.
 */
export default function PeriodPicker({ preset, onChange, trailing = null }) {
  const mode = getPeriodMode(preset);
  const year = getPeriodAnchorYear(preset);
  const currentYear = new Date().getFullYear();
  const stepsYear = mode === 'quarter' || mode === 'month';
  const chartMode = mode === 'ytd' || mode === 'ytg' ? 'month' : mode;

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Box
        role="group"
        aria-label="Período"
        sx={trailing
          ? {
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
            alignItems: 'center',
            columnGap: 1,
            minHeight: 28,
          }
          : { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, minHeight: 28 }}
      >
        <Select
          variant="standard"
          disableUnderline
          value={mode}
          onChange={(event) => onChange?.(presetForMode(event.target.value, preset))}
          inputProps={{ 'aria-label': 'Tipo de período' }}
          renderValue={(value) => MODE_OPTIONS.find((option) => option.id === value)?.short}
          MenuProps={{
            PaperProps: {
              sx: {
                mt: 0.5,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                backgroundImage: 'none',
                boxShadow: 'none',
              },
            },
          }}
          sx={{
            ...hubLabelSx,
            ...controlSx,
            gridColumn: 1,
            justifySelf: 'start',
            height: 28,
            boxSizing: 'border-box',
            color: 'text.primary',
            fontWeight: 700,
            '& .MuiSelect-select': {
              display: 'flex',
              alignItems: 'center',
              minHeight: 0,
              height: 26,
              py: 0,
              pl: 1,
              pr: '24px !important',
              '&:focus': { bgcolor: 'transparent' },
            },
            '& .MuiSelect-icon': { right: 4, fontSize: '1.125rem', color: 'text.secondary' },
          }}
        >
          {MODE_OPTIONS.map((option) => (
            <MenuItem
              key={option.id}
              value={option.id}
              divider={option.id === 'month'}
              sx={{ fontSize: '0.8125rem', minHeight: 36 }}
            >
              {option.label}
            </MenuItem>
          ))}
        </Select>
        {stepsYear && (
          <Box sx={{ gridColumn: 2, justifySelf: 'center' }}>
            <YearStepper
              year={year}
              canNext={year < currentYear}
              onPrev={() => onChange?.(shiftPresetYear(preset, -1))}
              onNext={() => onChange?.(shiftPresetYear(preset, 1))}
            />
          </Box>
        )}
        {trailing && <Box sx={{ gridColumn: 3, justifySelf: 'end', minWidth: 0 }}>{trailing}</Box>}
      </Box>
      <PeriodBars mode={chartMode} year={year} preset={preset} onChange={onChange} />
    </Box>
  );
}

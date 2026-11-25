import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useMercadoPago } from '@shared/hooks/useMercadoPago';
import {
  TASK_FORM_PILL_FILL_BG,
  TASK_FORM_PILL_FONT_SIZE,
  TASK_FORM_PILL_LINE_HEIGHT,
  TASK_FORM_PILL_OUTLINE_BORDER,
  TASK_FORM_PILL_OUTLINED_BG_HOVER,
  taskFormPillOutlinedSx,
} from '@shared/components/forms/tareaFormTokens';

const mercadopagoLogo = new URL('./logos/mercadopago.svg', import.meta.url).href;

/** Piso del recorrido histórico. Mercado Pago no entrega años anteriores a esto. */
const HISTORIAL_DESDE = '2010-01-01';
const HISTORIAL_MAX_MESES = 240;
const HISTORY_DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_SYNC_DAYS = 90;

function historyTarget() {
  return new Date(`${HISTORIAL_DESDE}T00:00:00.000-03:00`);
}

function monthKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return year && month ? `${year}-${month}` : '';
}

function monthStamp(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  const raw = date.toLocaleDateString('es-AR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).replace(/\./g, '').replace(/\s+de\s+/i, ' ').trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
}

/** Los mismos tramos de un mes que recorre el sync, del borde de 90 días hacia 2010. */
function buildHistorySpan(now = new Date()) {
  const target = historyTarget();
  const months = [];
  let edge = new Date(now.getTime() - HISTORY_SYNC_DAYS * HISTORY_DAY_MS);
  while (months.length < HISTORIAL_MAX_MESES && edge.getTime() > target.getTime()) {
    const begin = new Date(edge);
    begin.setMonth(begin.getMonth() - 1);
    if (begin.getTime() < target.getTime()) begin.setTime(target.getTime());
    months.push({ begin, key: monthKey(begin) });
    if (begin.getTime() <= target.getTime()) break;
    edge = begin;
  }
  return { months, total: months.length };
}

function coveredCount(months, cubiertoHasta) {
  if (!cubiertoHasta) return 0;
  const key = monthKey(new Date(cubiertoHasta));
  if (!key) return 0;
  let count = 0;
  for (const month of months) {
    if (month.key >= key) count += 1;
    else break;
  }
  return count;
}

function progressDoneFrom(historial, span) {
  if (!historial?.cubiertoHasta) return 0;
  if (historial.completo || historial.quedaHistorial === false) return span.total;
  return coveredCount(span.months, historial.cubiertoHasta);
}

function progressLabelFrom(historial, span, done) {
  if (!span.total) return '';
  if (done >= span.total) return monthStamp(span.months[span.total - 1]?.begin);
  if (done <= 0) return monthStamp(span.months[0]?.begin);
  const at = historial?.ultimoMes?.beginDate || historial?.cubiertoHasta;
  return monthStamp(at ? new Date(at) : span.months[done - 1]?.begin);
}

function formatDay(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

function describeRun(historial) {
  if (!historial) return null;
  if (historial.cuotaAgotada) {
    return `Cupo de Mercado Pago agotado en ${historial.mesLabel || 'el último mes'}. Se puede retomar.`;
  }
  if (historial.pendiente) {
    return `Quedó pendiente ${historial.mesLabel || 'el último mes'}. Reintentá ese tramo.`;
  }
  if (historial.completo || historial.quedaHistorial === false) {
    const hasta = formatDay(historial.cubiertoHasta || historial.objetivo);
    return hasta ? `Historial cubierto hasta el ${hasta}.` : 'El historial pedido ya está cubierto.';
  }
  return historial.mesLabel ? `Último tramo: ${historial.mesLabel}.` : null;
}

export function SyncModePill({ historico, onChange, disabled = false }) {
  const modes = [
    { id: 'rapido', label: 'Rápido', selected: !historico, onClick: () => onChange(false) },
    { id: 'historico', label: 'Histórico', selected: historico, onClick: () => onChange(true) },
  ];

  return (
    <Box
      role="group"
      aria-label="Tipo de sincronización"
      sx={{
        ...taskFormPillOutlinedSx,
        display: 'inline-flex',
        alignItems: 'stretch',
        flexShrink: 0,
        p: 0,
        gap: 0,
        overflow: 'hidden',
        cursor: 'default',
        ...(disabled ? { pointerEvents: 'none', opacity: 0.45 } : null),
      }}
    >
      {modes.map((mode, index) => (
        <React.Fragment key={mode.id}>
          {index > 0 && (
            <Box
              aria-hidden
              sx={{
                width: '1px',
                alignSelf: 'stretch',
                bgcolor: TASK_FORM_PILL_OUTLINE_BORDER,
                flexShrink: 0,
              }}
            />
          )}
          <Box
            component="button"
            type="button"
            aria-pressed={mode.selected}
            disabled={disabled}
            onClick={mode.onClick}
            sx={{
              appearance: 'none',
              border: 0,
              m: 0,
              px: 1.5,
              minWidth: 0,
              minHeight: 0,
              bgcolor: mode.selected ? TASK_FORM_PILL_FILL_BG : 'transparent',
              color: mode.selected ? 'text.primary' : 'text.secondary',
              fontFamily: 'inherit',
              fontSize: TASK_FORM_PILL_FONT_SIZE,
              fontWeight: mode.selected ? 500 : 400,
              lineHeight: TASK_FORM_PILL_LINE_HEIGHT,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: mode.selected ? TASK_FORM_PILL_FILL_BG : TASK_FORM_PILL_OUTLINED_BG_HOVER,
              },
            }}
          >
            {mode.label}
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
}

export default function MercadoPagoSyncOptions({
  connectionId,
  onSynced,
  historico: historicoProp,
  onHistoricoChange,
  historial = null,
  showPill = true,
  onBusyChange,
}) {
  const { loading, syncConnection } = useMercadoPago();
  const { enqueueSnackbar } = useSnackbar();
  const [innerHistorico, setInnerHistorico] = useState(false);
  const historico = historicoProp ?? innerHistorico;
  const setHistorico = onHistoricoChange ?? setInnerHistorico;
  const [running, setRunning] = useState(false);
  const [flight, setFlight] = useState(null);
  const cancelRef = useRef(false);
  const span = useMemo(() => buildHistorySpan(), []);

  useEffect(() => () => {
    cancelRef.current = true;
  }, []);

  useEffect(() => {
    if (!historico) setFlight(null);
  }, [historico]);

  const stopped = (result) => {
    const chunk = result?.resultado?.historial;
    const quota = result?.resultado?.detalles?.errores?.some((item) => item.quotaExceeded);
    return !result
      || result.exito === false
      || result.resultado?.syncParcial
      || result.resultado?.settlementPending
      || quota
      || chunk?.cuotaAgotada
      || chunk?.pendiente;
  };

  const runHistorico = async () => {
    const storedDone = progressDoneFrom(historial, span);
    const atMonth = (index) => span.months[Math.min(Math.max(index, 0), Math.max(span.total - 1, 0))];
    setFlight({
      label: monthStamp(atMonth(storedDone)?.begin),
      done: storedDone,
    });

    const recent = await syncConnection(connectionId, { silent: true });
    if (!cancelRef.current) onSynced?.(recent);
    if (cancelRef.current || stopped(recent)) {
      enqueueSnackbar(recent?.message || 'Sincronización detenida', {
        variant: recent?.exito === false || recent?.resultado?.syncParcial ? 'warning' : 'success',
        autoHideDuration: 8000,
      });
      return recent;
    }

    let last = recent;
    let cursor = null;
    let done = storedDone;
    for (let step = 0; step < span.total; step += 1) {
      if (cancelRef.current || done >= span.total) return last;
      const current = span.months[done];
      if (!current) break;
      setFlight({ label: monthStamp(current.begin), done });
      const result = await syncConnection(connectionId, {
        mode: 'historial',
        since: HISTORIAL_DESDE,
        silent: true,
      });
      last = result;
      const chunk = result?.resultado?.historial;
      if (!cancelRef.current) onSynced?.(result);
      const reached = chunk?.ultimoMes?.beginDate || chunk?.cubiertoHasta;
      const label = reached ? monthStamp(new Date(reached)) : monthStamp(current.begin);
      const halted = !chunk || chunk.completo || chunk.cuotaAgotada || chunk.pendiente || chunk.quedaHistorial === false;
      const finished = !chunk || chunk.completo || chunk.quedaHistorial === false;
      let covered = finished ? span.total : coveredCount(span.months, chunk?.cubiertoHasta);
      if (!halted && covered <= done) covered = Math.min(span.total, done + 1);
      done = covered;
      if (!cancelRef.current) setFlight({ label, done });
      if (!chunk || chunk.completo || chunk.cuotaAgotada || chunk.pendiente || chunk.quedaHistorial === false) {
        break;
      }
      const nextCursor = chunk.cubiertoHasta || '';
      if (nextCursor && nextCursor === cursor) break;
      cursor = nextCursor;
    }
    if (cancelRef.current) return last;
    const note = describeRun(last?.resultado?.historial);
    enqueueSnackbar(note || last?.message || 'Historial actualizado', {
      variant: last?.resultado?.historial?.cuotaAgotada || last?.resultado?.historial?.pendiente ? 'warning' : 'success',
      autoHideDuration: 8000,
    });
    return last;
  };

  const run = async () => {
    if (!connectionId || loading || running) return;
    cancelRef.current = false;
    setRunning(true);
    try {
      if (historico) {
        await runHistorico();
      } else {
        const result = await syncConnection(connectionId, {});
        onSynced?.(result);
      }
    } catch {
      // El hook ya muestra el error.
    } finally {
      if (!cancelRef.current) setRunning(false);
    }
  };

  const busy = loading || running;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const storedDone = progressDoneFrom(historial, span);
  const storedLabel = progressLabelFrom(historial, span, storedDone);
  const progressDone = flight?.done ?? storedDone;
  const progressLabel = flight?.label || storedLabel;
  const progressRatio = span.total ? Math.min(1, progressDone / span.total) : 0;

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      width: '100%',
      maxWidth: 420,
      pt: showPill ? 2 : 0.5,
      pb: 1,
    }}>
      {showPill && (
        <SyncModePill historico={historico} disabled={busy} onChange={setHistorico} />
      )}
      <Box
        component="button"
        type="button"
        aria-label={busy
          ? (historico ? 'Trayendo historial' : 'Sincronizando')
          : 'Sincronizar Mercado Pago'}
        disabled={busy || !connectionId}
        onClick={run}
        sx={{
          appearance: 'none',
          alignSelf: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          m: 0,
          p: 0.5,
          border: 0,
          borderRadius: 0,
          bgcolor: 'transparent',
          cursor: 'pointer',
          opacity: busy || !connectionId ? 0.5 : 1,
          '&:hover': { bgcolor: 'action.hover' },
          '&:disabled': { cursor: 'default' },
        }}
      >
        {busy ? (
          <CircularProgress size={22} />
        ) : (
          <img
            src={mercadopagoLogo}
            alt=""
            style={{ width: 148, height: 38, objectFit: 'contain', display: 'block' }}
          />
        )}
      </Box>
      {historico && span.total > 0 && (
        <Box sx={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Typography
            component="p"
            sx={{
              m: 0,
              textAlign: 'center',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'text.secondary',
            }}
          >
            <Box component="span" sx={{ color: 'text.primary' }}>{progressLabel}</Box>
            {` / ${span.total} meses`}
          </Typography>
          <Box
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={span.total}
            aria-valuenow={Math.min(progressDone, span.total)}
            aria-label={`${progressLabel} de ${span.total} meses`}
            sx={{ height: 2, bgcolor: 'divider', overflow: 'hidden' }}
          >
            <Box
              sx={{
                width: `${progressRatio * 100}%`,
                height: '100%',
                bgcolor: 'text.primary',
                transition: 'width 240ms ease',
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

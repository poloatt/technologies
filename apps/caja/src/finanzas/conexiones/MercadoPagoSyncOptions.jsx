import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useSnackbar } from 'notistack';
import CommonProgressBar from '@shared/components/common/CommonProgressBar';
import { useMercadoPago } from '@shared/hooks/useMercadoPago';
import mercadopagoService from '@shared/services/mercadopagoService';
import {
  TASK_FORM_PILL_FILL_BG,
  TASK_FORM_PILL_FONT_SIZE,
  TASK_FORM_PILL_LINE_HEIGHT,
  TASK_FORM_PILL_OUTLINE_BORDER,
  TASK_FORM_PILL_OUTLINED_BG_HOVER,
  taskFormPillOutlinedSx,
} from '@shared/components/forms/tareaFormTokens';

const mercadopagoLogo = new URL('./logos/mercadopago.svg', import.meta.url).href;
const SYNC_MODE_KEY = 'mercadopago_sync_mode';
const SYNC_SINCE_KEY = 'mercadopago_sync_since';

/** Piso del recorrido histórico. El backend lo acota al inicio real de actividad de la cuenta. */
const HISTORIAL_DESDE = '2010-01-01';
const HISTORIAL_MAX_TRAMOS = 120;
const HISTORY_DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_SYNC_DAYS = 90;
const HISTORY_CHUNK_DAYS = 58;
/** Tope de tramos sin retiros que se vuelven a pedir en una corrida (cada uno es un reporte MP). */
const REVISIONES_MAX = 3;

function historyTarget(since = HISTORIAL_DESDE) {
  if (since && since !== HISTORIAL_DESDE) {
    const parsed = new Date(since);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(`${HISTORIAL_DESDE}T00:00:00.000-03:00`);
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

/** Los mismos tramos de 58 días que recorre el sync, del borde de 90 días hacia el inicio de la cuenta. */
function buildHistorySpan(now = new Date(), since = HISTORIAL_DESDE) {
  const target = historyTarget(since);
  const months = [];
  let edge = new Date(now.getTime() - HISTORY_SYNC_DAYS * HISTORY_DAY_MS);
  while (months.length < HISTORIAL_MAX_TRAMOS && edge.getTime() > target.getTime()) {
    const begin = new Date(edge.getTime() - HISTORY_CHUNK_DAYS * HISTORY_DAY_MS);
    if (begin.getTime() < target.getTime()) begin.setTime(target.getTime());
    months.push({ begin });
    if (begin.getTime() <= target.getTime()) break;
    edge = begin;
  }
  return { months, total: months.length };
}

function coveredCount(months, cubiertoHasta) {
  const until = new Date(cubiertoHasta).getTime();
  if (!cubiertoHasta || Number.isNaN(until)) return 0;
  let count = 0;
  for (const month of months) {
    if (month.begin.getTime() >= until) count += 1;
    else break;
  }
  return count;
}

function progressDoneFrom(historial, span) {
  if (!historial?.cubiertoHasta) return 0;
  if (historial.completo || historial.quedaHistorial === false) return span.total;
  return coveredCount(span.months, historial.cubiertoHasta);
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
  if (historial.revision?.beginDate) {
    return historial.revision.pendiente || historial.revision.cuotaAgotada
      ? `Quedó pendiente la revisión de ${historial.revision.mesLabel} (sin retiros a CBU). Reintentá más tarde.`
      : `Se volvió a importar ${historial.revision.mesLabel}, que había quedado sin retiros a CBU.`;
  }
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
  ready = true,
}) {
  const { loading, syncConnection } = useMercadoPago();
  const { enqueueSnackbar } = useSnackbar();
  const [innerHistorico, setInnerHistorico] = useState(false);
  const historico = historicoProp ?? innerHistorico;
  const setHistorico = onHistoricoChange ?? setInnerHistorico;
  const [running, setRunning] = useState(false);
  const [flight, setFlight] = useState(null);
  const cancelRef = useRef(false);
  const span = useMemo(
    () => buildHistorySpan(new Date(), historial?.inicioActividad || historial?.objetivo || HISTORIAL_DESDE),
    [historial?.inicioActividad, historial?.objetivo]
  );

  useEffect(() => () => {
    cancelRef.current = true;
  }, []);

  useEffect(() => {
    if (!historico) setFlight(null);
  }, [historico]);

  const haltHistory = (result) => {
    const chunk = result?.resultado?.historial;
    const quota = result?.resultado?.detalles?.errores?.some((item) => item.quotaExceeded);
    return !result
      || result.exito === false
      || result.resultado?.settlementPending
      || quota
      || chunk?.cuotaAgotada
      || chunk?.pendiente;
  };

  const runHistorico = async () => {
    const done0 = progressDoneFrom(historial, span);
    const firstMonth = span.months[Math.min(done0, Math.max(span.total - 1, 0))];
    if (!cancelRef.current && span.total > 0) {
      setFlight({
        label: firstMonth ? monthStamp(firstMonth.begin) : 'Historial',
        done: done0,
        active: true,
      });
    }

    // Si estamos retomando un histórico pendiente o con cuota agotada, ir directo al tramo
    // pendiente sin gastar un reporte extra en el sync rápido.
    const resumingPending = Boolean(historial?.pendiente || historial?.cuotaAgotada);
    let last = null;
    if (!resumingPending) {
      const recent = await syncConnection(connectionId, { mode: 'rapido', silent: true });
      if (!cancelRef.current) onSynced?.(recent);
      if (cancelRef.current || haltHistory(recent)) {
        enqueueSnackbar(recent?.message || 'Sincronización detenida', {
          variant: recent?.exito === false || recent?.resultado?.settlementPending ? 'warning' : 'success',
          autoHideDuration: 8000,
        });
        return recent;
      }
      last = recent;
    }
    let done = progressDoneFrom(historial, span);
    let revisando = false;
    let revisiones = 0;
    let cursorTime = historial?.cubiertoHasta ? new Date(historial.cubiertoHasta).getTime() : null;
    if (cursorTime != null && Number.isNaN(cursorTime)) cursorTime = null;

    // Con el recorrido completo igual se pide una vez: el backend puede revisar tramos sin retiros.
    for (let step = 0; step < span.total + REVISIONES_MAX; step += 1) {
      if (cancelRef.current || (done >= span.total && step > 0 && !revisando)) break;
      const current = span.months[Math.min(done, span.total - 1)];
      if (!current) break;
      if (!cancelRef.current) {
        setFlight({ label: monthStamp(current.begin), done, active: true });
      }
      const result = await syncConnection(connectionId, {
        mode: 'historial',
        since: HISTORIAL_DESDE,
        silent: true,
      });
      last = result;
      const chunk = result?.resultado?.historial;
      if (!cancelRef.current) onSynced?.(result);
      // Una revisión vuelve a pedir un tramo ya cubierto: no mueve el cursor y se sigue.
      revisando = Boolean(chunk?.revision?.beginDate);
      const finished = !revisando && Boolean(chunk?.completo || chunk?.quedaHistorial === false);
      const halted = !chunk || finished || chunk.cuotaAgotada || chunk.pendiente;
      const nextTime = chunk?.cubiertoHasta ? new Date(chunk.cubiertoHasta).getTime() : NaN;
      const movedBack = Number.isFinite(nextTime) && (cursorTime == null || nextTime < cursorTime);
      if (revisando && !halted) {
        revisiones += 1;
        if (!cancelRef.current) setFlight({ label: `Revisión ${chunk.revision.mesLabel}`, done, active: false });
        if (revisiones >= REVISIONES_MAX) break;
        continue;
      }
      if (!halted && !movedBack) break;
      if (movedBack) cursorTime = nextTime;
      const covered = finished ? span.total : coveredCount(span.months, chunk?.cubiertoHasta);
      done = finished ? span.total : Math.min(span.total, Math.max(covered, movedBack ? done + 1 : done));
      const reached = chunk?.ultimoMes?.beginDate || chunk?.cubiertoHasta;
      const label = reached ? monthStamp(new Date(reached)) : monthStamp(current.begin);
      if (!cancelRef.current) setFlight({ label, done, active: false });
      if (halted) break;
    }
    if (cancelRef.current) return last;
    const note = describeRun(last?.resultado?.historial);
    enqueueSnackbar(note || last?.message || 'Historial actualizado', {
      variant: last?.resultado?.historial?.cuotaAgotada || last?.resultado?.historial?.pendiente ? 'warning' : 'success',
      autoHideDuration: 8000,
    });
    return last;
  };

  const openMercadoPago = async () => {
    try {
      const mode = historico ? 'historial' : 'rapido';
      localStorage.setItem(SYNC_MODE_KEY, mode);
      if (historico) localStorage.setItem(SYNC_SINCE_KEY, HISTORIAL_DESDE);
      else localStorage.removeItem(SYNC_SINCE_KEY);
      await mercadopagoService.connect({
        mode,
        since: historico ? HISTORIAL_DESDE : undefined,
      });
    } catch (error) {
      enqueueSnackbar(error.message || 'No se pudo abrir Mercado Pago', { variant: 'error' });
    }
  };

  const run = async (wantHistory = false) => {
    if (loading || running || !ready || !connectionId) return;
    cancelRef.current = false;
    setRunning(true);
    try {
      if (wantHistory) {
        await runHistorico();
      } else {
        const result = await syncConnection(connectionId, { mode: 'rapido' });
        onSynced?.(result);
      }
    } catch {
      // El hook ya muestra el error.
    } finally {
      setRunning(false);
    }
  };

  const busy = loading || running;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const showProgress = running && historico && flight && span.total > 0;

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
        aria-label="Abrir Mercado Pago"
        onClick={openMercadoPago}
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
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <img
          src={mercadopagoLogo}
          alt=""
          style={{ width: 148, height: 38, objectFit: 'contain', display: 'block' }}
        />
      </Box>
      {showProgress && (
        <CommonProgressBar
          value={flight.done}
          maxValue={span.total}
          leftLabel={flight.label}
          rightLabel={`${flight.done} / ${span.total}`}
          indeterminate={flight.active && flight.done <= 0}
          showLabels
          variant="compact"
          color="primary"
          sx={{ alignSelf: 'stretch', width: '100%' }}
        />
      )}
    </Box>
  );
}

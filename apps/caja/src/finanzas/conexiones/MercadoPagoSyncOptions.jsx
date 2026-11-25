import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
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
  showPill = true,
  onBusyChange,
}) {
  const { loading, syncConnection } = useMercadoPago();
  const { enqueueSnackbar } = useSnackbar();
  const [innerHistorico, setInnerHistorico] = useState(false);
  const historico = historicoProp ?? innerHistorico;
  const setHistorico = onHistoricoChange ?? setInnerHistorico;
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => () => {
    cancelRef.current = true;
  }, []);

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
    for (let step = 0; step < HISTORIAL_MAX_MESES; step += 1) {
      if (cancelRef.current) return last;
      const result = await syncConnection(connectionId, {
        mode: 'historial',
        since: HISTORIAL_DESDE,
        silent: true,
      });
      last = result;
      const chunk = result?.resultado?.historial;
      if (!cancelRef.current) onSynced?.(result);
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pt: showPill ? 2 : 0.5, pb: 1 }}>
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
    </Box>
  );
}

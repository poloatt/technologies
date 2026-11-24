import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMercadoPago } from '@shared/hooks/useMercadoPago';

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

function describeHistorial(historial) {
  if (!historial?.cubiertoHasta && !historial?.ultimoMes) {
    return 'Cada corrida trae un mes anterior a los últimos 90 días. Se puede repetir hasta cubrir la fecha elegida.';
  }
  const hasta = formatDay(historial.cubiertoHasta);
  const objetivo = formatDay(historial.objetivo);
  if (historial.cuotaAgotada) {
    return `Cupo de Mercado Pago agotado en ${historial.mesLabel || 'el mes pedido'}. Ese mes queda pendiente.`;
  }
  if (historial.pendiente) {
    return `Quedó pendiente ${historial.mesLabel || 'el último mes'}. Reintentá ese tramo antes de seguir.`;
  }
  if (historial.completo || historial.quedaHistorial === false) {
    return hasta
      ? `Historial cubierto hasta el ${hasta}.`
      : 'Esa fecha ya está dentro de los últimos 90 días.';
  }
  return `Cubierto hasta el ${hasta || 'el último mes'}. Falta llegar al ${objetivo || 'la fecha elegida'}.`;
}

export default function MercadoPagoSyncOptions({
  connectionId,
  historial = null,
  showDailySync = false,
  onSynced,
}) {
  const { loading, syncConnection } = useMercadoPago();
  const year = new Date().getFullYear();
  const [preset, setPreset] = useState('este-anio');
  const [since, setSince] = useState(`${year}-01-01`);
  const [progress, setProgress] = useState(historial);

  useEffect(() => {
    setProgress(historial);
  }, [historial]);

  const targetSince = preset === 'anio-anterior'
    ? `${year - 1}-01-01`
    : preset === 'fecha'
      ? since
      : `${year}-01-01`;

  const run = async (options) => {
    if (!connectionId) return;
    const result = await syncConnection(connectionId, options);
    if (result?.resultado?.historial) {
      setProgress(result.resultado.historial);
    }
    onSynced?.(result);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
      {showDailySync && (
        <>
          <Typography variant="body2" color="text.secondary">
            La sincronización habitual trae los últimos 90 días. No recorre el año anterior.
          </Typography>
          <Button
            variant="contained"
            disabled={loading || !connectionId}
            onClick={() => run({})}
            sx={{ borderRadius: 0, alignSelf: 'flex-start' }}
          >
            Sincronizar últimos 90 días
          </Button>
          <Divider />
        </>
      )}
      <Typography variant="subtitle2">Traer historial</Typography>
      <Typography variant="body2" color="text.secondary">
        {describeHistorial(progress)}
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={preset}
        onChange={(_, value) => {
          if (value) setPreset(value);
        }}
      >
        <ToggleButton value="este-anio">Este año</ToggleButton>
        <ToggleButton value="anio-anterior">Año anterior</ToggleButton>
        <ToggleButton value="fecha">Una fecha</ToggleButton>
      </ToggleButtonGroup>
      {preset === 'fecha' && (
        <TextField
          label="Desde"
          type="date"
          value={since}
          onChange={(e) => setSince(e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
        />
      )}
      <Button
        variant={showDailySync ? 'outlined' : 'contained'}
        disabled={loading || !connectionId || !targetSince}
        onClick={() => run({ mode: 'historial', since: targetSince })}
        sx={{ borderRadius: 0, alignSelf: 'flex-start' }}
      >
        {loading ? 'Trayendo un mes...' : 'Traer un mes'}
      </Button>
    </Box>
  );
}

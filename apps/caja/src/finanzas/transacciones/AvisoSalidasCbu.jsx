import { Box, Tooltip, Typography } from '@mui/material';
import { WarningAmberRounded as WarningIcon } from '@mui/icons-material';
import { FONT_SIZE } from '@shared/tipografia';
import { formatMonto } from './transaccionesPeriodUtils';

/**
 * Aviso visible cuando las salidas a CBU (CVU→CBU) de Mercado Pago no están validadas para todo
 * el historial. No oculta ni modifica números: acompaña a los saldos para que "dinero en cuenta"
 * no se tome como confirmado mientras falten tramos por validar.
 */
export default function AvisoSalidasCbu({ cobertura, salidasBancarias, simbolo = '$', showValues = true }) {
  if (!cobertura?.advertencia || !cobertura.avisos?.length) return null;

  const resumen = cobertura.avisos[0];
  const detalle = (
    <Box sx={{ maxWidth: 320 }}>
      {cobertura.avisos.map((aviso) => (
        <Typography key={aviso} variant="caption" component="div" sx={{ mb: 0.5 }}>
          {aviso}
        </Typography>
      ))}
      {salidasBancarias ? (
        <Typography variant="caption" component="div" sx={{ mt: 0.5, opacity: 0.85 }}>
          Salidas a CBU del período: {formatMonto(salidasBancarias.total, simbolo, showValues)} ({salidasBancarias.cantidad})
        </Typography>
      ) : null}
    </Box>
  );

  return (
    <Tooltip title={detalle} placement="bottom-start" arrow>
      <Box
        role="status"
        data-testid="aviso-salidas-cbu"
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0.5,
          mt: 1,
          color: 'warning.main',
          cursor: 'help',
        }}
      >
        <WarningIcon sx={{ fontSize: 16, mt: '1px', flex: '0 0 auto' }} />
        <Typography variant="caption" sx={{ fontSize: FONT_SIZE.xs ?? FONT_SIZE.sm, lineHeight: 1.3 }}>
          {resumen}
        </Typography>
      </Box>
    </Tooltip>
  );
}

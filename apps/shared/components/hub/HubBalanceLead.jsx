import { Box, Skeleton, Typography } from '@mui/material';
import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, hubNumericSx } from '../../tipografia';

export const DEFAULT_FLUJO_NETO_LABEL = 'Flujo neto del período';

/**
 * Bloque único de flujo neto centrado (monto + etiqueta secundaria debajo).
 * SSOT compartido entre el desglose extendido de Cuentas y todas las subpáginas
 * financieras (Movimientos, Dólares, Inversiones, Tarjeta).
 * `dense={true}` (default) se usa en tarjetas compactas del hub; `dense={false}`
 * escala el monto como hero de subpágina.
 */
export default function HubBalanceLead({
  amount,
  label = DEFAULT_FLUJO_NETO_LABEL,
  color,
  dense = true,
  loading = false,
  error = false,
  sx,
}) {
  let content;
  if (loading) {
    content = (
      <Skeleton
        component="span"
        width={dense ? 110 : 148}
        height={dense ? 18 : 28}
        sx={{ display: 'inline-block', borderRadius: 0.5 }}
      />
    );
  } else if (error) {
    content = '—';
  } else {
    content = amount;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        flex: '0 0 100%',
        width: '100%',
        gap: dense ? 0.375 : 0.25,
        pt: dense ? 0 : 0.25,
        pb: dense ? 0.5 : 0,
        textAlign: 'center',
        ...sx,
      }}
    >
      <Typography
        sx={{
          ...hubNumericSx,
          fontSize: dense ? FONT_SIZE.base : FONT_SIZE['3xl'],
          fontWeight: dense ? FONT_WEIGHT.semibold : FONT_WEIGHT.bold,
          lineHeight: 1.15,
          letterSpacing: dense ? LETTER_SPACING.tight : LETTER_SPACING.tighter,
          color: !loading && !error ? (color || 'text.primary') : 'text.primary',
        }}
      >
        {content}
      </Typography>
      {label && (
        <Typography
          component="span"
          sx={{
            fontSize: FONT_SIZE.xs,
            fontWeight: 450,
            lineHeight: 1.2,
            color: 'text.secondary',
          }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );
}

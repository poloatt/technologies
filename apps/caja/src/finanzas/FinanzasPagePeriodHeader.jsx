import { Box, Typography } from '@mui/material';
import PageTitle from '@shared/components/common/PageTitle';
import { hubEyebrowSx } from '@shared/tipografia';
import PeriodPicker from './transacciones/PeriodPicker';

/** Contenedor de sección de resumen en subpáginas de Finanzas. */
export const finanzasPageSummarySectionSx = {
  mb: 1.5,
  pb: 1.75,
  borderBottom: '1px solid',
  borderColor: 'divider',
};

/**
 * Cabecera de subpágina financiera: gráfico de barras con selector de período
 * arriba (alineado a la izquierda y rango a la derecha, igual que el hub),
 * título de sección debajo y subtítulo secundario flotante si viene desde una cuenta.
 */
export default function FinanzasPagePeriodHeader({
  title,
  subtitle = null,
  extra = null,
  preset,
  onChange,
  span,
  modes = null,
  cuentaId,
  positiveColor,
  ledger = null,
  kinds = null,
  yieldSide = null,
  mb = 1.25,
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb }}>
      <PeriodPicker
        preset={preset}
        onChange={onChange}
        modes={modes}
        cuentaId={cuentaId}
        positiveColor={positiveColor}
        ledger={ledger}
        kinds={kinds}
        yieldSide={yieldSide}
        trailing={span ? (
          <Typography
            variant="caption"
            aria-label="Rango del período"
            sx={{
              ...hubEyebrowSx,
              mb: 0,
              display: 'block',
              lineHeight: '28px',
              whiteSpace: 'nowrap',
              textAlign: 'right',
            }}
          >
            {span}
          </Typography>
        ) : null}
      />
      {(title || subtitle || extra) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {title && <PageTitle variant="subtitle1">{title}</PageTitle>}
          {subtitle && (
            <Typography variant="caption" sx={{ ...hubEyebrowSx, mb: 0 }}>
              {subtitle}
            </Typography>
          )}
          {extra && <Box sx={{ mt: 0.5 }}>{extra}</Box>}
        </Box>
      )}
    </Box>
  );
}

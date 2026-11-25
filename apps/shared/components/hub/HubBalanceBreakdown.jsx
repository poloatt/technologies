import { Box, Collapse, Skeleton, Typography } from '@mui/material';
import {
  filterToggleAmountSx,
  getFilterToggleButtonSx,
  getFilterToggleFloatingLabelSx,
} from '../../styles/filterToggleStyles';
import { hubEyebrowSx } from '../../styles/hubBalanceTypography';

const COLUMNS = 3;
const GAP = 1.5;

/**
 * Desglose de un saldo hub con la estética de los botones de filtro: monto arriba
 * y etiqueta flotante debajo, centrados y sin caja. Cada ítem es un botón que
 * navega (el destino lo resuelve quien lo usa con `onClick`).
 * items: [{ id, label, amount, color, onClick }]
 */
export default function HubBalanceBreakdown({ id, open, items = [], loading = false, error = false }) {
  const itemWidth = `calc((100% - ${GAP * (COLUMNS - 1) * 8}px) / ${COLUMNS})`;
  return (
    <Collapse in={open} timeout={180} unmountOnExit>
      <Box
        id={id}
        role="group"
        aria-label="Saldos de la cuenta"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: GAP,
          rowGap: 1.5,
          pt: 1.25,
          pb: 0.5,
        }}
      >
        {loading && items.length === 0 && Array.from({ length: COLUMNS }).map((_, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <Skeleton key={index} height={28} sx={{ width: itemWidth, borderRadius: 0.5 }} />
        ))}
        {error && items.length === 0 && (
          <Typography sx={{ ...hubEyebrowSx, textTransform: 'none' }}>
            No se pudieron cargar los saldos
          </Typography>
        )}
        {items.map((item) => (
          <Box
            key={item.id}
            component="button"
            type="button"
            onClick={item.onClick}
            sx={{
              ...getFilterToggleButtonSx(),
              flex: '0 0 auto',
              width: itemWidth,
              gap: 0.5,
              cursor: item.onClick ? 'pointer' : 'default',
            }}
          >
            <Typography sx={{ ...filterToggleAmountSx, color: item.color || 'text.primary' }}>
              {item.amount}
            </Typography>
            <Typography component="span" sx={getFilterToggleFloatingLabelSx(false)}>
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Collapse>
  );
}

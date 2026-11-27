import { useId, useState } from 'react';
import { Box, Skeleton, useTheme } from '@mui/material';
import HubBalanceRow from './HubBalanceRow';
import HubBalanceBreakdown from './HubBalanceBreakdown';
import HubBalanceLead from './HubBalanceLead';
import { collapseInlineToggleSx } from '../../styles/collapseSectionStyles';

/**
 * Definición visual única para cualquier cuenta en el Hub (estilo MERCADOPAGO POLOATTA):
 *  - En modo `dense` (hub):
 *    - Subsección liviana sin caja anidada ni barra tintada (usa `collapseInlineToggleSx`
 *      y tipografía eyebrow de `@shared` para no competir con `HubSectionHeader`).
 *    - `HubBalanceBreakdown` con `lead` centrado arriba (`Flujo neto del período`) y la grilla
 *      de 3 columnas debajo con cada saldo en su color/símbolo.
 *  - En modo página (`dense={false}`):
 *    - `HubBalanceLead` centrado (mismo componente único de flujo neto que en el hub).
 */
export default function HubAccountBlock({
  cuenta,
  amount,
  isNegative = false,
  caption,
  dense = true,
  loading = false,
  error = false,
  breakdownItems = [],
  breakdownLoading = false,
  breakdownError = false,
  breakdownCaption = null,
  defaultExpanded = false,
  showDivider = false,
  showHero = true,
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const breakdownId = `account-saldos-${useId().replace(/:/g, '')}`;

  let heroAmount;
  if (loading) {
    heroAmount = (
      <Skeleton
        component="span"
        width={dense ? 96 : 140}
        sx={{ display: 'inline-block' }}
      />
    );
  } else if (error) {
    heroAmount = '—';
  } else {
    heroAmount = amount;
  }

  const heroColor = !loading && !error && isNegative ? theme.palette.error.main : undefined;

  if (!dense && showHero) {
    return (
      <HubBalanceLead
        amount={amount}
        label={caption}
        color={heroColor}
        dense={false}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <Box
      sx={{
        pb: showDivider ? 1 : 0,
        mb: showDivider ? 0.75 : 0,
        borderBottom: showDivider ? '1px solid' : 'none',
        borderColor: 'divider',
      }}
    >
      <HubBalanceRow
        cuenta={cuenta}
        amount={!expanded && showHero && (loading || error || amount != null) ? heroAmount : null}
        color={heroColor}
        dense
        expanded={expanded}
        onToggle={() => setExpanded((prev) => !prev)}
        controlsId={breakdownId}
        sx={{
          ...collapseInlineToggleSx,
          width: '100%',
          mx: 0,
          px: 0.25,
          py: 0.5,
          minHeight: 28,
          justifyContent: 'space-between',
        }}
      />
      <HubBalanceBreakdown
        id={breakdownId}
        open={expanded}
        lead={showHero && caption ? {
          label: caption,
          amount: heroAmount,
          color: heroColor,
        } : null}
        items={breakdownItems}
        loading={breakdownLoading}
        error={breakdownError}
        caption={breakdownCaption}
        sx={{ px: 0, pt: 0.75, pb: 0.5 }}
      />
    </Box>
  );
}

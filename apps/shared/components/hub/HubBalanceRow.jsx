import { Box, ButtonBase, Typography } from '@mui/material';
import { ExpandMoreRounded } from '@mui/icons-material';
import { HUB_HERO_AMOUNT,
  getHubHeroAmountSx,
  hubEyebrowSx, FONT_SIZE } from '../../tipografia';

const CHEVRON_SIZE = '1.125rem';

/** Alto de línea del monto, para centrar el eyebrow contra él. */
function heroLineHeight(dense) {
  const size = parseFloat(dense ? HUB_HERO_AMOUNT.denseFontSize : HUB_HERO_AMOUNT.pageFontSize);
  return `${(size * HUB_HERO_AMOUNT.lineHeight).toFixed(4)}rem`;
}

/**
 * Fila de saldo de una sección hub: cuenta a la izquierda, monto a la derecha.
 * `below` va justo debajo del monto, alineado a la derecha.
 * Con `onToggle` la fila entera es un botón desplegable (chevron junto a la cuenta).
 */
export default function HubBalanceRow({
  cuenta,
  amount,
  color,
  dense = true,
  prominent = false,
  below,
  mb = 0,
  expanded = false,
  onToggle,
  controlsId,
  sx,
}) {
  const expandable = typeof onToggle === 'function';
  const showAmount = amount != null;
  const content = (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 0.5,
          minWidth: 0,
          flex: '1 1 auto',
          textAlign: 'left',
        }}
      >
        {expandable && (
          <ExpandMoreRounded
            aria-hidden
            sx={{
              flex: '0 0 auto',
              fontSize: CHEVRON_SIZE,
              color: prominent ? 'text.primary' : (expanded ? 'text.primary' : 'text.secondary'),
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 160ms ease, color 160ms ease',
            }}
          />
        )}
        <Typography
          noWrap
          sx={prominent
            ? {
              mb: 0,
              minWidth: 0,
              fontSize: FONT_SIZE.base,
              fontWeight: 600,
              lineHeight: 1.25,
              color: 'text.primary',
            }
            : {
              ...hubEyebrowSx,
              mb: 0,
              minWidth: 0,
              lineHeight: heroLineHeight(dense),
            }}
        >
          {cuenta}
        </Typography>
      </Box>
      {showAmount && (
        <Box sx={{ flex: '0 0 auto', textAlign: 'right' }}>
          <Typography sx={{ ...getHubHeroAmountSx(dense), color }}>{amount}</Typography>
          {below}
        </Box>
      )}
    </>
  );

  const rowSx = {
    display: 'flex',
    // Centrado vertical; con fecha debajo del monto, la fila arranca arriba.
    alignItems: below && showAmount ? 'flex-start' : 'center',
    justifyContent: 'space-between',
    gap: 1,
    py: 0.375,
    mb,
  };

  if (!expandable) return <Box sx={{ ...rowSx, ...sx }}>{content}</Box>;

  return (
    <ButtonBase
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controlsId}
      disableRipple
      sx={{
        ...rowSx,
        // Área táctil de ~28 px que sobresale 4 px a cada lado: el texto queda alineado con el resto.
        width: 'calc(100% + 8px)',
        mx: -0.5,
        px: 0.5,
        minHeight: 30,
        font: 'inherit',
        color: 'inherit',
        borderRadius: 0,
        transition: 'background-color 120ms ease',
        '&:hover': { bgcolor: 'action.hover' },
        // Sin aro de foco al hacer click; solo se marca con teclado.
        '&.Mui-focusVisible': { bgcolor: 'action.hover' },
        '&:focus:not(.Mui-focusVisible)': { outline: 'none' },
        ...sx,
      }}
    >
      {content}
    </ButtonBase>
  );
}

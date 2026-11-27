import { Box, Collapse, Skeleton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ChevronRightRounded } from '@mui/icons-material';
import { getFilterToggleButtonSx } from '../../styles/filterToggleStyles';
import { hubEyebrowSx, hubNumericSx, FONT_SIZE } from '../../tipografia';
import HubBalanceLead from './HubBalanceLead';

const COLUMNS = 3;
const GAP = 1;

/**
 * Desglose de un saldo hub:
 * - `lead` (opcional): dato informativo centrado arriba, sin caja ni flecha.
 * - `items`: tiles sutiles clickeables en grilla de 3 columnas con borde suave,
 *   etiqueta en Sentence case y chevron discreto para indicar navegación.
 * items: [{ id, label, amount, color, onClick, title }] — `title` es el tooltip nativo.
 * `caption` (opcional) dice a qué fecha corresponden los saldos, p. ej. "Saldos al 30 sep".
 */
export default function HubBalanceBreakdown({
  id,
  open,
  lead = null,
  items = [],
  loading = false,
  error = false,
  caption = null,
  sx,
}) {
  const itemWidth = `calc((100% - ${GAP * (COLUMNS - 1) * 8}px) / ${COLUMNS})`;

  return (
    <Collapse in={open} timeout={180} unmountOnExit>
      {caption && (
        <Typography sx={{ ...hubEyebrowSx, mb: 0, pt: 1, textAlign: 'center' }}>
          {caption}
        </Typography>
      )}
      <Box
        id={id}
        role="group"
        aria-label={caption || 'Saldos de la cuenta'}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: GAP,
          rowGap: GAP,
          pt: caption ? 0.75 : 1,
          pb: 0.5,
          ...sx,
        }}
      >
        {lead && (
          <HubBalanceLead
            amount={lead.amount}
            label={lead.label}
            color={lead.color}
          />
        )}
        {loading && items.length === 0 && Array.from({ length: COLUMNS }).map((_, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <Skeleton key={index} height={46} sx={{ width: itemWidth, borderRadius: 0 }} />
        ))}
        {error && items.length === 0 && (
          <Typography sx={{ ...hubEyebrowSx, textTransform: 'none' }}>
            No se pudieron cargar los saldos
          </Typography>
        )}
        {items.map((item) => {
          const clickable = typeof item.onClick === 'function';
          return (
            <Box
              key={item.id}
              component={clickable ? 'button' : 'div'}
              type={clickable ? 'button' : undefined}
              onClick={item.onClick}
              title={item.title || undefined}
              sx={{
                ...getFilterToggleButtonSx(),
                flex: '0 0 auto',
                width: itemWidth,
                gap: 0.375,
                py: 0.75,
                px: 0.5,
                borderRadius: 0,
                border: '1px solid',
                borderColor: clickable ? 'divider' : 'transparent',
                bgcolor: (theme) => (
                  clickable
                    ? alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.025 : 0.02)
                    : 'transparent'
                ),
                cursor: clickable ? 'pointer' : 'default',
                transition: 'background-color 140ms ease, border-color 140ms ease, transform 100ms ease',
                ...(clickable && {
                  '&:hover': {
                    bgcolor: 'action.hover',
                    borderColor: (theme) => alpha(theme.palette.text.primary, 0.28),
                    '& .hub-breakdown-chevron': {
                      opacity: 0.9,
                      transform: 'translateX(1px)',
                    },
                  },
                  '&:active': {
                    transform: 'scale(0.985)',
                  },
                  '&:focus-visible': {
                    outline: '1px solid',
                    outlineColor: 'text.secondary',
                    outlineOffset: 1,
                  },
                }),
              }}
            >
              <Typography
                noWrap
                sx={{
                  ...hubNumericSx,
                  width: '100%',
                  fontSize: FONT_SIZE.md,
                  fontWeight: 500,
                  lineHeight: 1.15,
                  letterSpacing: '-0.005em',
                  textAlign: 'center',
                  color: item.color || 'text.primary',
                }}
              >
                {item.amount}
              </Typography>
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.125,
                  maxWidth: '100%',
                  color: 'text.secondary',
                }}
              >
                <Typography
                  component="span"
                  noWrap
                  sx={{
                    fontSize: FONT_SIZE.xs,
                    fontWeight: 450,
                    lineHeight: 1.15,
                    color: 'inherit',
                  }}
                >
                  {item.label}
                </Typography>
                {clickable && (
                  <ChevronRightRounded
                    aria-hidden
                    className="hub-breakdown-chevron"
                    sx={{
                      flex: '0 0 auto',
                      fontSize: 12,
                      opacity: 0.55,
                      transition: 'opacity 140ms ease, transform 140ms ease',
                    }}
                  />
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Collapse>
  );
}

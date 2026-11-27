import { Box, Chip, Typography } from '@mui/material';
import { FONT_SIZE } from '../../tipografia';

/**
 * Contenedor único de grupo de cuentas en el listado (/cuentas y setup popup).
 * Mantiene el mismo borde, fondo y cabecera visual para todas las cuentas
 * (Mercado Pago, bancos, Efectivo multimoneda, etc.).
 */
export function AccountListGroup({ title, rightContent, children }) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {rightContent}
      </Box>
      <Box>{children}</Box>
    </Box>
  );
}

/**
 * Fila única de cuenta dentro de `AccountListGroup`.
 * Soporta tanto cuentas monomoneda (1 monto) como multimoneda (múltiples montos
 * con sus símbolos y colores respectivos) con la misma estética visual.
 */
export function AccountListRow({
  id,
  icon,
  nombre,
  tipoLabel,
  tipoWarning = false,
  selected = false,
  onClick,
  balances = [],
  actions = null,
}) {
  return (
    <Box
      id={id}
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        px: 1.5,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        cursor: onClick ? 'pointer' : 'default',
        bgcolor: selected ? 'action.selected' : 'transparent',
        '&:last-child': { borderBottom: 0 },
        '&:hover': onClick
          ? { bgcolor: selected ? 'action.selected' : 'action.hover' }
          : undefined,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
        {icon}
        <Typography variant="body2" noWrap>
          {nombre}
        </Typography>
        {tipoLabel && (
          <Chip
            label={tipoLabel}
            size="small"
            variant="outlined"
            color={tipoWarning ? 'warning' : 'default'}
            sx={{
              height: 20,
              flexShrink: 0,
              '& .MuiChip-label': { px: 1, fontSize: FONT_SIZE.xs },
            }}
          />
        )}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          flexShrink: 0,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {balances.map((item) => (
          <Typography
            key={item.id}
            variant="body2"
            title={item.title || undefined}
            sx={{
              color: item.color || 'text.primary',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {item.formatted}
          </Typography>
        ))}
        {actions}
      </Box>
    </Box>
  );
}

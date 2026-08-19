import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import CajaSwitch from '../../navigation/CajaSwitch';
import {
  MoreVertOutlined as MoreIcon,
  EditOutlined as EditIcon,
  DeleteOutlineOutlined as DeleteIcon,
} from '@mui/icons-material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { useResponsive } from '@shared/hooks';
import {
  COLORES_MONEDA,
  MONEDA_TILE,
  getMonedaTileSx,
  monedaLabelSx,
  monedaSymbolSx,
  monedaValueSx,
} from './monedaConstants';
import { monedaDetailPath } from '../finanzasDeepLink';
import { useMonedaBalance } from './useMonedaBalance';

function formatBalance(balance, showValues, loading) {
  if (loading) return '…';
  if (!showValues) return '****';
  return balance.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Tarjeta unificada de moneda (hub compacta o página con acciones).
 * @param {'compact' | 'full'} variant
 */
function MonedaTile({
  moneda,
  variant = 'compact',
  fullWidth = false,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
  onToggleActive,
}) {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const { showValues } = useValuesVisibility();
  const monedaId = moneda.id || moneda._id;
  const { balance, loading: balanceLoading } = useMonedaBalance(monedaId);
  const [anchorEl, setAnchorEl] = useState(null);
  const accent = moneda.color || COLORES_MONEDA.CELESTE_ARGENTINA.value;
  const isFull = variant === 'full';
  const hasActions = isFull && (onEdit || onDelete || onToggleActive);
  const isSelectable = variant === 'compact' || Boolean(onSelect);
  const isFullWidth = isFull && (fullWidth || isMobile);

  const tileWidth = isFullWidth ? '100%' : (isFull ? MONEDA_TILE.widthFull : MONEDA_TILE.width);
  const tileHeight = isFull ? MONEDA_TILE.heightFull : MONEDA_TILE.height;

  const handleCardClick = (e) => {
    e.stopPropagation();
    if (!isSelectable) return;
    if (onSelect) onSelect(monedaId);
    else navigate(monedaDetailPath(monedaId));
  };

  return (
    <Card
      id={`moneda-tile-${monedaId}`}
      elevation={0}
      sx={{
        ...getMonedaTileSx({ selected, isSelectable: !!isSelectable }),
        height: tileHeight,
        width: isFullWidth ? '100%' : undefined,
        minWidth: isFullWidth ? 0 : tileWidth,
        maxWidth: isFullWidth ? '100%' : tileWidth,
        flex: isFullWidth ? '1 1 auto' : `0 0 ${tileWidth}px`,
        cursor: isSelectable ? 'pointer' : 'default',
      }}
      onClick={isSelectable ? handleCardClick : (e) => e.stopPropagation()}
    >
      <Box
        sx={{
          height: '100%',
          px: MONEDA_TILE.px,
          py: MONEDA_TILE.py,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: MONEDA_TILE.gap,
            minWidth: 0,
            width: '100%',
          }}
        >
          <Box sx={monedaSymbolSx}>{moneda.simbolo}</Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" noWrap sx={{ ...monedaLabelSx, display: 'block' }}>
              {moneda.codigo}
            </Typography>
            <Typography
              variant="caption"
              noWrap
              sx={{
                ...monedaValueSx,
                display: 'block',
                color: balance >= 0 ? accent : 'error.main',
                opacity: balanceLoading ? 0.5 : 1,
              }}
            >
              {formatBalance(balance, showValues, balanceLoading)}
              {balanceLoading && (
                <CircularProgress
                  size={8}
                  thickness={4}
                  sx={{ ml: 0.35, verticalAlign: 'middle' }}
                />
              )}
            </Typography>
          </Box>

          {hasActions && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                ml: 0.25,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {onToggleActive && (
                <Tooltip
                  title={moneda.activa ? 'Desactivar moneda' : 'Activar moneda'}
                  placement="top"
                  enterDelay={400}
                >
                  <CajaSwitch
                    checked={!!moneda.activa}
                    inputProps={{ 'aria-label': moneda.activa ? 'Desactivar moneda' : 'Activar moneda' }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleActive(monedaId);
                    }}
                    sx={{ mr: -0.125 }}
                  />
                </Tooltip>
              )}
              {(onEdit || onDelete) && (
                <>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAnchorEl(e.currentTarget);
                    }}
                    sx={{ p: 0.25, color: 'text.secondary' }}
                  >
                    <MoreIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={() => setAnchorEl(null)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onEdit && (
                      <MenuItem onClick={() => { setAnchorEl(null); onEdit(moneda); }}>
                        <EditIcon sx={{ fontSize: 16, mr: 1 }} />
                        Editar
                      </MenuItem>
                    )}
                    {onDelete && (
                      <MenuItem
                        onClick={() => { setAnchorEl(null); onDelete(monedaId); }}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteIcon sx={{ fontSize: 16, mr: 1 }} />
                        Eliminar
                      </MenuItem>
                    )}
                  </Menu>
                </>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Card>
  );
}

export default React.memo(MonedaTile);

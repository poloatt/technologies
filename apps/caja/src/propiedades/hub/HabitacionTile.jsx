import React, { useState } from 'react';
import {
  Box,
  Card,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  MoreVertOutlined as MoreIcon,
  EditOutlined as EditIcon,
  DeleteOutlineOutlined as DeleteIcon,
} from '@mui/icons-material';
import { getHabitacionTipoLabel } from '../habitacionConstants';
import { getHabitacionTipoMuiIcon } from '../getHabitacionTipoMuiIcon';
import {
  HABITACION_TILE,
  getHabitacionTileSx,
  habitacionIconSx,
} from './propiedadesHubConstants';

export function HabitacionTileSkeleton() {
  return (
    <Box
      sx={{
        ...getHabitacionTileSx(),
        height: HABITACION_TILE.height,
        width: HABITACION_TILE.width,
        minWidth: HABITACION_TILE.width,
        flex: `0 0 ${HABITACION_TILE.width}px`,
      }}
    />
  );
}

/**
 * Chip de ambiente (hub compacto o detalle con menú de acciones). Solo icono; nombre en tooltip.
 * @param {'compact' | 'full'} variant
 */
export default function HabitacionTile({
  habitacion,
  variant = 'compact',
  selected = false,
  onSelect,
  onEdit,
  onDelete,
  subtitle = null,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const habitacionId = habitacion.id || habitacion._id;
  const label = getHabitacionTipoLabel(habitacion.tipo, habitacion.nombrePersonalizado);
  const tooltipTitle = subtitle ? `${label} · ${subtitle}` : label;
  const isFull = variant === 'full';
  const hasActions = isFull && (onEdit || onDelete);
  const isSelectable = variant === 'compact' ? !!onSelect : !!(onSelect || onEdit);

  const tileWidth = isFull ? HABITACION_TILE.widthFull : HABITACION_TILE.width;
  const tileHeight = isFull ? HABITACION_TILE.heightFull : HABITACION_TILE.height;

  const handleCardClick = (e) => {
    e.stopPropagation();
    if (!isSelectable) return;
    if (onSelect) onSelect(habitacionId);
    else if (onEdit) onEdit(habitacion);
  };

  return (
    <Tooltip title={tooltipTitle} arrow describeChild>
      <Card
        elevation={0}
        aria-label={label}
        sx={{
          ...getHabitacionTileSx({ selected, isSelectable }),
          height: tileHeight,
          width: tileWidth,
          minWidth: tileWidth,
          maxWidth: tileWidth,
          flex: `0 0 ${tileWidth}px`,
          cursor: isSelectable ? 'pointer' : 'default',
          position: 'relative',
        }}
        onClick={isSelectable ? handleCardClick : (e) => e.stopPropagation()}
      >
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box sx={habitacionIconSx}>
            {getHabitacionTipoMuiIcon(habitacion.tipo, {
              fontSize: HABITACION_TILE.iconFontSize,
              color: 'inherit',
            })}
          </Box>

          {hasActions && (
            <Box
              sx={{
                position: 'absolute',
                top: 2,
                right: 2,
                display: 'flex',
                alignItems: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <IconButton
                size="small"
                aria-label={`Acciones de ${label}`}
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
                  <MenuItem
                    onClick={() => {
                      setAnchorEl(null);
                      onEdit(habitacion);
                    }}
                  >
                    <EditIcon sx={{ fontSize: 16, mr: 1 }} />
                    Editar
                  </MenuItem>
                )}
                {onDelete && (
                  <MenuItem
                    onClick={() => {
                      setAnchorEl(null);
                      onDelete(habitacion);
                    }}
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon sx={{ fontSize: 16, mr: 1 }} />
                    Eliminar
                  </MenuItem>
                )}
              </Menu>
            </Box>
          )}
        </Box>
      </Card>
    </Tooltip>
  );
}

import React from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export default function HabitGroupContextMenu({
  open,
  anchorPosition,
  onClose,
  onEdit,
  onDelete,
}) {
  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition || undefined}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
    >
      <MenuItem onClick={onEdit}>
        <ListItemIcon>
          <EditOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Editar grupo</ListItemText>
      </MenuItem>
      <MenuItem onClick={onDelete}>
        <ListItemIcon>
          <DeleteOutlineIcon fontSize="small" color="error" />
        </ListItemIcon>
        <ListItemText primaryTypographyProps={{ color: 'error' }}>
          Eliminar grupo
        </ListItemText>
      </MenuItem>
    </Menu>
  );
}

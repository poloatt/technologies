import React from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';

export default function HabitItemPostponeMenu({
  open,
  anchorPosition,
  postponeLabel,
  onClose,
  onPostpone,
}) {
  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition || undefined}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        root: { sx: { zIndex: 1500 } },
      }}
    >
      <MenuItem
        onClick={() => {
          onPostpone?.();
          onClose?.();
        }}
      >
        <ListItemIcon>
          <ScheduleOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{postponeLabel}</ListItemText>
      </MenuItem>
    </Menu>
  );
}

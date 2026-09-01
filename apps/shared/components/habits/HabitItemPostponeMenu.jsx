import React from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import FastForwardOutlinedIcon from '@mui/icons-material/FastForwardOutlined';

export default function HabitItemPostponeMenu({
  open,
  anchorPosition,
  postponeLabel,
  empujarLabel,
  onClose,
  onPostpone,
  onEmpujar,
  onIgnoreToday,
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
        disabled={!postponeLabel}
      >
        <ListItemIcon>
          <ScheduleOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{postponeLabel || 'Posponer'}</ListItemText>
      </MenuItem>
      <MenuItem
        onClick={() => {
          onEmpujar?.();
          onClose?.();
        }}
        disabled={!empujarLabel}
      >
        <ListItemIcon>
          <FastForwardOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{empujarLabel || 'Empujar'}</ListItemText>
      </MenuItem>
      <MenuItem
        onClick={() => {
          onIgnoreToday?.();
          onClose?.();
        }}
      >
        <ListItemText inset>Ignorar por hoy</ListItemText>
      </MenuItem>
    </Menu>
  );
}

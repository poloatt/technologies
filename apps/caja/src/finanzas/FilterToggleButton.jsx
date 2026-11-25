import { Box, Typography } from '@mui/material';
import {
  filterToggleAmountSx,
  getFilterToggleButtonSx,
  getFilterToggleFloatingLabelSx,
} from '@shared/styles/filterToggleStyles';

export default function FilterToggleButton({ label, amount, amountColor, selected, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      sx={getFilterToggleButtonSx()}
    >
      <Typography sx={{ ...filterToggleAmountSx, color: amountColor }}>
        {amount}
      </Typography>
      <Typography component="span" sx={getFilterToggleFloatingLabelSx(selected)}>
        {label}
      </Typography>
    </Box>
  );
}

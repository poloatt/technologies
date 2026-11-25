import { Divider } from '@mui/material';

/** Separa el saldo principal del desglose en las tarjetas del hub. */
export default function HubBalanceDivider() {
  return (
    <Divider
      sx={{
        my: 1,
        borderColor: 'divider',
      }}
    />
  );
}

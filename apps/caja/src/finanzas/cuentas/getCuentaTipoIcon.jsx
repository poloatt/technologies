import React from 'react';
import {
  AccountBalanceOutlined as BankIcon,
  CreditCardOutlined as CardIcon,
  AttachMoneyOutlined as MoneyIcon,
} from '@mui/icons-material';

export default function getCuentaTipoIcon(tipo, sx = {}) {
  const iconSx = { fontSize: 18, color: 'text.secondary', ...sx };
  switch (tipo) {
    case 'BANCO':
      return <BankIcon sx={iconSx} />;
    case 'EFECTIVO':
      return <MoneyIcon sx={iconSx} />;
    default:
      return <CardIcon sx={iconSx} />;
  }
}

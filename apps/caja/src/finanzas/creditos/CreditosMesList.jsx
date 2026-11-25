import { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import { arDateKey, cuotaEnRangoClave, expandirCuotas } from '@shared/utils/cuotasCredito';
import { formatCardPurchaseTitle } from '@shared/utils/mpDisplayUtils';
import { hubLabelSx } from '../../hub';
import { formatMonto } from '../transacciones/transaccionesPeriodUtils';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function tituloCompra(tx) {
  return formatCardPurchaseTitle(tx);
}

function mesLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return `${MESES[(month || 1) - 1]} ${year}`;
}

export function agruparCuotas(transacciones, fechaInicio, fechaFin) {
  const meses = new Map();
  for (const tx of transacciones) {
    const meta = tx.origen?.metadata || {};
    const cuotas = expandirCuotas({
      fecha: tx.fecha,
      monto: tx.monto,
      installments: meta.installments,
      installmentAmount: meta.installmentAmount,
    }).filter((cuota) => cuotaEnRangoClave(cuota.due, fechaInicio, fechaFin));
    for (const cuota of cuotas) {
      const key = arDateKey(cuota.due);
      const mes = key.slice(0, 7);
      if (!meses.has(mes)) meses.set(mes, { mes, total: 0, items: [] });
      const grupo = meses.get(mes);
      grupo.total += cuota.amount;
      grupo.items.push({
        id: `${tx._id || tx.id}-${cuota.index}`,
        titulo: tituloCompra(tx),
        index: cuota.index,
        count: cuota.count,
        amount: cuota.amount,
      });
    }
  }
  return [...meses.values()]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((grupo) => ({
      ...grupo,
      items: grupo.items.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es')),
    }));
}

export default function CreditosMesList({ transacciones, fechaInicio, fechaFin, simbolo = '$', showValues = true }) {
  const grupos = useMemo(
    () => agruparCuotas(transacciones, fechaInicio, fechaFin),
    [transacciones, fechaInicio, fechaFin],
  );
  const mesActual = arDateKey(new Date()).slice(0, 7);
  const [abierto, setAbierto] = useState(null);

  if (grupos.length === 0) return null;

  return (
    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column' }}>
      {grupos.map((grupo) => {
        const open = abierto === grupo.mes;
        const pagado = grupo.mes <= mesActual;
        const colorMonto = pagado ? 'text.primary' : 'error.main';
        return (
          <Box key={grupo.mes} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box
              component="button"
              type="button"
              aria-expanded={open}
              onClick={() => setAbierto(open ? null : grupo.mes)}
              sx={{
                appearance: 'none',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 0.5,
                py: 1.25,
                border: 0,
                bgcolor: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <ExpandMoreIcon
                sx={{
                  fontSize: 20,
                  color: 'text.secondary',
                  transform: open ? 'rotate(180deg)' : 'none',
                  transition: 'transform 120ms ease',
                }}
              />
              <Typography sx={{ ...hubLabelSx, flex: 1, color: 'text.primary', fontSize: '0.8125rem' }}>
                {mesLabel(grupo.mes)}
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: colorMonto }}>
                {formatMonto(-grupo.total, simbolo, showValues)}
              </Typography>
            </Box>
            {open && (
              <Box sx={{ pb: 1, pl: 4.5, pr: 0.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {grupo.items.map((item) => (
                  <Box key={item.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, py: 0.5 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        bgcolor: 'action.hover',
                      }}
                    >
                      <CreditCardOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 560,
                          fontSize: '0.875rem',
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.titulo}
                      </Typography>
                      {item.count > 1 && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.2 }}>
                          {`cuota ${item.index}/${item.count}`}
                        </Typography>
                      )}
                    </Box>
                    <Typography
                      sx={{
                        fontWeight: 650,
                        fontSize: '0.875rem',
                        color: colorMonto,
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                      }}
                    >
                      {formatMonto(-item.amount, simbolo, showValues)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

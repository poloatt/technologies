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

function monedaDeLista(transacciones) {
  for (const tx of transacciones) {
    const moneda = tx?.moneda;
    if (moneda && typeof moneda === 'object') {
      return {
        simbolo: moneda.simbolo || '$',
        color: moneda.color || '#5C6BC0',
      };
    }
  }
  return { simbolo: '$', color: '#5C6BC0' };
}

function colorSaldo(monto, monedaColor) {
  if (monto < 0) return 'error.main';
  if (monto === 0) return 'text.primary';
  return monedaColor;
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

export default function CreditosMesList({
  transacciones,
  fechaInicio,
  fechaFin,
  simbolo: simboloProp,
  monedaColor: monedaColorProp,
  showValues = true,
}) {
  const moneda = useMemo(() => monedaDeLista(transacciones), [transacciones]);
  const simbolo = simboloProp || moneda.simbolo;
  const monedaColor = monedaColorProp || moneda.color;
  const grupos = useMemo(
    () => agruparCuotas(transacciones, fechaInicio, fechaFin),
    [transacciones, fechaInicio, fechaFin],
  );
  const [abierto, setAbierto] = useState(null);

  if (grupos.length === 0) return null;

  return (
    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column' }}>
      {grupos.map((grupo) => {
        const open = abierto === grupo.mes;
        const netoMes = -grupo.total;
        const colorMes = colorSaldo(netoMes, monedaColor);
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
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: colorMes }}>
                {formatMonto(netoMes, simbolo, showValues)}
              </Typography>
            </Box>
            {open && (
              <Box sx={{ pb: 1, pl: 4.5, pr: 0.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {grupo.items.map((item) => {
                  const netoItem = -item.amount;
                  return (
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
                          fontWeight: 400,
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
                        fontWeight: 400,
                        fontSize: '0.875rem',
                        color: colorSaldo(netoItem, monedaColor),
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                      }}
                    >
                      {formatMonto(netoItem, simbolo, showValues)}
                    </Typography>
                  </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import CommonHeader from '@shared/components/common/CommonHeader';
import CommonProgressBar from '@shared/components/common/CommonProgressBar';
import EstadoFinanzasContrato from './EstadoFinanzasContrato';
import { formatFecha, calcularProgresoContrato, formatMontoAbreviado } from '@shared/utils/contratoUtils';
import { useState } from 'react';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContratoDetail from './ContratoDetail';
import TipoPropiedadIcon from '../TipoPropiedadIcon';
import { CuotasProvider } from '@shared/context/CuotasContext';
import { useResponsive } from '@shared/hooks';

const ContratoCard = ({ contrato, onClick }) => {
  // Obtener el inquilino principal
  let inquilino = null;
  if (Array.isArray(contrato.inquilino) && contrato.inquilino.length > 0) {
    inquilino = contrato.inquilino[0];
  } else if (typeof contrato.inquilino === 'object') {
    inquilino = contrato.inquilino;
  }
  const nombreInquilino = inquilino ? `${inquilino.nombre || ''} ${inquilino.apellido || ''}`.trim() : 'Sin inquilino';

  // Fechas y duración
  let fechaInicio = 'Sin fecha';
  let fechaFin = 'Sin fecha';
  if (contrato.fechaInicio && contrato.fechaFin) {
    const anioInicio = new Date(contrato.fechaInicio).getFullYear();
    const anioFin = new Date(contrato.fechaFin).getFullYear();
    if (anioInicio === anioFin) {
      fechaInicio = formatFecha(contrato.fechaInicio, anioFin);
      fechaFin = formatFecha(contrato.fechaFin);
    } else {
      fechaInicio = formatFecha(contrato.fechaInicio);
      fechaFin = formatFecha(contrato.fechaFin);
    }
  } else {
    if (contrato.fechaInicio) fechaInicio = formatFecha(contrato.fechaInicio);
    if (contrato.fechaFin) fechaFin = formatFecha(contrato.fechaFin);
  }
  const fechasContrato = `${fechaInicio} — ${fechaFin}`;
  const tipoPropiedad = contrato.propiedad?.tipo;

  // Progreso en días y montos
  const progreso = calcularProgresoContrato(contrato);
  const diasTranscurridos = progreso.diasTranscurridos;
  const diasTotales = progreso.diasTotales;
  const porcentaje = progreso.porcentaje;
  const montoAcumulado = progreso.montoAcumulado || 0;
  const montoTotal = progreso.montoTotal || 0;
  const simboloMoneda = contrato?.cuenta?.moneda?.simbolo || contrato?.moneda?.simbolo || '$';

  const [openDetail, setOpenDetail] = useState(false);
  const { theme, isDesktop } = useResponsive();

  return (
    <Paper
      sx={{
        borderRadius: 0,
        backgroundColor: (theme) => theme.palette.collapseHeader.background,
        border: 1,
        borderColor: (theme) => theme.palette.divider,
        p: 1.5,
        mb: 1,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: onClick ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
        },
      }}
      onClick={e => {
        if (isDesktop && onClick) {
          onClick(e);
        } else if (!isDesktop) {
          setOpenDetail(true);
        }
      }}
    >
      <CommonHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>{nombreInquilino}</span>
            <Box component="span" sx={{ ml: 0.5 }}>
              <OpenInNewIcon
                sx={{ fontSize: 18, cursor: 'pointer', color: 'text.secondary', borderRadius: 0, p: 0.2, '&:hover': { color: 'primary.main', background: 'transparent' } }}
                onClick={e => { e.stopPropagation(); setOpenDetail(true); }}
              />
            </Box>
          </Box>
        }
        subtitle={fechasContrato}
        estado={contrato.estado}
        tipo="CONTRATO"
        showEstado={true}
        icon={TipoPropiedadIcon}
        iconProps={{ tipo: tipoPropiedad, sx: { fontSize: 22, mr: 1 } }}
        titleSize="subtitle1"
        titleWeight={600}
        gap={1}
      />
      {/* Divider geométrico entre header y contenido */}
      <Box sx={{ width: '100%', px: 0, mt: 1 }}>
        <Box
          sx={{
            width: '100%',
            height: '2px',
            backgroundColor: (theme) => theme.palette.collapseHeader.background,
            borderRadius: 0,
          }}
        />
      </Box>
      {/* Espaciado antes de la barra de progreso */}
      <Box sx={{ mt: 2 }} />
      {/* Barra de progreso de días y montos */}
      <Box sx={{ mt: 0.5 }}>
        <CommonProgressBar
          dataType="days"
          diasTranscurridos={diasTranscurridos}
          diasTotales={diasTotales}
          percentage={porcentaje}
          color="primary"
          showLabels={true}
          variant="compact"
          rightLabel={`${simboloMoneda} ${formatMontoAbreviado(montoAcumulado)}/${formatMontoAbreviado(montoTotal)}`}
        />
      </Box>
      <Box sx={{ mt: 1 }}>
        <CuotasProvider contratoId={contrato._id || contrato.id} formData={contrato}>
          <EstadoFinanzasContrato contrato={contrato} compact={true} noBorder={true} />
        </CuotasProvider>
      </Box>
      {!isDesktop && (
        <ContratoDetail open={openDetail} onClose={() => setOpenDetail(false)} contrato={contrato} />
      )}
    </Paper>
  );
};

export default ContratoCard; 
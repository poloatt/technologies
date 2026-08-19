import React, { useEffect, useState, useCallback } from 'react';
import { Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { CommonForm } from '@shared/components/common';
import clienteAxios from '@shared/config/axios';
import { useSnackbar } from 'notistack';
import { useAPI } from '@shared/hooks/useAPI';
import { FinanzasSectionNav } from '../finanzas';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';

export default function Finanzas() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [openCuenta, setOpenCuenta] = useState(false);
  const [openMoneda, setOpenMoneda] = useState(false);
  const [openTransaccion, setOpenTransaccion] = useState(false);

  const { data: monedasData } = useAPI('/api/monedas');
  const monedas = monedasData?.docs || [];

  const formFieldsCuenta = [
    { name: 'nombre', label: 'Nombre', type: 'text', required: true },
    { name: 'numero', label: 'Número', type: 'text', required: true },
    {
      name: 'tipo',
      label: 'Tipo',
      type: 'select',
      required: true,
      options: [
        { value: 'EFECTIVO', label: 'Efectivo' },
        { value: 'BANCO', label: 'Banco' },
        { value: 'MERCADO_PAGO', label: 'Mercado Pago' },
        { value: 'CRIPTO', label: 'Cripto' },
        { value: 'OTRO', label: 'Otro' },
      ],
    },
    {
      name: 'monedaId',
      label: 'Moneda',
      type: 'select',
      required: true,
      options: monedas.map((m) => ({
        value: m._id || m.id,
        label: `${m.nombre} (${m.simbolo})`,
      })),
    },
  ];

  const formFieldsMoneda = [
    { name: 'codigo', label: 'Código', type: 'text', required: true },
    { name: 'nombre', label: 'Nombre', type: 'text', required: true },
    { name: 'simbolo', label: 'Símbolo', type: 'text', required: true },
  ];

  const formFieldsTransaccion = [
    { name: 'descripcion', label: 'Descripción', type: 'text', required: true },
    { name: 'monto', label: 'Monto', type: 'number', required: true },
    { name: 'fecha', label: 'Fecha', type: 'date', required: true },
    { name: 'cuenta', label: 'Cuenta', type: 'select', required: true, options: [] },
    {
      name: 'moneda',
      label: 'Moneda',
      type: 'select',
      required: true,
      options: monedas.map((m) => ({
        value: m._id || m.id,
        label: `${m.nombre} (${m.simbolo})`,
      })),
    },
  ];

  const handleSubmitCuenta = useCallback(async (data) => {
    await clienteAxios.post('/api/cuentas', data);
    enqueueSnackbar('Cuenta creada exitosamente', { variant: 'success' });
    setOpenCuenta(false);
  }, [enqueueSnackbar]);

  const handleSubmitMoneda = useCallback(async (data) => {
    await clienteAxios.post('/api/monedas', data);
    enqueueSnackbar('Moneda creada exitosamente', { variant: 'success' });
    setOpenMoneda(false);
  }, [enqueueSnackbar]);

  const handleSubmitTransaccion = useCallback(async (data) => {
    await clienteAxios.post('/api/transacciones', data);
    enqueueSnackbar('Transacción creada exitosamente', { variant: 'success' });
    setOpenTransaccion(false);
  }, [enqueueSnackbar]);

  useEffect(() => {
    const handleHeaderAdd = (e) => {
      if (e.detail?.type === 'transacciones') setOpenTransaccion(true);
      if (e.detail?.type === 'cuentas') setOpenCuenta(true);
      if (e.detail?.type === 'monedas') setOpenMoneda(true);
      if (e.detail?.type === 'recurrente') {
        navigate('/finanzas/recurrente', { state: { openAdd: true } });
      }
    };
    window.addEventListener('headerAddButtonClicked', handleHeaderAdd);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAdd);
  }, [navigate]);

  return (
    <Box
      component="main"
      className="page-main-content"
      sx={{ ...cajaPageLayoutSx, display: 'flex', flexDirection: 'column' }}
    >
      <CommonForm
        open={openCuenta}
        onClose={() => setOpenCuenta(false)}
        onSubmit={handleSubmitCuenta}
        title="Nueva Cuenta"
        fields={formFieldsCuenta}
        initialData={{}}
        isEditing={false}
      />
      <CommonForm
        open={openMoneda}
        onClose={() => setOpenMoneda(false)}
        onSubmit={handleSubmitMoneda}
        title="Nueva Moneda"
        fields={formFieldsMoneda}
        initialData={{}}
        isEditing={false}
      />
      <CommonForm
        open={openTransaccion}
        onClose={() => setOpenTransaccion(false)}
        onSubmit={handleSubmitTransaccion}
        title="Nueva Transacción"
        fields={formFieldsTransaccion}
        initialData={{}}
        isEditing={false}
      />

      <FinanzasSectionNav variant="hub" />
    </Box>
  );
}

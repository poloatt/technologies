import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
} from '@mui/material';
import { CommonForm, CommonActions } from '@shared/components/common';
import { AccountListGroup, AccountListRow } from '@shared/components/hub';
import { 
  AccountBalanceOutlined as BankIcon,
  CreditCardOutlined as CardIcon,
  AttachMoneyOutlined as MoneyIcon
} from '@mui/icons-material';
import clienteAxios from '@shared/config/axios';
import { useSnackbar } from 'notistack';
import { EmptyState } from '@shared/components/common';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { useAPI } from '@shared/hooks/useAPI';
import { BankConnectionForm, MercadoPagoPartialSyncBanner } from '../conexiones';
import CuentaTransaccionesPanel from './CuentaTransaccionesPanel';
import { useCajaSetup } from '../../atta/useCajaSetup';
import { formatFinanzasMonto } from '@shared/utils/formatFinanzasMonto';
import { formatDateKey } from '../transacciones/transaccionesPeriodUtils';
import {
  getMonedasFromCuenta,
  isCuentaMultimoneda,
  saldoReportadoMercadoPago,
} from './cuentaConstants';
import { useFinanzasBranch } from '../useFinanzasBranch';

/**
 * Setup de cuentas: se muestra solo dentro del popup (sin página propia).
 * Lista de cuentas y, con `?setupCuenta=ID`, el detalle de la cuenta en el mismo popup.
 */
export function CuentasSetup() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedMonedas, setExpandedMonedas] = useState([]);
  const { showValues } = useValuesVisibility();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [editingCuenta, setEditingCuenta] = useState(null);
  const [balances, setBalances] = useState({});
  const [balancesPorMoneda, setBalancesPorMoneda] = useState({});
  const [balancesPorCuentaMoneda, setBalancesPorCuentaMoneda] = useState({});
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isBankConnectionFormOpen, setIsBankConnectionFormOpen] = useState(false);
  const [isProcessingPago, setIsProcessingPago] = useState(false);
  const { cuentaId: selectedCuentaId, openSetup, closeCuenta } = useCajaSetup();
  const { branchId } = useFinanzasBranch();

  // Función para restablecer los balances
  const resetBalance = useCallback(() => {
    setBalances({});
    setBalancesPorMoneda({});
    setBalancesPorCuentaMoneda({});
    console.log('Balances restablecidos');
    return Promise.resolve();
  }, []);

  // Usar nuestro hook personalizado para cargar los datos
  const { 
    data: monedasData, 
    loading: monedasLoading, 
    error: monedasError,
    refetch: refetchMonedas
  } = useAPI('/api/monedas');
  
  const { 
    data: cuentasData, 
    loading: cuentasLoading, 
    error: cuentasError,
    refetch: refetchCuentas
  } = useAPI('/api/cuentas');

  // Extraer los arrays desde los datos paginados
  const monedas = monedasData?.docs || [];
  const cuentas = cuentasData?.docs || [];

  // Estado de carga general
  const isLoading = monedasLoading || cuentasLoading;

  // Manejar errores de API
  useEffect(() => {
    if (monedasError) {
      enqueueSnackbar('Error al cargar monedas: ' + monedasError.message, { variant: 'error' });
    }
    if (cuentasError) {
      enqueueSnackbar('Error al cargar cuentas: ' + cuentasError.message, { variant: 'error' });
    }
  }, [monedasError, cuentasError, enqueueSnackbar]);

  // Usar el hook useAPI para obtener los balances de las cuentas
  const fetchBalancesCuentas = useCallback(async () => {
    if (cuentas.length === 0) return;

    console.log('Iniciando carga de balances para todas las cuentas');
    const balancesTemp = {};
    const balancesPorMonedaTemp = {};
    const balancesPorCuentaMonedaTemp = {};
    
    // Preparar los grupos por moneda para acumular balances
    monedas.forEach(moneda => {
      const monedaId = moneda.id || moneda._id;
      if (monedaId) {
        balancesPorMonedaTemp[monedaId] = 0;
      }
    });

    const today = formatDateKey(new Date());

    // Pedir el balance de cada cuenta en paralelo via agregación (no bajar transacciones)
    const resultados = await Promise.all(
      cuentas.map(async (cuenta) => {
        const cuentaId = cuenta.id || cuenta._id;
        if (!cuentaId) return null;
        try {
          const response = await clienteAxios.get(`/api/transacciones/balance/${cuentaId}`, {
            params: { fechaFin: today, estado: 'PAGADO' },
          });
          return {
            cuenta,
            cuentaId,
            balance: response.data?.balance ?? 0,
            porMoneda: Array.isArray(response.data?.porMoneda) ? response.data.porMoneda : [],
          };
        } catch (error) {
          console.error(`Error al cargar balance para cuenta ${cuenta.nombre}:`, error);
          return { cuenta, cuentaId, balance: 0, porMoneda: [] };
        }
      }),
    );

    for (const item of resultados) {
      if (!item) continue;
      const { cuenta, cuentaId, balance, porMoneda } = item;
      const reportado = saldoReportadoMercadoPago(cuenta);
      const saldo = reportado != null ? reportado : balance;
      balancesTemp[cuentaId] = saldo;

      if (isCuentaMultimoneda(cuenta)) {
        const mapMonedas = {};
        for (const entry of porMoneda) {
          if (!entry?.monedaId) continue;
          const mId = String(entry.monedaId);
          mapMonedas[mId] = entry.balance ?? 0;
          if (balancesPorMonedaTemp[mId] !== undefined) {
            balancesPorMonedaTemp[mId] += entry.balance ?? 0;
          }
        }
        balancesPorCuentaMonedaTemp[cuentaId] = mapMonedas;
        continue;
      }

      let monedaId = null;
      if (typeof cuenta.moneda === 'object' && cuenta.moneda) {
        monedaId = cuenta.moneda.id || cuenta.moneda._id;
      } else {
        monedaId = cuenta.moneda;
      }

      if (monedaId && balancesPorMonedaTemp[monedaId] !== undefined) {
        balancesPorMonedaTemp[monedaId] += saldo;
      }
    }

    setBalances(balancesTemp);
    setBalancesPorMoneda(balancesPorMonedaTemp);
    setBalancesPorCuentaMoneda(balancesPorCuentaMonedaTemp);
  }, [cuentas, monedas]);

  const handleRefreshCuenta = useCallback(() => {
    refetchCuentas();
    fetchBalancesCuentas();
  }, [refetchCuentas, fetchBalancesCuentas]);

  // Cargar balances cuando se cargan las cuentas
  useEffect(() => {
    if (cuentas.length > 0 && !isLoading) {
      fetchBalancesCuentas();
    }
  }, [cuentas, isLoading, fetchBalancesCuentas]);

  // Establecer monedas expandidas
  useEffect(() => {
    if (cuentas.length > 0) {
      const monedasIds = [...new Set(cuentas.map(cuenta => cuenta.moneda?.id || cuenta.moneda?._id || cuenta.moneda))];
      setExpandedMonedas(prev => {
        const newIds = monedasIds.filter(id => !prev.includes(id));
        return [...prev, ...newIds];
      });
    }
  }, [cuentas]);

  // Escuchar el evento del botón "+" del Header
  useEffect(() => {
    const handleHeaderAdd = (e) => {
      if (e.detail?.type === 'cuenta' || e.detail?.type === 'cuentas') {
        setEditingCuenta(null);
        setIsFormOpen(true);
      }
    };

    window.addEventListener('headerAddButtonClicked', handleHeaderAdd);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAdd);
  }, []);

  // Refetch si el sync, transacciones o cambios de monedas se completaron.
  useEffect(() => {
    const handleCuentasRefreshed = () => {
      refetchCuentas();
    };
    const handleMonedasRefreshed = () => {
      refetchMonedas();
      refetchCuentas();
    };
    const handleTransaccionesRefreshed = () => {
      fetchBalancesCuentas();
    };
    window.addEventListener('cuentasRefreshed', handleCuentasRefreshed);
    window.addEventListener('monedasRefreshed', handleMonedasRefreshed);
    window.addEventListener('transaccionesRefreshed', handleTransaccionesRefreshed);
    return () => {
      window.removeEventListener('cuentasRefreshed', handleCuentasRefreshed);
      window.removeEventListener('monedasRefreshed', handleMonedasRefreshed);
      window.removeEventListener('transaccionesRefreshed', handleTransaccionesRefreshed);
    };
  }, [refetchCuentas, refetchMonedas, fetchBalancesCuentas]);

  const handleCreateMoneda = async (data) => {
    try {
      const response = await clienteAxios.post('/api/monedas', data);
      const newMoneda = response.data;
      enqueueSnackbar('Moneda creada exitosamente', { variant: 'success' });
      refetchMonedas(); // Recargar las monedas
      return newMoneda;
    } catch (error) {
      console.error('Error al crear moneda:', error);
      enqueueSnackbar('Error al crear moneda', { variant: 'error' });
      throw error;
    }
  };

  const handleEdit = useCallback((cuenta) => {
    // Validar que la cuenta existe
    if (!cuenta) {
      enqueueSnackbar('Error: Cuenta no válida para editar', { variant: 'error' });
      return;
    }
    
    // Extraer y validar ID de la cuenta
    const cuentaId = cuenta.id || cuenta._id;
    if (!cuentaId) {
      enqueueSnackbar('Error: ID de cuenta no válido', { variant: 'error' });
      return;
    }
    
    // Extraer y validar ID de moneda
    let monedaId = null;
    if (typeof cuenta.moneda === 'object' && cuenta.moneda) {
      monedaId = cuenta.moneda.id || cuenta.moneda._id;
    } else {
      monedaId = cuenta.moneda;
    }
    
    // Verificar moneda válida
    if (!monedaId) {
      enqueueSnackbar('Error: No se pudo determinar la moneda de la cuenta', { variant: 'error' });
      return;
    }
    
    // Normalizar datos para edición
    const cuentaNormalizada = {
      id: cuentaId,
      _id: cuentaId,
      nombre: cuenta.nombre || '',
      numero: cuenta.numero || '',
      tipo: cuenta.tipo || 'OTRO',
      monedaId: monedaId // Para el selector del formulario
    };
    
    setEditingCuenta(cuentaNormalizada);
    setIsFormOpen(true);
  }, [enqueueSnackbar]);

  const handleDelete = useCallback(async (cuenta) => {
    try {
      // Extraer y validar ID de la cuenta
      const cuentaId = cuenta.id || cuenta._id;
      if (!cuentaId) {
        enqueueSnackbar('Error: ID de cuenta no válido para eliminar', { variant: 'error' });
        return;
      }
      
      // Mostrar confirmación al usuario
      setDeletingId(cuentaId);
      setConfirmDialogOpen(true);
    } catch (error) {
      console.error('Error al preparar eliminación de cuenta:', error);
      enqueueSnackbar('Error al preparar eliminación de cuenta', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const confirmDelete = useCallback(async () => {
    try {
      if (!deletingId) {
        enqueueSnackbar('Error: No hay cuenta seleccionada para eliminar', { variant: 'error' });
        setConfirmDialogOpen(false);
        return;
      }
      
      // Mostrar mensaje de carga
      const loadingMsg = enqueueSnackbar('Eliminando cuenta...', { 
        variant: 'info',
        persist: true 
      });
      
      // Realizar la eliminación
      const response = await clienteAxios.delete(`/api/cuentas/${deletingId}`);
      
      if (response.status === 200) {
        // Quitar mensaje de carga y mostrar éxito
        closeSnackbar(loadingMsg);
        enqueueSnackbar('Cuenta eliminada con éxito', { variant: 'success' });
        
        // Actualizar datos
        await Promise.all([
          refetchCuentas(),
          resetBalance()
        ]);
        
        // Recargar balances después de un pequeño retraso para dar tiempo a la actualización
        setTimeout(() => {
          fetchBalancesCuentas();
        }, 500);
      } else {
        throw new Error('Error al eliminar cuenta');
      }
    } catch (error) {
      console.error('Error al eliminar cuenta:', error);
      enqueueSnackbar(
        error.response?.data?.message || 'Error al eliminar la cuenta', 
        { variant: 'error' }
      );
    } finally {
      setConfirmDialogOpen(false);
      setDeletingId(null);
    }
  }, [deletingId, enqueueSnackbar, closeSnackbar, refetchCuentas, resetBalance, fetchBalancesCuentas]);

  const handleFormSubmit = useCallback(async (formData) => {
    try {
      // Validación del ID de moneda
      const monedaId = formData.monedaId;
      if (!monedaId) {
        enqueueSnackbar('Error: Debe seleccionar una moneda', { variant: 'error' });
        return;
      }

      // Verificar que la moneda existe
      const monedaExistente = monedas.find(m => m._id === monedaId || m.id === monedaId);
      if (!monedaExistente) {
        console.error(`No se encontró la moneda con ID: ${monedaId}`);
        enqueueSnackbar('Error: La moneda seleccionada no existe', { variant: 'error' });
        return;
      }

      // Mostrar mensaje de carga
      const loadingMsg = enqueueSnackbar('Guardando cuenta...', { 
        variant: 'info',
        persist: true 
      });

      // Normalizar los datos a enviar
      const datosAEnviar = {
        nombre: formData.nombre?.trim() || '',
        numero: formData.numero?.trim() || '',
        tipo: formData.tipo || 'OTRO',
        moneda: monedaId,
        activo: true
      };

      // Determinar si estamos creando o actualizando
      let response;
      if (editingCuenta) {
        // Obtener ID de la cuenta
        const cuentaId = editingCuenta.id || editingCuenta._id;
        if (!cuentaId) {
          closeSnackbar(loadingMsg);
          enqueueSnackbar('Error: ID de cuenta no válido para edición', { variant: 'error' });
          return;
        }
        
        // Actualizar cuenta existente
        response = await clienteAxios.put(`/api/cuentas/${cuentaId}`, datosAEnviar);
        closeSnackbar(loadingMsg);
        enqueueSnackbar('Cuenta actualizada exitosamente', { variant: 'success' });
      } else {
        // Crear nueva cuenta
        response = await clienteAxios.post('/api/cuentas', datosAEnviar);
        closeSnackbar(loadingMsg);
        enqueueSnackbar('Cuenta creada exitosamente', { variant: 'success' });
      }
      
      // Limpiar estado y recargar datos
      setIsFormOpen(false);
      setEditingCuenta(null);
      
      // Esperar a que se completen las recargas para evitar estados inconsistentes
      await Promise.all([
        refetchCuentas(),
        refetchMonedas(),
        resetBalance()
      ]);
      
      // Recargar los balances después de actualizar los datos
      setTimeout(() => {
        fetchBalancesCuentas();
      }, 500);

    } catch (error) {
      console.error('Error al guardar cuenta:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error al guardar la cuenta';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  }, [editingCuenta, enqueueSnackbar, closeSnackbar, refetchCuentas, refetchMonedas, monedas, fetchBalancesCuentas, resetBalance]);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingCuenta(null);
  }, []);

  const handleMonedaToggle = (monedaId) => {
    setExpandedMonedas(prev => {
      if (prev.includes(monedaId)) {
        return prev.filter(id => id !== monedaId);
      }
      return [...prev, monedaId];
    });
  };

  const formFields = [
    {
      name: 'nombre',
      label: 'Nombre',
      type: 'text',
      required: true
    },
    {
      name: 'numero',
      label: 'Número',
      type: 'text',
      required: true
    },
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
        { value: 'OTRO', label: 'Otro' }
      ]
    },
    {
      name: 'monedaId',
      label: 'Moneda',
      type: 'select',
      required: true,
      options: monedas.map(m => ({
        value: m._id || m.id,
        label: `${m.nombre} (${m.simbolo})`
      })),
      onCreateNew: handleCreateMoneda,
      createButtonText: 'Crear Nueva Moneda',
      createTitle: 'Nueva Moneda',
      createFields: [
        { name: 'codigo', label: 'Código', required: true },
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'simbolo', label: 'Símbolo', required: true }
      ]
    }
  ];

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'BANCO':
        return <BankIcon sx={{ fontSize: 18 }} />;
      case 'EFECTIVO':
        return <MoneyIcon sx={{ fontSize: 18 }} />;
      default:
        return <CardIcon sx={{ fontSize: 18 }} />;
    }
  };

  const cuentasMultimoneda = useMemo(
    () =>
      cuentas
        .filter((cuenta) => isCuentaMultimoneda(cuenta))
        .map((cuenta) => {
          const cuentaId = cuenta.id || cuenta._id;
          return {
            ...cuenta,
            id: cuentaId,
            _id: cuentaId,
            monedasHabilitadas: getMonedasFromCuenta(cuenta, monedas),
          };
        }),
    [cuentas, monedas],
  );

  // Memoizar la función para evitar recálculos innecesarios
  const cuentasAgrupadasPorMoneda = useMemo(() => {
    // Preparar un objeto para almacenar las cuentas agrupadas por moneda
    const grupos = {};
    
    // Primero, crear grupos para cada moneda disponible
    monedas.forEach(moneda => {
      // Usar siempre 'id' para referencias de IDs
      const monedaId = moneda.id || moneda._id;
      if (monedaId) {
        grupos[monedaId] = {
          moneda: {
            id: monedaId,
            _id: monedaId, // Para compatibilidad
            nombre: moneda.nombre || 'Sin nombre',
            simbolo: moneda.simbolo || '$',
            color: moneda.color || '#75AADB'
          },
          cuentas: [],
          balance: balancesPorMoneda[monedaId] || 0
        };
      }
    });
    
    // Crear un grupo para cuentas sin moneda asignada
    grupos['sin-moneda'] = {
      moneda: {
        id: 'sin-moneda',
        _id: 'sin-moneda',
        nombre: 'Sin moneda asignada',
        simbolo: '$',
        color: '#75AADB'
      },
      cuentas: [],
      balance: 0
    };
    
    // Luego asignar cada cuenta monomoneda a su grupo de moneda correspondiente
    cuentas.forEach(cuenta => {
      if (isCuentaMultimoneda(cuenta)) return;

      // Normalizar el id de la cuenta
      const cuentaId = cuenta.id || cuenta._id;
      
      // Extraer el id de la moneda - simplificado
      let monedaId;
      
      if (cuenta.moneda) {
        if (typeof cuenta.moneda === 'object') {
          monedaId = cuenta.moneda.id || cuenta.moneda._id;
        } else {
          monedaId = cuenta.moneda;
        }
      }
      
      // Si no hay un grupo para esta moneda, o la moneda no existe, usar el grupo sin-moneda
      const grupoKey = (monedaId && grupos[monedaId]) ? monedaId : 'sin-moneda';
      
      // Procesar la cuenta con valores normalizados
      const cuentaProcesada = {
        id: cuentaId,
        _id: cuentaId, // Para compatibilidad
        nombre: cuenta.nombre || 'Sin nombre',
        numero: cuenta.numero || '',
        tipo: cuenta.tipo || 'OTRO',
        saldo: balances[cuentaId] || 0,
        moneda: monedaId,
        // Copiar el resto de propiedades
        ...Object.fromEntries(
          Object.entries(cuenta).filter(([key]) => !['id', '_id', 'nombre', 'numero', 'tipo', 'saldo', 'moneda'].includes(key))
        )
      };
      
      // Añadir la cuenta al grupo correspondiente
      grupos[grupoKey].cuentas.push(cuentaProcesada);
    });
    
    // Filtrar grupos vacíos
    return Object.fromEntries(
      Object.entries(grupos).filter(([_, grupo]) => grupo.cuentas.length > 0)
    );
  }, [monedas, cuentas, balances, balancesPorMoneda]);

  const selectedCuenta = useMemo(() => {
    if (!selectedCuentaId) return null;
    const foundMulti = cuentasMultimoneda.find((c) => (c._id || c.id) === selectedCuentaId);
    if (foundMulti) {
      return {
        ...foundMulti,
        monedas: foundMulti.monedasHabilitadas,
      };
    }
    for (const grupo of Object.values(cuentasAgrupadasPorMoneda)) {
      const found = grupo.cuentas.find((c) => (c._id || c.id) === selectedCuentaId);
      if (found) {
        const monedaObj = grupo.moneda;
        return {
          ...found,
          moneda: typeof found.moneda === 'object' ? found.moneda : monedaObj,
        };
      }
    }
    return null;
  }, [cuentasMultimoneda, cuentasAgrupadasPorMoneda, selectedCuentaId]);

  // Si el id de la URL ya no existe (cuenta eliminada o link viejo), volver a la lista.
  useEffect(() => {
    if (selectedCuentaId && !isLoading && !selectedCuenta) closeCuenta();
  }, [selectedCuentaId, isLoading, selectedCuenta, closeCuenta]);

  // Función para iniciar el pago de prueba
  const handlePagoPrueba = async () => {
    setIsProcessingPago(true);
    try {
      // Llamada simple al backend para crear la preferencia de pago
      const response = await clienteAxios.post('/api/bankconnections/pagos/prueba');
      
      if (response.data.success && response.data.init_point) {
        // Redirigir al usuario a MercadoPago para completar el pago
        window.location.href = response.data.init_point;
      } else {
        console.error('Error: No se recibió la URL de pago');
        alert('Error al generar el pago. Intenta nuevamente.');
      }
    } catch (error) {
      console.error('Error en pago de prueba:', error);
      alert('Error al procesar el pago. Intenta nuevamente.');
    } finally {
      setIsProcessingPago(false);
    }
  };

  const openCreate = () => {
    setEditingCuenta(null);
    setIsFormOpen(true);
  };

  const handleCuentaRowClick = (cuenta) => {
    const cuentaRowId = cuenta._id || cuenta.id;
    openSetup('cuentas', { cuentaId: cuentaRowId });
  };

  const cuentasList = (
    <>
      {isLoading ? (
        <EmptyState
          message="Cargando cuentas..."
          submessage="Un momento mientras preparamos tus datos."
        />
      ) : monedas.length === 0 && cuentas.length === 0 ? (
        <EmptyState
          message="Falta configurar monedas"
          submessage="Creá al menos una moneda para poder agregar cuentas."
        />
      ) : cuentas.length === 0 ? (
        <EmptyState
          onAdd={openCreate}
          message="Todavía no hay cuentas"
          submessage="Creá una cuenta manual o sincronizá Mercado Pago para empezar."
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {cuentasMultimoneda.length > 0 && (() => {
            const visibles = cuentasMultimoneda;
            return (
              <AccountListGroup
                title="Multimoneda"
                rightContent={(
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {visibles[0].monedasHabilitadas.length === 1
                      ? '1 moneda'
                      : `${visibles[0].monedasHabilitadas.length} monedas`}
                  </Typography>
                )}
              >
                {visibles.map((cuenta) => {
                  const cuentaRowId = cuenta._id || cuenta.id;
                  const saldosCuenta = balancesPorCuentaMoneda[cuentaRowId] || {};
                  const monedasHabilitadas = cuenta.monedasHabilitadas || [];
                  const balanceItems = monedasHabilitadas.map((moneda) => {
                    const saldoMoneda = saldosCuenta[moneda.id] ?? 0;
                    return {
                      id: moneda.id,
                      title: `${moneda.nombre} (${moneda.codigo})`,
                      color: saldoMoneda >= 0 ? (moneda.color || '#75AADB') : 'error.main',
                      formatted: showValues
                        ? formatFinanzasMonto(saldoMoneda, { simbolo: moneda.simbolo })
                        : '****',
                    };
                  });
                  return (
                    <AccountListRow
                      key={cuentaRowId}
                      id={`cuenta-row-${cuentaRowId}`}
                      icon={getTipoIcon(cuenta.tipo)}
                      nombre={cuenta.nombre || 'Efectivo'}
                      tipoLabel={cuenta.tipo ? cuenta.tipo.replace('_', ' ') : 'EFECTIVO'}
                      onClick={() => handleCuentaRowClick(cuenta)}
                      balances={balanceItems}
                      actions={cuenta.esDefault ? undefined : (
                        <CommonActions
                          onEdit={() => handleEdit(cuenta)}
                          onDelete={() => handleDelete(cuenta)}
                          itemName={`la cuenta ${cuenta.nombre}`}
                        />
                      )}
                    />
                  );
                })}
              </AccountListGroup>
            );
          })()}
          {Object.entries(cuentasAgrupadasPorMoneda).map(([monedaId, grupo]) => {
            if (!grupo.moneda) return null;

            const cuentasVisibles = grupo.cuentas;
            if (cuentasVisibles.length === 0) return null;

            return (
              <AccountListGroup
                key={monedaId}
                title={`${grupo.moneda.nombre} (${grupo.moneda.simbolo})`}
                rightContent={(
                  <Typography
                    variant="caption"
                    sx={{
                      color: grupo.balance >= 0 ? grupo.moneda.color || '#75AADB' : 'error.main',
                      fontWeight: 700,
                    }}
                  >
                    {showValues
                      ? formatFinanzasMonto(grupo.balance, { simbolo: grupo.moneda.simbolo })
                      : '****'}
                  </Typography>
                )}
              >
                {cuentasVisibles.map((cuenta) => {
                  const cuentaRowId = cuenta._id || cuenta.id;
                  const saldo = balances[cuentaRowId] ?? cuenta.saldo ?? 0;
                  return (
                    <AccountListRow
                      key={cuentaRowId}
                      id={`cuenta-row-${cuentaRowId}`}
                      icon={getTipoIcon(cuenta.tipo)}
                      nombre={cuenta.nombre || 'Sin nombre'}
                      tipoLabel={cuenta.tipo ? cuenta.tipo.replace('_', ' ') : 'OTRO'}
                      tipoWarning={!cuenta.tipo}
                      onClick={() => handleCuentaRowClick(cuenta)}
                      balances={[
                        {
                          id: grupo.moneda.id,
                          color: saldo >= 0 ? grupo.moneda.color || '#75AADB' : 'error.main',
                          formatted: showValues
                            ? formatFinanzasMonto(saldo, { simbolo: grupo.moneda.simbolo })
                            : '****',
                        },
                      ]}
                      actions={(
                        <CommonActions
                          onEdit={() => handleEdit(cuenta)}
                          onDelete={() => handleDelete(cuenta)}
                          itemName={`la cuenta ${cuenta.nombre}`}
                        />
                      )}
                    />
                  );
                })}
              </AccountListGroup>
            );
          })}
        </Box>
      )}
    </>
  );

  return (
    <Box sx={selectedCuenta ? undefined : { px: 1.5, py: 1.25 }}>
      {!selectedCuenta && (
        <MercadoPagoPartialSyncBanner onImportCsv={() => refetchCuentas()} />
      )}
      {selectedCuenta && (
        <CuentaTransaccionesPanel
          cuenta={selectedCuenta}
          onRefresh={handleRefreshCuenta}
          embedded
          branchId={branchId}
        />
      )}
      <BankConnectionForm
        open={isBankConnectionFormOpen}
        onClose={() => setIsBankConnectionFormOpen(false)}
        onSubmit={async (formData) => {
          try {
            await clienteAxios.post('/api/cuentas', {
              nombre: formData.nombre,
              numero: formData.numero,
              tipo: formData.tipo,
              activo: true,
            });
            setIsBankConnectionFormOpen(false);
            await refetchCuentas();
          } catch (error) {
            console.error('Error creando cuenta:', error);
            throw error;
          }
        }}
        isEditing={false}
      />

      <CommonForm
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCuenta(null);
        }}
        onSubmit={handleFormSubmit}
        title={editingCuenta ? 'Editar Cuenta' : 'Nueva Cuenta'}
        fields={formFields}
        initialData={editingCuenta || {}}
        isEditing={!!editingCuenta}
      />

      {!selectedCuenta && cuentasList}

      {/* Diálogo de confirmación para eliminar */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Está seguro que desea eliminar esta cuenta? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)} color="primary">
            Cancelar
          </Button>
          <Button onClick={confirmDelete} color="error" autoFocus>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default CuentasSetup;

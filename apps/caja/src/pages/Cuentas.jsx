import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  Tooltip,
} from '@mui/material';
import { CommonForm, CommonActions } from '@shared/components/common';
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
import {
  MercadoPagoConnectButton,
  BankConnectionForm,
  BranchFinanzasSectionNav,
  MercadoPagoPartialSyncBanner,
  CuentaTransaccionesPanel,
  CuentaDetailShell,
  cuentaDetailPath,
  useFinanzasBranch,
} from '../finanzas';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useResponsive } from '@shared/hooks';
import { formatFinanzasMonto } from '@shared/utils/formatFinanzasMonto';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';

export function Cuentas() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedMonedas, setExpandedMonedas] = useState([]);
  const { showValues } = useValuesVisibility();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [editingCuenta, setEditingCuenta] = useState(null);
  const [balances, setBalances] = useState({});
  const [balancesPorMoneda, setBalancesPorMoneda] = useState({});
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isBankConnectionFormOpen, setIsBankConnectionFormOpen] = useState(false);
  const [isProcessingPago, setIsProcessingPago] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCuentaId = searchParams.get('cuenta');
  const { isMobile } = useResponsive();
  const { branchId, cuentasPath } = useFinanzasBranch();

  // Función para restablecer los balances
  const resetBalance = useCallback(() => {
    setBalances({});
    setBalancesPorMoneda({});
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
    
    // Preparar los grupos por moneda para acumular balances
    monedas.forEach(moneda => {
      const monedaId = moneda.id || moneda._id;
      if (monedaId) {
        balancesPorMonedaTemp[monedaId] = 0;
      }
    });

    const today = new Date().toISOString().split('T')[0];

    // Pedir el balance de cada cuenta en paralelo via agregación (no bajar transacciones)
    const resultados = await Promise.all(
      cuentas.map(async (cuenta) => {
        const cuentaId = cuenta.id || cuenta._id;
        if (!cuentaId) return null;
        try {
          const response = await clienteAxios.get(`/api/transacciones/balance/${cuentaId}`, {
            params: { fechaFin: today, estado: 'PAGADO' },
          });
          return { cuenta, cuentaId, balance: response.data?.balance ?? 0 };
        } catch (error) {
          console.error(`Error al cargar balance para cuenta ${cuenta.nombre}:`, error);
          return { cuenta, cuentaId, balance: 0 };
        }
      }),
    );

    for (const item of resultados) {
      if (!item) continue;
      const { cuenta, cuentaId, balance } = item;
      balancesTemp[cuentaId] = balance;

      let monedaId = null;
      if (typeof cuenta.moneda === 'object' && cuenta.moneda) {
        monedaId = cuenta.moneda.id || cuenta.moneda._id;
      } else {
        monedaId = cuenta.moneda;
      }

      if (monedaId && balancesPorMonedaTemp[monedaId] !== undefined) {
        balancesPorMonedaTemp[monedaId] += balance;
      }
    }

    setBalances(balancesTemp);
    setBalancesPorMoneda(balancesPorMonedaTemp);
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
      if (
        (e.detail?.path && e.detail.path === location.pathname) ||
        e.detail?.type === 'cuenta' ||
        e.detail?.type === 'cuentas'
      ) {
        setEditingCuenta(null);
        setIsFormOpen(true);
      }
    };
    
    window.addEventListener('headerAddButtonClicked', handleHeaderAdd);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAdd);
  }, [location.pathname]);

  // Escuchar evento global para abrir la conexión de MercadoPago desde la Toolbar
  useEffect(() => {
    const handleOpenMpConnect = () => {
      setIsSyncModalOpen(true);
    };
    window.addEventListener('openMercadoPagoConnect', handleOpenMpConnect);
    return () => window.removeEventListener('openMercadoPagoConnect', handleOpenMpConnect);
  }, []);

  // Abrir formulario tras redirección si openAdd está en el estado
  useEffect(() => {
    if (location.state?.openAdd) {
      setEditingCuenta(null);
      setIsFormOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    if (!selectedCuentaId || isLoading || !isMobile) return undefined;
    const timer = setTimeout(() => {
      document.getElementById(`cuenta-row-${selectedCuentaId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedCuentaId, isLoading, cuentas, isMobile]);

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
    
    // Luego asignar cada cuenta a su grupo de moneda correspondiente
    cuentas.forEach(cuenta => {
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
  }, [cuentasAgrupadasPorMoneda, selectedCuentaId]);

  const showGlobalPartialBanner = !selectedCuentaId || selectedCuenta?.tipo !== 'MERCADO_PAGO';

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

  return (
    <Box sx={cajaPageLayoutSx}>
      <BranchFinanzasSectionNav branchId={branchId} variant="strip" />
      {showGlobalPartialBanner && (
        <MercadoPagoPartialSyncBanner onImportCsv={() => refetchCuentas()} />
      )}
      {isMobile && selectedCuenta && (
        <CuentaTransaccionesPanel
          cuenta={selectedCuenta}
          onRefresh={handleRefreshCuenta}
          embedded
          branchId={branchId}
        />
      )}
      <CuentaDetailShell
        open={!isMobile && !!selectedCuenta}
        onClose={() => navigate(cuentasPath, { replace: true })}
      >
        {!isMobile && selectedCuenta && (
          <CuentaTransaccionesPanel
            cuenta={selectedCuenta}
            onRefresh={handleRefreshCuenta}
            embedded
            branchId={branchId}
          />
        )}
      </CuentaDetailShell>
      {/* Modal para crear cuenta (manual o MercadoPago) */}
      <BankConnectionForm
        open={isBankConnectionFormOpen}
        onClose={() => setIsBankConnectionFormOpen(false)}
        onSubmit={async (formData) => {
          try {
            // Crear la cuenta usando el endpoint de cuentas
            await clienteAxios.post('/api/cuentas', {
              nombre: formData.nombre,
              numero: formData.numero,
              tipo: formData.tipo,
              activo: true
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
      
      <Box sx={{ mt: 3 }}>
        {isLoading ? (
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, boxShadow: 1 }}>
            <EmptyState
              message="Cargando cuentas..."
              submessage="Por favor espera mientras cargamos tus datos."
            />
          </Box>
        ) : cuentas.length === 0 ? (
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, boxShadow: 1 }}>
            <EmptyState onAdd={() => setIsFormOpen(true)} />
          </Box>
        ) : (
          <Box sx={{ mt: 3 }}>
            {Object.entries(cuentasAgrupadasPorMoneda).map(([monedaId, grupo]) => {
              if (!grupo.moneda) {
                return null;
              }

              const cuentasVisibles = grupo.cuentas.filter((cuenta) => {
                if (!isMobile || !selectedCuentaId) return true;
                const id = cuenta._id || cuenta.id;
                return id !== selectedCuentaId;
              });

              if (cuentasVisibles.length === 0) {
                return null;
              }
              
              return (
                <Paper 
                  key={monedaId}
                  sx={{ 
                    mb: 2, 
                    overflow: 'hidden',
                    bgcolor: 'background.paper'
                  }}
                >
                  <Box sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1,
                    bgcolor: 'background.default',
                    borderBottom: 1,
                    borderColor: 'divider'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {grupo.moneda.nombre} ({grupo.moneda.simbolo})
                      </Typography>
                      <Typography 
                        variant="subtitle2" 
                        sx={{ 
                          color: grupo.balance >= 0 ? grupo.moneda.color || '#75AADB' : 'error.main',
                          fontWeight: 'bold'
                        }}
                      >
                        {showValues ? formatFinanzasMonto(grupo.balance, { simbolo: grupo.moneda.simbolo }) : '****'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box>
                    {cuentasVisibles.map((cuenta) => {
                      const cuentaRowId = cuenta._id || cuenta.id;
                      const isSelected = selectedCuentaId === cuentaRowId;
                      return (
                        <Box
                          key={cuentaRowId}
                          id={`cuenta-row-${cuentaRowId}`}
                          onClick={() => navigate(cuentaDetailPath(cuentaRowId, branchId), { replace: true })}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 2,
                            py: 1,
                            borderBottom: 1,
                            borderColor: 'divider',
                            cursor: 'pointer',
                            bgcolor: isSelected ? 'action.selected' : 'background.paper',
                            outline: isSelected ? '2px solid' : 'none',
                            outlineColor: 'primary.main',
                            outlineOffset: -2,
                            '&:last-child': {
                              borderBottom: 0
                            },
                            '&:hover': {
                              bgcolor: isSelected ? 'action.selected' : 'action.hover'
                            }
                          }}
                        >
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1,
                            flex: 1
                          }}>
                            {getTipoIcon(cuenta.tipo)}
                            <Typography variant="body2">
                              {cuenta.nombre || 'Sin nombre'}
                            </Typography>
                            <Chip 
                              label={cuenta.tipo ? cuenta.tipo.replace('_', ' ') : 'OTRO'}
                              size="small"
                              variant="outlined"
                              color={cuenta.tipo ? 'default' : 'warning'}
                              sx={{ 
                                height: 20,
                                '& .MuiChip-label': {
                                  px: 1,
                                  fontSize: '0.75rem'
                                }
                              }}
                            />
                          </Box>
                          
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: cuenta.saldo >= 0 ? grupo.moneda.color || '#75AADB' : 'error.main',
                                fontWeight: 500
                              }}
                            >
                              {showValues
                                ? formatFinanzasMonto(cuenta.saldo, { simbolo: grupo.moneda.simbolo })
                                : '****'}
                            </Typography>

                            <CommonActions
                              onEdit={() => handleEdit(cuenta)}
                              onDelete={() => handleDelete(cuenta)}
                              itemName={`la cuenta ${cuenta.nombre}`}
                            />
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </Box>

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

      {/* Modal de sincronización */}
      <Dialog open={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogContent>
          <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
            Sincronizar nueva cuenta
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <MercadoPagoConnectButton
              onSuccess={() => {
                setIsSyncModalOpen(false);
                refetchCuentas();
              }}
              onError={(error) => {
                console.error('Error en conexión MercadoPago:', error);
                // NO cerramos el modal para que el usuario vea el error y pueda reintentar
              }}
              fullWidth
            />
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default Cuentas; 
import React from 'react';
import { Box, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import useResponsive from '../../hooks/useResponsive';
import {
  Apartment as BuildingFilledIcon,
  AccountBalanceWallet as WalletFilledIcon,
  CalendarMonth as DateFilledIcon,
  Science as LabFilledIcon,
  Restaurant as DietaFilledIcon,
  TrackChanges as ProjectFilledIcon,
  CurrencyExchange as MoneyFilledIcon,
  AllInbox as InventoryFilledIcon,
  Bed as BedFilledIcon,
  People as PeopleFilledIcon,
  Description as ContratosFilledIcon,
  AccountBalance as CuentasFilledIcon,
  TaskAlt as TaskFilledIcon,
  MonitorWeight as WeightFilledIcon,
  HealthAndSafety as HealthFilledIcon,
  Autorenew as AutorenewFilledIcon,
  Settings as SettingsIcon,
  Person as PersonFilledIcon
} from '@mui/icons-material';
import { FONT_SIZE } from '../../tipografia';

export function UnderConstruction() {
  const { theme } = useResponsive();
  const location = useLocation();
  const currentPath = location.pathname.slice(1);

  // Mapeo de rutas a íconos filled
  const routeIcons = {
    propiedades: BuildingFilledIcon,
    habitaciones: BedFilledIcon,
    contratos: ContratosFilledIcon,
    inquilinos: PeopleFilledIcon,
    inventario: InventoryFilledIcon,
    lab: LabFilledIcon,
    rutinas: DateFilledIcon,
    salud: HealthFilledIcon,
    transacciones: WalletFilledIcon,
    cuentas: CuentasFilledIcon,
    monedas: MoneyFilledIcon,
    dieta: DietaFilledIcon,
    objetivos: ProjectFilledIcon,
    datacorporal: WeightFilledIcon,
    tareas: TaskFilledIcon,
    recurrente: AutorenewFilledIcon,
    contactos: PersonFilledIcon
  };

  const IconComponent = routeIcons[currentPath] || BuildingFilledIcon;

  return (
    <Box
      sx={{
        p: 3,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 8
        }}
      >
        <Box sx={{ position: 'relative', mb: 3 }}>
          <IconComponent 
            sx={{ 
              fontSize: 64,
              color: theme.palette.secondary.main,
              stroke: 'currentColor',
              strokeWidth: 1,
              fill: 'none',
              '& path': {
                strokeWidth: 1,
                strokeLinecap: 'round',
                strokeLinejoin: 'round'
              }
            }} 
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -10,
              right: -20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: -1
            }}
          >
            <motion.div
              animate={{ rotate: -360 }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "linear"
              }}
              style={{ marginLeft: '12px', marginBottom: '-1px' }}
            >
              <SettingsIcon 
                sx={{ 
                  fontSize: 18,
                  color: theme.palette.secondary.main,
                  stroke: 'currentColor',
                  strokeWidth: 1,
                  fill: 'none',
                  '& path': {
                    strokeWidth: 1,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round'
                  }
                }} 
              />
            </motion.div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <SettingsIcon 
                sx={{ 
                  fontSize: 24,
                  color: theme.palette.secondary.main,
                  stroke: 'currentColor',
                  strokeWidth: 1,
                  fill: 'none',
                  '& path': {
                    strokeWidth: 1,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round'
                  }
                }} 
              />
            </motion.div>
          </Box>
        </Box>
        <Typography
          variant="body1"
          sx={{
            fontFamily: theme.typography.fontFamily,
            fontWeight: 400,
            textAlign: 'center',
            color: theme.palette.secondary.main,
            letterSpacing: '0.02em',
            fontSize: FONT_SIZE.base
          }}
        >
          Este módulo pronto estará habilitado
        </Typography>
      </Box>
    </Box>
  );
}

export default UnderConstruction;
import React from 'react';
import { TIEMPO_ICON_KEYS, TIEMPO_MODULE_ICON_KEY } from './tiempoIconKeys.js';
// import { icons } from './menuIcons'; // Ya no se usa icons directamente

/**
 * Niveles de navegación:
 * - App (Caja/Pulso/Foco): cambio en sidebar / AppsButton
 * - Branch (solo Caja): Finanzas — hub único con secciones in-page
 * - Page: destinos hoja (toolbar/bottom nav en la rama activa)
 * - Subpage (opcional): hijos de una page (p. ej. recurrentes bajo Transacciones)
 *
 * Propiedades e Inventario viven bajo Finanzas (cards en hub /finanzas).
 */
export const modulos = [
  {
    id: 'assets',
    title: 'Caja',
    icon: 'dollarSign',
    path: '/finanzas',
    subItems: [
      {
        id: 'finanzas',
        title: 'Finanzas',
        icon: 'wallet',
        path: '/finanzas',
        subItems: [
          {
            id: 'transacciones',
            title: 'Transacciones',
            path: '/finanzas/transacciones',
            icon: 'moneyBag',
            canAdd: true,
            subItems: [
              {
                id: 'recurrente',
                title: 'Transacciones recurrentes',
                path: '/finanzas/recurrente',
                icon: 'repeat',
                canAdd: true,
              },
            ],
          },
          { id: 'cuentas', title: 'Cuentas', path: '/finanzas/cuentas', icon: 'accountBalance', canAdd: true },
          { id: 'monedas', title: 'Monedas', path: '/finanzas/monedas', icon: 'currency', canAdd: true },
          { id: 'inversiones', title: 'Inversiones', path: '/finanzas/inversiones', icon: 'inversiones', isUnderConstruction: true },
          { id: 'deudores', title: 'Deudores', path: '/finanzas/deudores', icon: 'personSearch', isUnderConstruction: true },
          {
            id: 'propiedades',
            title: 'Propiedades',
            icon: 'apartment',
            path: '/propiedades',
            canAdd: true,
            subItems: [
              { id: 'contratos', title: 'Contratos', path: '/propiedades/contratos', icon: 'description', canAdd: true },
              { id: 'inquilinos', title: 'Inquilinos', path: '/propiedades/inquilinos', icon: 'person', canAdd: true },
              { id: 'cuentas', title: 'Cuentas', path: '/propiedades/cuentas', icon: 'accountBalance', canAdd: true },
              { id: 'transacciones', title: 'Transacciones', path: '/propiedades/transacciones', icon: 'moneyBag', canAdd: true },
            ],
          },
          {
            id: 'inventario',
            title: 'Inventario',
            icon: 'inventario',
            path: '/propiedades/inventario',
            canAdd: true,
            subItems: [
              {
                id: 'inventario-en-propiedades',
                title: 'En propiedades',
                path: '/propiedades/inventario/en-propiedades',
                icon: 'apartment',
                canAdd: true,
              },
              {
                id: 'vehiculos',
                title: 'Autos',
                path: '/propiedades/autos',
                icon: 'auto',
                isUnderConstruction: true,
              },
              {
                id: 'inventario-sin-ubicacion',
                title: 'Sin locación',
                path: '/propiedades/inventario/sin-ubicacion',
                icon: 'inventario',
                canAdd: true,
              },
              { id: 'cuentas', title: 'Cuentas', path: '/propiedades/inventario/cuentas', icon: 'accountBalance', canAdd: true },
              { id: 'transacciones', title: 'Transacciones', path: '/propiedades/inventario/transacciones', icon: 'moneyBag', canAdd: true },
            ],
          },
        ]
      },
    ]
  },
  {
    id: 'salud',
    title: 'Pulso',
    icon: 'pulso',
    path: '/datacorporal',
    subItems: [
      { id: 'datacorporal', title: 'Data corporal', icon: 'monitorHeart', path: '/datacorporal', canAdd: true },
      { id: 'dieta', title: 'Dieta', icon: 'restaurant', path: '/dieta', isUnderConstruction: true },
      { id: 'lab', title: 'Lab', icon: 'science', path: '/lab', isUnderConstruction: true }
    ]
  },
  {
    id: 'tiempo',
    title: 'Foco',
    icon: TIEMPO_MODULE_ICON_KEY,
    path: '/tareas',
    subItems: [
      { id: 'rutinas', title: 'Rutinas', icon: TIEMPO_ICON_KEYS.rutinas, path: '/rutinas', canAdd: true },
      { id: 'objetivos', title: 'Objetivos', icon: TIEMPO_ICON_KEYS.objetivos, path: '/objetivos', canAdd: true },
      { id: 'tareas', title: 'Tareas', icon: TIEMPO_ICON_KEYS.tareas, path: '/tareas', canAdd: true },
    ]
  },
  {
    id: 'setup',
    title: 'Setup',
    icon: 'settings',
    path: '/configuracion',
    subItems: [
      { id: 'perfil', title: 'Perfil', path: '/configuracion/perfil', icon: 'accountCircle' },
      { id: 'preferencias', title: 'Preferencias', path: '/configuracion/preferencias', icon: 'manageAccounts' }
    ]
  }
];

// Switcher de apps (sidebar desktop + bottom nav móvil) → hub de cada app
export const bottomNavigationItems = [
  {
    id: 'assets',
    appKey: 'caja',
    title: 'Caja',
    icon: 'dollarSign',
    path: '/finanzas',
    type: 'module',
    activePaths: ['/', '/finanzas', '/propiedades']
  },
  {
    id: 'salud',
    appKey: 'pulso',
    title: 'Pulso',
    icon: 'pulso',
    path: '/datacorporal',
    type: 'module',
    activePaths: ['/datacorporal', '/dieta', '/lab']
  },
  {
    id: 'tiempo',
    appKey: 'foco',
    title: 'Foco',
    icon: TIEMPO_MODULE_ICON_KEY,
    path: '/tareas',
    type: 'module',
    activePaths: ['/rutinas', '/objetivos', '/tareas', '/archivo']
  }
];

// Helpers adaptados
export const getBottomNavigationItems = () => {
  return bottomNavigationItems.map(item => ({
    ...item,
    icon: item.icon
  }));
};

export const getModulos = () => {
  return modulos.map(item => ({
    ...item,
    icon: item.icon
  }));
};

// Para obtener solo los módulos (primer nivel)
export const getRootModules = () => {
  return modulos;
}; 
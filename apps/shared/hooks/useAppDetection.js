import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { bottomNavigationItems } from '../navigation/menuStructure.js';
import { getAppKeyFromPath, getCurrentAppKey } from '../utils/navigationUtils';

// Paths antiguos removidos; se usa lógica centralizada

export const useAppDetection = () => {
  const location = useLocation();
  
  const appInfo = useMemo(() => {
    const currentPort = window.location.port;
    const pathname = location.pathname;
    const appName = getAppKeyFromPath(pathname) || getCurrentAppKey() || 'foco';
    
    // Obtener información de la app
    const appConfig = bottomNavigationItems.find(item => item.appKey === appName);
    
    return {
      appName,
      appTitle: appConfig?.title || 'Foco',
      appIcon: appConfig?.icon || 'accessTime',
      appPath: appConfig?.path || '/tareas',
      currentPort,
      detectedBy: 'path'
    };
  }, [location.pathname]);
  
  return appInfo;
};

// Hook específico para obtener solo el nombre de la app
export const useCurrentApp = () => {
  const { appName } = useAppDetection();
  return appName;
};

// Hook para obtener configuración completa
export const useAppConfig = () => {
  const appInfo = useAppDetection();
  return appInfo;
};

// Componentes principales
export { ContratoPropiedadSection, ContratoHabitacionSection, ContratoInquilinosSection, ContratoMontosSection, TIPO_ALQUILER } from './ContratosSection';
export { default as ContratoCuotasSection } from './ContratoCuotasSection';
export { default as ContratoDetail } from './ContratoDetail';
export { default as ContratoForm } from './ContratoForm';
export { default as EstadoFinanzasContrato } from './EstadoFinanzasContrato';

// Hooks
export { useContratoData } from '@shared/hooks/useContratoData';

// Contexto
export { CuotasProvider, useCuotasContext } from '@shared/context/CuotasContext';

// Utilidades
export * from '@shared/utils/contratoUtils'; 
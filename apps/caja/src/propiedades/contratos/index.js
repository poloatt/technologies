// Componentes principales
export { ContratoPropiedadSection, ContratoHabitacionSection, ContratoInquilinosSection, ContratoMontosSection } from './ContratosSection';
export { TIPO_ALQUILER } from './tipoAlquiler';
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
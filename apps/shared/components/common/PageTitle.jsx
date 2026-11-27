import { Typography } from '@mui/material';
import { pageTitleSx } from '../../tipografia';

/** Título de página compartido por Caja, Foco y Pulso (serif estilo Hinge). */
export default function PageTitle({ children, component = 'h1', sx, ...props }) {
  return (
    <Typography
      component={component}
      sx={[pageTitleSx, ...(Array.isArray(sx) ? sx : [sx])]}
      {...props}
    >
      {children}
    </Typography>
  );
}

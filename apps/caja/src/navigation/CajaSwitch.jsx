import React from 'react';
import { Switch } from '@mui/material';
import { cajaSwitchSx } from '../hub/styles/attaPropiedadHubStyles';

/**
 * Switch compacto con estética hub Atta (Google Tasks–like).
 * Reutilizable en filas de lista y tiles de finanzas.
 */
function CajaSwitch({ sx, ...props }) {
  return (
    <Switch
      color="primary"
      disableRipple
      sx={[cajaSwitchSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...props}
    />
  );
}

export default React.memo(CajaSwitch);
export { cajaSwitchSx };

import React from 'react';
import { getTipoPropiedadIconComponent } from '@shared/utils/propiedadUtils';

function isRenderableComponent(Component) {
  if (!Component) return false;
  if (typeof Component === 'function') return true;
  // MUI icons suelen venir envueltos en memo/forwardRef (objeto con $$typeof)
  return typeof Component === 'object' && Component.$$typeof != null;
}

const TipoPropiedadIcon = ({ tipo, sx = {}, ...props }) => {
  if (!tipo || typeof tipo !== 'string') {
    return null;
  }

  const { IconComponent, props: defaultProps } = getTipoPropiedadIconComponent(tipo, { sx, ...props });

  if (!isRenderableComponent(IconComponent)) {
    return null;
  }

  return <IconComponent {...defaultProps} />;
};

export default TipoPropiedadIcon; 
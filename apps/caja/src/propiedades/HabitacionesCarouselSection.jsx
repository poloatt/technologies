import React from 'react';
import { Typography } from '@mui/material';
import { MonedasCarousel } from '../finanzas/monedas';
import HabitacionTile from './hub/HabitacionTile';
import { getHabitacionTipoLabel } from './habitacionConstants';
import { contarItemsPorHabitacion } from '@shared/utils/propiedadUtils';

function buildHabitacionSubtitle(habitacion) {
  const parts = [];
  if (habitacion.metrosCuadrados) parts.push(`${habitacion.metrosCuadrados}m²`);
  if (habitacion.itemsCount !== undefined) {
    parts.push(`${habitacion.itemsCount} ${habitacion.itemsCount === 1 ? 'item' : 'items'}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Carrusel horizontal de ambientes (misma UX que Monedas en Finanzas; tiles solo icono).
 */
export default function HabitacionesCarouselSection({
  habitaciones = [],
  inventarios = [],
  onEdit,
  onDelete,
  emptyMessage = 'Sin ambientes',
  carouselSx = {},
  variant = 'compact',
}) {
  const enriched = contarItemsPorHabitacion(habitaciones, inventarios);
  const hasActions = !!(onEdit || onDelete);
  const tileVariant = hasActions ? 'full' : variant;

  if (!enriched.length) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ px: 0.125, display: 'block' }}>
        {emptyMessage}
      </Typography>
    );
  }

  const handleDelete = onDelete
    ? (habitacion) => {
        const nombre = getHabitacionTipoLabel(habitacion.tipo, habitacion.nombrePersonalizado);
        if (window.confirm(`¿Eliminar el ambiente "${nombre}"?`)) {
          onDelete(habitacion);
        }
      }
    : undefined;

  return (
    <MonedasCarousel sx={carouselSx}>
      {enriched.map((habitacion) => (
        <HabitacionTile
          key={habitacion.id || habitacion._id}
          habitacion={habitacion}
          variant={tileVariant}
          subtitle={buildHabitacionSubtitle(habitacion)}
          onEdit={onEdit}
          onDelete={handleDelete}
        />
      ))}
    </MonedasCarousel>
  );
}

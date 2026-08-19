import React from 'react';
import {
  BedOutlined as BedIcon,
  BathtubOutlined as BathIcon,
  KitchenOutlined as KitchenIcon,
  WeekendOutlined as LivingIcon,
  YardOutlined as GardenIcon,
  DeckOutlined as TerraceIcon,
  LocalLaundryServiceOutlined as LaundryIcon,
  HomeWorkOutlined as StudioIcon,
  MeetingRoomOutlined as RoomIcon,
} from '@mui/icons-material';

export function getHabitacionTipoMuiIcon(tipo, sx = { fontSize: 18 }) {
  switch (tipo) {
    case 'BAÑO':
    case 'TOILETTE':
      return <BathIcon sx={sx} />;
    case 'DORMITORIO_DOBLE':
    case 'DORMITORIO_SIMPLE':
      return <BedIcon sx={sx} />;
    case 'ESTUDIO':
      return <StudioIcon sx={sx} />;
    case 'COCINA':
    case 'DESPENSA':
      return <KitchenIcon sx={sx} />;
    case 'SALA_PRINCIPAL':
      return <LivingIcon sx={sx} />;
    case 'PATIO':
    case 'JARDIN':
      return <GardenIcon sx={sx} />;
    case 'TERRAZA':
      return <TerraceIcon sx={sx} />;
    case 'LAVADERO':
      return <LaundryIcon sx={sx} />;
    default:
      return <RoomIcon sx={sx} />;
  }
}

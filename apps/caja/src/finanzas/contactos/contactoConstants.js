import {
  PersonOutline,
  StorefrontOutlined,
  AccountBalanceOutlined,
  GroupsOutlined,
} from '@mui/icons-material';

export const TIPOS_CONTACTO = [
  { value: 'PERSONA', label: 'Persona', Icon: PersonOutline },
  { value: 'COMERCIO', label: 'Comercio', Icon: StorefrontOutlined },
  { value: 'ENTIDAD', label: 'Entidad', Icon: AccountBalanceOutlined },
  { value: 'OTRO', label: 'Otro', Icon: GroupsOutlined },
];

const TIPO_MAP = new Map(TIPOS_CONTACTO.map((t) => [t.value, t]));

export function getTipoContactoMeta(tipo) {
  return TIPO_MAP.get(tipo) || TIPO_MAP.get('OTRO');
}

export function getCategoriaEfectivaContacto(contacto) {
  if (!contacto) return null;
  return contacto.categoriaDefault || contacto.categoriaEgreso || contacto.categoriaIngreso || null;
}

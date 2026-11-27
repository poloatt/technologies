import React, { useCallback, useMemo } from 'react';
import { Box, IconButton, Tab, Tabs, TabScrollButton, Tooltip, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { FONT_SIZE } from '../../tipografia';

/**
 * Flecha de las pestañas de grupo: además de desplazar la barra, selecciona
 * el grupo anterior/siguiente. Si no hay vecino, mantiene el scroll por
 * defecto de MUI.
 */
function GroupScrollButton({ onStep, onClick, direction, ...other }) {
  const theme = useTheme();
  const isRtl = theme.direction === 'rtl';

  const handleClick = (event) => {
    const delta = (direction === 'left' ? -1 : 1) * (isRtl ? -1 : 1);
    if (onStep?.(delta)) return;
    onClick?.(event);
  };

  return <TabScrollButton {...other} direction={direction} onClick={handleClick} />;
}

const BASE_TABS_SX = {
  flexShrink: 0,
  bgcolor: 'background.default',
  minHeight: 40,
  borderBottom: 1,
  borderColor: 'divider',
  '& .MuiTab-root': {
    minHeight: 40,
    py: 1,
    px: 1.5,
    fontSize: FONT_SIZE.md,
    fontWeight: 600,
    textTransform: 'none',
  },
};

/**
 * Pestañas de grupo de hábitos (scroll horizontal; las flechas seleccionan
 * el grupo vecino). UX compartida entre el picker de rutinas y el gestor de hábitos.
 *
 * @param {{ value: string, label: string }[]} sections
 * @param {string} value — grupo activo
 * @param {(value: string) => void} onChange
 * @param {() => void} [onCreate] — muestra el botón "+" al final
 * @param {() => void} [onEdit] — muestra el lápiz (editar el grupo activo)
 */
export default function HabitGroupTabs({
  sections = [],
  value,
  onChange,
  onCreate,
  createLabel = 'Nuevo grupo',
  onEdit,
  editLabel = 'Editar grupo',
  sx,
}) {
  const stepSection = useCallback((delta) => {
    const index = sections.findIndex((section) => section.value === value);
    const next = index >= 0 ? sections[index + delta] : null;
    if (!next) return false;
    onChange?.(next.value);
    return true;
  }, [sections, value, onChange]);

  const tabScrollButtonProps = useMemo(() => ({ onStep: stepSection }), [stepSection]);
  const hasValue = sections.some((section) => section.value === value);

  const tabs = (
    <Tabs
      value={hasValue ? value : false}
      onChange={(_, next) => onChange?.(next)}
      variant="scrollable"
      scrollButtons="auto"
      ScrollButtonComponent={GroupScrollButton}
      TabScrollButtonProps={tabScrollButtonProps}
      allowScrollButtonsMobile
      sx={{
        ...BASE_TABS_SX,
        ...(onCreate || onEdit ? { flex: 1, minWidth: 0, borderBottom: 0 } : null),
        ...(onCreate || onEdit ? null : sx),
      }}
    >
      {sections.map((section) => (
        <Tab key={section.value} label={section.label} value={section.value} />
      ))}
    </Tabs>
  );

  if (!onCreate && !onEdit) return tabs;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        borderBottom: 1,
        borderColor: 'divider',
        ...sx,
      }}
    >
      {tabs}
      {onEdit ? (
        <Tooltip title={editLabel} arrow>
          <IconButton size="small" onClick={onEdit} aria-label={editLabel} sx={{ flexShrink: 0 }}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
      {onCreate ? (
        <Tooltip title={createLabel} arrow>
          <IconButton size="small" onClick={onCreate} aria-label={createLabel} sx={{ flexShrink: 0 }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
    </Box>
  );
}

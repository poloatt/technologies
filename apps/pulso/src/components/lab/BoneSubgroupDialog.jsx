import React, { useState } from 'react';
import { Box, Dialog, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CollapseChevron from '@shared/components/common/CollapseChevron';
import { hubSectionShellSx } from '@shared/styles/hubSectionStyles';
import BoneGroupThumb from './BoneGroupThumb';
import { taskFormHeaderActionIconSx } from '@shared/components/forms/tareaFormTokens';
import {
  TareaFormIcons,
  TareaFormPrimaryLine,
  TareaFormRow,
  TareaFormSecondaryLine,
} from '@shared/components/forms/tareaFormUi';

const DONE_TIPOS = new Set(['ESTUDIO', 'REVISION']);

function formatFecha(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusOf(controles, items, zona) {
  const zoneControls = (controles || []).filter((control) => control.zona === zona);
  const ids = new Set(zoneControls.map((control) => control.controlId));
  const related = (items || []).filter((item) => ids.has(item.controlId));
  const last = related
    .filter((item) => item.estado === 'HECHO' && DONE_TIPOS.has(item.tipo))
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] || null;
  const archivos = related.flatMap((item) => item.archivos || item.adjuntos || []);
  let estado = 'Sin datos';
  if (zoneControls.length) {
    if (zoneControls.some((control) => control.vencido)) estado = 'Vencido';
    else if (zoneControls.some((control) => control.pendiente)) estado = 'Pendiente';
    else estado = 'Al día';
  }
  return { estado, last, archivos };
}

export function SubgroupBoneList({
  zone,
  groups = [],
  boneName = '',
  selectedGroupId = null,
  expandBones = false,
  onSelectGroup,
  onSelectBone,
}) {
  const [openId, setOpenId] = useState(null);
  const toggle = (group) => {
    if (expandBones) setOpenId((current) => (current === group.id ? null : group.id));
    onSelectGroup?.(group.id);
  };

  return groups.map((group) => {
    const open = expandBones && openId === group.id;
    const marked = selectedGroupId === group.id;
    return (
      <Box key={group.id}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: marked ? '#121212' : 'transparent',
            color: 'text.secondary',
          }}
        >
          <Box
            component="button"
            type="button"
            aria-expanded={expandBones ? open : undefined}
            onClick={() => toggle(group)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flex: 1,
              minWidth: 0,
              textAlign: 'left',
              border: 0,
              bgcolor: 'transparent',
              color: 'inherit',
              py: 0.75,
              px: 0.5,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <BoneGroupThumb zone={zone} names={group.bones} />
            <Typography variant="body2" component="span" color="inherit">{group.label}</Typography>
            <Typography variant="caption" component="span" color="text.secondary">
              {group.bones.length} huesos
            </Typography>
          </Box>
          {expandBones ? (
            <CollapseChevron
              asButton
              expanded={open}
              aria-label={open ? `Cerrar huesos de ${group.label}` : `Ver huesos de ${group.label}`}
              onClick={(event) => {
                event.stopPropagation();
                toggle(group);
              }}
            />
          ) : null}
        </Box>
        {open && group.bones.map((name) => {
          const selected = name === boneName;
          return (
            <Box
              key={name}
              component="button"
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectBone?.(name)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                width: '100%',
                textAlign: 'left',
                border: 0,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: selected ? '#121212' : 'transparent',
                color: 'text.secondary',
                py: 0.75,
                pl: 4,
                pr: 0.5,
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              <BoneGroupThumb zone={zone} names={[name]} />
              <Typography variant="body2" component="span" color="inherit">{name}</Typography>
            </Box>
          );
        })}
      </Box>
    );
  });
}

export default function BoneSubgroupDialog({
  open,
  subgroup,
  zone,
  controles = [],
  items = [],
  boneName = '',
  onClose,
  onBoneClick,
  onGroupClick,
  groups = [],
}) {
  const { estado, last, archivos } = statusOf(controles, items, zone);
  const documents = archivos.length
    ? archivos.map((archivo, index) => ({
      key: archivo.id || archivo.nombre || index,
      title: archivo.nombre || archivo,
      meta: archivo.fecha ? formatFecha(archivo.fecha) : '',
    }))
    : [{ key: 'empty', title: 'Sin documentos', meta: 'Todavía no hay archivos' }];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      sx={{ zIndex: 1600 }}
      PaperProps={{
        elevation: 0,
        sx: {
          bgcolor: 'background.default',
          backgroundImage: 'none',
          borderRadius: 0,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ flex: 1, fontSize: '1.05rem', fontWeight: 500, pl: 1 }}>
          {subgroup?.label}
        </Typography>
        <IconButton aria-label="Cerrar" onClick={onClose} sx={taskFormHeaderActionIconSx()}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>
      <Box sx={{ px: 2, py: 2, overflow: 'auto' }}>
        <Box sx={{ ...hubSectionShellSx, mb: 1.5, bgcolor: '#121212' }}>
          <Box sx={{ px: 0.5, py: 0.25 }}>
            <TareaFormRow icon={TareaFormIcons.estado} compact>
              <TareaFormPrimaryLine>Estado</TareaFormPrimaryLine>
              <TareaFormSecondaryLine>{estado}</TareaFormSecondaryLine>
            </TareaFormRow>
          </Box>
        </Box>
        {last ? (
          <Box sx={{ ...hubSectionShellSx, mb: 1.5, px: 1.5, py: 1.25, bgcolor: '#121212' }}>
            <Typography variant="body2">Último estudio</Typography>
            <Typography variant="caption" color="text.secondary">
              {last.titulo} · {formatFecha(last.fecha)}
            </Typography>
          </Box>
        ) : null}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
          {documents.map((document) => (
            <Box key={document.key} sx={{ ...hubSectionShellSx, mb: 0, px: 1.5, py: 1.25, bgcolor: '#121212' }}>
              <Typography variant="body2">{document.title}</Typography>
              {document.meta ? (
                <Typography variant="caption" color="text.secondary">{document.meta}</Typography>
              ) : null}
            </Box>
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Subgrupos
        </Typography>
        <SubgroupBoneList
          key={zone}
          zone={zone}
          groups={groups}
          boneName={boneName}
          expandBones
          onSelectGroup={onGroupClick}
          onSelectBone={onBoneClick}
        />
      </Box>
    </Dialog>
  );
}
